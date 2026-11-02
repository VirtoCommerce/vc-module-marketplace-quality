using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using VirtoCommerce.MarketplaceQuality.Core;
using VirtoCommerce.MarketplaceQuality.Core.Models;
using VirtoCommerce.MarketplaceQuality.Core.PushNotifications;
using VirtoCommerce.MarketplaceQuality.Core.Services;
using VirtoCommerce.MarketplaceQuality.Data.VirtoOz;
using VirtoCommerce.Platform.Core.PushNotifications;
using VirtoCommerce.Platform.Core.Settings;

namespace VirtoCommerce.MarketplaceQuality.Data.Services;

/// <summary>
/// Runs the queued scoring runs: sends each entity to its AI expert and notifies the user when the run is over.
/// </summary>
public class QualityScoringWorker : BackgroundService
{
    /// <summary>
    /// Runs at a time per platform instance. VirtoOZ allows 10 concurrent requests per tenant, shared with the chat.
    /// </summary>
    public const int MaxConcurrency = 2;

    public const int MaxAttempts = 3;

    private static readonly TimeSpan _defaultRetryDelay = TimeSpan.FromSeconds(10);

    private readonly IQualityScoringQueue _queue;
    private readonly IServiceScopeFactory _serviceScopeFactory;
    private readonly IPushNotificationManager _pushNotificationManager;
    private readonly ISettingsManager _settingsManager;
    private readonly ILogger<QualityScoringWorker> _logger;

    public QualityScoringWorker(
        IQualityScoringQueue queue,
        IServiceScopeFactory serviceScopeFactory,
        IPushNotificationManager pushNotificationManager,
        ISettingsManager settingsManager,
        ILogger<QualityScoringWorker> logger)
    {
        _queue = queue;
        _serviceScopeFactory = serviceScopeFactory;
        _pushNotificationManager = pushNotificationManager;
        _settingsManager = settingsManager;
        _logger = logger;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        return Task.WhenAll(Enumerable.Range(0, MaxConcurrency).Select(_ => ConsumeAsync(stoppingToken)));
    }

    private async Task ConsumeAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var task in _queue.ReadAllAsync(stoppingToken))
            {
                await ProcessAsync(task, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // The platform is shutting down; queued runs are lost, the user can start them again
        }
    }

    protected virtual async Task ProcessAsync(QualityScoringTask task, CancellationToken stoppingToken)
    {
        var progress = task.Notification;

        try
        {
            // The first progress notification ("0 of N") is sent when the run is queued; this one follows each batch
            progress.TotalCount = task.EntityIds.Count;

            // A failed batch does not stop the others
            var batchSize = await GetBatchSizeAsync();
            foreach (var batch in task.EntityIds.Chunk(batchSize))
            {
                var error = await ProcessBatchAsync(task, batch, stoppingToken);
                if (error != null)
                {
                    progress.FailedCount += batch.Length;
                    if (!progress.Errors.Contains(error))
                    {
                        progress.Errors.Add(error);
                    }
                }

                progress.ProcessedCount += batch.Length;
                if (progress.ProcessedCount < progress.TotalCount)
                {
                    await SendProgressAsync(progress);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            progress.FailedCount = progress.TotalCount - progress.ProcessedCount + progress.FailedCount;
            progress.ProcessedCount = progress.TotalCount;
            progress.Errors.Add("Quality scoring was interrupted by the platform restart");
        }
        finally
        {
            _queue.Complete(task);

            // The outcome is a new notification rather than an update of the progress one, which the user may have already read
            await SendSafeAsync(progress.CreateFinal());
        }
    }

    protected virtual Task SendProgressAsync(QualityScoringPushNotification progress)
    {
        progress.Title = progress.GetProgressTitle();
        return SendSafeAsync(progress);
    }

    /// <summary>
    /// Read for every run, so a changed setting applies without a restart.
    /// </summary>
    protected virtual async Task<int> GetBatchSizeAsync()
    {
        var batchSize = await _settingsManager.GetValueAsync<int>(ModuleConstants.Settings.General.ScoringBatchSize);
        return Math.Clamp(batchSize, 1, QualityScoring.MaxEntities);
    }

    /// <returns>The error to show the user, or null when the batch is scored.</returns>
    protected virtual async Task<string> ProcessBatchAsync(QualityScoringTask task, IList<string> entityIds, CancellationToken stoppingToken)
    {
        try
        {
            await RunWithRetriesAsync(task, entityIds, stoppingToken);
            return null;
        }
        catch (VirtoOzException ex)
        {
            _logger.LogWarning("Quality scoring of {EntityType} {EntityIds} failed: {Error}", task.EntityType, entityIds, ex.Message);
            return ex.Message;
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !stoppingToken.IsCancellationRequested)
        {
            _logger.LogError(ex, "Quality scoring of {EntityType} {EntityIds} failed", task.EntityType, entityIds);
            return "Quality scoring failed";
        }
    }

    protected virtual async Task RunWithRetriesAsync(QualityScoringTask task, IList<string> entityIds, CancellationToken stoppingToken)
    {
        var message = new VirtoOzChatMessage
        {
            AgentId = task.Agent.AgentId,
            Message = task.Agent.Prompt,
            Locale = task.Locale,
            EntityType = task.EntityType,
            EntityIds = entityIds,
        };

        for (var attempt = 1; ; attempt++)
        {
            // Every attempt starts a new thread, so a failed attempt leaves nothing behind in the conversation
            message.ThreadId = Guid.NewGuid().ToString();

            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var client = scope.ServiceProvider.GetRequiredService<IVirtoOzChatClient>();
                await client.SendMessageAsync(message, task.AccessToken, stoppingToken);
                return;
            }
            catch (VirtoOzException ex) when (ex.IsTransient && attempt < MaxAttempts)
            {
                var delay = ex.RetryAfter ?? _defaultRetryDelay * attempt;
                _logger.LogInformation("Quality scoring of {EntityType} {EntityIds} will be retried in {Delay}: {Error}", task.EntityType, entityIds, delay, ex.Message);
                await Task.Delay(delay, stoppingToken);
            }
        }
    }

    private async Task SendSafeAsync(PushNotification notification)
    {
        try
        {
            await _pushNotificationManager.SendAsync(notification);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send the quality scoring push notification");
        }
    }
}

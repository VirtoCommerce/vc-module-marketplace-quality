using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using VirtoCommerce.AI.Core.Models;
using VirtoCommerce.AI.Core.Services;
using VirtoCommerce.MarketplaceQuality.Core;
using VirtoCommerce.MarketplaceQuality.Core.Models;
using VirtoCommerce.MarketplaceQuality.Core.PushNotifications;
using VirtoCommerce.MarketplaceQuality.Data.Services;
using VirtoCommerce.Platform.Core.PushNotifications;
using VirtoCommerce.Platform.Core.Settings;
using Xunit;

namespace VirtoCommerce.MarketplaceQuality.Tests;

[Trait("Category", "Unit")]
public class QualityScoringWorkerTests
{
    /// <summary>
    /// Batch size set in the module settings for the tests.
    /// </summary>
    private const int BatchSize = 3;

    private readonly QualityScoringQueue _queue = new();
    private readonly VirtoOzChatClientStub _chatClient = new();
    private readonly PushNotificationManagerStub _pushNotificationManager = new();
    private readonly SettingsManagerStub _settingsManager = new()
    {
        Values = { [ModuleConstants.Settings.General.ScoringBatchSize.Name] = BatchSize },
    };

    [Fact]
    public async Task Process_SendsTheEntityToItsAgent_WithTheUserToken()
    {
        // Arrange
        var task = CreateTask();

        // Act
        await CreateWorker().ProcessTaskAsync(task);

        // Assert
        var call = Assert.Single(_chatClient.Calls);
        Assert.Equal("seller-product-quality-expert", call.AgentId);
        Assert.Equal("Evaluate this product.", call.Message);
        Assert.False(string.IsNullOrEmpty(call.ThreadId));
        Assert.Equal("token-1", call.AccessToken);
    }

    [Fact]
    public async Task Process_SendsOneEntityAsADetailsContext()
    {
        // Arrange
        var task = CreateTask();

        // Act
        await CreateWorker().ProcessTaskAsync(task);

        // Assert
        var context = Assert.Single(_chatClient.Calls).Context;
        Assert.Equal("details", context.GetProperty("context_type").GetString());
        Assert.Equal("de-DE", context.GetProperty("locale").GetString());
        Assert.Equal("QualityScoring", context.GetProperty("blade").GetProperty("name").GetString());
        Assert.Equal("prod-1", context.GetProperty("item").GetProperty("id").GetString());
        Assert.Equal("SellerProduct", context.GetProperty("item").GetProperty("objectType").GetString());
        Assert.False(context.TryGetProperty("items", out _));
    }

    [Fact]
    public async Task Process_SendsSeveralEntitiesAsAListContext()
    {
        // Arrange
        var task = CreateTask("prod-1", "prod-2");

        // Act
        await CreateWorker().ProcessTaskAsync(task);

        // Assert
        var context = Assert.Single(_chatClient.Calls).Context;
        Assert.Equal("list", context.GetProperty("context_type").GetString());
        Assert.Equal("de-DE", context.GetProperty("locale").GetString());
        Assert.Equal("QualityScoring", context.GetProperty("blade").GetProperty("name").GetString());
        Assert.False(context.TryGetProperty("item", out _));
        var items = context.GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(["prod-1", "prod-2"], items.Select(x => x.GetProperty("id").GetString()));
        Assert.All(items, x => Assert.Equal("SellerProduct", x.GetProperty("objectType").GetString()));
    }

    [Fact]
    public async Task Process_SendsTheOutcomeAsANewNotificationOfTheRun()
    {
        // Arrange
        var task = CreateTask();

        // Act
        await CreateWorker().ProcessTaskAsync(task);

        // Assert
        // One item, one batch: no progress to report before the outcome
        var finished = Assert.Single(_pushNotificationManager.Sent);
        Assert.NotEqual("run-1", finished.Id);
        Assert.Equal("run-1", finished.RunId);
        Assert.Equal("seller-1", finished.Creator);
        Assert.Equal("Quality scoring is completed", finished.Title);
        Assert.NotNull(finished.Finished);
        Assert.Equal(1, finished.TotalCount);
        Assert.Equal(1, finished.ProcessedCount);
        Assert.Empty(finished.Errors);
    }

    [Fact]
    public async Task Process_ReportsTheErrorOfAFailedRun()
    {
        // Arrange
        _chatClient.Errors.Enqueue(new VirtoOzException("404: Agent not found"));

        // Act
        await CreateWorker().ProcessTaskAsync(CreateTask());

        // Assert
        var finished = _pushNotificationManager.Sent.Last();
        Assert.Equal("Quality scoring failed: 404: Agent not found", finished.Title);
        Assert.NotNull(finished.Finished);
        Assert.Equal(["404: Agent not found"], finished.Errors);
        Assert.Single(_chatClient.Calls);
    }

    [Fact]
    public async Task Process_HidesTheDetailsOfAnUnexpectedError()
    {
        // Arrange
        _chatClient.Errors.Enqueue(new InvalidOperationException("secret details"));

        // Act
        await CreateWorker().ProcessTaskAsync(CreateTask());

        // Assert
        Assert.Equal(["Quality scoring failed"], _pushNotificationManager.Sent.Last().Errors);
    }

    [Fact]
    public async Task Process_RetriesATransientError_InANewThread()
    {
        // Arrange
        _chatClient.Errors.Enqueue(new VirtoOzException("429: quota", isTransient: true, retryAfter: TimeSpan.Zero));

        // Act
        await CreateWorker().ProcessTaskAsync(CreateTask());

        // Assert
        Assert.Equal(2, _chatClient.Calls.Count);
        Assert.NotEqual(_chatClient.Calls[0].ThreadId, _chatClient.Calls[1].ThreadId);
        Assert.Empty(_pushNotificationManager.Sent.Last().Errors);
    }

    [Fact]
    public async Task Process_GivesUpAfterTheLastAttempt()
    {
        // Arrange
        for (var i = 0; i < QualityScoringWorker.MaxAttempts; i++)
        {
            _chatClient.Errors.Enqueue(new VirtoOzException($"503: busy {i}", isTransient: true, retryAfter: TimeSpan.Zero));
        }

        // Act
        await CreateWorker().ProcessTaskAsync(CreateTask());

        // Assert
        Assert.Equal(QualityScoringWorker.MaxAttempts, _chatClient.Calls.Count);
        Assert.Equal([$"503: busy {QualityScoringWorker.MaxAttempts - 1}"], _pushNotificationManager.Sent.Last().Errors);
    }

    [Fact]
    public async Task Process_ReleasesTheEntities_SoTheyCanBeScoredAgain()
    {
        // Arrange
        var task = CreateTask("prod-1", "prod-2");
        _queue.Enqueue(task);
        _chatClient.Errors.Enqueue(new VirtoOzException("failed"));
        var again = CreateTask("prod-1", "prod-2");

        // Act
        await CreateWorker().ProcessTaskAsync(task);
        _queue.Enqueue(again);

        // Assert
        Assert.Equal(["prod-1", "prod-2"], again.EntityIds);
    }

    // =========================================================================
    // Batches
    // =========================================================================
    [Fact]
    public async Task Process_SendsTheEntitiesInBatches()
    {
        // Arrange
        var entityIds = Enumerable.Range(1, BatchSize * 2 + 1).Select(i => $"prod-{i}").ToArray();

        // Act
        await CreateWorker().ProcessTaskAsync(CreateTask(entityIds));

        // Assert
        Assert.Equal(
            entityIds.Chunk(BatchSize).Select(x => x.ToList()),
            _chatClient.Calls.Select(x => x.GetEntityIds().ToList()));
        Assert.Equal(_chatClient.Calls.Count, _chatClient.Calls.Select(x => x.ThreadId).Distinct().Count());

        var finished = _pushNotificationManager.Sent.Last();
        Assert.Equal($"Quality scoring of {entityIds.Length} items is completed", finished.Title);
        Assert.Equal(0, finished.FailedCount);
    }

    [Fact]
    public async Task Process_UpdatesTheProgressNotificationAfterEachBatchButTheLast()
    {
        // Arrange
        var entityIds = Enumerable.Range(1, BatchSize * 2 + 1).Select(i => $"prod-{i}").ToArray();

        // Act
        await CreateWorker().ProcessTaskAsync(CreateTask(entityIds));

        // Assert
        var progress = _pushNotificationManager.Sent.SkipLast(1).ToList();
        Assert.All(progress, x =>
        {
            Assert.Equal("run-1", x.Id);
            Assert.Equal("run-1", x.RunId);
            Assert.Null(x.Finished);
            Assert.Equal(entityIds.Length, x.TotalCount);
        });
        Assert.Equal([BatchSize, BatchSize * 2], progress.Select(x => x.ProcessedCount));
        Assert.Equal(
            [$"Quality scoring: {BatchSize} of {entityIds.Length} items…", $"Quality scoring: {BatchSize * 2} of {entityIds.Length} items…"],
            progress.Select(x => x.Title));

        var finished = _pushNotificationManager.Sent.Last();
        Assert.NotEqual("run-1", finished.Id);
        Assert.Equal("run-1", finished.RunId);
        Assert.Equal(entityIds.Length, finished.ProcessedCount);
    }

    [Theory]
    [InlineData(null, 5)] // not set: the setting's default
    [InlineData(0, 1)]
    [InlineData(-3, 1)]
    [InlineData(1000, QualityScoring.MaxEntities)]
    public async Task Process_TakesTheBatchSizeFromTheSettings_WithinLimits(int? setting, int expectedBatchSize)
    {
        // Arrange
        _settingsManager.Values[ModuleConstants.Settings.General.ScoringBatchSize.Name] = setting;
        var entityIds = Enumerable.Range(1, QualityScoring.MaxEntities + 1).Select(i => $"prod-{i}").ToArray();

        // Act
        await CreateWorker().ProcessTaskAsync(CreateTask(entityIds));

        // Assert
        Assert.Equal(expectedBatchSize, _chatClient.Calls[0].GetEntityIds().Count);
    }

    [Fact]
    public async Task Process_GoesOnAfterAFailedBatch_AndReportsTheFailedItems()
    {
        // Arrange
        var entityIds = Enumerable.Range(1, BatchSize + 2).Select(i => $"prod-{i}").ToArray();
        _chatClient.Errors.Enqueue(new VirtoOzException("Tool failed"));

        // Act
        await CreateWorker().ProcessTaskAsync(CreateTask(entityIds));

        // Assert
        Assert.Equal(2, _chatClient.Calls.Count);
        var finished = _pushNotificationManager.Sent.Last();
        Assert.Equal(BatchSize, finished.FailedCount);
        Assert.Equal(
            $"Quality scoring failed for {BatchSize} of {entityIds.Length} items: Tool failed",
            finished.Title);
    }

    [Fact]
    public async Task Process_ReportsTheSameErrorOfSeveralBatchesOnce()
    {
        // Arrange
        var entityIds = Enumerable.Range(1, BatchSize + 1).Select(i => $"prod-{i}").ToArray();
        _chatClient.Errors.Enqueue(new VirtoOzException("the session has expired"));
        _chatClient.Errors.Enqueue(new VirtoOzException("the session has expired"));

        // Act
        await CreateWorker().ProcessTaskAsync(CreateTask(entityIds));

        // Assert
        var finished = _pushNotificationManager.Sent.Last();
        Assert.Equal(entityIds.Length, finished.FailedCount);
        Assert.Equal(["the session has expired"], finished.Errors);
    }

    private TestableWorker CreateWorker()
    {
        var services = new ServiceCollection();
        services.AddSingleton<IVirtoOzChatClient>(_chatClient);
        var scopeFactory = services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>();

        return new TestableWorker(_queue, scopeFactory, _pushNotificationManager, _settingsManager);
    }

    private static QualityScoringTask CreateTask(params string[] entityIds)
    {
        if (entityIds.Length == 0)
        {
            entityIds = ["prod-1"];
        }

        return new QualityScoringTask
        {
            EntityType = "SellerProduct",
            EntityIds = [.. entityIds],
            Locale = "de-DE",
            Agent = new QualityScoringAgent { AgentId = "seller-product-quality-expert", Prompt = "Evaluate this product." },
            AccessToken = "token-1",
            // As queued by the command handler: the progress notification's id is the run id
            Notification = new QualityScoringPushNotification("seller-1")
            {
                Id = "run-1",
                RunId = "run-1",
                EntityIds = [.. entityIds],
                TotalCount = entityIds.Length,
            },
        };
    }

    private sealed class TestableWorker(
        QualityScoringQueue queue,
        IServiceScopeFactory scopeFactory,
        IPushNotificationManager pushNotificationManager,
        ISettingsManager settingsManager)
        : QualityScoringWorker(queue, scopeFactory, pushNotificationManager, settingsManager, NullLogger<QualityScoringWorker>.Instance)
    {
        public Task ProcessTaskAsync(QualityScoringTask task) => ProcessAsync(task, TestContext.Current.CancellationToken);
    }
}

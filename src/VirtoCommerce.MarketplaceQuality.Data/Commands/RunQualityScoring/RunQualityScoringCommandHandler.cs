using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using VirtoCommerce.MarketplaceQuality.Core.Models;
using VirtoCommerce.MarketplaceQuality.Core.PushNotifications;
using VirtoCommerce.MarketplaceQuality.Core.Services;
using VirtoCommerce.MarketplaceVendorModule.Core.Common;
using VirtoCommerce.Platform.Core.PushNotifications;
using VirtoCommerce.Platform.Core.Security;

namespace VirtoCommerce.MarketplaceQuality.Data.Commands;

public class RunQualityScoringCommandHandler : ICommandHandler<RunQualityScoringCommand, QualityScoringPushNotification>
{
    private const string BearerPrefix = "Bearer ";

    private readonly IUserNameResolver _userNameResolver;
    private readonly IQualityScoringQueue _scoringQueue;
    private readonly IPushNotificationManager _pushNotificationManager;

    public RunQualityScoringCommandHandler(
        IUserNameResolver userNameResolver,
        IQualityScoringQueue scoringQueue,
        IPushNotificationManager pushNotificationManager
        )
    {
        _userNameResolver = userNameResolver;
        _scoringQueue = scoringQueue;
        _pushNotificationManager = pushNotificationManager;
    }

    public virtual async Task<QualityScoringPushNotification> Handle(RunQualityScoringCommand request, CancellationToken cancellationToken)
    {
        var entityIds = request?.EntityIds?.Where(x => !string.IsNullOrEmpty(x)).Distinct().ToList() ?? [];

        if (entityIds.Count == 0 ||
            request.EntityType == null ||
            !QualityScoring.Agents.TryGetValue(request.EntityType, out var agent))
        {
            throw new ArgumentException("Unknown entities to score");
        }

        if (entityIds.Count > QualityScoring.MaxEntities)
        {
            throw new ArgumentException($"Up to {QualityScoring.MaxEntities} items can be scored at once");
        }

        var creator = !string.IsNullOrEmpty(request.SellerId) ? request.SellerId : _userNameResolver.GetCurrentUserName();
        var notification = new QualityScoringPushNotification(creator)
        {
            EntityType = request.EntityType,
        };
        notification.RunId = notification.Id;

        var scoringTask = new QualityScoringTask
        {
            EntityType = request.EntityType,
            EntityIds = entityIds,
            Locale = !string.IsNullOrEmpty(request.Locale) ? request.Locale : "en",
            Agent = agent,
            AccessToken = request.Authorization[BearerPrefix.Length..].Trim(),
            Notification = notification,
        };

        var result = _scoringQueue.Enqueue(scoringTask);

        switch (result)
        {
            case QualityScoringEnqueueResult.QueueFull:
                throw new InvalidOperationException("Too many quality scoring runs, try again later");
        }

        notification.EntityIds = scoringTask.EntityIds;
        notification.TotalCount = scoringTask.EntityIds.Count;
        notification.Title = notification.GetProgressTitle();

        await _pushNotificationManager.SendAsync(notification);

        return notification;
    }

}

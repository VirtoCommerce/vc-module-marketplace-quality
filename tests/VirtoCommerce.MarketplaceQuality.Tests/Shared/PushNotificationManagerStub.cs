using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using VirtoCommerce.MarketplaceQuality.Core.PushNotifications;
using VirtoCommerce.Platform.Core.PushNotifications;

namespace VirtoCommerce.MarketplaceQuality.Tests;

/// <summary>
/// Records a snapshot of each sent notification, since the worker sends the same progress notification object after every batch.
/// </summary>
public class PushNotificationManagerStub : IPushNotificationManager
{
    public List<QualityScoringPushNotification> Sent { get; } = [];

    public PushNotificationSearchResult SearchNotifies(string userId, PushNotificationSearchCriteria criteria)
    {
        throw new NotImplementedException();
    }

    public void Send(PushNotification notification)
    {
        throw new NotImplementedException();
    }

    public Task SendAsync(PushNotification notification)
    {
        var source = (QualityScoringPushNotification)notification;
        Sent.Add(new QualityScoringPushNotification(source.Creator)
        {
            Id = source.Id,
            RunId = source.RunId,
            Title = source.Title,
            Finished = source.Finished,
            TotalCount = source.TotalCount,
            ProcessedCount = source.ProcessedCount,
            FailedCount = source.FailedCount,
            Errors = source.Errors.ToList(),
        });

        return Task.CompletedTask;
    }
}

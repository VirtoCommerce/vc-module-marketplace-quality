using System;
using System.Collections.Generic;
using System.Linq;
using VirtoCommerce.Platform.Core.PushNotifications;

namespace VirtoCommerce.MarketplaceQuality.Core.PushNotifications;

public class QualityScoringPushNotification : PushNotification
{
    public QualityScoringPushNotification(string creator)
        : base(creator)
    {
    }

    public string RunId { get; set; }

    public string EntityType { get; set; }

    public IList<string> EntityIds { get; set; } = new List<string>();

    public int TotalCount { get; set; }

    public int ProcessedCount { get; set; }

    public int FailedCount { get; set; }

    public DateTime? Finished { get; set; }

    public ICollection<string> Errors { get; set; } = new List<string>();

    public string GetProgressTitle()
    {
        return TotalCount == 1
            ? "Quality scoring is running…"
            : $"Quality scoring: {ProcessedCount} of {TotalCount} items…";
    }

    public string GetFinalTitle()
    {
        if (FailedCount == 0)
        {
            return TotalCount == 1 ? "Quality scoring is completed" : $"Quality scoring of {TotalCount} items is completed";
        }

        var failed = TotalCount == 1 ? "Quality scoring failed" : $"Quality scoring failed for {FailedCount} of {TotalCount} items";
        return $"{failed}: {Errors.FirstOrDefault()}";
    }

    public QualityScoringPushNotification CreateFinal()
    {
        return new QualityScoringPushNotification(Creator)
        {
            RunId = RunId,
            EntityType = EntityType,
            EntityIds = EntityIds.ToList(),
            TotalCount = TotalCount,
            ProcessedCount = ProcessedCount,
            FailedCount = FailedCount,
            Errors = Errors.ToList(),
            Finished = DateTime.UtcNow,
            Title = GetFinalTitle(),
        };
    }
}

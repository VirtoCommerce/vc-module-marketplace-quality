using System.Collections.Generic;
using System.Linq;
using VirtoCommerce.MarketplaceQuality.Core.PushNotifications;

namespace VirtoCommerce.MarketplaceQuality.Core.Models;

public class QualityScoringTask
{
    public string EntityType { get; set; }

    public IList<string> EntityIds { get; set; } = new List<string>();

    public string Locale { get; set; }

    public QualityScoringAgent Agent { get; set; }

    /// <summary>
    /// Access token of the user who started the run. The expert reads and saves the data on the user's behalf,
    /// so it sees only what the user may see. The token is kept in memory only and never persisted.
    /// </summary>
    public string AccessToken { get; set; }

    /// <summary>
    /// The run's progress notification; its id is the run id.
    /// </summary>
    public QualityScoringPushNotification Notification { get; set; }

    public string RunId => Notification?.RunId;

    public static string GetKey(string entityType, string entityId) => $"{entityType}|{entityId}";

    public IEnumerable<string> GetKeys() => EntityIds.Select(entityId => GetKey(EntityType, entityId));
}

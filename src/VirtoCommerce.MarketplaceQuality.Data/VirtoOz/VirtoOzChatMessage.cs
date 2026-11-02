using System.Collections.Generic;

namespace VirtoCommerce.MarketplaceQuality.Data.VirtoOz;

/// <summary>
/// A message sent directly to one agent, about entities of one type selected in the vendor portal.
/// </summary>
public class VirtoOzChatMessage
{
    public string AgentId { get; set; }

    public string Message { get; set; }

    public string ThreadId { get; set; }

    public string Locale { get; set; }

    public string EntityType { get; set; }

    public IList<string> EntityIds { get; set; } = new List<string>();
}

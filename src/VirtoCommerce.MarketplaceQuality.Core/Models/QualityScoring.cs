using System.Collections.Generic;
using static VirtoCommerce.MarketplaceQuality.Core.ModuleConstants;

namespace VirtoCommerce.MarketplaceQuality.Core.Models;

public static class QualityScoring
{
    public static IReadOnlyDictionary<string, QualityScoringAgent> Agents { get; } = new Dictionary<string, QualityScoringAgent>
    {
        [QualityEntityType.SellerProduct] = new QualityScoringAgent
        {
            AgentId = "seller-product-quality-expert",
            Prompt = "Evaluate every product from the context against all seller product quality targets."
        },

        [QualityEntityType.Offer] = new QualityScoringAgent
        {
            AgentId = "offer-quality-expert",
            Prompt = "Evaluate every offer from the context against all offer quality targets."
        },
    };

    public const int MaxEntities = 100;
}

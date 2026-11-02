using VirtoCommerce.MarketplaceQuality.Core.PushNotifications;
using VirtoCommerce.MarketplaceVendorModule.Core.Common;
using VirtoCommerce.MarketplaceVendorModule.Core.Domains;

namespace VirtoCommerce.MarketplaceQuality.Data.Queries;

public class GetQualityScoringRunsQuery : IQuery<QualityScoringPushNotification[]>, IHasSellerId
{
    public string SellerId { get; set; }
    public string SellerName { get; set; }
}

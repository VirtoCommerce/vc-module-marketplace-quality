using System.Collections.Generic;
using VirtoCommerce.MarketplaceQuality.Core.PushNotifications;
using VirtoCommerce.MarketplaceVendorModule.Core.Common;
using VirtoCommerce.MarketplaceVendorModule.Core.Domains;

namespace VirtoCommerce.MarketplaceQuality.Data.Commands;

public class RunQualityScoringCommand : ICommand<QualityScoringPushNotification>, IHasSellerId
{
    public string SellerId { get; set; }
    public string SellerName { get; set; }

    public string EntityType { get; set; }
    public IList<string> EntityIds { get; set; }

    /// <summary>
    /// UI language of the user; the expert answers in it.
    /// </summary>
    public string Locale { get; set; }

    public string Authorization { get; set; }
}

using System.Collections.Generic;
using System.Threading.Tasks;

namespace VirtoCommerce.MarketplaceQuality.Core.Services;

public interface IMarketplaceQualityService
{
    Task<IList<string>> GetQualityTargetNamesAsync();
}

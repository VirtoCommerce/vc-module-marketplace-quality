using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using VirtoCommerce.MarketplaceQuality.Core.Services;
using VirtoCommerce.MarketplaceVendorModule.Core.Common;

namespace VirtoCommerce.MarketplaceQuality.Data.Queries;

public class GetTargetNamesQueryHandler : IQueryHandler<GetTargetNamesQuery, IList<string>>
{
    private readonly IMarketplaceQualityService _marketplaceQualityService;

    public GetTargetNamesQueryHandler(
        IMarketplaceQualityService marketplaceQualityService
        )
    {
        _marketplaceQualityService = marketplaceQualityService;
    }

    public virtual async Task<IList<string>> Handle(GetTargetNamesQuery request, CancellationToken cancellationToken)
    {
        var result = await _marketplaceQualityService.GetQualityTargetNamesAsync();

        return result;
    }
}

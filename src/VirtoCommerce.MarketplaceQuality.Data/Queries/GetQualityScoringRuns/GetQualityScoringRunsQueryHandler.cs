using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using VirtoCommerce.MarketplaceQuality.Core.PushNotifications;
using VirtoCommerce.MarketplaceQuality.Core.Services;
using VirtoCommerce.MarketplaceVendorModule.Core.Common;
using VirtoCommerce.Platform.Core.Security;

namespace VirtoCommerce.MarketplaceQuality.Data.Queries;

public class GetQualityScoringRunsQueryHandler : IQueryHandler<GetQualityScoringRunsQuery, QualityScoringPushNotification[]>
{
    private readonly IQualityScoringQueue _scoringQueue;
    private readonly IUserNameResolver _userNameResolver;

    public GetQualityScoringRunsQueryHandler(
        IQualityScoringQueue scoringQueue,
        IUserNameResolver userNameResolver
        )
    {
        _scoringQueue = scoringQueue;
        _userNameResolver = userNameResolver;
    }

    public virtual async Task<QualityScoringPushNotification[]> Handle(GetQualityScoringRunsQuery request, CancellationToken cancellationToken)
    {
        var creator = !string.IsNullOrEmpty(request.SellerId) ? request.SellerId : _userNameResolver.GetCurrentUserName();
        var result = _scoringQueue.GetActiveRuns().Select(x => x.Notification).Where(x => x.Creator == creator).ToArray();

        return result;
    }
}

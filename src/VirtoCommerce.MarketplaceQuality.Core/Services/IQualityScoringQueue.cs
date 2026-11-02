using System.Collections.Generic;
using System.Threading;
using VirtoCommerce.MarketplaceQuality.Core.Models;

namespace VirtoCommerce.MarketplaceQuality.Core.Services;

public interface IQualityScoringQueue
{
    QualityScoringEnqueueResult Enqueue(QualityScoringTask task);

    IAsyncEnumerable<QualityScoringTask> ReadAllAsync(CancellationToken cancellationToken);

    IList<QualityScoringTask> GetActiveRuns();

    void Complete(QualityScoringTask task);
}

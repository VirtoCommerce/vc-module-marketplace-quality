using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Channels;
using VirtoCommerce.MarketplaceQuality.Core.Models;
using VirtoCommerce.MarketplaceQuality.Core.Services;

namespace VirtoCommerce.MarketplaceQuality.Data.Services;

public class QualityScoringQueue : IQualityScoringQueue
{
    /// <summary>
    /// Runs waiting for the worker.
    /// </summary>
    public const int Capacity = 100;

    private readonly Channel<QualityScoringTask> _channel = Channel.CreateBounded<QualityScoringTask>(Capacity);
    private readonly ConcurrentDictionary<string, byte> _activeKeys = new();
    private readonly ConcurrentDictionary<QualityScoringTask, byte> _activeRuns = new();

    public virtual QualityScoringEnqueueResult Enqueue(QualityScoringTask task)
    {
        task.EntityIds = task.EntityIds
            .Where(entityId => _activeKeys.TryAdd(QualityScoringTask.GetKey(task.EntityType, entityId), 0))
            .ToList();

        _activeRuns.TryAdd(task, 0);

        if (!_channel.Writer.TryWrite(task))
        {
            Complete(task);
            return QualityScoringEnqueueResult.QueueFull;
        }

        return QualityScoringEnqueueResult.Queued;
    }

    public virtual IAsyncEnumerable<QualityScoringTask> ReadAllAsync(CancellationToken cancellationToken)
    {
        return _channel.Reader.ReadAllAsync(cancellationToken);
    }

    public virtual IList<QualityScoringTask> GetActiveRuns()
    {
        return _activeRuns.Keys.ToList();
    }

    public virtual void Complete(QualityScoringTask task)
    {
        _activeRuns.TryRemove(task, out _);

        foreach (var key in task.GetKeys())
        {
            _activeKeys.TryRemove(key, out _);
        }
    }
}

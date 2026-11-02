using System.Linq;
using System.Threading.Tasks;
using VirtoCommerce.MarketplaceQuality.Core.Models;
using VirtoCommerce.MarketplaceQuality.Core.Services;
using VirtoCommerce.MarketplaceQuality.Data.Services;
using Xunit;

namespace VirtoCommerce.MarketplaceQuality.Tests;

[Trait("Category", "Unit")]
public class QualityScoringQueueTests
{
    [Fact]
    public async Task Enqueue_QueuesTheTaskForTheWorker()
    {
        // Arrange
        var queue = new QualityScoringQueue();
        var task = CreateTask("prod-1", "prod-2");

        // Act
        var result = queue.Enqueue(task);

        // Assert
        Assert.Equal(QualityScoringEnqueueResult.Queued, result);
        await using var reader = queue.ReadAllAsync(TestContext.Current.CancellationToken).GetAsyncEnumerator(TestContext.Current.CancellationToken);
        Assert.True(await reader.MoveNextAsync());
        Assert.Same(task, reader.Current);
        Assert.Equal(["prod-1", "prod-2"], reader.Current.EntityIds);
    }

    [Fact]
    public void Enqueue_QueuesAnEmptyRun_WhenAllEntitiesAreInAnotherRun_UntilThatRunIsCompleted()
    {
        // Arrange
        var queue = new QualityScoringQueue();
        var task = CreateTask("prod-1", "prod-2");
        queue.Enqueue(task);
        var duplicate = CreateTask("prod-2", "prod-1");

        // Act
        var result = queue.Enqueue(duplicate);

        // Assert
        Assert.Equal(QualityScoringEnqueueResult.Queued, result);
        Assert.Empty(duplicate.EntityIds);

        // Act
        queue.Complete(task);
        var again = CreateTask("prod-1", "prod-2");
        queue.Enqueue(again);

        // Assert
        Assert.Equal(["prod-1", "prod-2"], again.EntityIds);
    }

    [Fact]
    public void Enqueue_LeavesOutTheEntitiesOfAnotherRun()
    {
        // Arrange
        var queue = new QualityScoringQueue();
        queue.Enqueue(CreateTask("prod-1", "prod-2"));
        var task = CreateTask("prod-2", "prod-3");

        // Act
        var result = queue.Enqueue(task);

        // Assert
        Assert.Equal(QualityScoringEnqueueResult.Queued, result);
        Assert.Equal(["prod-3"], task.EntityIds);
    }

    [Fact]
    public void Complete_ReleasesOnlyTheEntitiesOfItsRun()
    {
        // Arrange
        var queue = new QualityScoringQueue();
        queue.Enqueue(CreateTask("prod-1"));
        var task = CreateTask("prod-1", "prod-2");
        queue.Enqueue(task);
        var stillRunning = CreateTask("prod-1");
        var released = CreateTask("prod-2");

        // Act
        queue.Complete(task);
        queue.Enqueue(stillRunning);
        queue.Enqueue(released);

        // Assert
        Assert.Empty(stillRunning.EntityIds);
        Assert.Equal(["prod-2"], released.EntityIds);
    }

    [Fact]
    public void GetActiveRuns_HasTheQueuedRuns_UntilTheyAreCompleted()
    {
        // Arrange
        var queue = new QualityScoringQueue();
        var first = CreateTask("prod-1");
        var second = CreateTask("prod-2");
        queue.Enqueue(first);
        queue.Enqueue(second);

        // Act
        var active = queue.GetActiveRuns();

        // Assert
        Assert.Equal([first, second], active.OrderBy(x => x.EntityIds[0]));

        // Act
        queue.Complete(first);

        // Assert
        Assert.Equal([second], queue.GetActiveRuns());
    }

    [Fact]
    public void Enqueue_KeepsEntityTypesApart()
    {
        // Arrange
        var queue = new QualityScoringQueue();
        queue.Enqueue(CreateTask("SellerProduct", ["id-1"]));
        var offer = CreateTask("Offer", ["id-1"]);

        // Act
        var result = queue.Enqueue(offer);

        // Assert
        Assert.Equal(QualityScoringEnqueueResult.Queued, result);
        Assert.Equal(["id-1"], offer.EntityIds);
    }

    [Fact]
    public void Enqueue_RejectsTasksOverCapacity_AndDoesNotHoldTheirEntities()
    {
        // Arrange
        var queue = new QualityScoringQueue();
        for (var i = 0; i < QualityScoringQueue.Capacity; i++)
        {
            queue.Enqueue(CreateTask($"prod-{i}"));
        }

        // Act
        var first = queue.Enqueue(CreateTask("extra"));
        var second = queue.Enqueue(CreateTask("extra"));

        // Assert
        Assert.Equal(QualityScoringEnqueueResult.QueueFull, first);
        Assert.Equal(QualityScoringEnqueueResult.QueueFull, second);
        Assert.Equal(QualityScoringQueue.Capacity, queue.GetActiveRuns().Count);
    }

    private static QualityScoringTask CreateTask(params string[] entityIds)
    {
        return CreateTask("SellerProduct", entityIds);
    }

    private static QualityScoringTask CreateTask(string entityType, string[] entityIds)
    {
        return new QualityScoringTask { EntityType = entityType, EntityIds = [.. entityIds] };
    }
}

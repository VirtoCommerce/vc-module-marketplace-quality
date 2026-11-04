using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using VirtoCommerce.AI.Core.Models;
using VirtoCommerce.AI.Core.Services;

namespace VirtoCommerce.MarketplaceQuality.Tests;

/// <summary>
/// Records the sent messages; fails a call with the next exception of <see cref="Errors"/>, or succeeds when none is left.
/// </summary>
public class VirtoOzChatClientStub : IVirtoOzChatClient
{
    public List<VirtoOzChatClientCall> Calls { get; } = [];

    public Queue<Exception> Errors { get; } = new();

    public Task SendMessageAsync(VirtoOzChatMessage message, string accessToken, CancellationToken cancellationToken)
    {
        // A snapshot, since the worker sends the same message object again with a new thread id
        Calls.Add(new VirtoOzChatClientCall(
            message.AgentId,
            message.Message,
            message.ThreadId,
            JsonSerializer.SerializeToElement(message.Context),
            accessToken));

        return Errors.TryDequeue(out var exception) ? Task.FromException(exception) : Task.CompletedTask;
    }
}

public record VirtoOzChatClientCall(string AgentId, string Message, string ThreadId, JsonElement Context, string AccessToken)
{
    /// <summary>
    /// The ids of the context: the item of a details context or the items of a list context.
    /// </summary>
    public IList<string> GetEntityIds()
    {
        var ids = new List<string>();

        if (Context.TryGetProperty("item", out var item))
        {
            ids.Add(item.GetProperty("id").GetString());
        }

        if (Context.TryGetProperty("items", out var items))
        {
            foreach (var x in items.EnumerateArray())
            {
                ids.Add(x.GetProperty("id").GetString());
            }
        }

        return ids;
    }
}

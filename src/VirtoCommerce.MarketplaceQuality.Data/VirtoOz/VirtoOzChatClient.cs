using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using VirtoCommerce.MarketplaceVendorModule.Core;

namespace VirtoCommerce.MarketplaceQuality.Data.VirtoOz;

public class VirtoOzChatClient : IVirtoOzChatClient
{
    /// <summary>
    /// Longer than the VirtoOZ run timeout (5 minutes by default), so VirtoOZ reports its own timeout first.
    /// </summary>
    public static readonly TimeSpan RequestTimeout = TimeSpan.FromMinutes(6);

    /// <summary>
    /// VirtoOZ sends a heartbeat after 20 seconds without output, so a longer silence means the stream is dead.
    /// </summary>
    public static readonly TimeSpan StreamIdleTimeout = TimeSpan.FromSeconds(60);

    // Stream error codes worth retrying: the LLM provider or VirtoOZ is overloaded or unavailable.
    private static readonly string[] _transientErrorCodes =
    [
        "AI_OVERLOADED",
        "AI_RATE_LIMIT",
        "AI_UNAVAILABLE",
        "AI_SERVER_ERROR",
        "AI_CONNECTION_ERROR",
        "RATE_LIMITED",
    ];

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly HttpClient _httpClient;
    private readonly MarketplaceOptions _marketplaceOptions;

    public VirtoOzChatClient(HttpClient httpClient, IOptions<MarketplaceOptions> marketplaceOptions)
    {
        _httpClient = httpClient;
        _marketplaceOptions = marketplaceOptions.Value;
    }

    public virtual async Task SendMessageAsync(VirtoOzChatMessage message, string accessToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(_marketplaceOptions.AiAssistantUrl))
        {
            throw new VirtoOzException("AI assistant URL is not configured (Marketplace:AiAssistantUrl)");
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(new Uri(_marketplaceOptions.AiAssistantUrl), "/api/chat"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Content = JsonContent.Create(CreateBody(message), options: _jsonOptions);

        using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            throw new VirtoOzException("the session has expired, sign in again and retry");
        }

        if (!response.IsSuccessStatusCode)
        {
            // 404 unknown agent, 422 malformed request, 429 quota exceeded, 503 agent failed to start
            var text = await response.Content.ReadAsStringAsync(cancellationToken);
            var isTransient = response.StatusCode is HttpStatusCode.TooManyRequests or >= HttpStatusCode.InternalServerError;
            throw new VirtoOzException($"{(int)response.StatusCode}: {text}", isTransient, response.Headers.RetryAfter?.Delta);
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        await ReadEventsAsync(stream, cancellationToken);
    }

    protected virtual object CreateBody(VirtoOzChatMessage message)
    {
        // The context is shaped after the vendor portal blades: the details blade of one entity, or a list blade with selected rows
        var items = message.EntityIds.Select(entityId => new { id = entityId, objectType = message.EntityType }).ToList();
        var blade = new { id = "quality-scoring", name = "QualityScoring", title = "Quality scoring" };

        object context = items.Count == 1
            ? new { context_type = "details", locale = message.Locale, blade, item = items[0] }
            : new { context_type = "list", locale = message.Locale, blade, items };

        return new
        {
            type = "message",
            agent_id = message.AgentId,
            message = message.Message,
            thread_id = message.ThreadId,
            context,
        };
    }

    // The response is NDJSON: one event per line, "done" always last, errors reported as "error" events.
    private static async Task ReadEventsAsync(Stream stream, CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(stream);
        using var idleCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

        string errorCode = null;
        string errorMessage = null;

        for (;;)
        {
            idleCancellation.CancelAfter(StreamIdleTimeout);

            string line;
            try
            {
                line = await reader.ReadLineAsync(idleCancellation.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                throw new VirtoOzException($"AI assistant sent nothing for {StreamIdleTimeout.TotalSeconds} seconds");
            }

            if (line == null)
            {
                throw new VirtoOzException("AI assistant closed the connection before the run was over");
            }

            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            using var json = JsonDocument.Parse(line);
            var root = json.RootElement;

            switch (GetString(root, "type"))
            {
                case "error":
                    errorCode = GetString(root, "code");
                    errorMessage = GetString(root, "message");
                    break;
                case "done":
                    if (errorCode != null || errorMessage != null)
                    {
                        throw new VirtoOzException(errorMessage ?? errorCode, Array.IndexOf(_transientErrorCodes, errorCode) >= 0);
                    }
                    return;
            }
        }
    }

    private static string GetString(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;
    }
}

using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using VirtoCommerce.MarketplaceQuality.Data.VirtoOz;
using VirtoCommerce.MarketplaceVendorModule.Core;
using Xunit;

namespace VirtoCommerce.MarketplaceQuality.Tests;

[Trait("Category", "Unit")]
public class VirtoOzChatClientTests
{
    private static readonly VirtoOzChatMessage _message = new()
    {
        AgentId = "seller-product-quality-expert",
        Message = "Evaluate this product against all seller product quality targets.",
        ThreadId = "thread-1",
        Locale = "de-DE",
        EntityType = "VirtoCommerce.MarketplaceVendorModule.Core.Domains.SellerProduct",
        EntityIds = ["prod-1"],
    };

    [Fact]
    public async Task SendMessage_PostsTheMessageToTheAgent_WithTheUserToken()
    {
        // Arrange
        var handler = new StubHandler(_ => Ndjson("""{"type":"token","content":"ok"}""", """{"type":"done"}"""));

        // Act
        await CreateClient(handler).SendMessageAsync(_message, "token-1", TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal(HttpMethod.Post, handler.Request.Method);
        Assert.Equal("https://virtooz.example.com/api/chat", handler.Request.RequestUri!.ToString());
        Assert.Equal("Bearer token-1", handler.Request.Headers.Authorization!.ToString());

        using var body = JsonDocument.Parse(handler.RequestBody);
        var root = body.RootElement;
        Assert.Equal("message", root.GetProperty("type").GetString());
        Assert.Equal("seller-product-quality-expert", root.GetProperty("agent_id").GetString());
        Assert.Equal(_message.Message, root.GetProperty("message").GetString());
        Assert.Equal("thread-1", root.GetProperty("thread_id").GetString());

        var context = root.GetProperty("context");
        Assert.Equal("details", context.GetProperty("context_type").GetString());
        Assert.Equal("de-DE", context.GetProperty("locale").GetString());
        Assert.Equal("QualityScoring", context.GetProperty("blade").GetProperty("name").GetString());
        Assert.Equal("prod-1", context.GetProperty("item").GetProperty("id").GetString());
        Assert.Equal(_message.EntityType, context.GetProperty("item").GetProperty("objectType").GetString());
    }

    [Fact]
    public async Task SendMessage_SendsSeveralEntitiesAsAListContext()
    {
        // Arrange
        var handler = new StubHandler(_ => Ndjson("""{"type":"done"}"""));
        var message = new VirtoOzChatMessage
        {
            AgentId = _message.AgentId,
            Message = _message.Message,
            ThreadId = "thread-1",
            Locale = "de-DE",
            EntityType = _message.EntityType,
            EntityIds = ["prod-1", "prod-2"],
        };

        // Act
        await CreateClient(handler).SendMessageAsync(message, "token-1", TestContext.Current.CancellationToken);

        // Assert
        using var body = JsonDocument.Parse(handler.RequestBody);
        var context = body.RootElement.GetProperty("context");
        Assert.Equal("list", context.GetProperty("context_type").GetString());
        Assert.False(context.TryGetProperty("item", out _));
        var items = context.GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(["prod-1", "prod-2"], items.Select(x => x.GetProperty("id").GetString()));
        Assert.All(items, x => Assert.Equal(_message.EntityType, x.GetProperty("objectType").GetString()));
    }

    [Fact]
    public async Task SendMessage_KeepsTheBaseUrlPathOut()
    {
        // Arrange
        var handler = new StubHandler(_ => Ndjson("""{"type":"done"}"""));

        // Act
        await CreateClient(handler, "https://virtooz.example.com/chat/").SendMessageAsync(_message, "token-1", TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("https://virtooz.example.com/api/chat", handler.Request.RequestUri!.ToString());
    }

    [Fact]
    public async Task SendMessage_Fails_WithoutTheAssistantUrl()
    {
        // Arrange
        var handler = new StubHandler(_ => Ndjson("""{"type":"done"}"""));

        // Act
        var ex = await Assert.ThrowsAsync<VirtoOzException>(() => CreateClient(handler, "").SendMessageAsync(_message, "token-1", TestContext.Current.CancellationToken));

        // Assert
        Assert.Contains("not configured", ex.Message);
        Assert.Null(handler.Request);
    }

    [Fact]
    public async Task SendMessage_ReportsAnExpiredSession_OnUnauthorized()
    {
        // Arrange
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized) { Content = new StringContent("token expired") });

        // Act
        var ex = await Assert.ThrowsAsync<VirtoOzException>(() => CreateClient(handler).SendMessageAsync(_message, "token-1", TestContext.Current.CancellationToken));

        // Assert
        Assert.Contains("session has expired", ex.Message);
        Assert.False(ex.IsTransient);
    }

    [Theory]
    [InlineData(HttpStatusCode.NotFound, false)]
    [InlineData(HttpStatusCode.UnprocessableEntity, false)]
    [InlineData(HttpStatusCode.TooManyRequests, true)]
    [InlineData(HttpStatusCode.ServiceUnavailable, true)]
    public async Task SendMessage_Fails_WithTheStatusOfARejectedRequest(HttpStatusCode statusCode, bool isTransient)
    {
        // Arrange
        var handler = new StubHandler(_ => new HttpResponseMessage(statusCode) { Content = new StringContent("rejected") });

        // Act
        var ex = await Assert.ThrowsAsync<VirtoOzException>(() => CreateClient(handler).SendMessageAsync(_message, "token-1", TestContext.Current.CancellationToken));

        // Assert
        Assert.Equal($"{(int)statusCode}: rejected", ex.Message);
        Assert.Equal(isTransient, ex.IsTransient);
    }

    [Fact]
    public async Task SendMessage_PassesRetryAfterOn()
    {
        // Arrange
        var handler = new StubHandler(_ =>
        {
            var response = new HttpResponseMessage(HttpStatusCode.TooManyRequests) { Content = new StringContent("quota") };
            response.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromSeconds(5));
            return response;
        });

        // Act
        var ex = await Assert.ThrowsAsync<VirtoOzException>(() => CreateClient(handler).SendMessageAsync(_message, "token-1", TestContext.Current.CancellationToken));

        // Assert
        Assert.Equal(TimeSpan.FromSeconds(5), ex.RetryAfter);
    }

    [Theory]
    [InlineData("AGENT_ERROR", false)]
    [InlineData("RBAC_FORBIDDEN", false)]
    [InlineData("STREAMING_TIMEOUT", false)]
    [InlineData("AI_OVERLOADED", true)]
    [InlineData("AI_RATE_LIMIT", true)]
    public async Task SendMessage_Fails_WithTheErrorEventOfTheRun(string code, bool isTransient)
    {
        // Arrange
        var handler = new StubHandler(_ => Ndjson(
            """{"type":"token","content":"Evaluating"}""",
            $$"""{"type":"error","code":"{{code}}","message":"Tool failed"}""",
            """{"type":"done"}"""));

        // Act
        var ex = await Assert.ThrowsAsync<VirtoOzException>(() => CreateClient(handler).SendMessageAsync(_message, "token-1", TestContext.Current.CancellationToken));

        // Assert
        Assert.Equal("Tool failed", ex.Message);
        Assert.Equal(isTransient, ex.IsTransient);
    }

    [Fact]
    public async Task SendMessage_Fails_WhenTheStreamEndsBeforeDone()
    {
        // Arrange
        var handler = new StubHandler(_ => Ndjson("""{"type":"token","content":"Evaluating"}"""));

        // Act
        var ex = await Assert.ThrowsAsync<VirtoOzException>(() => CreateClient(handler).SendMessageAsync(_message, "token-1", TestContext.Current.CancellationToken));

        // Assert
        Assert.Contains("before the run was over", ex.Message);
        Assert.False(ex.IsTransient);
    }

    [Fact]
    public async Task SendMessage_SkipsBlankLinesAndHeartbeats()
    {
        // Arrange
        var handler = new StubHandler(_ => Ndjson("", """{"type":"heartbeat"}""", "  ", """{"type":"done","message_id":"m-1"}"""));

        // Act & Assert: completes without an error
        await CreateClient(handler).SendMessageAsync(_message, "token-1", TestContext.Current.CancellationToken);
    }

    private static VirtoOzChatClient CreateClient(StubHandler handler, string aiAssistantUrl = "https://virtooz.example.com")
    {
        var options = Options.Create(new MarketplaceOptions { AiAssistantUrl = aiAssistantUrl });
        return new VirtoOzChatClient(new HttpClient(handler), options);
    }

    private static HttpResponseMessage Ndjson(params string[] lines)
    {
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(string.Join("\n", lines) + "\n", Encoding.UTF8, "application/x-ndjson"),
        };
    }

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public HttpRequestMessage Request { get; private set; }
        public string RequestBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Request = request;
            RequestBody = request.Content == null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            return respond(request);
        }
    }
}

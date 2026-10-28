import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import { mockUseAsync } from "../../../../test/harness/mockFramework";

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
const getAccessToken = vi.fn();
let aiAgent: { config: ReturnType<typeof ref<{ url: string }>> } | undefined;
const fetchMock = vi.fn();

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------
vi.mock("@vc-shell/framework", () => ({
  useAsync: mockUseAsync,
  useUser: () => ({ getAccessToken }),
}));

vi.mock("@vc-shell/framework/ai-agent", () => ({
  useAiAgent: () => aiAgent,
}));

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------
const { useQualityScoring } = await import("./index");

const args = {
  agentId: "seller-product-quality-expert",
  prompt: "Evaluate this product against all seller product quality targets.",
  item: { id: "prod-1", name: "Gift Box", objectType: "VirtoCommerce.MarketplaceVendorModule.Core.Domains.SellerProduct" },
  blade: { id: "blade-1", name: "QualityEvaluation", title: "Quality evaluation" },
  locale: "de-DE",
};

/** A streamed NDJSON response; each chunk is delivered as a separate read. */
function streamResponse(chunks: string[], init: ResponseInit = { status: 200 }) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
  return new Response(body, init);
}

describe("useQualityScoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiAgent = { config: ref({ url: "https://virtooz.example.com/chat/" }) };
    getAccessToken.mockResolvedValue("token-1");
    fetchMock.mockResolvedValue(streamResponse(['{"type":"token","content":"Done"}\n']));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the quality expert directly on the Virtooz origin", async () => {
    const { runScoring } = useQualityScoring();
    await runScoring(args);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://virtooz.example.com/api/chat");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer token-1" });
  });

  it("sends the prompt to the given expert agent with the item as the details context", async () => {
    const { runScoring } = useQualityScoring();
    await runScoring(args);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      type: "message",
      agent_id: "seller-product-quality-expert",
      message: "Evaluate this product against all seller product quality targets.",
      context: {
        context_type: "details",
        locale: "de-DE",
        blade: args.blade,
        item: args.item,
      },
    });
    expect(body.thread_id).toEqual(expect.any(String));
  });

  it("starts a new thread on every run", async () => {
    const { runScoring } = useQualityScoring();
    await runScoring(args);
    fetchMock.mockResolvedValue(streamResponse([]));
    await runScoring(args);

    const threadIds = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).thread_id);
    expect(threadIds[0]).not.toBe(threadIds[1]);
  });

  it("sends an empty object type when the item has none", async () => {
    const { runScoring } = useQualityScoring();
    await runScoring({ ...args, item: { id: "prod-1" } });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).context.item).toEqual({ id: "prod-1", objectType: "" });
  });

  it("is scoring until the whole stream is read", async () => {
    const { runScoring, scoring } = useQualityScoring();
    const run = runScoring(args);

    expect(scoring.value).toBe(true);
    await run;
    expect(scoring.value).toBe(false);
  });

  it("does nothing without an item id or an agent", async () => {
    const { runScoring } = useQualityScoring();
    await runScoring({ ...args, item: { id: "" } });
    await runScoring({ ...args, agentId: "" });
    await runScoring(undefined);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Availability
  // =========================================================================
  it.each([
    ["no AI agent service", () => (aiAgent = undefined)],
    ["no AI agent URL", () => (aiAgent = { config: ref({ url: "" }) })],
  ])("cannot score with %s", async (_label, arrange) => {
    arrange();
    const { canScore, runScoring } = useQualityScoring();

    expect(canScore.value).toBe(false);
    await expect(runScoring(args)).rejects.toThrow("AI agent URL is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("can score when the AI agent URL is configured", () => {
    expect(useQualityScoring().canScore.value).toBe(true);
  });

  // =========================================================================
  // Errors
  // =========================================================================
  it("fails with the status and body of a rejected request", async () => {
    fetchMock.mockResolvedValue(new Response("Agent 'seller-product-quality-expert' not found", { status: 404 }));

    const { runScoring } = useQualityScoring();
    await expect(runScoring(args)).rejects.toThrow("404: Agent 'seller-product-quality-expert' not found");
  });

  it("fails with the message of an error event", async () => {
    fetchMock.mockResolvedValue(
      streamResponse(['{"type":"token","content":"Evaluating"}\n{"type":"error","message":"Tool failed"}\n']),
    );

    const { runScoring } = useQualityScoring();
    await expect(runScoring(args)).rejects.toThrow("Tool failed");
  });

  it("reads events split across chunks and a last line without a newline", async () => {
    fetchMock.mockResolvedValue(streamResponse(['{"type":"token","con', 'tent":"x"}\n{"type":"err', 'or","message":"Late"}']));

    const { runScoring } = useQualityScoring();
    await expect(runScoring(args)).rejects.toThrow("Late");
  });

  it("succeeds when the stream has no error events", async () => {
    fetchMock.mockResolvedValue(streamResponse(['{"type":"token","content":"a"}\n', "\n", '{"type":"done"}\n']));

    const { runScoring } = useQualityScoring();
    await expect(runScoring(args)).resolves.toBeUndefined();
  });
});

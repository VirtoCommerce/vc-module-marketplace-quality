import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { effectScope } from "vue";

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
const getAccessToken = vi.fn();
const fetchMock = vi.fn();
const notification = { error: vi.fn() };
let subscription: {
  types: string[];
  filter: (msg: Record<string, unknown>) => boolean;
  handler: (msg: Record<string, unknown>) => void;
};
const subscribe = vi.fn((options: typeof subscription) => {
  subscription = options;
  return vi.fn();
});

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------
vi.mock("@vc-shell/framework", () => ({
  notification,
  useUser: () => ({ getAccessToken }),
  useNotificationStore: () => ({ subscribe }),
}));

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------
const { useQualityScoring, startQualityScoring, resetQualityScoring } = await import("./index");

const PRODUCT = "VirtoCommerce.MarketplaceVendorModule.Core.Domains.SellerProduct";
const OFFER = "VirtoCommerce.MarketplaceVendorModule.Core.Domains.Offer";
const args = { entityType: PRODUCT, entityIds: ["prod-1", "prod-2"], locale: "de-DE" };

function accepted(runId = "run-1", entityIds = args.entityIds) {
  return new Response(JSON.stringify({ id: runId, runId, entityIds, title: "Quality scoring: 0 of 2 items…" }), {
    status: 202,
  });
}

function final(runId = "run-1", entityIds = args.entityIds) {
  return { id: `final-${runId}`, runId, entityType: PRODUCT, entityIds, finished: "2026-11-02T10:00:00Z" };
}

/** Delivers a push notification the way the framework does: through the filter, then to the handler. */
function push(message: Record<string, unknown>) {
  if (subscription.filter(message)) subscription.handler(message);
}

describe("useQualityScoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQualityScoring();
    getAccessToken.mockResolvedValue("token-1");
    fetchMock.mockResolvedValue(accepted());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts the run on the platform with the user token", async () => {
    await startQualityScoring(args);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/vcmp/quality/scoring");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer token-1" });
    expect(JSON.parse(init.body)).toEqual(args);
  });

  it("does nothing without entities", async () => {
    await startQualityScoring({ ...args, entityIds: [] });
    await startQualityScoring({ ...args, entityType: "" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("listens to the final notifications of the quality scoring runs once", () => {
    useQualityScoring();
    useQualityScoring();

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscription.types).toEqual(["QualityScoringPushNotification"]);
  });

  // =========================================================================
  // Shared state
  // =========================================================================
  it("is scoring for every user of the store from the start until the run's final notification", async () => {
    const blade = useQualityScoring();
    const list = useQualityScoring();

    const run = startQualityScoring(args);
    expect(blade.scoring.value).toBe(true);
    await run;
    expect(list.scoring.value).toBe(true);

    // Progress notifications do not finish the run
    push({ id: "run-1", runId: "run-1", processedCount: 1 });
    expect(blade.scoring.value).toBe(true);

    push(final());
    expect(blade.scoring.value).toBe(false);
    expect(list.scoring.value).toBe(false);
  });

  it("does not start another run while one is going", async () => {
    await startQualityScoring(args);
    await startQualityScoring({ ...args, entityType: OFFER, entityIds: ["offer-1"] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("knows which entities are being scored", async () => {
    const { isEntityScoring } = useQualityScoring();
    await startQualityScoring(args);

    expect(isEntityScoring(PRODUCT, "prod-2")).toBe(true);
    expect(isEntityScoring(PRODUCT, "prod-3")).toBe(false);
    expect(isEntityScoring(OFFER, "prod-2")).toBe(false);
    expect(isEntityScoring(PRODUCT, undefined)).toBe(false);
  });

  it("takes the entities the platform queued: those already being scored are left out", async () => {
    fetchMock.mockResolvedValue(accepted("run-1", ["prod-2"]));
    const { isEntityScoring } = useQualityScoring();

    await startQualityScoring(args);

    expect(isEntityScoring(PRODUCT, "prod-1")).toBe(false);
    expect(isEntityScoring(PRODUCT, "prod-2")).toBe(true);
  });

  // =========================================================================
  // Finished
  // =========================================================================
  it("tells every listener when a run is over", async () => {
    const onBlade = vi.fn();
    const onOther = vi.fn();
    useQualityScoring({ onFinished: onBlade });
    useQualityScoring({ onFinished: onOther });
    await startQualityScoring(args);

    const message = final();
    push(message);

    expect(onBlade).toHaveBeenCalledWith(message);
    expect(onOther).toHaveBeenCalledWith(message);
  });

  it("stops telling a listener whose scope is disposed", async () => {
    const onFinished = vi.fn();
    const scope = effectScope();
    scope.run(() => useQualityScoring({ onFinished }));
    scope.stop();
    await startQualityScoring(args);

    push(final());

    expect(onFinished).not.toHaveBeenCalled();
  });

  it("ignores the final notifications of runs not started here", async () => {
    const onFinished = vi.fn();
    const { scoring } = useQualityScoring({ onFinished });
    await startQualityScoring(args);

    push(final("other-run"));

    expect(scoring.value).toBe(true);
    expect(onFinished).not.toHaveBeenCalled();
  });

  it("finishes a run whose final notification came before the start request returned", async () => {
    const onFinished = vi.fn();
    const { scoring } = useQualityScoring({ onFinished });
    const message = final();
    fetchMock.mockImplementation(async () => {
      push(message);
      return accepted();
    });

    await startQualityScoring(args);

    expect(scoring.value).toBe(false);
    expect(onFinished).toHaveBeenCalledWith(message);
  });

  it("does not finish a later run with a final notification that came while idle", async () => {
    const { scoring } = useQualityScoring();

    push(final());
    await startQualityScoring(args);

    expect(scoring.value).toBe(true);
  });

  // =========================================================================
  // Errors
  // =========================================================================
  it("shows why a run could not be started, and is not scoring then", async () => {
    fetchMock.mockResolvedValue(new Response("Quality scoring of these items is already running", { status: 409 }));
    const { scoring } = useQualityScoring();

    await expect(startQualityScoring(args)).resolves.toBeUndefined();

    expect(notification.error).toHaveBeenCalledWith("409: Quality scoring of these items is already running");
    expect(scoring.value).toBe(false);
  });
});

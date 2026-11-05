import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mockUseAsync } from "../../../test/harness/mockFramework";

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
let client: { dataSearch: ReturnType<typeof vi.fn> };
const getApiClientFn = vi.fn();
let onFinished: ((message: Record<string, unknown>) => void) | undefined;

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------
vi.mock("@vc-shell/framework", () => ({
  useApiClient: () => ({ getApiClient: getApiClientFn }),
  useAsync: mockUseAsync,
}));

vi.mock("../../../api_client/virtocommerce.catalogquality", () => ({
  CatalogQualityClient: class {},
}));

vi.mock("./useQualityScoring", () => ({
  useQualityScoring: (options: { onFinished?: typeof onFinished }) => {
    onFinished = options.onFinished;
    return {};
  },
}));

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------
const { useQualityLowestScore } = await import("./useQualityLowestScore");
const { SELLER_PRODUCT_ENTITY_TYPE, OFFER_ENTITY_TYPE } = await import("../entities");

const page = (scores: Array<number | undefined>) => ({
  results: scores.map((readinessScore, i) => ({ targetId: `t${i}`, readinessScore })),
  totalCount: scores.length,
});

describe("useQualityLowestScore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onFinished = undefined;
    client = { dataSearch: vi.fn().mockResolvedValue(page([57])) };
    getApiClientFn.mockResolvedValue(client);
  });

  it("searches the entity's evaluations as soon as an entity id is present", async () => {
    const { score } = useQualityLowestScore(ref("prod-1"), SELLER_PRODUCT_ENTITY_TYPE);
    await flushPromises();

    expect(client.dataSearch).toHaveBeenCalledWith({
      entityId: "prod-1",
      entityType: SELLER_PRODUCT_ENTITY_TYPE,
      skip: 0,
      take: 100,
    });
    expect(score.value).toBe(57);
  });

  it("searches under the given entity type", async () => {
    useQualityLowestScore(ref("offer-1"), OFFER_ENTITY_TYPE);
    await flushPromises();

    expect(client.dataSearch).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: "offer-1", entityType: OFFER_ENTITY_TYPE }),
    );
  });

  it("takes the lowest of several target scores", async () => {
    client.dataSearch.mockResolvedValue(page([57, 32, 80]));

    const { score } = useQualityLowestScore(ref("prod-1"), SELLER_PRODUCT_ENTITY_TYPE);
    await flushPromises();

    expect(score.value).toBe(32);
  });

  it("counts a stored evaluation without a score as zero", async () => {
    client.dataSearch.mockResolvedValue(page([57, undefined]));

    const { score } = useQualityLowestScore(ref("prod-1"), SELLER_PRODUCT_ENTITY_TYPE);
    await flushPromises();

    expect(score.value).toBe(0);
  });

  it("is undefined when nothing is scored", async () => {
    client.dataSearch.mockResolvedValue(page([]));

    const { score } = useQualityLowestScore(ref("prod-1"), SELLER_PRODUCT_ENTITY_TYPE);
    await flushPromises();

    expect(score.value).toBeUndefined();
  });

  it("skips evaluations without a target id", async () => {
    client.dataSearch.mockResolvedValue({ results: [{ readinessScore: 10 }], totalCount: 1 });

    const { score } = useQualityLowestScore(ref("prod-1"), SELLER_PRODUCT_ENTITY_TYPE);
    await flushPromises();

    expect(score.value).toBeUndefined();
  });

  it("pages through results until the total count is reached", async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => ({ targetId: `t${i}`, readinessScore: 50 + (i % 10) }));
    client.dataSearch
      .mockResolvedValueOnce({ results: firstPage, totalCount: 101 })
      .mockResolvedValueOnce({ results: [{ targetId: "t100", readinessScore: 12 }], totalCount: 101 });

    const { score } = useQualityLowestScore(ref("prod-1"), SELLER_PRODUCT_ENTITY_TYPE);
    await flushPromises();

    expect(client.dataSearch).toHaveBeenCalledTimes(2);
    expect(client.dataSearch).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 100 }));
    expect(score.value).toBe(12);
  });

  it("does not load while there is no entity id", async () => {
    const { score } = useQualityLowestScore(ref<string | undefined>(undefined), SELLER_PRODUCT_ENTITY_TYPE);
    await flushPromises();

    expect(client.dataSearch).not.toHaveBeenCalled();
    expect(score.value).toBeUndefined();
  });

  it("loads once the entity id arrives", async () => {
    const entityId = ref<string | undefined>(undefined);
    const { score } = useQualityLowestScore(entityId, SELLER_PRODUCT_ENTITY_TYPE);

    entityId.value = "prod-1";
    await nextTick();
    await flushPromises();

    expect(client.dataSearch).toHaveBeenCalledTimes(1);
    expect(score.value).toBe(57);
  });

  it("reloads when the blade is reused for a different entity", async () => {
    const entityId = ref<string | undefined>("prod-1");
    useQualityLowestScore(entityId, SELLER_PRODUCT_ENTITY_TYPE);
    await flushPromises();

    entityId.value = "prod-2";
    await nextTick();
    await flushPromises();

    expect(client.dataSearch).toHaveBeenCalledTimes(2);
  });

  it("does not reload when the entity id is cleared", async () => {
    const entityId = ref<string | undefined>("prod-1");
    useQualityLowestScore(entityId, SELLER_PRODUCT_ENTITY_TYPE);
    await flushPromises();

    entityId.value = undefined;
    await nextTick();
    await flushPromises();

    expect(client.dataSearch).toHaveBeenCalledTimes(1);
  });

  it("shows nothing instead of failing when the seller lacks permission", async () => {
    client.dataSearch.mockRejectedValue(new Error("403 Forbidden"));

    const { score, loading } = useQualityLowestScore(ref("prod-1"), SELLER_PRODUCT_ENTITY_TYPE);
    await flushPromises();

    expect(score.value).toBeUndefined();
    expect(loading.value).toBe(false);
  });

  it("reloads when a scoring run of this entity is over", async () => {
    const { score } = useQualityLowestScore(ref("prod-1"), SELLER_PRODUCT_ENTITY_TYPE);
    await flushPromises();

    client.dataSearch.mockResolvedValue(page([91, 44]));
    onFinished?.({ entityType: SELLER_PRODUCT_ENTITY_TYPE, entityIds: ["prod-0", "prod-1"] });
    await flushPromises();

    expect(client.dataSearch).toHaveBeenCalledTimes(2);
    expect(score.value).toBe(44);
  });

  it.each([
    ["another entity", { entityType: SELLER_PRODUCT_ENTITY_TYPE, entityIds: ["prod-2"] }],
    ["another entity type", { entityType: OFFER_ENTITY_TYPE, entityIds: ["prod-1"] }],
  ])("does not reload when a scoring run of %s is over", async (_, message) => {
    useQualityLowestScore(ref("prod-1"), SELLER_PRODUCT_ENTITY_TYPE);
    await flushPromises();

    onFinished?.(message);
    await flushPromises();

    expect(client.dataSearch).toHaveBeenCalledTimes(1);
  });

  it("refresh reloads the score", async () => {
    const { score, refresh } = useQualityLowestScore(ref("prod-1"), SELLER_PRODUCT_ENTITY_TYPE);
    await flushPromises();

    client.dataSearch.mockResolvedValue(page([9]));
    await refresh();

    expect(client.dataSearch).toHaveBeenCalledTimes(2);
    expect(score.value).toBe(9);
  });
});

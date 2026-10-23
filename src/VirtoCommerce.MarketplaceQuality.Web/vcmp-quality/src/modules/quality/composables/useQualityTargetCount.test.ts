import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mockUseAsync } from "../../../test/harness/mockFramework";

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
let client: { targetSearch: ReturnType<typeof vi.fn> };
const getApiClientFn = vi.fn();

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

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------
const { useQualityTargetCount } = await import("./useQualityTargetCount");
const { QUALITY_PRODUCT_ENTITY_TYPE } = await import("./useQualityEvaluation");

describe("useQualityTargetCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client = { targetSearch: vi.fn().mockResolvedValue({ totalCount: 3 }) };
    getApiClientFn.mockResolvedValue(client);
  });

  it("loads the count immediately when a product id is present", async () => {
    const { count } = useQualityTargetCount(ref("prod-1"));
    await flushPromises();

    // take: 0 — only the total of the seller product targets is needed, not the targets themselves
    expect(client.targetSearch).toHaveBeenCalledWith({ entityType: QUALITY_PRODUCT_ENTITY_TYPE, take: 0 });
    expect(count.value).toBe(3);
  });

  it("does not load while there is no product id", async () => {
    const { count } = useQualityTargetCount(ref<string | undefined>(undefined));
    await flushPromises();

    expect(client.targetSearch).not.toHaveBeenCalled();
    expect(count.value).toBe(0);
  });

  it("loads once the product id arrives", async () => {
    const productId = ref<string | undefined>(undefined);
    const { count } = useQualityTargetCount(productId);

    productId.value = "prod-1";
    await nextTick();
    await flushPromises();

    expect(client.targetSearch).toHaveBeenCalledTimes(1);
    expect(count.value).toBe(3);
  });

  it("reloads when the blade is reused for a different product", async () => {
    const productId = ref<string | undefined>("prod-1");
    useQualityTargetCount(productId);
    await flushPromises();

    productId.value = "prod-2";
    await nextTick();
    await flushPromises();

    expect(client.targetSearch).toHaveBeenCalledTimes(2);
  });

  it("does not reload when the product id is cleared", async () => {
    const productId = ref<string | undefined>("prod-1");
    useQualityTargetCount(productId);
    await flushPromises();

    productId.value = undefined;
    await nextTick();
    await flushPromises();

    expect(client.targetSearch).toHaveBeenCalledTimes(1);
  });

  it("treats a missing total count as zero", async () => {
    client.targetSearch.mockResolvedValue({});

    const { count } = useQualityTargetCount(ref("prod-1"));
    await flushPromises();

    expect(count.value).toBe(0);
  });

  it("shows zero instead of failing when the seller lacks permission", async () => {
    client.targetSearch.mockRejectedValue(new Error("403 Forbidden"));

    const { count, loading } = useQualityTargetCount(ref("prod-1"));
    await flushPromises();

    expect(count.value).toBe(0);
    expect(loading.value).toBe(false);
  });

  it("refresh reloads the count", async () => {
    const { count, refresh } = useQualityTargetCount(ref("prod-1"));
    await flushPromises();

    client.targetSearch.mockResolvedValue({ totalCount: 9 });
    await refresh();

    expect(client.targetSearch).toHaveBeenCalledTimes(2);
    expect(count.value).toBe(9);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mockUseAsync } from "../../../test/harness/mockFramework";

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
let client: { targetSearch: ReturnType<typeof vi.fn>; getTargetNames: ReturnType<typeof vi.fn> };
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

vi.mock("../../../api_client/virtocommerce.marketplacequality", () => ({
  MarketplaceQualityClient: class {},
}));

vi.mock("./useQualityTargets", () => ({ ALL_TARGETS_TAKE: 1000 }));

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------
const { useQualityTargetCount } = await import("./useQualityTargetCount");

describe("useQualityTargetCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Both API clients resolve to this one mock.
    client = {
      targetSearch: vi.fn().mockResolvedValue({
        results: [{ name: "A" }, { name: "B" }, { name: "Not on marketplace" }, { name: "C" }],
        totalCount: 4,
      }),
      getTargetNames: vi.fn().mockResolvedValue(["A", "B", "C"]),
    };
    getApiClientFn.mockResolvedValue(client);
  });

  it("loads the count immediately when a product id is present", async () => {
    const { count } = useQualityTargetCount(ref("prod-1"));
    await flushPromises();

    // All targets are loaded, then only the marketplace ones are counted.
    expect(client.targetSearch).toHaveBeenCalledWith({ take: 1000 });
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

  it("treats missing results as zero", async () => {
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

    client.getTargetNames.mockResolvedValue(["A"]);
    await refresh();

    expect(client.targetSearch).toHaveBeenCalledTimes(2);
    expect(count.value).toBe(1);
  });
});

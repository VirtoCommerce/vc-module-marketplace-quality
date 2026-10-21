import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockUseAsync } from "../../../../test/harness/mockFramework";

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
let client: { dataGetByEntity: ReturnType<typeof vi.fn> };
const getApiClientFn = vi.fn();

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------
vi.mock("@vc-shell/framework", () => ({
  useApiClient: () => ({ getApiClient: getApiClientFn }),
  useAsync: mockUseAsync,
}));

vi.mock("../../../../api_client/virtocommerce.catalogquality", () => ({
  CatalogQualityClient: class {},
}));

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------
const { useQualityEvaluation, QUALITY_PRODUCT_ENTITY_TYPE } = await import("./index");

describe("useQualityEvaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client = { dataGetByEntity: vi.fn() };
    getApiClientFn.mockResolvedValue(client);
  });

  it("stores evaluations under the seller product entity type", () => {
    expect(QUALITY_PRODUCT_ENTITY_TYPE).toBe("VirtoCommerce.MarketplaceVendorModule.Core.Domains.SellerProduct");
  });

  it("loads the evaluation for the product and target", async () => {
    const data = { id: "qd-1", readinessScore: 82, suggestions: "# Report" };
    client.dataGetByEntity.mockResolvedValue(data);

    const { loadEvaluation, evaluation, isScored } = useQualityEvaluation();
    await loadEvaluation({ entityId: "prod-1", targetId: "target-1" });

    expect(client.dataGetByEntity).toHaveBeenCalledWith("prod-1", QUALITY_PRODUCT_ENTITY_TYPE, "target-1");
    expect(evaluation.value).toEqual(data);
    expect(isScored.value).toBe(true);
  });

  it.each([
    ["no arguments", undefined],
    ["no entity id", { entityId: "", targetId: "target-1" }],
    ["no target id", { entityId: "prod-1", targetId: "" }],
  ])("does not call the API with %s", async (_label, args) => {
    const { loadEvaluation, evaluation } = useQualityEvaluation();
    await loadEvaluation(args);

    expect(getApiClientFn).not.toHaveBeenCalled();
    expect(client.dataGetByEntity).not.toHaveBeenCalled();
    expect(evaluation.value).toBeNull();
  });

  it("sets evaluation to null when nothing is stored", async () => {
    client.dataGetByEntity.mockResolvedValue(undefined);

    const { loadEvaluation, evaluation, isScored } = useQualityEvaluation();
    await loadEvaluation({ entityId: "prod-1", targetId: "target-1" });

    expect(evaluation.value).toBeNull();
    expect(isScored.value).toBe(false);
  });

  it("replaces a previous evaluation with null when the next target has none", async () => {
    client.dataGetByEntity.mockResolvedValueOnce({ id: "qd-1" }).mockResolvedValueOnce(null);

    const { loadEvaluation, evaluation } = useQualityEvaluation();
    await loadEvaluation({ entityId: "prod-1", targetId: "target-1" });
    await loadEvaluation({ entityId: "prod-1", targetId: "target-2" });

    expect(evaluation.value).toBeNull();
  });

  it("counts an evaluation with only suggestions as scored", async () => {
    client.dataGetByEntity.mockResolvedValue({ suggestions: "Add more images" });

    const { loadEvaluation, isScored } = useQualityEvaluation();
    await loadEvaluation({ entityId: "prod-1", targetId: "target-1" });

    expect(isScored.value).toBe(true);
  });

  it("does not count an empty object as scored", async () => {
    client.dataGetByEntity.mockResolvedValue({});

    const { loadEvaluation, isScored } = useQualityEvaluation();
    await loadEvaluation({ entityId: "prod-1", targetId: "target-1" });

    expect(isScored.value).toBe(false);
  });
});

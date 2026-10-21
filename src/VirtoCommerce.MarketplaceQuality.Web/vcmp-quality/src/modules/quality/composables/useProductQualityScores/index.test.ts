import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockUseAsync } from "../../../../test/harness/mockFramework";

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
let client: { dataSearch: ReturnType<typeof vi.fn> };
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
const { useProductQualityScores } = await import("./index");
const { QUALITY_PRODUCT_ENTITY_TYPE } = await import("../useQualityEvaluation");

describe("useProductQualityScores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client = { dataSearch: vi.fn() };
    getApiClientFn.mockResolvedValue(client);
  });

  it("searches the product's evaluations by entity", async () => {
    client.dataSearch.mockResolvedValue({ results: [], totalCount: 0 });

    const { loadScores } = useProductQualityScores();
    await loadScores("prod-1");

    expect(client.dataSearch).toHaveBeenCalledWith({
      entityId: "prod-1",
      entityType: QUALITY_PRODUCT_ENTITY_TYPE,
      skip: 0,
      take: 100,
    });
  });

  it("maps scores by target id", async () => {
    client.dataSearch.mockResolvedValue({
      results: [
        { targetId: "t1", readinessScore: 53 },
        { targetId: "t2", readinessScore: 0 },
      ],
      totalCount: 2,
    });

    const { loadScores, scores } = useProductQualityScores();
    await loadScores("prod-1");

    expect(scores.value).toEqual({ t1: 53, t2: 0 });
  });

  it("counts a stored evaluation without a score as zero", async () => {
    client.dataSearch.mockResolvedValue({ results: [{ targetId: "t1" }], totalCount: 1 });

    const { loadScores, scores } = useProductQualityScores();
    await loadScores("prod-1");

    expect(scores.value).toEqual({ t1: 0 });
  });

  it("skips evaluations without a target id", async () => {
    client.dataSearch.mockResolvedValue({ results: [{ readinessScore: 90 }], totalCount: 1 });

    const { loadScores, scores } = useProductQualityScores();
    await loadScores("prod-1");

    expect(scores.value).toEqual({});
  });

  it("pages through results until the total count is reached", async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => ({ targetId: `t${i}`, readinessScore: i }));
    client.dataSearch
      .mockResolvedValueOnce({ results: firstPage, totalCount: 101 })
      .mockResolvedValueOnce({ results: [{ targetId: "t100", readinessScore: 100 }], totalCount: 101 });

    const { loadScores, scores } = useProductQualityScores();
    await loadScores("prod-1");

    expect(client.dataSearch).toHaveBeenCalledTimes(2);
    expect(client.dataSearch).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 100 }));
    expect(Object.keys(scores.value)).toHaveLength(101);
  });

  it("stops when a page comes back empty even if the total says otherwise", async () => {
    client.dataSearch.mockResolvedValue({ results: [], totalCount: 5 });

    const { loadScores } = useProductQualityScores();
    await loadScores("prod-1");

    expect(client.dataSearch).toHaveBeenCalledTimes(1);
  });

  it("clears scores without calling the API when there is no product id", async () => {
    client.dataSearch.mockResolvedValue({ results: [{ targetId: "t1", readinessScore: 53 }], totalCount: 1 });

    const { loadScores, scores } = useProductQualityScores();
    await loadScores("prod-1");
    client.dataSearch.mockClear();
    await loadScores(undefined);

    expect(client.dataSearch).not.toHaveBeenCalled();
    expect(scores.value).toEqual({});
  });

  it("replaces previous scores on reload", async () => {
    client.dataSearch
      .mockResolvedValueOnce({ results: [{ targetId: "t1", readinessScore: 53 }], totalCount: 1 })
      .mockResolvedValueOnce({ results: [{ targetId: "t2", readinessScore: 70 }], totalCount: 1 });

    const { loadScores, scores } = useProductQualityScores();
    await loadScores("prod-1");
    await loadScores("prod-1");

    expect(scores.value).toEqual({ t2: 70 });
  });
});

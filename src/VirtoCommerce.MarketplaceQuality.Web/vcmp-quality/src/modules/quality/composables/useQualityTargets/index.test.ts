import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockUseAsync } from "../../../../test/harness/mockFramework";

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
let client: { targetSearch: ReturnType<typeof vi.fn>; getTargetNames: ReturnType<typeof vi.fn> };
const getApiClientFn = vi.fn();
// Default: the request is the latest one, so its result is passed through.
const latestFn = vi.fn((promise: Promise<unknown>) => promise);
let paginationOptions: {
  pageSize: number;
  totalCount: { value: number };
  onPageChange: (args: { skip: number }) => Promise<void>;
  stateKey?: string;
};

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------
vi.mock("@vc-shell/framework", () => ({
  useApiClient: () => ({ getApiClient: getApiClientFn }),
  useAsync: mockUseAsync,
  useLatestRequest: () => ({ latest: latestFn }),
  useDataTablePagination: (options: typeof paginationOptions) => {
    paginationOptions = options;
    return { skip: 0, totalCount: options.totalCount, goToPage: vi.fn() };
  },
}));

vi.mock("../../../../api_client/virtocommerce.catalogquality", () => ({
  CatalogQualityClient: class {},
}));

vi.mock("../../../../api_client/virtocommerce.marketplacequality", () => ({
  MarketplaceQualityClient: class {},
}));

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------
const { useQualityTargets, ALL_TARGETS_TAKE } = await import("./index");

describe("useQualityTargets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Both API clients resolve to this one mock.
    client = { targetSearch: vi.fn(), getTargetNames: vi.fn().mockResolvedValue(["SEO", "Images"]) };
    getApiClientFn.mockResolvedValue(client);
    latestFn.mockImplementation((promise: Promise<unknown>) => promise);
  });

  it("uses a page size of 20 by default", () => {
    const { searchQuery } = useQualityTargets();

    expect(searchQuery.value).toEqual({ take: 20 });
    expect(paginationOptions.pageSize).toBe(20);
  });

  it("honours a custom page size and passes the state key to pagination", () => {
    const { searchQuery } = useQualityTargets({ pageSize: 5, stateKey: "my_key" });

    expect(searchQuery.value).toEqual({ take: 5 });
    expect(paginationOptions.pageSize).toBe(5);
    expect(paginationOptions.stateKey).toBe("my_key");
  });

  it("loads all targets and keeps only the marketplace ones", async () => {
    client.targetSearch.mockResolvedValue({
      results: [
        { id: "t1", name: "SEO" },
        { id: "t2", name: "Not on marketplace" },
        { id: "t3", name: "Images" },
        { id: "t4" },
      ],
      totalCount: 4,
    });

    const { searchTargets, targets } = useQualityTargets();
    await searchTargets({ sort: "name:ASC" });

    expect(client.targetSearch).toHaveBeenCalledWith({ take: ALL_TARGETS_TAKE, sort: "name:ASC", skip: 0 });
    expect(targets.value).toEqual([
      { id: "t1", name: "SEO" },
      { id: "t3", name: "Images" },
    ]);
    expect(paginationOptions.totalCount.value).toBe(2);
  });

  it("shows nothing when no names are available on the marketplace", async () => {
    client.targetSearch.mockResolvedValue({ results: [{ id: "t1", name: "SEO" }], totalCount: 1 });
    client.getTargetNames.mockResolvedValue([]);

    const { searchTargets, targets } = useQualityTargets();
    await searchTargets();

    expect(targets.value).toEqual([]);
    expect(paginationOptions.totalCount.value).toBe(0);
  });

  it("pages the marketplace targets", async () => {
    client.getTargetNames.mockResolvedValue(["A", "B", "C"]);
    client.targetSearch.mockResolvedValue({
      results: [{ name: "A" }, { name: "X" }, { name: "B" }, { name: "C" }],
      totalCount: 4,
    });

    const { searchTargets, targets } = useQualityTargets({ pageSize: 2 });
    await searchTargets({ skip: 2 });

    expect(targets.value).toEqual([{ name: "C" }]);
    expect(paginationOptions.totalCount.value).toBe(3);
  });

  it("merges each query into the previous one", async () => {
    client.targetSearch.mockResolvedValue({ results: [], totalCount: 0 });

    const { searchTargets, searchQuery } = useQualityTargets();
    await searchTargets({ sort: "name:ASC" });
    await searchTargets({ skip: 20 });

    expect(searchQuery.value).toEqual({ take: 20, sort: "name:ASC", skip: 20 });
    expect(client.targetSearch).toHaveBeenLastCalledWith({ take: ALL_TARGETS_TAKE, sort: "name:ASC", skip: 0 });
  });

  it("returns empty targets and zero total before the first search", () => {
    const { targets } = useQualityTargets();

    expect(targets.value).toEqual([]);
    expect(paginationOptions.totalCount.value).toBe(0);
  });

  it("treats a missing results array as empty", async () => {
    client.targetSearch.mockResolvedValue({ totalCount: 0 });

    const { searchTargets, targets } = useQualityTargets();
    await searchTargets();

    expect(targets.value).toEqual([]);
  });

  it("keeps the previous result when a newer search superseded the request", async () => {
    client.targetSearch.mockResolvedValueOnce({ results: [{ id: "t1", name: "SEO" }], totalCount: 1 });

    const { searchTargets, targets } = useQualityTargets();
    await searchTargets();

    latestFn.mockResolvedValueOnce(undefined);
    client.targetSearch.mockResolvedValueOnce({ results: [{ id: "stale", name: "SEO" }], totalCount: 1 });
    await searchTargets();

    expect(targets.value).toEqual([{ id: "t1", name: "SEO" }]);
  });

  it("keeps the sort and moves to the new skip when the page changes", async () => {
    client.targetSearch.mockResolvedValue({ results: [], totalCount: 0 });

    const { searchTargets, searchQuery } = useQualityTargets();
    await searchTargets({ sort: "name:DESC" });
    await paginationOptions.onPageChange({ skip: 40 });

    expect(searchQuery.value).toEqual({ take: 20, sort: "name:DESC", skip: 40 });
    expect(client.targetSearch).toHaveBeenLastCalledWith({ take: ALL_TARGETS_TAKE, sort: "name:DESC", skip: 0 });
  });

  it("reports loading while the search is in flight", async () => {
    let resolve!: (value: unknown) => void;
    client.targetSearch.mockReturnValue(new Promise((r) => (resolve = r)));

    const { searchTargets, loading } = useQualityTargets();
    const pending = searchTargets();
    expect(loading.value).toBe(true);

    resolve({ results: [], totalCount: 0 });
    await pending;
    expect(loading.value).toBe(false);
  });
});

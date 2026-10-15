import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockUseAsync } from "../../../../test/harness/mockFramework";

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
let client: { targetSearch: ReturnType<typeof vi.fn> };
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

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------
const { useQualityTargets } = await import("./index");

describe("useQualityTargets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client = { targetSearch: vi.fn() };
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

  it("searches targets and exposes results and total count", async () => {
    client.targetSearch.mockResolvedValue({
      results: [{ id: "t1", name: "SEO" }],
      totalCount: 7,
    });

    const { searchTargets, targets } = useQualityTargets();
    await searchTargets({ sort: "name:ASC" });

    expect(client.targetSearch).toHaveBeenCalledWith({ take: 20, sort: "name:ASC" });
    expect(targets.value).toEqual([{ id: "t1", name: "SEO" }]);
    expect(paginationOptions.totalCount.value).toBe(7);
  });

  it("merges each query into the previous one", async () => {
    client.targetSearch.mockResolvedValue({ results: [], totalCount: 0 });

    const { searchTargets, searchQuery } = useQualityTargets();
    await searchTargets({ sort: "name:ASC" });
    await searchTargets({ skip: 20 });

    expect(searchQuery.value).toEqual({ take: 20, sort: "name:ASC", skip: 20 });
    expect(client.targetSearch).toHaveBeenLastCalledWith({ take: 20, sort: "name:ASC", skip: 20 });
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
    client.targetSearch.mockResolvedValueOnce({ results: [{ id: "t1" }], totalCount: 1 });

    const { searchTargets, targets } = useQualityTargets();
    await searchTargets();

    latestFn.mockResolvedValueOnce(undefined);
    client.targetSearch.mockResolvedValueOnce({ results: [{ id: "stale" }], totalCount: 1 });
    await searchTargets();

    expect(targets.value).toEqual([{ id: "t1" }]);
  });

  it("searches with the new skip when the page changes", async () => {
    client.targetSearch.mockResolvedValue({ results: [], totalCount: 0 });

    const { searchTargets } = useQualityTargets();
    await searchTargets({ sort: "name:DESC" });
    await paginationOptions.onPageChange({ skip: 40 });

    expect(client.targetSearch).toHaveBeenLastCalledWith({ take: 20, sort: "name:DESC", skip: 40 });
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

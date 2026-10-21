import {
  CatalogQualityClient,
  type QualityTarget,
  type SearchQualityTargetQuery,
  type SearchQualityTargetResult,
} from "../../../../api_client/virtocommerce.catalogquality";
import { MarketplaceQualityClient } from "../../../../api_client/virtocommerce.marketplacequality";
import { computed, type ComputedRef, type Ref, ref } from "vue";
import {
  useApiClient,
  useAsync,
  useLatestRequest,
  useDataTablePagination,
  type UseDataTablePaginationReturn,
} from "@vc-shell/framework";

export interface IUseQualityTargets {
  loading: ComputedRef<boolean>;
  pagination: UseDataTablePaginationReturn;
  targets: ComputedRef<QualityTarget[]>;
  searchQuery: Ref<SearchQualityTargetQuery>;
  searchTargets: (query?: SearchQualityTargetQuery) => Promise<void>;
}

interface IUseQualityTargetsOptions {
  pageSize?: number;
  /** When set, persists the current page to the blade URL query under this key. */
  stateKey?: string;
}

// Big enough to load every target in one request.
export const ALL_TARGETS_TAKE = 1000;

// Quality targets are global in the catalog-quality module: the same set applies to every product.
// Only the targets available on the marketplace are shown.
export function useQualityTargets(options?: IUseQualityTargetsOptions): IUseQualityTargets {
  const pageSize = options?.pageSize || 20;

  const { getApiClient } = useApiClient(CatalogQualityClient);
  const { getApiClient: getMarketplaceApiClient } = useApiClient(MarketplaceQualityClient);

  const searchQuery = ref<SearchQualityTargetQuery>({ take: pageSize });
  const searchResult = ref<SearchQualityTargetResult>();

  const search = useLatestRequest();

  const { action: searchTargets, loading } = useAsync<SearchQualityTargetQuery>(async (query) => {
    const client = await getApiClient();
    const marketplaceClient = await getMarketplaceApiClient();
    searchQuery.value = { ...searchQuery.value, ...query };

    const response = await search.latest(
      Promise.all([
        client.targetSearch({ ...searchQuery.value, skip: 0, take: ALL_TARGETS_TAKE }),
        marketplaceClient.getTargetNames(),
      ]),
    );
    // A newer search superseded this one; its answer is the one that counts.
    if (!response) return;

    const [result, names] = response;
    const marketplaceTargets = (result?.results ?? []).filter((x) => x.name && names?.includes(x.name));
    const skip = searchQuery.value.skip ?? 0;

    searchResult.value = {
      totalCount: marketplaceTargets.length,
      results: marketplaceTargets.slice(skip, skip + pageSize),
    };
  });

  const pagination = useDataTablePagination({
    pageSize,
    totalCount: computed(() => searchResult.value?.totalCount ?? 0),
    onPageChange: ({ skip }) => searchTargets({ ...searchQuery.value, skip }),
    stateKey: options?.stateKey,
  });

  return {
    loading: computed(() => loading.value),
    pagination,
    targets: computed(() => searchResult.value?.results || []),
    searchQuery,
    searchTargets,
  };
}

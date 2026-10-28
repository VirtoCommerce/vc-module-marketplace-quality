import {
  CatalogQualityClient,
  type QualityTarget,
  type SearchQualityTargetQuery,
  type SearchQualityTargetResult,
} from "../../../../api_client/virtocommerce.catalogquality";
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
  /** Only the targets of this entity type are shown. */
  entityType: string;
  pageSize?: number;
  /** When set, persists the current page to the blade URL query under this key. */
  stateKey?: string;
}

// Quality targets are global in the catalog-quality module: the same set applies to every entity
// of a type. Only the targets of the given entity type are shown.
export function useQualityTargets(options: IUseQualityTargetsOptions): IUseQualityTargets {
  const pageSize = options.pageSize || 20;

  const { getApiClient } = useApiClient(CatalogQualityClient);

  const searchQuery = ref<SearchQualityTargetQuery>({ entityType: options.entityType, take: pageSize });
  const searchResult = ref<SearchQualityTargetResult>();

  const search = useLatestRequest();

  const { action: searchTargets, loading } = useAsync<SearchQualityTargetQuery>(async (query) => {
    searchQuery.value = { ...searchQuery.value, ...query };
    // Without an entity type the search would return the targets of every type.
    if (!searchQuery.value.entityType) return;

    const client = await getApiClient();

    const result = await search.latest(client.targetSearch(searchQuery.value));
    // A newer search superseded this one; its answer is the one that counts.
    if (!result) return;
    searchResult.value = result;
  });

  const pagination = useDataTablePagination({
    pageSize,
    totalCount: computed(() => searchResult.value?.totalCount ?? 0),
    onPageChange: ({ skip }) => searchTargets({ ...searchQuery.value, skip }),
    stateKey: options.stateKey,
  });

  return {
    loading: computed(() => loading.value),
    pagination,
    targets: computed(() => searchResult.value?.results || []),
    searchQuery,
    searchTargets,
  };
}

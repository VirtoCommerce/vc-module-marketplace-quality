import { CatalogQualityClient } from "../../../../api_client/virtocommerce.catalogquality";
import { computed, type ComputedRef, type Ref, ref } from "vue";
import { useApiClient, useAsync } from "@vc-shell/framework";
import { QUALITY_PRODUCT_ENTITY_TYPE } from "../useQualityEvaluation";

const PAGE_SIZE = 100;

export interface IUseProductQualityScores {
  loading: ComputedRef<boolean>;
  /** Readiness score by target id. A target without an entry has not been scored for this product. */
  scores: Ref<Record<string, number>>;
  /** Loads the scores of every target for a catalog product — for a seller product, its stagedProductDataId. */
  loadScores: (entityId?: string) => Promise<void>;
}

// One search by entity returns the product's evaluations across all targets, so the targets list
// can show every score without a request per row.
export function useProductQualityScores(): IUseProductQualityScores {
  const { getApiClient } = useApiClient(CatalogQualityClient);

  const scores = ref<Record<string, number>>({});

  const { action: loadScores, loading } = useAsync<string>(async (entityId) => {
    if (!entityId) {
      scores.value = {};
      return;
    }

    const client = await getApiClient();
    const result: Record<string, number> = {};
    let skip = 0;

    // A product has at most one evaluation per target, so this is normally a single page.
    for (;;) {
      const page = await client.dataSearch({
        entityId,
        entityType: QUALITY_PRODUCT_ENTITY_TYPE,
        skip,
        take: PAGE_SIZE,
      });
      const items = page?.results ?? [];
      for (const data of items) {
        if (data.targetId) {
          result[data.targetId] = data.readinessScore ?? 0;
        }
      }
      skip += items.length;
      if (!items.length || skip >= (page?.totalCount ?? 0)) break;
    }

    scores.value = result;
  });

  return {
    loading: computed(() => loading.value),
    scores,
    loadScores,
  };
}

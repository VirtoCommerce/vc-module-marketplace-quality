import { CatalogQualityClient, type QualityData } from "../../../../api_client/virtocommerce.catalogquality";
import { computed, type ComputedRef, type Ref, ref } from "vue";
import { useApiClient, useAsync } from "@vc-shell/framework";

/** Entity type the seller product evaluations are stored under in the catalog-quality module. */
export const QUALITY_PRODUCT_ENTITY_TYPE = "VirtoCommerce.MarketplaceVendorModule.Core.Domains.SellerProduct";

export interface IQualityEvaluationArgs {
  /** Seller product id. */
  entityId: string;
  targetId: string;
}

export interface IUseQualityEvaluation {
  loading: ComputedRef<boolean>;
  evaluation: Ref<QualityData | null>;
  /** False when nothing was stored for this product and target — the agent has not scored it yet. */
  isScored: ComputedRef<boolean>;
  loadEvaluation: (args?: IQualityEvaluationArgs) => Promise<void>;
}

// Read-only: evaluations are written by the Marketplace Quality Expert AI agent; the module exposes no API to run one.
export function useQualityEvaluation(): IUseQualityEvaluation {
  const { getApiClient } = useApiClient(CatalogQualityClient);

  const evaluation = ref<QualityData | null>(null);

  const { action: loadEvaluation, loading } = useAsync<IQualityEvaluationArgs>(async (args) => {
    if (!args?.entityId || !args.targetId) return;
    const client = await getApiClient();
    evaluation.value =
      (await client.dataGetByEntity(args.entityId, QUALITY_PRODUCT_ENTITY_TYPE, args.targetId)) ?? null;
  });

  return {
    loading: computed(() => loading.value),
    evaluation,
    isScored: computed(() => !!(evaluation.value?.id || evaluation.value?.suggestions)),
    loadEvaluation,
  };
}

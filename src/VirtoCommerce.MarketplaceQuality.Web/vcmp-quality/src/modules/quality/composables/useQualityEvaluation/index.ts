import { CatalogQualityClient, type QualityData } from "../../../../api_client/virtocommerce.catalogquality";
import { computed, type ComputedRef, type Ref, ref } from "vue";
import { useApiClient, useAsync } from "@vc-shell/framework";

export const QUALITY_PRODUCT_ENTITY_TYPE = "VirtoCommerce.MarketplaceVendorModule.Core.Domains.SellerProduct";

export interface IQualityEvaluationArgs {
  entityId: string;
  targetId: string;
}

export interface IUseQualityEvaluation {
  loading: ComputedRef<boolean>;
  evaluation: Ref<QualityData | null>;
  isScored: ComputedRef<boolean>;
  loadEvaluation: (args?: IQualityEvaluationArgs) => Promise<void>;
}

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

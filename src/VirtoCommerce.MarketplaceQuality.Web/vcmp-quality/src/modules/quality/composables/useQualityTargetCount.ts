import { ref, watch, type Ref } from "vue";
import { useApiClient, useAsync } from "@vc-shell/framework";
import { CatalogQualityClient } from "../../../api_client/virtocommerce.catalogquality";

export function useQualityTargetCount(productId: Ref<string | undefined>) {
  const { getApiClient } = useApiClient(CatalogQualityClient);

  const count = ref(0);

  const { loading, action: loadCount } = useAsync(async () => {
    const client = await getApiClient();
    try {
      const result = await client.targetSearch({ take: 0 });
      count.value = result.totalCount ?? 0;
    } catch {
      // A seller without catalog-quality:read gets 403 here. The badge is decoration — don't
      // raise an error on every product open; the targets blade reports the failure if opened.
      count.value = 0;
    }
  });

  // Targets are global, so a product reload doesn't change the count — only a different product
  // (the blade being reused for another one) needs a fresh load.
  watch(
    productId,
    async (newVal, oldVal) => {
      if (newVal && newVal !== oldVal) {
        await loadCount();
      }
    },
    { immediate: true },
  );

  return { count, loading, refresh: loadCount };
}

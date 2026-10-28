import { ref, watch, type Ref } from "vue";
import { useApiClient, useAsync } from "@vc-shell/framework";
import { CatalogQualityClient } from "../../../api_client/virtocommerce.catalogquality";

export function useQualityTargetCount(entityId: Ref<string | undefined>, entityType: string) {
  const { getApiClient } = useApiClient(CatalogQualityClient);

  const count = ref(0);

  const { loading, action: loadCount } = useAsync(async () => {
    const client = await getApiClient();
    try {
      // take: 0 — only the total of the entity type's targets is needed, not the targets themselves
      const result = await client.targetSearch({ entityType, take: 0 });
      count.value = result.totalCount ?? 0;
    } catch {
      // A seller without catalog-quality:read gets 403 here. The badge is decoration — don't
      // raise an error on every entity open; the targets blade reports the failure if opened.
      count.value = 0;
    }
  });

  // Targets are global, so an entity reload doesn't change the count — only a different entity
  // (the blade being reused for another one) needs a fresh load.
  watch(
    entityId,
    async (newVal, oldVal) => {
      if (newVal && newVal !== oldVal) {
        await loadCount();
      }
    },
    { immediate: true },
  );

  return { count, loading, refresh: loadCount };
}

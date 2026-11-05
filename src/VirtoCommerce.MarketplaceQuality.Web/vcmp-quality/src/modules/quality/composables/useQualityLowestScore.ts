import { ref, watch, type Ref } from "vue";
import { useApiClient, useAsync } from "@vc-shell/framework";
import { CatalogQualityClient } from "../../../api_client/virtocommerce.catalogquality";
import { useQualityScoring } from "./useQualityScoring";

const PAGE_SIZE = 100;

/** The lowest readiness score of the entity across its scored targets; undefined while nothing is scored. */
export function useQualityLowestScore(entityId: Ref<string | undefined>, entityType: string) {
  const { getApiClient } = useApiClient(CatalogQualityClient);

  const score = ref<number>();

  const { loading, action: loadScore } = useAsync(async () => {
    const id = entityId.value;
    if (!id) {
      score.value = undefined;
      return;
    }

    const client = await getApiClient();
    try {
      let lowest: number | undefined;
      let skip = 0;

      // An entity has at most one evaluation per target, so this is normally a single page.
      for (;;) {
        const page = await client.dataSearch({ entityId: id, entityType, skip, take: PAGE_SIZE });
        const items = page?.results ?? [];
        for (const data of items) {
          if (data.targetId) {
            const value = data.readinessScore ?? 0;
            lowest = lowest === undefined ? value : Math.min(lowest, value);
          }
        }
        skip += items.length;
        if (!items.length || skip >= (page?.totalCount ?? 0)) break;
      }

      score.value = lowest;
    } catch {
      // A seller without catalog-quality:read gets 403 here. The badge is decoration — don't
      // raise an error on every entity open; the targets blade reports the failure if opened.
      score.value = undefined;
    }
  });

  // The expert saves the evaluations itself, so the score is reloaded when a run of this entity is over.
  useQualityScoring({
    onFinished: (message) => {
      const id = entityId.value;
      if (message.entityType === entityType && !!id && message.entityIds?.includes(id)) {
        loadScore();
      }
    },
  });

  // Only a different entity (the blade being reused for another one) needs a fresh load.
  watch(
    entityId,
    async (newVal, oldVal) => {
      if (newVal && newVal !== oldVal) {
        await loadScore();
      }
    },
    { immediate: true },
  );

  return { score, loading, refresh: loadScore };
}

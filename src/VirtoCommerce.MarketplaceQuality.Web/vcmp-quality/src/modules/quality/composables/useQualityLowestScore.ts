import { ref, watch, type Ref } from "vue";
import { useApiClient, useAsync } from "@vc-shell/framework";
import { CatalogQualityClient } from "../../../api_client/virtocommerce.catalogquality";
import { useQualityScoring } from "./useQualityScoring";

const PAGE_SIZE = 100;

/** Loads every page of a skip/take search. */
async function searchAll<T>(
  search: (skip: number, take: number) => Promise<{ results?: T[]; totalCount?: number } | undefined>,
): Promise<T[]> {
  const all: T[] = [];
  for (;;) {
    const page = await search(all.length, PAGE_SIZE);
    const items = page?.results ?? [];
    all.push(...items);
    if (!items.length || all.length >= (page?.totalCount ?? 0)) break;
  }
  return all;
}

/**
 * The lowest readiness score of the entity across the existing targets of its type;
 * undefined while none of them is scored.
 */
export function useQualityLowestScore(entityId: Ref<string | undefined>, entityType: string) {
  const { getApiClient } = useApiClient(CatalogQualityClient);

  const score = ref<number>();
  // False until the entity's score has been loaded, so "not scored" isn't shown before it is known.
  const loaded = ref(false);

  const { loading, action: loadScore } = useAsync(async () => {
    const id = entityId.value;
    if (!id) {
      score.value = undefined;
      loaded.value = false;
      return;
    }

    const client = await getApiClient();
    try {
      // An evaluation may outlive its target, so only the scores of the current targets count —
      // the same ones the targets blade lists.
      const [targets, evaluations] = await Promise.all([
        searchAll((skip, take) => client.targetSearch({ entityType, skip, take })),
        searchAll((skip, take) => client.dataSearch({ entityId: id, entityType, skip, take })),
      ]);
      const targetIds = new Set(targets.map((target) => target.id));

      let lowest: number | undefined;
      for (const data of evaluations) {
        if (data.targetId && targetIds.has(data.targetId)) {
          const value = data.readinessScore ?? 0;
          lowest = lowest === undefined ? value : Math.min(lowest, value);
        }
      }

      score.value = lowest;
    } catch {
      // A seller without catalog-quality:read gets 403 here. The badge is decoration — don't
      // raise an error on every entity open; the targets blade reports the failure if opened.
      score.value = undefined;
    }
    loaded.value = true;
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
        // The previous entity's score doesn't apply to this one.
        loaded.value = false;
        await loadScore();
      }
    },
    { immediate: true },
  );

  return { score, loaded, loading, refresh: loadScore };
}

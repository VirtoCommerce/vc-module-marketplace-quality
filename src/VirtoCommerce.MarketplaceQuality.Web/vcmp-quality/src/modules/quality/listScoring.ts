import { computed, unref, type MaybeRef } from "vue";
import { i18n, registerExternalToolbarItem, type BladeContext } from "@vc-shell/framework";
import { startQualityScoring, useQualityScoring } from "./composables/useQualityScoring";
import type { QualityEntityConfig } from "./entities";

export const LIST_SCORING_TOOLBAR_ITEM_ID = "qualityRunScoring";

/** Ids of the rows checked in the host list blade, which exposes them via defineBladeContext({ selectedItems }). */
export function getSelectedIds(ctx: BladeContext | undefined): string[] {
  const items = unref(ctx?.selectedItems as MaybeRef<{ id?: string }[] | undefined>) ?? [];
  return items.map((item) => item.id).filter((id): id is string => !!id);
}

/** Starts scoring the checked rows; the run's notifications show its progress and outcome. */
export function runListScoring(entityType: string, entityIds: string[]): Promise<void> {
  return startQualityScoring({ entityType, entityIds, locale: unref(i18n.global.locale as MaybeRef<string>) });
}

/** Adds the bulk "Run scoring" button to the host list blade of each scorable entity type. */
export function registerListScoring(entities: QualityEntityConfig[]): void {
  for (const entity of entities) {
    if (!entity.scorable || !entity.listBlade) continue;

    registerExternalToolbarItem({
      id: LIST_SCORING_TOOLBAR_ITEM_ID,
      title: computed(() => i18n.global.t("QUALITY.TARGETS.TOOLBAR.RUN_SCORING")),
      icon: "lucide-sparkles",
      targetBlades: [entity.listBlade],
      // Same rule as every "Run scoring" button: disabled while a run started in this browser is going
      disabled: (_blade, ctx) => useQualityScoring().scoring.value || !getSelectedIds(ctx).length,
      clickHandler: (_blade, ctx) => runListScoring(entity.entityType, getSelectedIds(ctx)),
    });
  }
}

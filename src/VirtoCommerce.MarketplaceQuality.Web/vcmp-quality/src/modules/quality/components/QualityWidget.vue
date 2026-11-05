<template>
  <VcWidget
    icon="lucide-gauge"
    :title="$t('QUALITY.WIDGET.TITLE')"
    :value="score ?? $t('QUALITY.WIDGET.NOT_SCORED')"
    :badge-variant="badgeVariant"
    :disabled="loading"
    @click="onClick"
  />
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { injectBladeContext, useBlade } from "@vc-shell/framework";
import { VcWidget } from "@vc-shell/framework/ui";
import { useQualityLowestScore } from "../composables";
import type { QualityBladeOptions, QualityItem } from "../types";

const props = defineProps<{
  /** Quality entity type of the host blade's item. */
  entityType: string;
}>();

const { openBlade } = useBlade();
const bladeContext = injectBladeContext();
// Host details blades (ProductDetails, Offer) expose their entity via defineBladeContext({ item }).
const item = computed(() => bladeContext.value?.item as QualityItem | undefined);

// The badge shows the weakest target's score, so the seller sees how far the entity is from passing them all.
const { score, loading } = useQualityLowestScore(
  computed(() => item.value?.id),
  props.entityType,
);

// Red up to 75, yellow up to 90, green above; N/A is grey so it doesn't read as a score.
const badgeVariant = computed(() => {
  if (score.value === undefined) return "secondary";
  if (score.value <= 75) return "danger";
  if (score.value <= 90) return "warning";
  return "success";
});

function onClick() {
  openBlade({
    name: "QualityTargets",
    options: {
      entityType: props.entityType,
      entityId: item.value?.id,
      entityName: item.value?.name,
      item: item.value,
    } satisfies QualityBladeOptions,
  });
}
</script>

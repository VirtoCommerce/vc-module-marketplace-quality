<template>
  <VcWidget
    icon="lucide-gauge"
    :title="$t('QUALITY.WIDGET.TITLE')"
    :value="count"
    :disabled="loading"
    @click="onClick"
  />
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { injectBladeContext, useBlade } from "@vc-shell/framework";
import { VcWidget } from "@vc-shell/framework/ui";
import { useQualityTargetCount } from "../composables";
import type { QualityBladeOptions, QualityItem } from "../types";

const props = defineProps<{
  /** Quality entity type of the host blade's item. */
  entityType: string;
}>();

const { openBlade } = useBlade();
const bladeContext = injectBladeContext();
// Host details blades (ProductDetails, Offer) expose their entity via defineBladeContext({ item }).
const item = computed(() => bladeContext.value?.item as QualityItem | undefined);

const { count, loading } = useQualityTargetCount(
  computed(() => item.value?.id),
  props.entityType,
);

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

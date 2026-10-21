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
import type { QualityProduct } from "../types";

const { openBlade } = useBlade();
const bladeContext = injectBladeContext();
// Host ProductDetails blade exposes its SellerProduct via defineBladeContext({ item }).
const product = computed(() => bladeContext.value?.item as QualityProduct | undefined);

const { count, loading } = useQualityTargetCount(computed(() => product.value?.id));

function onClick() {
  openBlade({
    name: "QualityTargets",
    options: {
      sellerProductId: product.value?.id,
      productName: product.value?.name,
      product: product.value,
    },
  });
}
</script>

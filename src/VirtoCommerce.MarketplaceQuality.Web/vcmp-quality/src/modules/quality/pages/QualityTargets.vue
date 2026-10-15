<template>
  <VcBlade
    data-test-id="product-quality-targets-blade"
    :title="$t('QUALITY.TARGETS.TITLE')"
    :subtitle="options?.productName"
    width="50%"
    :toolbar-items="bladeToolbar"
  >
    <VcDataTable
      v-model:sort-field="sortField"
      v-model:sort-order="sortOrder"
      :active-item-id="activeChildParam"
      data-test-id="product-quality-targets-table"
      class="tw-grow tw-basis-0"
      :loading="loading || scoresLoading"
      :items="targets"
      :total-count="pagination.totalCount"
      :pagination="pagination"
      state-key="product_quality_targets"
      :pull-to-refresh="true"
      :empty-state="{
        icon: 'lucide-gauge',
        title: $t('QUALITY.TARGETS.EMPTY.NO_ITEMS'),
      }"
      @row-click="onItemClick"
      @pagination-click="pagination.goToPage"
      @pull-refresh="reload"
    >
      <VcColumn
        id="name"
        :title="t('QUALITY.TARGETS.TABLE.HEADER.NAME')"
        :sortable="true"
        :always-visible="true"
      />

      <VcColumn
        id="score"
        :title="t('QUALITY.TARGETS.TABLE.HEADER.SCORE')"
        :always-visible="true"
      >
        <template #body="{ data }">
          {{ formatScore(data.id) }}
        </template>
      </VcColumn>
    </VcDataTable>
  </VcBlade>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch, type Ref } from "vue";
import { IBladeToolbar, useBlade, useDataTableSort, hotkey } from "@vc-shell/framework";
import { useAiAgentContext } from "@vc-shell/framework/ai-agent";
import { useI18n } from "vue-i18n";
import { useQualityTargets, useProductQualityScores } from "../composables";
import type { QualityTarget } from "../../../api_client/virtocommerce.catalogquality";
import type { QualityProduct } from "../types";

import { VcBlade, VcColumn, VcDataTable } from "@vc-shell/framework/ui";

defineBlade({
  name: "QualityTargets",
});

const { openBlade, options, activeChildParam } = useBlade<{
  /** Catalog product the evaluations are stored under. */
  stagedProductDataId?: string;
  productName?: string;
  product?: QualityProduct;
}>();
const { t } = useI18n({ useScope: "global" });

// Same item the host ProductDetails blade sends, so the AI assistant knows which product this is about.
useAiAgentContext({ dataRef: computed(() => options.value?.product) as Ref<QualityProduct> });

const { searchQuery, loading, pagination, targets, searchTargets } = useQualityTargets({
  stateKey: "product_quality_targets",
});

const { scores, loading: scoresLoading, loadScores } = useProductQualityScores();

const { sortField, sortOrder, sortExpression } = useDataTableSort({
  stateKey: "product_quality_targets",
  initialField: "name",
  initialDirection: "ASC",
});

const bladeToolbar = ref<IBladeToolbar[]>([
  {
    id: "refresh",
    title: computed(() => t("QUALITY.TARGETS.TOOLBAR.REFRESH")),
    icon: "lucide-refresh-cw",
    shortcut: hotkey.r,
    async clickHandler() {
      await reload();
    },
  },
]);

// Scores cover every target, so sorting and paging only re-query the targets.
function formatScore(targetId?: string) {
  const score = targetId ? scores.value[targetId] : undefined;
  return score === undefined ? t("QUALITY.TARGETS.TABLE.NOT_SCORED") : `${score} / 100`;
}

watch(sortExpression, async (value) => {
  await searchTargets({ ...searchQuery.value, sort: value });
});

onMounted(async () => {
  await reload();
});

async function reload() {
  await Promise.all([
    searchTargets({
      ...searchQuery.value,
      skip: pagination.skip,
      sort: sortExpression.value,
    }),
    loadScores(options.value?.stagedProductDataId),
  ]);
}

function onItemClick(event: { data: QualityTarget }) {
  openBlade({
    name: "QualityEvaluation",
    param: event.data.id,
    options: {
      stagedProductDataId: options.value?.stagedProductDataId,
      productName: options.value?.productName,
      product: options.value?.product,
      targetName: event.data.name,
    },
  });
}
</script>

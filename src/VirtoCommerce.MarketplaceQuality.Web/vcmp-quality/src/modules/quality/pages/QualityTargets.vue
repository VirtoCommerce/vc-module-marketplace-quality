<template>
  <VcBlade
    data-test-id="quality-targets-blade"
    :title="$t('QUALITY.TARGETS.TITLE')"
    :subtitle="options?.entityName"
    width="50%"
    :toolbar-items="bladeToolbar"
  >
    <VcDataTable
      v-model:sort-field="sortField"
      v-model:sort-order="sortOrder"
      :active-item-id="activeChildParam"
      data-test-id="quality-targets-table"
      class="tw-grow tw-basis-0"
      :loading="loading || scoresLoading || entityScoring"
      :items="targets"
      :total-count="pagination.totalCount"
      :pagination="pagination"
      :state-key="stateKey"
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
import { useQualityTargets, useQualityScores, useQualityScoring } from "../composables";
import { getQualityEntity } from "../entities";
import type { QualityTarget } from "../../../api_client/virtocommerce.catalogquality";
import type { QualityBladeOptions, QualityItem } from "../types";

import { VcBlade, VcColumn, VcDataTable } from "@vc-shell/framework/ui";

defineBlade({
  name: "QualityTargets",
});

const { openBlade, closeChildren, options, activeChildParam } = useBlade<QualityBladeOptions>();
const { t, locale } = useI18n({ useScope: "global" });

// The blade is opened for one entity, so its type is fixed for the blade's lifetime.
const entityType = options.value?.entityType ?? "";
const entity = getQualityEntity(entityType);
const stateKey = entity?.stateKey ?? "quality_targets";

// Same item the host details blade sends, so the AI assistant knows which entity this is about.
useAiAgentContext({ dataRef: computed(() => options.value?.item) as Ref<QualityItem> });

const { searchQuery, loading, pagination, targets, searchTargets } = useQualityTargets({ entityType, stateKey });

const { scores, loading: scoresLoading, loadScores } = useQualityScores(entityType);

// The expert saves the evaluations itself, so the scores are reloaded when a run of this entity is over,
// wherever it was started.
const { scoring, isEntityScoring, runScoring } = useQualityScoring({
  onFinished: (message) => {
    const entityId = options.value?.entityId;
    if (message.entityType === entityType && !!entityId && message.entityIds?.includes(entityId)) {
      reload();
    }
  },
});
const entityScoring = computed(() => isEntityScoring(entityType, options.value?.entityId));

const { sortField, sortOrder, sortExpression } = useDataTableSort({
  stateKey,
  initialField: "name",
  initialDirection: "ASC",
});

const bladeToolbar = ref<IBladeToolbar[]>([
  {
    id: "runScoring",
    title: computed(() => t("QUALITY.TARGETS.TOOLBAR.RUN_SCORING")),
    icon: "lucide-sparkles",
    // Hidden for an entity type without a quality expert agent yet.
    isVisible: !!entity?.scorable,
    // Same rule as every "Run scoring" button: disabled while a run started in this browser is going
    disabled: computed(() => scoring.value || !options.value?.entityId),
    async clickHandler() {
      await score();
    },
  },
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
    loadScores(options.value?.entityId),
  ]);
}

async function score() {
  const entityId = options.value?.entityId;
  if (!entityId || !entity?.scorable) return;

  await closeChildren();
  await runScoring({ entityType, entityIds: [entityId], locale: locale.value });
}

function onItemClick(event: { data: QualityTarget }) {
  openBlade({
    name: "QualityEvaluation",
    param: event.data.id,
    options: {
      entityType,
      entityId: options.value?.entityId,
      entityName: options.value?.entityName,
      item: options.value?.item,
      targetName: event.data.name,
    },
  });
}
</script>

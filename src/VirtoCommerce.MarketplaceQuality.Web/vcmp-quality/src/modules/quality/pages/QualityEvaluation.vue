<template>
  <VcBlade
    v-loading="loading"
    data-test-id="product-quality-evaluation-blade"
    :title="$t('QUALITY.EVALUATION.TITLE')"
    :subtitle="subtitle"
    width="50%"
    :toolbar-items="bladeToolbar"
  >
    <VcContainer class="tw-p-4">
      <div
        v-if="isScored"
        class="product-quality-evaluation"
      >
        <!-- markdown-it runs with html disabled, so the agent's text cannot inject markup -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
          class="product-quality-evaluation__report"
          v-html="reportHtml"
        />

        <div
          v-if="evaluatedDate"
          class="product-quality-evaluation__meta"
        >
          {{ $t("QUALITY.EVALUATION.EVALUATED", { date: evaluatedDate }) }}
        </div>
      </div>

      <div
        v-else-if="!loading"
        class="product-quality-evaluation__empty"
      >
        <VcIcon
          icon="lucide-gauge"
          size="xl"
        />
        <span>{{ $t("QUALITY.EVALUATION.NOT_SCORED") }}</span>
      </div>
    </VcContainer>
  </VcBlade>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, type Ref } from "vue";
import { IBladeToolbar, useBlade, hotkey } from "@vc-shell/framework";
import { useAiAgentContext } from "@vc-shell/framework/ai-agent";
import { useI18n } from "vue-i18n";
import MarkdownIt from "markdown-it";
import { useQualityEvaluation } from "../composables";
import type { QualityProduct } from "../types";

import { VcBlade, VcContainer, VcIcon, vLoading } from "@vc-shell/framework/ui";

defineBlade({
  name: "QualityEvaluation",
});

const { param, options } = useBlade<{
  sellerProductId?: string;
  productName?: string;
  product?: QualityProduct;
  targetName?: string;
}>();
const { t, locale } = useI18n({ useScope: "global" });

// Same item the host ProductDetails blade sends, plus the quality target this blade shows, so the
// AI assistant evaluates the product against this target rather than picking one on its own.
const aiContextItem = computed(() => {
  const product = options.value?.product;
  if (!product) return undefined;
  return { ...product, qualityTarget: { id: param.value, name: options.value?.targetName } };
});
useAiAgentContext({ dataRef: aiContextItem as Ref<QualityProduct> });

const { loading, evaluation, isScored, loadEvaluation } = useQualityEvaluation();

const markdown = new MarkdownIt({ html: false, linkify: true });

const subtitle = computed(() => [options.value?.productName, options.value?.targetName].filter(Boolean).join(" — "));

const reportHtml = computed(() => markdown.render(evaluation.value?.suggestions ?? ""));

const evaluatedDate = computed(() => {
  const date = evaluation.value?.modifiedDate ?? evaluation.value?.createdDate;
  return date ? new Date(date).toLocaleString(locale.value) : undefined;
});

const bladeToolbar = ref<IBladeToolbar[]>([
  {
    id: "refresh",
    title: computed(() => t("QUALITY.EVALUATION.TOOLBAR.REFRESH")),
    icon: "lucide-refresh-cw",
    shortcut: hotkey.r,
    async clickHandler() {
      await reload();
    },
  },
]);

async function reload() {
  if (!options.value?.sellerProductId || !param.value) return;
  await loadEvaluation({ entityId: options.value.sellerProductId, targetId: param.value });
}

onMounted(async () => {
  await reload();
});
</script>

<style lang="scss" scoped>
.product-quality-evaluation {
  @apply tw-flex tw-flex-col tw-gap-4;

  &__meta {
    @apply tw-text-xs;
    color: var(--neutrals-500);
  }

  &__empty {
    @apply tw-flex tw-flex-col tw-items-center tw-gap-3 tw-py-10 tw-text-sm tw-text-center;
    color: var(--neutrals-500);
  }

  // Styles for the rendered markdown report (headings, the criteria table, the suggestion list)
  &__report {
    @apply tw-text-sm;
    color: var(--neutrals-800);

    :deep(h1),
    :deep(h2),
    :deep(h3),
    :deep(h4) {
      @apply tw-font-bold tw-mt-4 tw-mb-2;
    }

    :deep(h1) {
      @apply tw-text-xl;
    }

    :deep(h2) {
      @apply tw-text-lg;
    }

    :deep(h3),
    :deep(h4) {
      @apply tw-text-base;
    }

    :deep(p) {
      @apply tw-my-2;
    }

    :deep(ul),
    :deep(ol) {
      @apply tw-my-2 tw-pl-5;
    }

    :deep(ul) {
      @apply tw-list-disc;
    }

    :deep(ol) {
      @apply tw-list-decimal;
    }

    :deep(li) {
      @apply tw-my-1;
    }

    :deep(a) {
      color: var(--primary-500);
      @apply tw-underline;
    }

    :deep(code) {
      @apply tw-rounded tw-px-1;
      background-color: var(--neutrals-100);
    }

    :deep(table) {
      @apply tw-w-full tw-my-3 tw-border-collapse;
    }

    :deep(th),
    :deep(td) {
      @apply tw-px-2 tw-py-1.5 tw-text-left tw-align-top;
      border: 1px solid var(--neutrals-200);
    }

    :deep(th) {
      @apply tw-font-semibold;
      background-color: var(--neutrals-50);
    }
  }
}
</style>

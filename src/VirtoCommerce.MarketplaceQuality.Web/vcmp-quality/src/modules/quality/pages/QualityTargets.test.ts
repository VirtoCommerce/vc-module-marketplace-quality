import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, computed, nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import { createMockBlade, mockHotkey } from "../../../test/harness/mockFramework";
import { mountBlade } from "../../../test/harness/mountBlade";

// ---------------------------------------------------------------------------
// Shared mock state -- reset before each test
// ---------------------------------------------------------------------------
let mockBlade: ReturnType<typeof createMockBlade>;
let mockSort: ReturnType<typeof createSort>;
let mockTargets: {
  searchQuery: ReturnType<typeof ref<Record<string, unknown>>>;
  loading: ReturnType<typeof ref<boolean>>;
  pagination: { skip: number; totalCount: number; goToPage: ReturnType<typeof vi.fn> };
  targets: ReturnType<typeof computed>;
  searchTargets: ReturnType<typeof vi.fn>;
};
let mockScores: {
  scores: ReturnType<typeof ref<Record<string, number>>>;
  loading: ReturnType<typeof ref<boolean>>;
  loadScores: ReturnType<typeof vi.fn>;
};

function createSort() {
  const sortField = ref("name");
  const sortOrder = ref("ASC");
  return {
    sortField,
    sortOrder,
    sortExpression: computed(() => `${sortField.value}:${sortOrder.value}`),
  };
}

// ---------------------------------------------------------------------------
// Module-level mocks (MUST be before dynamic import)
// ---------------------------------------------------------------------------
vi.mock("@vc-shell/framework", () => ({
  hotkey: mockHotkey,
  useBlade: () => mockBlade,
  useDataTableSort: () => mockSort,
}));

vi.mock("@vc-shell/framework/ui", () => ({
  VcBlade: {
    name: "VcBlade",
    template: '<div class="vc-blade"><slot /></div>',
    props: ["title", "subtitle", "width", "toolbarItems"],
  },
  // Hands its rows to the columns, so a column's #body slot renders one cell per row.
  VcDataTable: {
    name: "VcDataTable",
    template: "<div><slot /></div>",
    props: ["items", "loading", "totalCount", "pagination", "stateKey", "activeItemId", "emptyState"],
    emits: ["row-click", "pagination-click", "pull-refresh"],
    provide() {
      return { getTableItems: () => (this as any).items ?? [] };
    },
  },
  VcColumn: {
    name: "VcColumn",
    template:
      '<div :class="`col-${id}`"><div v-for="item in getTableItems()" :key="item.id" class="cell"><slot name="body" :data="item" /></div></div>',
    props: ["id", "title", "sortable", "alwaysVisible"],
    inject: ["getTableItems"],
  },
}));

vi.mock("../composables", () => ({
  useQualityTargets: () => mockTargets,
  useProductQualityScores: () => mockScores,
}));

const useAiAgentContext = vi.fn();
vi.mock("@vc-shell/framework/ai-agent", () => ({ useAiAgentContext }));

const product = { id: "prod-1", name: "Gift Box", stagedProductDataId: "staged-1", objectType: "SellerProduct" };

// ---------------------------------------------------------------------------
// Dynamic import of the component (MUST come AFTER vi.mock declarations)
// ---------------------------------------------------------------------------
const QualityTargets = (await import("./QualityTargets.vue")).default;

function initMocks(
  options: Record<string, unknown> = { stagedProductDataId: "staged-1", productName: "Gift Box", product },
) {
  mockBlade = createMockBlade({ options: ref(options) });
  mockSort = createSort();
  mockTargets = {
    searchQuery: ref<Record<string, unknown>>({ take: 20 }),
    loading: ref(false),
    pagination: { skip: 0, totalCount: 2, goToPage: vi.fn() },
    targets: computed(() => [
      { id: "t1", name: "Catalog Publishing", description: "Publication readiness" },
      { id: "t2", name: "Catalog Translating", description: "Translation completeness" },
    ]),
    searchTargets: vi.fn().mockResolvedValue(undefined),
  };
  mockScores = {
    scores: ref<Record<string, number>>({ t1: 53 }),
    loading: ref(false),
    loadScores: vi.fn().mockResolvedValue(undefined),
  };
}

function toolbarItem(wrapper: Awaited<ReturnType<typeof mountBlade>>, id: string) {
  const items = wrapper.findComponent({ name: "VcBlade" }).props("toolbarItems") as any[];
  return items.find((i) => i.id === id);
}

describe("QualityTargets.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initMocks();
  });

  it("shows the product name as the blade subtitle", async () => {
    const wrapper = await mountBlade(QualityTargets);

    expect(wrapper.findComponent({ name: "VcBlade" }).props("subtitle")).toBe("Gift Box");
  });

  // =========================================================================
  // Loading
  // =========================================================================
  it("loads targets on mount with the current sort and page", async () => {
    await mountBlade(QualityTargets);
    await flushPromises();

    expect(mockTargets.searchTargets).toHaveBeenCalledWith({ take: 20, skip: 0, sort: "name:ASC" });
  });

  it("loads the product's scores on mount by staged product id", async () => {
    await mountBlade(QualityTargets);
    await flushPromises();

    expect(mockScores.loadScores).toHaveBeenCalledWith("staged-1");
  });

  it.each([
    ["targets", () => (mockTargets.loading.value = true)],
    ["scores", () => (mockScores.loading.value = true)],
  ])("shows the table as loading while %s load", async (_label, setLoading) => {
    setLoading();
    const wrapper = await mountBlade(QualityTargets);

    expect(wrapper.findComponent({ name: "VcDataTable" }).props("loading")).toBe(true);
  });

  // =========================================================================
  // Columns
  // =========================================================================
  it("shows only the name and score columns, name sortable", async () => {
    const wrapper = await mountBlade(QualityTargets);
    const columns = wrapper.findAllComponents({ name: "VcColumn" }).map((c) => c.props());

    expect(columns.map((c) => c.id)).toEqual(["name", "score"]);
    expect(columns[0].sortable).toBe(true);
    expect(columns[1].sortable).toBeFalsy();
  });

  it("shows each target's score out of 100, or N/A when not scored", async () => {
    const wrapper = await mountBlade(QualityTargets);
    const cells = wrapper.findAll(".col-score .cell").map((c) => c.text());

    expect(cells).toEqual(["53 / 100", "QUALITY.TARGETS.TABLE.NOT_SCORED"]);
  });

  it("shows a zero score as a score, not N/A", async () => {
    mockScores.scores.value = { t1: 0 };
    const wrapper = await mountBlade(QualityTargets);

    expect(wrapper.findAll(".col-score .cell")[0].text()).toBe("0 / 100");
  });

  it("updates the score cells when scores arrive", async () => {
    mockScores.scores.value = {};
    const wrapper = await mountBlade(QualityTargets);
    expect(wrapper.findAll(".col-score .cell")[1].text()).toBe("QUALITY.TARGETS.TABLE.NOT_SCORED");

    mockScores.scores.value = { t2: 88 };
    await nextTick();

    expect(wrapper.findAll(".col-score .cell")[1].text()).toBe("88 / 100");
  });

  // =========================================================================
  // Navigation
  // =========================================================================
  it("opens the evaluation blade for the clicked target", async () => {
    const wrapper = await mountBlade(QualityTargets);

    wrapper
      .findComponent({ name: "VcDataTable" })
      .vm.$emit("row-click", { data: { id: "t2", name: "Catalog Translating" } });

    expect(mockBlade.openBlade).toHaveBeenCalledWith({
      name: "QualityEvaluation",
      param: "t2",
      options: {
        stagedProductDataId: "staged-1",
        productName: "Gift Box",
        product,
        targetName: "Catalog Translating",
      },
    });
  });

  // =========================================================================
  // AI assistant context
  // =========================================================================
  it("gives the AI assistant the product as details context", async () => {
    await mountBlade(QualityTargets);

    expect(useAiAgentContext).toHaveBeenCalledTimes(1);
    expect(useAiAgentContext.mock.calls[0][0].dataRef.value).toEqual(product);
  });

  it("gives the AI assistant no item when the blade was opened without a product", async () => {
    initMocks({ stagedProductDataId: "staged-1" });
    await mountBlade(QualityTargets);

    expect(useAiAgentContext.mock.calls[0][0].dataRef.value).toBeUndefined();
  });

  // =========================================================================
  // Reloading
  // =========================================================================
  it("re-searches targets, but not scores, when the sort changes", async () => {
    await mountBlade(QualityTargets);
    await flushPromises();
    mockTargets.searchTargets.mockClear();
    mockScores.loadScores.mockClear();

    mockSort.sortOrder.value = "DESC";
    await nextTick();

    expect(mockTargets.searchTargets).toHaveBeenCalledWith(expect.objectContaining({ sort: "name:DESC" }));
    expect(mockScores.loadScores).not.toHaveBeenCalled();
  });

  it("reloads targets and scores on pull-to-refresh", async () => {
    const wrapper = await mountBlade(QualityTargets);
    await flushPromises();
    mockTargets.searchTargets.mockClear();
    mockScores.loadScores.mockClear();

    wrapper.findComponent({ name: "VcDataTable" }).vm.$emit("pull-refresh");
    await flushPromises();

    expect(mockTargets.searchTargets).toHaveBeenCalledTimes(1);
    expect(mockScores.loadScores).toHaveBeenCalledWith("staged-1");
  });

  it("refresh toolbar button reloads targets and scores and is bound to the R hotkey", async () => {
    const wrapper = await mountBlade(QualityTargets);
    await flushPromises();
    mockTargets.searchTargets.mockClear();
    mockScores.loadScores.mockClear();

    const refresh = toolbarItem(wrapper, "refresh");
    expect(refresh.shortcut).toEqual({ key: "r" });

    await refresh.clickHandler();
    expect(mockTargets.searchTargets).toHaveBeenCalledTimes(1);
    expect(mockScores.loadScores).toHaveBeenCalledTimes(1);
  });
});

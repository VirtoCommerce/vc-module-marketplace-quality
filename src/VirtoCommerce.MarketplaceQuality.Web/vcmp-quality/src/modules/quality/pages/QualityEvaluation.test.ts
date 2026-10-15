import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, computed } from "vue";
import { flushPromises } from "@vue/test-utils";
import { createMockBlade, mockHotkey } from "../../../test/harness/mockFramework";
import { mountBlade } from "../../../test/harness/mountBlade";
import type { QualityData } from "../../../api_client/virtocommerce.catalogquality";

// ---------------------------------------------------------------------------
// Shared mock state -- reset before each test
// ---------------------------------------------------------------------------
let mockBlade: ReturnType<typeof createMockBlade>;
let mockEvaluation: {
  loading: ReturnType<typeof ref<boolean>>;
  evaluation: ReturnType<typeof ref<QualityData | null>>;
  isScored: ReturnType<typeof computed<boolean>>;
  loadEvaluation: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Module-level mocks (MUST be before dynamic import)
// ---------------------------------------------------------------------------
vi.mock("@vc-shell/framework", () => ({
  hotkey: mockHotkey,
  useBlade: () => mockBlade,
}));

vi.mock("@vc-shell/framework/ui", () => ({
  VcBlade: {
    name: "VcBlade",
    template: '<div class="vc-blade"><slot /></div>',
    props: ["title", "subtitle", "width", "toolbarItems"],
  },
  VcContainer: { name: "VcContainer", template: "<div><slot /></div>" },
  VcIcon: { name: "VcIcon", template: "<i></i>", props: ["icon", "size"] },
  vLoading: { mounted: () => {}, updated: () => {} },
}));

vi.mock("../composables", () => ({
  useQualityEvaluation: () => mockEvaluation,
}));

const useAiAgentContext = vi.fn();
vi.mock("@vc-shell/framework/ai-agent", () => ({ useAiAgentContext }));

// ---------------------------------------------------------------------------
// Dynamic import of the component (MUST come AFTER vi.mock declarations)
// ---------------------------------------------------------------------------
const QualityEvaluation = (await import("./QualityEvaluation.vue")).default;

function initMocks(
  overrides: { param?: string; options?: Record<string, unknown>; evaluation?: QualityData | null } = {},
) {
  mockBlade = createMockBlade({
    param: ref<string | undefined>("param" in overrides ? overrides.param : "target-1"),
    options: ref(
      overrides.options ?? { stagedProductDataId: "staged-1", productName: "Gift Box", targetName: "SEO" },
    ),
  });

  const evaluation = ref<QualityData | null>(overrides.evaluation ?? null);
  mockEvaluation = {
    loading: ref(false),
    evaluation,
    isScored: computed(() => !!(evaluation.value?.id || evaluation.value?.suggestions)),
    loadEvaluation: vi.fn().mockResolvedValue(undefined),
  };
}

describe("QualityEvaluation.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initMocks();
  });

  // =========================================================================
  // Loading
  // =========================================================================
  it("loads the evaluation for the staged product and the target on mount", async () => {
    await mountBlade(QualityEvaluation);
    await flushPromises();

    expect(mockEvaluation.loadEvaluation).toHaveBeenCalledWith({ entityId: "staged-1", targetId: "target-1" });
  });

  it("does not load without a staged product id", async () => {
    initMocks({ options: { productName: "Gift Box" } });

    await mountBlade(QualityEvaluation);
    await flushPromises();

    expect(mockEvaluation.loadEvaluation).not.toHaveBeenCalled();
  });

  it("does not load without a target id", async () => {
    initMocks({ param: undefined });

    await mountBlade(QualityEvaluation);
    await flushPromises();

    expect(mockEvaluation.loadEvaluation).not.toHaveBeenCalled();
  });

  it("refresh toolbar button reloads the evaluation", async () => {
    const wrapper = await mountBlade(QualityEvaluation);
    await flushPromises();
    mockEvaluation.loadEvaluation.mockClear();

    const items = wrapper.findComponent({ name: "VcBlade" }).props("toolbarItems") as any[];
    const refresh = items.find((i) => i.id === "refresh");
    expect(refresh.shortcut).toEqual({ key: "r" });

    await refresh.clickHandler();
    expect(mockEvaluation.loadEvaluation).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  // AI assistant context
  // =========================================================================
  it("gives the AI assistant the product together with the opened quality target", async () => {
    const product = { id: "prod-1", name: "Gift Box", stagedProductDataId: "staged-1" };
    initMocks({ options: { stagedProductDataId: "staged-1", targetName: "Catalog Translating", product } });
    await mountBlade(QualityEvaluation);

    expect(useAiAgentContext).toHaveBeenCalledTimes(1);
    expect(useAiAgentContext.mock.calls[0][0].dataRef.value).toEqual({
      ...product,
      qualityTarget: { id: "target-1", name: "Catalog Translating" },
    });
  });

  it("does not change the product object it was given", async () => {
    const product = { id: "prod-1", name: "Gift Box" };
    initMocks({ options: { targetName: "Catalog Translating", product } });
    await mountBlade(QualityEvaluation);

    expect(product).not.toHaveProperty("qualityTarget");
  });

  it("gives the AI assistant no item when the blade was opened without a product", async () => {
    initMocks({ options: { stagedProductDataId: "staged-1", targetName: "SEO" } });
    await mountBlade(QualityEvaluation);

    expect(useAiAgentContext.mock.calls[0][0].dataRef.value).toBeUndefined();
  });

  // =========================================================================
  // Subtitle
  // =========================================================================
  it("joins product and target names in the subtitle", async () => {
    const wrapper = await mountBlade(QualityEvaluation);

    expect(wrapper.findComponent({ name: "VcBlade" }).props("subtitle")).toBe("Gift Box — SEO");
  });

  it("omits missing names from the subtitle", async () => {
    initMocks({ options: { stagedProductDataId: "staged-1", targetName: "SEO" } });
    const wrapper = await mountBlade(QualityEvaluation);

    expect(wrapper.findComponent({ name: "VcBlade" }).props("subtitle")).toBe("SEO");
  });

  // =========================================================================
  // Not scored
  // =========================================================================
  it("shows the not-scored message when there is no evaluation", async () => {
    const wrapper = await mountBlade(QualityEvaluation);

    expect(wrapper.find(".product-quality-evaluation__empty").exists()).toBe(true);
    expect(wrapper.find(".product-quality-evaluation").exists()).toBe(false);
  });

  it("hides the not-scored message while loading", async () => {
    mockEvaluation.loading.value = true;
    const wrapper = await mountBlade(QualityEvaluation);

    expect(wrapper.find(".product-quality-evaluation__empty").exists()).toBe(false);
  });

  // =========================================================================
  // Score
  // =========================================================================
  it("has no separate score header — the report carries the score", async () => {
    initMocks({ evaluation: { id: "qd-1", readinessScore: 53, suggestions: "**Quality score: 53 / 100**" } });
    const wrapper = await mountBlade(QualityEvaluation);
    const content = wrapper.find(".product-quality-evaluation");

    expect(content.find(".product-quality-evaluation__score").exists()).toBe(false);
    expect(content.element.firstElementChild?.classList).toContain("product-quality-evaluation__report");
    expect(content.text()).toContain("Quality score: 53 / 100");
  });

  // =========================================================================
  // Report
  // =========================================================================
  it("renders the markdown report", async () => {
    initMocks({
      evaluation: { id: "qd-1", suggestions: "## Findings\n\n- Add **alt text**\n\n| A | B |\n|---|---|\n| 1 | 2 |" },
    });
    const wrapper = await mountBlade(QualityEvaluation);
    const report = wrapper.find(".product-quality-evaluation__report");

    expect(report.find("h2").text()).toBe("Findings");
    expect(report.find("li strong").text()).toBe("alt text");
    expect(report.find("table").exists()).toBe(true);
  });

  it("escapes raw HTML in the agent's report instead of rendering it", async () => {
    initMocks({ evaluation: { id: "qd-1", suggestions: '<img src=x onerror="alert(1)"><script>alert(2)</script>' } });
    const wrapper = await mountBlade(QualityEvaluation);
    const report = wrapper.find(".product-quality-evaluation__report");

    expect(report.find("img").exists()).toBe(false);
    expect(report.find("script").exists()).toBe(false);
    expect(report.text()).toContain("<img");
  });

  it("turns bare URLs into links", async () => {
    initMocks({ evaluation: { id: "qd-1", suggestions: "See https://example.com/guide" } });
    const wrapper = await mountBlade(QualityEvaluation);

    expect(wrapper.find(".product-quality-evaluation__report a").attributes("href")).toBe("https://example.com/guide");
  });

  // =========================================================================
  // Evaluated date
  // =========================================================================
  it("shows the evaluated date when one is present", async () => {
    initMocks({ evaluation: { id: "qd-1", createdDate: new Date("2026-10-01T10:00:00Z") } });
    const wrapper = await mountBlade(QualityEvaluation);

    expect(wrapper.find(".product-quality-evaluation__meta").exists()).toBe(true);
  });

  it("hides the evaluated date when the evaluation has no dates", async () => {
    initMocks({ evaluation: { id: "qd-1", readinessScore: 90 } });
    const wrapper = await mountBlade(QualityEvaluation);

    expect(wrapper.find(".product-quality-evaluation__meta").exists()).toBe(false);
  });
});

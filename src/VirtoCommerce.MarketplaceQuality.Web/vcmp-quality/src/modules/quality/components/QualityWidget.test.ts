import { describe, it, expect, vi, beforeEach } from "vitest";
import { computed, ref, type Ref } from "vue";
import { createMockBlade } from "../../../test/harness/mockFramework";
import { mountBlade } from "../../../test/harness/mountBlade";

// ---------------------------------------------------------------------------
// Shared mock state -- reset before each test
// ---------------------------------------------------------------------------
let mockBlade: ReturnType<typeof createMockBlade>;
let bladeContext: Ref<Record<string, unknown>>;
let countProductId: Ref<string | undefined> | undefined;
let mockCount: { count: Ref<number>; loading: Ref<boolean>; refresh: ReturnType<typeof vi.fn> };

// ---------------------------------------------------------------------------
// Module-level mocks (MUST be before dynamic import)
// ---------------------------------------------------------------------------
vi.mock("@vc-shell/framework", () => ({
  useBlade: () => mockBlade,
  injectBladeContext: () => computed(() => bladeContext.value),
}));

vi.mock("@vc-shell/framework/ui", () => ({
  VcWidget: {
    name: "VcWidget",
    template: '<button @click="$emit(\'click\')"></button>',
    props: ["icon", "title", "value", "disabled"],
    emits: ["click"],
  },
}));

vi.mock("../composables", () => ({
  useQualityTargetCount: (productId: Ref<string | undefined>) => {
    countProductId = productId;
    return mockCount;
  },
}));

// ---------------------------------------------------------------------------
// Dynamic import of the component (MUST come AFTER vi.mock declarations)
// ---------------------------------------------------------------------------
const QualityWidget = (await import("./QualityWidget.vue")).default;

describe("QualityWidget.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBlade = createMockBlade();
    bladeContext = ref({ item: { id: "prod-1", name: "Gift Box" } });
    countProductId = undefined;
    mockCount = { count: ref(4), loading: ref(false), refresh: vi.fn() };
  });

  it("counts targets for the host blade's product", async () => {
    await mountBlade(QualityWidget);

    expect(countProductId?.value).toBe("prod-1");
  });

  it("follows the host blade when it switches to another product", async () => {
    await mountBlade(QualityWidget);

    bladeContext.value = { item: { id: "prod-2" } };

    expect(countProductId?.value).toBe("prod-2");
  });

  it("shows the target count with the gauge icon and title", async () => {
    const wrapper = await mountBlade(QualityWidget);
    const widget = wrapper.findComponent({ name: "VcWidget" });

    expect(widget.props("value")).toBe(4);
    expect(widget.props("icon")).toBe("lucide-gauge");
    expect(widget.props("title")).toBe("QUALITY.WIDGET.TITLE");
  });

  it("is disabled while the count is loading", async () => {
    mockCount.loading.value = true;
    const wrapper = await mountBlade(QualityWidget);

    expect(wrapper.findComponent({ name: "VcWidget" }).props("disabled")).toBe(true);
  });

  it("opens the targets blade with the seller product id and name on click", async () => {
    const wrapper = await mountBlade(QualityWidget);

    await wrapper.find("button").trigger("click");

    expect(mockBlade.openBlade).toHaveBeenCalledWith({
      name: "QualityTargets",
      options: {
        sellerProductId: "prod-1",
        productName: "Gift Box",
        product: { id: "prod-1", name: "Gift Box" },
      },
    });
  });

  it("tolerates a blade context without an item", async () => {
    bladeContext.value = {};
    const wrapper = await mountBlade(QualityWidget);

    expect(countProductId?.value).toBeUndefined();
    await wrapper.find("button").trigger("click");
    expect(mockBlade.openBlade).toHaveBeenCalledWith({
      name: "QualityTargets",
      options: { sellerProductId: undefined, productName: undefined, product: undefined },
    });
  });
});

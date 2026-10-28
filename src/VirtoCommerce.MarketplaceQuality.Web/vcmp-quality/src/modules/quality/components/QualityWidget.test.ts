import { describe, it, expect, vi, beforeEach } from "vitest";
import { computed, ref, type Ref } from "vue";
import { createMockBlade } from "../../../test/harness/mockFramework";
import { mountBlade } from "../../../test/harness/mountBlade";
import { OFFER_ENTITY_TYPE, SELLER_PRODUCT_ENTITY_TYPE } from "../entities";

// ---------------------------------------------------------------------------
// Shared mock state -- reset before each test
// ---------------------------------------------------------------------------
let mockBlade: ReturnType<typeof createMockBlade>;
let bladeContext: Ref<Record<string, unknown>>;
let countEntityId: Ref<string | undefined> | undefined;
let countEntityType: string | undefined;
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
  useQualityTargetCount: (entityId: Ref<string | undefined>, entityType: string) => {
    countEntityId = entityId;
    countEntityType = entityType;
    return mockCount;
  },
}));

// ---------------------------------------------------------------------------
// Dynamic import of the component (MUST come AFTER vi.mock declarations)
// ---------------------------------------------------------------------------
const QualityWidget = (await import("./QualityWidget.vue")).default;

const mountWidget = (entityType = SELLER_PRODUCT_ENTITY_TYPE) => mountBlade(QualityWidget, { props: { entityType } });

describe("QualityWidget.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBlade = createMockBlade();
    bladeContext = ref({ item: { id: "prod-1", name: "Gift Box" } });
    countEntityId = undefined;
    countEntityType = undefined;
    mockCount = { count: ref(4), loading: ref(false), refresh: vi.fn() };
  });

  it("counts targets of its entity type for the host blade's item", async () => {
    await mountWidget();

    expect(countEntityId?.value).toBe("prod-1");
    expect(countEntityType).toBe(SELLER_PRODUCT_ENTITY_TYPE);
  });

  it("follows the host blade when it switches to another item", async () => {
    await mountWidget();

    bladeContext.value = { item: { id: "prod-2" } };

    expect(countEntityId?.value).toBe("prod-2");
  });

  it("shows the target count with the gauge icon and title", async () => {
    const wrapper = await mountWidget();
    const widget = wrapper.findComponent({ name: "VcWidget" });

    expect(widget.props("value")).toBe(4);
    expect(widget.props("icon")).toBe("lucide-gauge");
    expect(widget.props("title")).toBe("QUALITY.WIDGET.TITLE");
  });

  it("is disabled while the count is loading", async () => {
    mockCount.loading.value = true;
    const wrapper = await mountWidget();

    expect(wrapper.findComponent({ name: "VcWidget" }).props("disabled")).toBe(true);
  });

  it("opens the targets blade with the entity type, id and name on click", async () => {
    const wrapper = await mountWidget();

    await wrapper.find("button").trigger("click");

    expect(mockBlade.openBlade).toHaveBeenCalledWith({
      name: "QualityTargets",
      options: {
        entityType: SELLER_PRODUCT_ENTITY_TYPE,
        entityId: "prod-1",
        entityName: "Gift Box",
        item: { id: "prod-1", name: "Gift Box" },
      },
    });
  });

  it("works the same for an offer", async () => {
    bladeContext.value = { item: { id: "offer-1", name: "Gift Box offer" } };
    const wrapper = await mountWidget(OFFER_ENTITY_TYPE);

    expect(countEntityType).toBe(OFFER_ENTITY_TYPE);
    await wrapper.find("button").trigger("click");
    expect(mockBlade.openBlade.mock.calls[0][0].options).toMatchObject({
      entityType: OFFER_ENTITY_TYPE,
      entityId: "offer-1",
      entityName: "Gift Box offer",
    });
  });

  it("tolerates a blade context without an item", async () => {
    bladeContext.value = {};
    const wrapper = await mountWidget();

    expect(countEntityId?.value).toBeUndefined();
    await wrapper.find("button").trigger("click");
    expect(mockBlade.openBlade).toHaveBeenCalledWith({
      name: "QualityTargets",
      options: { entityType: SELLER_PRODUCT_ENTITY_TYPE, entityId: undefined, entityName: undefined, item: undefined },
    });
  });
});

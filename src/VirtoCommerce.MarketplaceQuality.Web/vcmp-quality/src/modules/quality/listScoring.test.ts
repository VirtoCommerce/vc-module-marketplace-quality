import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, isRef } from "vue";

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
const registerExternalToolbarItem = vi.fn();
const startQualityScoring = vi.fn();
const scoring = ref(false);
const t = vi.fn((key: string) => key);

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------
vi.mock("@vc-shell/framework", () => ({
  registerExternalToolbarItem,
  i18n: { global: { t, locale: ref("de-DE") } },
}));

vi.mock("./composables/useQualityScoring", () => ({
  startQualityScoring,
  useQualityScoring: () => ({ scoring }),
}));

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------
const { getSelectedIds, runListScoring, registerListScoring, LIST_SCORING_TOOLBAR_ITEM_ID } = await import(
  "./listScoring"
);
const { QUALITY_ENTITIES, SELLER_PRODUCT_ENTITY_TYPE, OFFER_ENTITY_TYPE } = await import("./entities");

const products = { name: "Products" };

describe("listScoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scoring.value = false;
    startQualityScoring.mockResolvedValue(undefined);
  });

  // =========================================================================
  // Selection
  // =========================================================================
  it.each([
    ["a ref", ref([{ id: "prod-1" }, { id: "prod-2" }])],
    ["an array", [{ id: "prod-1" }, { id: "prod-2" }]],
  ])("reads the ids of the selected rows from %s", (_label, selectedItems) => {
    expect(getSelectedIds({ selectedItems })).toEqual(["prod-1", "prod-2"]);
  });

  it("skips rows without an id and has none without a selection", () => {
    expect(getSelectedIds({ selectedItems: [{ id: "prod-1" }, {}, { id: "" }] })).toEqual(["prod-1"]);
    expect(getSelectedIds({})).toEqual([]);
    expect(getSelectedIds(undefined)).toEqual([]);
  });

  // =========================================================================
  // Running
  // =========================================================================
  it("starts scoring the selected rows in the UI language", async () => {
    await runListScoring(SELLER_PRODUCT_ENTITY_TYPE, ["prod-1", "prod-2"]);

    expect(startQualityScoring).toHaveBeenCalledWith({
      entityType: SELLER_PRODUCT_ENTITY_TYPE,
      entityIds: ["prod-1", "prod-2"],
      locale: "de-DE",
    });
  });

  // =========================================================================
  // Toolbar button
  // =========================================================================
  it("adds the button to the list blade of each scorable entity type", () => {
    registerListScoring(QUALITY_ENTITIES);

    const items = registerExternalToolbarItem.mock.calls.map(([item]) => item);
    expect(items.map((item) => item.targetBlades)).toEqual([["Products"], ["Offers"]]);
    items.forEach((item) => {
      expect(item.id).toBe(LIST_SCORING_TOOLBAR_ITEM_ID);
      expect(item.icon).toBe("lucide-sparkles");
      expect(isRef(item.title)).toBe(true);
      expect(item.title.value).toBe("QUALITY.TARGETS.TOOLBAR.RUN_SCORING");
    });
  });

  it("skips an entity type that cannot be scored or has no list blade", () => {
    registerListScoring([
      { entityType: "A", hostBlade: "A", widgetId: "A", stateKey: "a", listBlade: "AList" },
      { entityType: "B", hostBlade: "B", widgetId: "B", stateKey: "b", scorable: true },
    ]);

    expect(registerExternalToolbarItem).not.toHaveBeenCalled();
  });

  it("is disabled until rows are selected", () => {
    registerListScoring(QUALITY_ENTITIES);
    const item = registerExternalToolbarItem.mock.calls[0][0];

    expect(item.disabled(products, { selectedItems: ref([]) })).toBe(true);
    expect(item.disabled(products, {})).toBe(true);
    expect(item.disabled(products, { selectedItems: ref([{ id: "prod-1" }]) })).toBe(false);
  });

  it("is disabled while a run is going, like every run scoring button", () => {
    registerListScoring(QUALITY_ENTITIES);
    const item = registerExternalToolbarItem.mock.calls[0][0];

    scoring.value = true;

    expect(item.disabled(products, { selectedItems: ref([{ id: "prod-1" }]) })).toBe(true);
  });

  it("scores the selected rows as the entity type of its list blade", async () => {
    registerListScoring(QUALITY_ENTITIES);
    const [productsItem, offersItem] = registerExternalToolbarItem.mock.calls.map(([item]) => item);

    await productsItem.clickHandler(products, { selectedItems: ref([{ id: "prod-1" }]) });
    await offersItem.clickHandler({ name: "Offers" }, { selectedItems: ref([{ id: "offer-1" }]) });

    expect(startQualityScoring.mock.calls.map(([args]) => [args.entityType, args.entityIds])).toEqual([
      [SELLER_PRODUCT_ENTITY_TYPE, ["prod-1"]],
      [OFFER_ENTITY_TYPE, ["offer-1"]],
    ]);
  });
});

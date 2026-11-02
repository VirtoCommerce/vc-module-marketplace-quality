import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Module-level mocks (MUST be before dynamic import)
// ---------------------------------------------------------------------------
const registerExternalWidget = vi.fn();
const defineAppModule = vi.fn((options: unknown) => ({ install: vi.fn(), options }));
const registerListScoring = vi.fn();

vi.mock("@vc-shell/framework", () => ({
  registerExternalWidget,
  defineAppModule,
}));

vi.mock("./listScoring", () => ({ registerListScoring }));

vi.mock("./pages", () => ({
  QualityTargets: { name: "QualityTargets" },
  QualityEvaluation: { name: "QualityEvaluation" },
}));

vi.mock("./components", () => ({
  QualityWidget: { name: "QualityWidget" },
}));

// ---------------------------------------------------------------------------
// Dynamic import — registration runs as an import side effect
// ---------------------------------------------------------------------------
const module = (await import("./index")).default;
const { default: entry } = await import("../index");
const { SELLER_PRODUCT_ENTITY_TYPE, OFFER_ENTITY_TYPE } = await import("./entities");
const widgets = registerExternalWidget.mock.calls.map(([widget]) => widget);

/** Renders a registered wrapper and returns the QualityWidget vnode it produces. */
function renderWrapper(widget: { component: { setup: () => () => { type: unknown; props: unknown } } }) {
  return widget.component.setup()();
}

describe("quality app module", () => {
  it("is the plugin's exposed entry", () => {
    expect(entry).toBe(module);
  });

  it("registers both blades and the locales", () => {
    const options = defineAppModule.mock.calls[0][0] as { blades: object; locales: { en: object } };

    expect(Object.keys(options.blades).sort()).toEqual(["QualityEvaluation", "QualityTargets"]);
    expect(options.locales.en).toBeDefined();
  });

  it("registers one Quality widget per quality entity type", () => {
    expect(widgets.map((w) => w.id)).toEqual(["QualityWidget", "OfferQualityWidget"]);
    widgets.forEach((w) => expect(w.title).toBe("QUALITY.WIDGET.TITLE"));
  });

  it.each([
    ["QualityWidget", "ProductDetails", SELLER_PRODUCT_ENTITY_TYPE],
    ["OfferQualityWidget", "Offer", OFFER_ENTITY_TYPE],
  ])("adds %s to the host's %s blade, bound to its entity type", (id, hostBlade, entityType) => {
    const widget = widgets.find((w) => w.id === id);

    expect(widget.targetBlades).toEqual([hostBlade]);
    const vnode = renderWrapper(widget);
    expect(vnode.type).toEqual({ name: "QualityWidget" });
    expect(vnode.props).toEqual({ entityType });
  });

  it("adds the bulk run scoring button to the list blades of the quality entity types", async () => {
    const { QUALITY_ENTITIES } = await import("./entities");

    expect(registerListScoring).toHaveBeenCalledWith(QUALITY_ENTITIES);
  });

  it("shows the widgets only for an opened (saved) entity", () => {
    for (const widget of widgets) {
      expect(widget.isVisible({ param: "id-1" })).toBe(true);
      expect(widget.isVisible({ param: undefined })).toBe(false);
      expect(widget.isVisible(undefined)).toBe(false);
    }
  });
});

describe("quality locales", () => {
  it("define every key the module's code uses", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const en = (await import("./locales/en.json")).default as Record<string, unknown>;

    const files = (readdirSync(__dirname, { recursive: true }) as string[])
      .filter((f) => /\.(vue|ts)$/.test(f) && !f.endsWith(".test.ts"))
      .map((f) => join(__dirname, f));

    const keys = new Set<string>();
    for (const file of files) {
      for (const match of readFileSync(file, "utf8").matchAll(/["'](QUALITY\.[A-Z_.]+)["']/g)) {
        keys.add(match[1]);
      }
    }

    const resolve = (key: string) => key.split(".").reduce<any>((node, part) => node?.[part], en);
    const missing = [...keys].filter((key) => typeof resolve(key) !== "string");

    expect(keys.size).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });
});

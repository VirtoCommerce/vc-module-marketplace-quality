import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Module-level mocks (MUST be before dynamic import)
// ---------------------------------------------------------------------------
const registerExternalWidget = vi.fn();
const defineAppModule = vi.fn((options: unknown) => ({ install: vi.fn(), options }));

vi.mock("@vc-shell/framework", () => ({
  registerExternalWidget,
  defineAppModule,
}));

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
const widget = registerExternalWidget.mock.calls[0][0];

describe("quality app module", () => {
  it("is the plugin's exposed entry", () => {
    expect(entry).toBe(module);
  });

  it("registers both blades and the locales", () => {
    const options = defineAppModule.mock.calls[0][0] as { blades: object; locales: { en: object } };

    expect(Object.keys(options.blades).sort()).toEqual(["QualityEvaluation", "QualityTargets"]);
    expect(options.locales.en).toBeDefined();
  });

  it("adds the Quality widget to the host's ProductDetails blade", () => {
    expect(registerExternalWidget).toHaveBeenCalledTimes(1);
    expect(widget).toMatchObject({
      id: "QualityWidget",
      targetBlades: ["ProductDetails"],
      title: "QUALITY.WIDGET.TITLE",
      component: { name: "QualityWidget" },
    });
  });

  it("shows the widget only for an opened (saved) product", () => {
    expect(widget.isVisible({ param: "prod-1" })).toBe(true);
    expect(widget.isVisible({ param: undefined })).toBe(false);
    expect(widget.isVisible(undefined)).toBe(false);
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

import { defineAppModule, registerExternalWidget, type BladeDescriptor } from "@vc-shell/framework";
import { markRaw } from "vue";
import * as pages from "./pages";
import * as locales from "./locales";
import * as components from "./components";

// Adds the Quality widget to the host vendor-portal product details blade.
registerExternalWidget({
  id: "QualityWidget",
  component: markRaw(components.QualityWidget),
  targetBlades: ["ProductDetails"],
  title: "QUALITY.WIDGET.TITLE",
  // Same rule as the host's own product widgets: only for a saved (opened) product.
  isVisible: (blade?: BladeDescriptor) => !!blade?.param,
});

export default defineAppModule({
  blades: pages,
  locales,
});

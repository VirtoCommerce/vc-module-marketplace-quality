import { defineAppModule, registerExternalWidget, type BladeDescriptor } from "@vc-shell/framework";
import { defineComponent, h, markRaw } from "vue";
import * as pages from "./pages";
import * as locales from "./locales";
import * as components from "./components";
import { QUALITY_ENTITIES } from "./entities";

// Adds the Quality widget to each host vendor-portal details blade of a quality entity type.
// External widgets take no props, so each one is a wrapper that binds its entity type.
for (const entity of QUALITY_ENTITIES) {
  registerExternalWidget({
    id: entity.widgetId,
    component: markRaw(
      defineComponent({
        name: entity.widgetId,
        setup: () => () => h(components.QualityWidget, { entityType: entity.entityType }),
      }),
    ),
    targetBlades: [entity.hostBlade],
    title: "QUALITY.WIDGET.TITLE",
    // Same rule as the host's own widgets: only for a saved (opened) entity.
    isVisible: (blade?: BladeDescriptor) => !!blade?.param,
  });
}

export default defineAppModule({
  blades: pages,
  locales,
});

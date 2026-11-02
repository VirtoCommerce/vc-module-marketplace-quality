import { defineAppModule, registerExternalWidget, type BladeDescriptor } from "@vc-shell/framework";
import { defineComponent, h, markRaw } from "vue";
import { registerListScoring } from "./listScoring";
import * as pages from "./pages";
import * as locales from "./locales";
import * as components from "./components";
import { QUALITY_ENTITIES } from "./entities";
import { QUALITY_SCORING_NOTIFY_TYPE, type QualityScoringPushNotification } from "./composables/useQualityScoring";

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

// Adds the bulk "Run scoring" button to the host list blades, for the rows the user has checked.
registerListScoring(QUALITY_ENTITIES);

export default defineAppModule({
  blades: pages,
  locales,
  notifications: {
    // One toast per run, wherever it was started: the progress notifications update it ("5 of 12 items…"),
    // and the final notification, a separate one with the same run id, completes it with the outcome.
    [QUALITY_SCORING_NOTIFY_TYPE]: {
      groupBy: "runId",
      toast: {
        mode: "progress",
        completedType: (message) => ((message as QualityScoringPushNotification).failedCount ? "error" : "success"),
      },
    },
  },
});

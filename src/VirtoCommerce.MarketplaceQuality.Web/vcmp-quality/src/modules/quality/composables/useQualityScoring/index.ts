import { computed, getCurrentScope, onScopeDispose, reactive, ref, type ComputedRef } from "vue";
import { notification, useNotificationStore, useUser, type PushNotification } from "@vc-shell/framework";

export const QUALITY_SCORING_NOTIFY_TYPE = "QualityScoringPushNotification";

/**
 * A scoring run sends a progress notification (its id is the run id), updated after each batch,
 * and a final notification with `finished` set and an id of its own. Both carry the `runId`.
 */
export interface QualityScoringPushNotification extends PushNotification {
  runId?: string;
  entityType?: string;
  /** Entities of the run; entities already being scored by another run are left out. */
  entityIds?: string[];
  totalCount?: number;
  processedCount?: number;
  failedCount?: number;
  finished?: string | Date;
  errors?: string[];
}

export interface IRunScoringArgs {
  entityType: string;
  entityIds: string[];
  locale: string;
}

interface IScoringRun {
  entityType: string;
  entityIds: string[];
}

// Shared by every "Run scoring" button and blade of the module: the runs started in this browser,
// by run id, until their final notification arrives.
const runs = reactive(new Map<string, IScoringRun>());
const starting = ref(0);
// A run that fails at once can finish before its start request returns
const finishedEarly = new Map<string, QualityScoringPushNotification>();
const finishedListeners = new Set<(message: QualityScoringPushNotification) => void>();
let unsubscribe: (() => void) | undefined;

/** A run started in this browser is starting or running; every "Run scoring" button is disabled meanwhile. */
const scoring = computed(() => starting.value > 0 || runs.size > 0);

function finish(message: QualityScoringPushNotification) {
  finishedListeners.forEach((listener) => listener(message));
}

function onFinalNotification(message: QualityScoringPushNotification) {
  const runId = message.runId!;
  if (runs.delete(runId)) {
    finish(message);
  } else if (starting.value > 0) {
    finishedEarly.set(runId, message);
  }
}

// Subscribed on first use, after the shell has set up its notification store
function ensureSubscribed() {
  unsubscribe ??= useNotificationStore().subscribe({
    types: [QUALITY_SCORING_NOTIFY_TYPE],
    filter: (message) => !!(message as QualityScoringPushNotification).finished && !!(message as QualityScoringPushNotification).runId,
    handler: (message) => onFinalNotification(message as QualityScoringPushNotification),
  });
}

/**
 * Starts scoring the entities on the platform. The entity's AI expert saves the evaluations itself;
 * the run's notifications show its progress and outcome. Does nothing while another run is going,
 * and shows why a run could not be started. Works outside a component setup too (e.g. in a toolbar click handler).
 */
export async function startQualityScoring(args: IRunScoringArgs): Promise<void> {
  if (!args.entityType || !args.entityIds.length || scoring.value) return;

  ensureSubscribed();
  starting.value++;
  try {
    const { getAccessToken } = useUser();
    const response = await fetch("/api/vcmp/quality/scoring", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getAccessToken()}`,
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      // 400 unknown or too many entities, 403 not the seller's entity, 409 already running, 503 queue full
      throw new Error(`${response.status}: ${await response.text()}`);
    }

    const progress: QualityScoringPushNotification = await response.json();
    const runId = progress.runId ?? progress.id!;
    const finished = finishedEarly.get(runId);
    if (finished) {
      finish(finished);
    } else {
      runs.set(runId, { entityType: args.entityType, entityIds: progress.entityIds ?? args.entityIds });
    }
  } catch (e) {
    notification.error(e instanceof Error ? e.message : String(e));
  } finally {
    starting.value--;
    if (!starting.value) finishedEarly.clear();
  }
}

export interface IUseQualityScoringOptions {
  /** Called when a run started in this browser is over, successfully or not. */
  onFinished?: (notification: QualityScoringPushNotification) => void;
}

export interface IUseQualityScoring {
  /** A run started in this browser is starting or running. */
  scoring: ComputedRef<boolean>;
  /** The entity is in a run started in this browser. */
  isEntityScoring: (entityType: string, entityId?: string) => boolean;
  runScoring: (args: IRunScoringArgs) => Promise<void>;
}

export function useQualityScoring(options: IUseQualityScoringOptions = {}): IUseQualityScoring {
  ensureSubscribed();

  const { onFinished } = options;
  if (onFinished) {
    finishedListeners.add(onFinished);
    if (getCurrentScope()) {
      onScopeDispose(() => finishedListeners.delete(onFinished));
    }
  }

  return {
    scoring,
    isEntityScoring: (entityType, entityId) =>
      !!entityId && [...runs.values()].some((run) => run.entityType === entityType && run.entityIds.includes(entityId)),
    runScoring: startQualityScoring,
  };
}

/** Clears the shared state; for tests. */
export function resetQualityScoring() {
  runs.clear();
  starting.value = 0;
  finishedEarly.clear();
  finishedListeners.clear();
  unsubscribe?.();
  unsubscribe = undefined;
}

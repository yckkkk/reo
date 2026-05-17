import { recordDiagnosticEvent } from './diagnostics.js';
import { BACKFILL_SCAN_DIAGNOSTIC_EVENTS } from './backfillDiagnosticConstants.js';
import { BACKFILL_QUEUE_EVENT_NAMES } from './backfillQueue.js';

type BackfillDiagnosticLevel = 'info' | 'warn' | 'error';

export const BACKFILL_DIAGNOSTIC_EVENTS = [
  ...BACKFILL_QUEUE_EVENT_NAMES,
  ...BACKFILL_SCAN_DIAGNOSTIC_EVENTS,
] as const;

type BackfillDiagnosticEvent = (typeof BACKFILL_DIAGNOSTIC_EVENTS)[number];

type BackfillDiagnosticFields = {
  readonly durationMs?: number;
  readonly errorCode?: string;
  readonly taskCount?: number;
};

type DiagnosticRecorderLike = {
  readonly record: (event: {
    readonly area: string;
    readonly event: string;
    readonly fields?: Record<string, unknown>;
    readonly level?: BackfillDiagnosticLevel;
  }) => void;
};

function allowedFields(fields: Record<string, unknown> = {}): BackfillDiagnosticFields {
  const next: { durationMs?: number; errorCode?: string; taskCount?: number } = {};
  if (typeof fields['durationMs'] === 'number' && Number.isFinite(fields['durationMs'])) {
    next.durationMs = fields['durationMs'];
  }
  if (typeof fields['errorCode'] === 'string') {
    next.errorCode = fields['errorCode'];
  }
  if (typeof fields['taskCount'] === 'number' && Number.isFinite(fields['taskCount'])) {
    next.taskCount = fields['taskCount'];
  }
  return next;
}

export function createBackfillDiagnostics(
  recorder: DiagnosticRecorderLike = { record: recordDiagnosticEvent }
) {
  return {
    record(
      event: BackfillDiagnosticEvent,
      fields: Record<string, unknown> = {},
      level: BackfillDiagnosticLevel = 'warn'
    ): void {
      recorder.record({
        area: 'backfill',
        event,
        fields: allowedFields(fields),
        level,
      });
    },
  };
}

export type BackfillDiagnostics = ReturnType<typeof createBackfillDiagnostics>;

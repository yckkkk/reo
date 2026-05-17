import { recordDiagnosticEvent } from './diagnostics.js';

type BackfillDiagnosticLevel = 'info' | 'warn' | 'error';
type BackfillDiagnosticEvent =
  | 'batch-capped'
  | 'breaker-tripped'
  | 'queue-canceled'
  | 'queue-paused'
  | 'queue-resumed'
  | 'scan-completed'
  | 'scan-failed'
  | 'scan-started'
  | 'task-failed'
  | 'task-started'
  | 'task-succeeded'
  | 'trigger-fired';

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

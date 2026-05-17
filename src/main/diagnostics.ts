import {
  WORKSPACE_IPC_CHANNELS,
  WORKSPACE_RENDERER_EVENT_CHANNELS,
  workspaceErrorCodeSchema,
} from '../workspace-contract/workspace-contract.js';
import {
  BACKFILL_QUEUE_CANCEL_REASONS,
  BACKFILL_QUEUE_ERROR_CODES,
  BACKFILL_QUEUE_PAUSE_REASONS,
} from './backfillQueue.js';
import { BACKFILL_SCAN_FAILED_ERROR_CODE } from './backfillDiagnosticConstants.js';

type DiagnosticLevel = 'info' | 'warn' | 'error';
type DiagnosticFieldValue = string | number | boolean | null;

export type DiagnosticEvent = {
  readonly area: string;
  readonly event: string;
  readonly fields: Record<string, DiagnosticFieldValue>;
  readonly level: DiagnosticLevel;
  readonly timestamp: string;
};

export type DiagnosticSink = {
  readonly write: (event: DiagnosticEvent) => void;
};

export type DiagnosticRecorder = {
  readonly record: (event: {
    readonly area: string;
    readonly event: string;
    readonly fields?: Record<string, unknown>;
    readonly level?: DiagnosticLevel;
  }) => void;
  readonly withSpan: <Result>(
    event: {
      readonly area: string;
      readonly event: string;
      readonly fields?: Record<string, unknown>;
      readonly level?: DiagnosticLevel;
    },
    run: () => Promise<Result> | Result
  ) => Promise<Result>;
};

const SENSITIVE_FIELD_PATTERNS = [
  /app.*id/i,
  /content/i,
  /description/i,
  /display.*path/i,
  /file.*path/i,
  /handle/i,
  /markdown/i,
  /path/i,
  /payload/i,
  /root/i,
  /secret/i,
  /selection.*token/i,
  /title/i,
  /token/i,
  /transcript/i,
];
const SAFE_CHANNELS = new Set<string>([
  ...WORKSPACE_IPC_CHANNELS,
  ...WORKSPACE_RENDERER_EVENT_CHANNELS,
]);
const SAFE_DATA_RETENTION_VALUES = new Set([
  'none-written',
  'previous-file-preserved',
  'draft-preserved',
  'durable-marker-recovery-required',
  'file-written-index-stale',
  'unknown',
]);
const SAFE_ERROR_CODES = new Set<string>(workspaceErrorCodeSchema.options);
const SAFE_BACKFILL_ERROR_CODES = new Set([
  ...BACKFILL_QUEUE_ERROR_CODES,
  ...BACKFILL_QUEUE_CANCEL_REASONS,
  ...BACKFILL_QUEUE_PAUSE_REASONS,
  BACKFILL_SCAN_FAILED_ERROR_CODE,
]);
const SAFE_ERROR_NAMES = new Set([
  'AbortError',
  'AggregateError',
  'DOMException',
  'Error',
  'EvalError',
  'FileWrittenIndexStale',
  'FinalizeTransactionFailure',
  'RangeError',
  'RecordingTranscriptionStartClosedError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
  'WorkspaceHandleLost',
  'WorkspaceMemorySpaceRegistryReadError',
  'WorkspaceOpenAborted',
  'WorkspacePathAborted',
  'ZodError',
]);
const SAFE_MODE_VALUES = new Set(['development', 'production']);
const SAFE_PROCESS_TYPE_VALUES = new Set(['main']);
const SAFE_RENDERER_GONE_REASONS = new Set([
  'abnormal-exit',
  'clean-exit',
  'crashed',
  'integrity-failure',
  'killed',
  'launch-failed',
  'oom',
]);

const DEFAULT_SINK: DiagnosticSink = {
  write() {},
};

let activeRecorder = createDiagnosticRecorder();

export function sanitizeDiagnosticFields(
  fields: Record<string, unknown> = {}
): Record<string, DiagnosticFieldValue> {
  const sanitized: Record<string, DiagnosticFieldValue> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(key))) {
      sanitized[key] = '[redacted]';
      continue;
    }

    if (value === null || typeof value === 'boolean') {
      sanitized[key] = value;
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = sanitizeStringField(key, value);
      continue;
    }

    if (typeof value === 'number') {
      sanitized[key] = Number.isFinite(value) ? value : '[non-finite-number]';
      continue;
    }

    if (Array.isArray(value)) {
      sanitized[key] = `[array:${value.length}]`;
      continue;
    }

    if (value === undefined) {
      continue;
    }

    sanitized[key] = '[object]';
  }

  return sanitized;
}

function sanitizeStringField(key: string, value: string): DiagnosticFieldValue {
  if (key === 'channel') {
    return SAFE_CHANNELS.has(value) ? value : `[string:${value.length}]`;
  }

  if (key === 'dataRetention') {
    return SAFE_DATA_RETENTION_VALUES.has(value) ? value : `[string:${value.length}]`;
  }

  if (key === 'errorCode') {
    return SAFE_ERROR_CODES.has(value) || SAFE_BACKFILL_ERROR_CODES.has(value)
      ? value
      : 'ERR_UNKNOWN';
  }

  if (key === 'errorName') {
    return sanitizeDiagnosticErrorName(value);
  }

  if (key === 'status') {
    return sanitizeDiagnosticStatus(value);
  }

  if (key === 'mode') {
    return SAFE_MODE_VALUES.has(value) ? value : `[string:${value.length}]`;
  }

  if (key === 'processType') {
    return SAFE_PROCESS_TYPE_VALUES.has(value) ? value : `[string:${value.length}]`;
  }

  if (key === 'reason') {
    return SAFE_RENDERER_GONE_REASONS.has(value) ? value : `[string:${value.length}]`;
  }

  return `[string:${value.length}]`;
}

export function diagnosticErrorName(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeDiagnosticErrorName(error.name);
  }
  return typeof error;
}

function sanitizeDiagnosticErrorName(value: string): string {
  return SAFE_ERROR_NAMES.has(value) ? value : 'Error';
}

function sanitizeDiagnosticStatus(value: string): string {
  if (value === 'ok' || value === 'error' || value === 'thrown') {
    return value;
  }

  if (value.startsWith('error:')) {
    const code = value.slice('error:'.length);
    return SAFE_ERROR_CODES.has(code) ? value : 'error';
  }

  return `[string:${value.length}]`;
}

export function createDiagnosticRecorder({
  now = () => new Date().toISOString(),
  nowMs = () => performance.now(),
  sink = DEFAULT_SINK,
}: {
  readonly now?: () => string;
  readonly nowMs?: () => number;
  readonly sink?: DiagnosticSink;
} = {}): DiagnosticRecorder {
  function record({
    area,
    event,
    fields,
    level = 'info',
  }: {
    readonly area: string;
    readonly event: string;
    readonly fields?: Record<string, unknown>;
    readonly level?: DiagnosticLevel;
  }): void {
    sink.write({
      area,
      event,
      fields: sanitizeDiagnosticFields(fields),
      level,
      timestamp: now(),
    });
  }

  async function withSpan<Result>(
    event: {
      readonly area: string;
      readonly event: string;
      readonly fields?: Record<string, unknown>;
      readonly level?: DiagnosticLevel;
    },
    run: () => Promise<Result> | Result
  ): Promise<Result> {
    const startedAt = nowMs();
    record({ ...event, event: `${event.event}.start` });
    try {
      const result = await run();
      record({
        ...event,
        event: `${event.event}.finish`,
        fields: {
          ...event.fields,
          durationMs: Math.max(0, Math.round(nowMs() - startedAt)),
          status: responseStatus(result),
        },
      });
      return result;
    } catch (error) {
      record({
        ...event,
        event: `${event.event}.finish`,
        fields: {
          ...event.fields,
          durationMs: Math.max(0, Math.round(nowMs() - startedAt)),
          errorName: diagnosticErrorName(error),
          status: 'thrown',
        },
        level: 'error',
      });
      throw error;
    }
  }

  return { record, withSpan };
}

export function configureDiagnostics(sink: DiagnosticSink): void {
  activeRecorder = createDiagnosticRecorder({ sink });
}

export function recordDiagnosticEvent(event: Parameters<DiagnosticRecorder['record']>[0]): void {
  activeRecorder.record(event);
}

export function withDiagnosticSpan<Result>(
  event: Parameters<DiagnosticRecorder['withSpan']>[0],
  run: () => Promise<Result> | Result
): Promise<Result> {
  return activeRecorder.withSpan(event, run);
}

function responseStatus(result: unknown): string {
  if (
    result &&
    typeof result === 'object' &&
    'ok' in result &&
    typeof (result as { readonly ok: unknown }).ok === 'boolean'
  ) {
    if ((result as { readonly ok: boolean }).ok) {
      return 'ok';
    }
    const error = (result as { readonly error?: { readonly code?: unknown } }).error;
    return typeof error?.code === 'string' ? `error:${error.code}` : 'error';
  }
  return 'ok';
}

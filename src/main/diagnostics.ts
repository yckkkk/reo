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
const SAFE_STRING_FIELD_KEYS = new Set([
  'channel',
  'dataRetention',
  'errorCode',
  'errorName',
  'mode',
  'phase',
  'processType',
  'reason',
  'status',
]);
const MAX_SAFE_STRING_LENGTH = 160;

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
  if (SAFE_STRING_FIELD_KEYS.has(key) && value.length <= MAX_SAFE_STRING_LENGTH) {
    return value;
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
          errorName: error instanceof Error ? error.name : typeof error,
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

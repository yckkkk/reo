import { randomUUID } from 'node:crypto';
import { MAX_BACKFILL_AUDIO_READ_BYTES } from '../workspace-contract/recording-audio.js';

export const DOUBAO_AUC_TURBO_ENDPOINT =
  'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash';
export const DOUBAO_AUC_TURBO_RESOURCE_ID = 'volc.bigasr.auc_turbo';
export const DOUBAO_AUC_TURBO_MAX_AUDIO_DATA_BASE64_BYTES =
  Math.ceil(MAX_BACKFILL_AUDIO_READ_BYTES / 3) * 4;

const DEFAULT_TIMEOUT_MS = 30_000;
const SUCCESS_STATUS_CODE = '20000000';

export type DoubaoAucTurboErrorCode =
  | 'abort'
  | 'auth'
  | 'empty-audio'
  | 'format'
  | 'malformed'
  | 'network'
  | 'rate-limit'
  | 'server'
  | 'server-busy'
  | 'silent-audio'
  | 'size'
  | 'timeout';

export type DoubaoAucTurboRecognitionResult =
  | {
      readonly logId?: string;
      readonly ok: true;
      readonly requestId: string;
      readonly transcriptText: string;
    }
  | {
      readonly errorCode: DoubaoAucTurboErrorCode;
      readonly logId?: string;
      readonly ok: false;
      readonly requestId?: string;
      readonly statusCode?: string;
    };

export type DoubaoAucTurboFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type RecognizeDoubaoAucTurboAudioDataInput = {
  readonly apiKey: string;
  readonly audioDataBase64: string;
  readonly fetch?: DoubaoAucTurboFetch;
  readonly requestId?: string;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
};

type ParsedTurboBody = {
  readonly result?: {
    readonly text?: string;
  };
};

type SettledResponse =
  | {
      readonly kind: 'abort' | 'timeout';
    }
  | {
      readonly kind: 'response';
      readonly response: Response;
    };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseTurboBody(value: unknown): ParsedTurboBody | null {
  if (!isObject(value)) {
    return null;
  }
  const resultValue = value['result'];
  if (!isObject(resultValue)) {
    return {};
  }
  const text = resultValue['text'];
  return typeof text === 'string' ? { result: { text } } : { result: {} };
}

function statusCodeToErrorCode(statusCode: string): DoubaoAucTurboErrorCode {
  if (statusCode === '20000003') return 'silent-audio';
  if (statusCode === '45000001') return 'malformed';
  if (statusCode === '45000002') return 'empty-audio';
  if (statusCode === '45000010') return 'auth';
  if (statusCode === '45000151') return 'format';
  if (statusCode === '55000031') return 'server-busy';
  if (statusCode.startsWith('550')) return 'server';
  return 'server';
}

function httpStatusToErrorCode(status: number): DoubaoAucTurboErrorCode | null {
  if (status === 401 || status === 403) return 'auth';
  if (status === 413) return 'size';
  if (status === 429) return 'rate-limit';
  if (status >= 500) return 'server';
  if (status >= 400) return 'malformed';
  return null;
}

function getResponseHeader(response: Response, name: string): string | undefined {
  return response.headers.get(name) ?? undefined;
}

function buildFailure(
  errorCode: DoubaoAucTurboErrorCode,
  context?: {
    readonly logId?: string | undefined;
    readonly requestId?: string | undefined;
    readonly statusCode?: string | undefined;
  }
): DoubaoAucTurboRecognitionResult {
  if (!context) {
    return { errorCode, ok: false };
  }

  const failure: {
    errorCode: DoubaoAucTurboErrorCode;
    logId?: string;
    ok: false;
    requestId?: string;
    statusCode?: string;
  } = { errorCode, ok: false };
  if (context.logId) failure.logId = context.logId;
  if (context.requestId) failure.requestId = context.requestId;
  if (context.statusCode) failure.statusCode = context.statusCode;
  return failure;
}

function buildRequestInit({
  apiKey,
  audioDataBase64,
  requestId,
  signal,
}: {
  readonly apiKey: string;
  readonly audioDataBase64: string;
  readonly requestId: string;
  readonly signal: AbortSignal;
}): RequestInit {
  return {
    body: JSON.stringify({
      audio: { data: audioDataBase64 },
      request: { model_name: 'bigmodel' },
      user: { uid: 'reo' },
    }),
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'X-Api-Request-Id': requestId,
      'X-Api-Resource-Id': DOUBAO_AUC_TURBO_RESOURCE_ID,
      'X-Api-Sequence': '-1',
    },
    method: 'POST',
    redirect: 'error',
    signal,
  };
}

function settleWithTimeout({
  controller,
  fetchPromise,
  signal,
  timeoutMs,
}: {
  readonly controller: AbortController;
  readonly fetchPromise: Promise<Response>;
  readonly signal?: AbortSignal | undefined;
  readonly timeoutMs: number;
}): Promise<SettledResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const safeTimeoutMs = Math.max(1, timeoutMs);
    const cleanup = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abort);
    };
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      controller.abort();
      resolve({ kind: 'timeout' });
    }, safeTimeoutMs);

    const abort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      controller.abort();
      resolve({ kind: 'abort' });
    };

    signal?.addEventListener('abort', abort, { once: true });
    fetchPromise
      .then((response) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({ kind: 'response', response });
      })
      .catch((error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      });
  });
}

export async function recognizeDoubaoAucTurboAudioData({
  apiKey,
  audioDataBase64,
  fetch = globalThis.fetch,
  requestId = randomUUID(),
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: RecognizeDoubaoAucTurboAudioDataInput): Promise<DoubaoAucTurboRecognitionResult> {
  if (signal?.aborted) {
    return buildFailure('abort');
  }
  if (audioDataBase64.length > DOUBAO_AUC_TURBO_MAX_AUDIO_DATA_BASE64_BYTES) {
    return buildFailure('size');
  }

  const controller = new AbortController();
  const fetchPromise = fetch(
    DOUBAO_AUC_TURBO_ENDPOINT,
    buildRequestInit({ apiKey, audioDataBase64, requestId, signal: controller.signal })
  );
  fetchPromise.catch(() => undefined);

  let settled: SettledResponse;
  try {
    settled = await settleWithTimeout({ controller, fetchPromise, signal, timeoutMs });
  } catch {
    return buildFailure(signal?.aborted ? 'abort' : 'network');
  }

  if (settled.kind !== 'response') {
    return buildFailure(settled.kind);
  }

  const { response } = settled;
  const logId = getResponseHeader(response, 'X-Tt-Logid');
  const statusCode = getResponseHeader(response, 'X-Api-Status-Code');
  const httpErrorCode = httpStatusToErrorCode(response.status);
  if (httpErrorCode) {
    return buildFailure(httpErrorCode, { logId, requestId, statusCode });
  }
  if (!statusCode) {
    return buildFailure('malformed', { logId, requestId });
  }
  if (statusCode !== SUCCESS_STATUS_CODE) {
    return buildFailure(statusCodeToErrorCode(statusCode), { logId, requestId, statusCode });
  }

  let parsed: ParsedTurboBody | null;
  try {
    parsed = parseTurboBody(await response.json());
  } catch {
    return buildFailure('malformed', { logId, requestId, statusCode });
  }

  const transcriptText = parsed?.result?.text;
  if (typeof transcriptText !== 'string') {
    return buildFailure('malformed', { logId, requestId, statusCode });
  }
  const success: {
    logId?: string;
    ok: true;
    requestId: string;
    transcriptText: string;
  } = { ok: true, requestId, transcriptText };
  if (logId) success.logId = logId;
  return success;
}

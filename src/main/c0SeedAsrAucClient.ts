import { randomUUID } from 'node:crypto';

export const SEED_ASR_AUC_RESOURCE_ID = 'volc.seedasr.auc';
export const SEED_ASR_AUC_SUBMIT_PATH = '/api/v3/auc/bigmodel/submit';
export const SEED_ASR_AUC_QUERY_PATH = '/api/v3/auc/bigmodel/query';

const DEFAULT_ORIGIN = 'https://openspeech.bytedance.com';
const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 120_000;
const STATUS_SUCCESS = '20000000';
const STATUS_PROCESSING = '20000001';
const STATUS_QUEUED = '20000002';

export type SeedAsrAucErrorCode =
  | 'abort'
  | 'auth'
  | 'empty-audio'
  | 'format'
  | 'malformed'
  | 'network'
  | 'quota'
  | 'rate-limit'
  | 'size'
  | 'timeout';

export type SeedAsrAucResult =
  | {
      readonly ok: true;
      readonly requestId: string;
      readonly transcriptText: string;
    }
  | {
      readonly errorCode: SeedAsrAucErrorCode;
      readonly ok: false;
      readonly requestId: string;
    };

export type SeedAsrAucFetchResponse = {
  readonly headers: {
    readonly get: (name: string) => string | null;
  };
  readonly json: () => Promise<unknown>;
  readonly status: number;
};

export type SeedAsrAucFetch = (
  url: string,
  init?: {
    readonly body?: string;
    readonly headers?: Record<string, string>;
    readonly method?: string;
    readonly signal?: AbortSignal;
  }
) => Promise<SeedAsrAucFetchResponse>;

export type TranscribeWithSeedAsrAucInput = {
  readonly audioCodec?: string;
  readonly apiKey: string;
  readonly audioFormat: string;
  readonly audioUrl: string;
  readonly endpointOrigin?: string;
  readonly fetch?: SeedAsrAucFetch;
  readonly now?: () => number;
  readonly pollIntervalMs?: number;
  readonly requestId?: string;
  readonly signal?: AbortSignal;
  readonly sleep?: (delayMs: number) => Promise<void>;
  readonly timeoutMs?: number;
  readonly uid: string;
  readonly uuid?: () => string;
};

function getDefaultFetch(): SeedAsrAucFetch {
  return globalThis.fetch as unknown as SeedAsrAucFetch;
}

function errorResult(errorCode: SeedAsrAucErrorCode, requestId: string): SeedAsrAucResult {
  return { errorCode, ok: false, requestId };
}

function normalizeEndpoint(origin: string, path: string) {
  return new URL(path, origin).toString();
}

function baseHeaders(apiKey: string, requestId: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': apiKey,
    'X-Api-Request-Id': requestId,
    'X-Api-Resource-Id': SEED_ASR_AUC_RESOURCE_ID,
  };
}

function mapHttpStatus(status: number): SeedAsrAucErrorCode | null {
  if (status === 401 || status === 403) return 'auth';
  if (status === 408) return 'timeout';
  if (status === 429) return 'rate-limit';
  if (status >= 500) return 'network';
  if (status < 200 || status >= 300) return 'network';
  return null;
}

function mapProviderStatus(statusCode: string): SeedAsrAucErrorCode | 'pending' | 'success' {
  if (statusCode === STATUS_SUCCESS) return 'success';
  if (statusCode === STATUS_PROCESSING || statusCode === STATUS_QUEUED) return 'pending';
  if (statusCode === '45000002') return 'empty-audio';
  if (statusCode === '45000131') return 'quota';
  if (statusCode === '45000130') return 'size';
  if (statusCode === '45000132' || statusCode === '45000151') return 'format';
  return 'network';
}

function readProviderStatus(response: SeedAsrAucFetchResponse): string | null {
  return response.headers.get('X-Api-Status-Code');
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

async function postJson(
  fetchImpl: SeedAsrAucFetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal | undefined
): Promise<SeedAsrAucFetchResponse | SeedAsrAucErrorCode> {
  if (signal?.aborted) return 'abort';
  try {
    const init: Parameters<SeedAsrAucFetch>[1] = {
      body: JSON.stringify(body),
      headers,
      method: 'POST',
    };
    if (signal) {
      return await fetchImpl(url, { ...init, signal });
    }
    return await fetchImpl(url, init);
  } catch (error) {
    return isAbortError(error) || signal?.aborted ? 'abort' : 'network';
  }
}

function classifyResponse(
  response: SeedAsrAucFetchResponse
): SeedAsrAucErrorCode | 'pending' | 'success' {
  const httpError = mapHttpStatus(response.status);
  if (httpError) return httpError;
  const statusCode = readProviderStatus(response);
  if (!statusCode) return 'malformed';
  return mapProviderStatus(statusCode);
}

async function readTranscriptText(response: SeedAsrAucFetchResponse): Promise<
  | {
      readonly ok: true;
      readonly transcriptText: string;
    }
  | {
      readonly errorCode: SeedAsrAucErrorCode;
      readonly ok: false;
    }
> {
  try {
    const body = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'result' in body &&
      typeof body.result === 'object' &&
      body.result !== null &&
      'text' in body.result &&
      typeof body.result.text === 'string'
    ) {
      return { ok: true, transcriptText: body.result.text };
    }
    return { errorCode: 'malformed', ok: false };
  } catch {
    return { errorCode: 'malformed', ok: false };
  }
}

export async function transcribeWithSeedAsrAuc({
  apiKey,
  audioCodec,
  audioFormat,
  audioUrl,
  endpointOrigin = DEFAULT_ORIGIN,
  fetch = getDefaultFetch(),
  now = Date.now,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  requestId,
  signal,
  sleep = (delayMs) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  uid,
  uuid = randomUUID,
}: TranscribeWithSeedAsrAucInput): Promise<SeedAsrAucResult> {
  const taskRequestId = requestId ?? uuid();
  const startedAt = now();
  const submitHeaders = { ...baseHeaders(apiKey, taskRequestId), 'X-Api-Sequence': '-1' };
  const submitResponse = await postJson(
    fetch,
    normalizeEndpoint(endpointOrigin, SEED_ASR_AUC_SUBMIT_PATH),
    submitHeaders,
    {
      audio: { ...(audioCodec ? { codec: audioCodec } : {}), format: audioFormat, url: audioUrl },
      request: { model_name: 'bigmodel' },
      user: { uid },
    },
    signal
  );
  if (typeof submitResponse === 'string') return errorResult(submitResponse, taskRequestId);

  const submitStatus = classifyResponse(submitResponse);
  if (submitStatus !== 'success') {
    return errorResult(submitStatus === 'pending' ? 'malformed' : submitStatus, taskRequestId);
  }

  const queryHeaders = baseHeaders(apiKey, taskRequestId);
  while (true) {
    if (signal?.aborted) return errorResult('abort', taskRequestId);
    if (now() - startedAt >= timeoutMs) return errorResult('timeout', taskRequestId);

    const queryResponse = await postJson(
      fetch,
      normalizeEndpoint(endpointOrigin, SEED_ASR_AUC_QUERY_PATH),
      queryHeaders,
      {},
      signal
    );
    if (typeof queryResponse === 'string') return errorResult(queryResponse, taskRequestId);

    const queryStatus = classifyResponse(queryResponse);
    if (queryStatus === 'success') {
      const transcript = await readTranscriptText(queryResponse);
      if (!transcript.ok) return errorResult(transcript.errorCode, taskRequestId);
      return { ok: true, requestId: taskRequestId, transcriptText: transcript.transcriptText };
    }
    if (queryStatus !== 'pending') return errorResult(queryStatus, taskRequestId);

    await sleep(Math.max(1, pollIntervalMs));
  }
}

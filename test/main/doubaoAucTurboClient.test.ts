import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DOUBAO_AUC_TURBO_ENDPOINT,
  DOUBAO_AUC_TURBO_MAX_AUDIO_DATA_BASE64_BYTES,
  DOUBAO_AUC_TURBO_RESOURCE_ID,
  recognizeDoubaoAucTurboAudioData,
} from '../../src/main/doubaoAucTurboClient.js';

type CapturedRequest = {
  readonly init: RequestInit;
  readonly url: string;
};

type LocalDoubaoAucTurboFetch = (url: string, init?: RequestInit) => Promise<Response>;

function createJsonResponse(
  body: unknown,
  {
    headers = {},
    status = 200,
  }: {
    readonly headers?: Record<string, string>;
    readonly status?: number;
  } = {}
) {
  return new Response(JSON.stringify(body), { headers, status });
}

function createClientFetch(response: Response): {
  readonly captured: CapturedRequest[];
  readonly fetch: LocalDoubaoAucTurboFetch;
} {
  const captured: CapturedRequest[] = [];
  return {
    captured,
    fetch: async (url, init) => {
      captured.push({ init: init ?? {}, url: String(url) });
      return response;
    },
  };
}

test('doubao AUC Turbo client posts audio.data with single X-Api-Key auth headers', async () => {
  const { captured, fetch } = createClientFetch(
    createJsonResponse(
      { result: { text: '识别完成。' } },
      { headers: { 'X-Api-Status-Code': '20000000', 'X-Tt-Logid': 'log_1' } }
    )
  );

  const result = await recognizeDoubaoAucTurboAudioData({
    apiKey: 'secret-api-key',
    audioDataBase64: 'b2dnLW9wdXM=',
    fetch,
    requestId: 'request-1',
  });

  assert.deepEqual(result, {
    logId: 'log_1',
    ok: true,
    requestId: 'request-1',
    transcriptText: '识别完成。',
  });
  assert.equal(captured[0]?.url, DOUBAO_AUC_TURBO_ENDPOINT);
  assert.equal(captured[0]?.init.method, 'POST');
  assert.equal(captured[0]?.init.redirect, 'error');

  const headers = captured[0]?.init.headers as Record<string, string>;
  assert.deepEqual(headers, {
    'Content-Type': 'application/json',
    'X-Api-Key': 'secret-api-key',
    'X-Api-Request-Id': 'request-1',
    'X-Api-Resource-Id': DOUBAO_AUC_TURBO_RESOURCE_ID,
    'X-Api-Sequence': '-1',
  });

  const body = JSON.parse(String(captured[0]?.init.body)) as {
    readonly audio?: { readonly data?: string; readonly url?: string };
    readonly request?: { readonly model_name?: string };
  };
  assert.equal(body.audio?.data, 'b2dnLW9wdXM=');
  assert.equal(body.audio?.url, undefined);
  assert.equal(body.request?.model_name, 'bigmodel');
});

test('doubao AUC Turbo client maps service and HTTP failures to typed redacted errors', async () => {
  const cases: Array<{
    readonly body: Record<string, unknown>;
    readonly code: string;
    readonly expected: string;
    readonly status?: number;
  }> = [
    { body: {}, code: '20000003', expected: 'silent-audio' },
    { body: {}, code: '45000001', expected: 'malformed' },
    { body: {}, code: '45000002', expected: 'empty-audio' },
    { body: {}, code: '45000010', expected: 'auth' },
    { body: {}, code: '45000151', expected: 'format' },
    { body: {}, code: '55000031', expected: 'server-busy' },
    { body: {}, code: '55010000', expected: 'server' },
    { body: {}, code: '20000000', expected: 'malformed' },
    { body: {}, code: '20000000', expected: 'auth', status: 401 },
    { body: {}, code: '20000000', expected: 'rate-limit', status: 429 },
  ];

  for (const entry of cases) {
    const { fetch } = createClientFetch(
      createJsonResponse(
        { ...entry.body, message: 'secret-api-key audio-data transcript text raw/path.webm' },
        entry.status === undefined
          ? { headers: { 'X-Api-Status-Code': entry.code, 'X-Api-Message': 'secret-api-key' } }
          : {
              headers: { 'X-Api-Status-Code': entry.code, 'X-Api-Message': 'secret-api-key' },
              status: entry.status,
            }
      )
    );

    const result = await recognizeDoubaoAucTurboAudioData({
      apiKey: 'secret-api-key',
      audioDataBase64: 'audio-data',
      fetch,
      requestId: 'request-2',
    });

    assert.equal(result.ok, false);
    assert.equal(result.errorCode, entry.expected);
    assert.equal(JSON.stringify(result).includes('secret-api-key'), false);
    assert.equal(JSON.stringify(result).includes('audio-data'), false);
    assert.equal(JSON.stringify(result).includes('transcript text'), false);
    assert.equal(JSON.stringify(result).includes('raw/path.webm'), false);
  }
});

test('doubao AUC Turbo client maps abort timeout and network failures without leaking secrets', async () => {
  const aborted = new AbortController();
  aborted.abort();

  assert.deepEqual(
    await recognizeDoubaoAucTurboAudioData({
      apiKey: 'secret-api-key',
      audioDataBase64: 'audio-data',
      fetch: async () => createJsonResponse({}),
      signal: aborted.signal,
    }),
    { errorCode: 'abort', ok: false }
  );

  const timeoutResult = await recognizeDoubaoAucTurboAudioData({
    apiKey: 'secret-api-key',
    audioDataBase64: 'audio-data',
    fetch: () => new Promise<Response>(() => undefined),
    timeoutMs: 1,
  });
  assert.deepEqual(timeoutResult, { errorCode: 'timeout', ok: false });

  const networkResult = await recognizeDoubaoAucTurboAudioData({
    apiKey: 'secret-api-key',
    audioDataBase64: 'audio-data',
    fetch: async () => {
      throw new Error('network secret-api-key audio-data transcript text');
    },
  });
  assert.equal(networkResult.ok, false);
  assert.equal(networkResult.errorCode, 'network');
  assert.equal(JSON.stringify(networkResult).includes('secret-api-key'), false);
  assert.equal(JSON.stringify(networkResult).includes('audio-data'), false);
});

test('doubao AUC Turbo client rejects oversized audio data before building the request body', async () => {
  let fetchCalls = 0;
  const result = await recognizeDoubaoAucTurboAudioData({
    apiKey: 'secret-api-key',
    audioDataBase64: 'a'.repeat(DOUBAO_AUC_TURBO_MAX_AUDIO_DATA_BASE64_BYTES + 1),
    fetch: async () => {
      fetchCalls += 1;
      return createJsonResponse({});
    },
  });

  assert.deepEqual(result, { errorCode: 'size', ok: false });
  assert.equal(fetchCalls, 0);
});

test('doubao AUC Turbo client removes external abort listener after timeout', async () => {
  const listeners = new Set<() => void>();
  const signal = {
    aborted: false,
    addEventListener: (_event: string, listener: unknown) => {
      listeners.add(listener as () => void);
    },
    removeEventListener: (_event: string, listener: unknown) => {
      listeners.delete(listener as () => void);
    },
  } as AbortSignal;

  const result = await recognizeDoubaoAucTurboAudioData({
    apiKey: 'secret-api-key',
    audioDataBase64: 'audio-data',
    fetch: () => new Promise<Response>(() => undefined),
    signal,
    timeoutMs: 1,
  });

  assert.deepEqual(result, { errorCode: 'timeout', ok: false });
  assert.equal(listeners.size, 0);
});

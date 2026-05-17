import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SEED_ASR_AUC_QUERY_PATH,
  SEED_ASR_AUC_RESOURCE_ID,
  SEED_ASR_AUC_SUBMIT_PATH,
  transcribeWithSeedAsrAuc,
} from '../../src/main/c0SeedAsrAucClient.js';

type SeedAsrAucFetchResponse = {
  readonly headers: {
    readonly get: (name: string) => string | null;
  };
  readonly json: () => Promise<unknown>;
  readonly status: number;
};

type SeedAsrAucFetch = (
  url: string,
  init?: {
    readonly body?: string;
    readonly headers?: Record<string, string>;
    readonly method?: string;
    readonly signal?: AbortSignal;
  }
) => Promise<SeedAsrAucFetchResponse>;

type FetchCall = {
  readonly body: unknown;
  readonly headers: Record<string, string>;
  readonly signal?: AbortSignal;
  readonly url: string;
};

function response({
  body,
  headers,
  status = 200,
}: {
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
  readonly status?: number;
}): SeedAsrAucFetchResponse {
  const headerMap = new Map(
    Object.entries(headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    status,
    headers: {
      get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
    },
    json: () => {
      if (body instanceof Error) {
        return Promise.reject(body);
      }
      return Promise.resolve(body);
    },
  };
}

function createFetch(responses: readonly (SeedAsrAucFetchResponse | Error)[]) {
  const calls: FetchCall[] = [];
  let cursor = 0;
  const fetch: SeedAsrAucFetch = async (url, init = {}) => {
    const call: FetchCall = {
      body: init.body ? JSON.parse(String(init.body)) : null,
      headers: Object.fromEntries(
        Object.entries(init.headers ?? {}).map(([key, value]) => [key, String(value)])
      ),
      url,
    };
    if (init.signal) {
      calls.push({ ...call, signal: init.signal });
    } else {
      calls.push(call);
    }
    const next = responses[cursor];
    cursor += 1;
    if (!next) {
      throw new Error('unexpected fetch call');
    }
    if (next instanceof Error) {
      throw next;
    }
    return next;
  };
  return { calls, fetch };
}

function okHeader(code = '20000000') {
  return { 'X-Api-Status-Code': code };
}

test('c0SeedAsrAucClient: submits standard 2.0 request and polls processing to transcript success', async () => {
  const { calls, fetch } = createFetch([
    response({ headers: okHeader() }),
    response({ headers: okHeader('20000001') }),
    response({ body: { result: { text: '最终转录文本' } }, headers: okHeader() }),
  ]);
  const sleeps: number[] = [];

  const result = await transcribeWithSeedAsrAuc({
    apiKey: 'test-api-key',
    audioCodec: 'opus',
    audioFormat: 'ogg',
    audioUrl: 'https://audio.example/private-file.ogg',
    fetch,
    now: () => 1000,
    requestId: 'request-1',
    sleep: async (delayMs: number) => {
      sleeps.push(delayMs);
    },
    uid: 'user-1',
  });

  assert.deepEqual(result, { ok: true, requestId: 'request-1', transcriptText: '最终转录文本' });
  assert.equal(calls.length, 3);
  assert.equal(calls[0]?.url, `https://openspeech.bytedance.com${SEED_ASR_AUC_SUBMIT_PATH}`);
  assert.equal(calls[1]?.url, `https://openspeech.bytedance.com${SEED_ASR_AUC_QUERY_PATH}`);
  assert.equal(calls[0]?.headers['X-Api-Key'], 'test-api-key');
  assert.equal(calls[0]?.headers['X-Api-Resource-Id'], SEED_ASR_AUC_RESOURCE_ID);
  assert.equal(calls[0]?.headers['X-Api-Request-Id'], 'request-1');
  assert.equal(calls[0]?.headers['X-Api-Sequence'], '-1');
  assert.equal(calls[1]?.headers['X-Api-Sequence'], undefined);
  assert.deepEqual(calls[0]?.body, {
    audio: {
      codec: 'opus',
      format: 'ogg',
      url: 'https://audio.example/private-file.ogg',
    },
    request: {
      model_name: 'bigmodel',
    },
    user: {
      uid: 'user-1',
    },
  });
  assert.deepEqual(calls[1]?.body, {});
  assert.deepEqual(sleeps, [1000]);
});

test('c0SeedAsrAucClient: polls queued status until success and uses injected UUID', async () => {
  const { calls, fetch } = createFetch([
    response({ headers: okHeader() }),
    response({ headers: okHeader('20000002') }),
    response({ headers: okHeader('20000002') }),
    response({ body: { result: { text: 'queued done' } }, headers: okHeader() }),
  ]);

  const result = await transcribeWithSeedAsrAuc({
    apiKey: 'test-api-key',
    audioFormat: 'mp3',
    audioUrl: 'https://audio.example/file.mp3',
    fetch,
    now: () => 0,
    sleep: async () => undefined,
    uid: 'user-1',
    uuid: () => 'generated-request-id',
  });

  assert.deepEqual(result, {
    ok: true,
    requestId: 'generated-request-id',
    transcriptText: 'queued done',
  });
  assert.equal(calls.length, 4);
  assert.equal(calls[0]?.headers['X-Api-Request-Id'], 'generated-request-id');
});

test('c0SeedAsrAucClient: maps HTTP and transport failures to typed error codes', async () => {
  const cases: readonly {
    readonly expected: string;
    readonly responses: readonly (SeedAsrAucFetchResponse | Error)[];
  }[] = [
    { expected: 'auth', responses: [response({ headers: okHeader(), status: 401 })] },
    { expected: 'auth', responses: [response({ headers: okHeader(), status: 403 })] },
    { expected: 'rate-limit', responses: [response({ headers: okHeader(), status: 429 })] },
    { expected: 'timeout', responses: [response({ headers: okHeader(), status: 408 })] },
    { expected: 'network', responses: [response({ headers: okHeader(), status: 500 })] },
    { expected: 'network', responses: [new Error('ENOTFOUND https://audio.example/secret')] },
  ];

  for (const testCase of cases) {
    const { fetch } = createFetch(testCase.responses);
    const result = await transcribeWithSeedAsrAuc({
      apiKey: 'secret-key',
      audioFormat: 'wav',
      audioUrl: 'https://audio.example/secret.wav',
      fetch,
      now: () => 0,
      requestId: 'request-1',
      sleep: async () => undefined,
      uid: 'user-1',
    });

    assert.deepEqual(result, {
      errorCode: testCase.expected,
      ok: false,
      requestId: 'request-1',
    });
    assert.equal(JSON.stringify(result).includes('secret'), false);
  }
});

test('c0SeedAsrAucClient: maps provider terminal status codes without leaking sensitive data', async () => {
  const cases: readonly [string, string][] = [
    ['45000002', 'empty-audio'],
    ['45000131', 'quota'],
    ['45000130', 'size'],
    ['45000132', 'format'],
    ['45000151', 'format'],
  ];

  for (const [statusCode, errorCode] of cases) {
    const { fetch } = createFetch([
      response({ headers: okHeader() }),
      response({
        body: { result: { text: 'do not leak transcript' } },
        headers: okHeader(statusCode),
      }),
    ]);

    const result = await transcribeWithSeedAsrAuc({
      apiKey: 'secret-key',
      audioFormat: 'ogg',
      audioUrl: 'https://audio.example/private.ogg',
      fetch,
      now: () => 0,
      requestId: 'request-1',
      sleep: async () => undefined,
      uid: 'user-1',
    });

    assert.deepEqual(result, { errorCode, ok: false, requestId: 'request-1' });
    assert.equal(JSON.stringify(result).includes('private.ogg'), false);
    assert.equal(JSON.stringify(result).includes('secret-key'), false);
    assert.equal(JSON.stringify(result).includes('do not leak transcript'), false);
  }
});

test('c0SeedAsrAucClient: returns malformed for missing status header or invalid success body', async () => {
  for (const responses of [
    [response({ headers: {} })],
    [response({ headers: okHeader() }), response({ body: {}, headers: okHeader() })],
    [
      response({ headers: okHeader() }),
      response({
        body: new Error('bad json https://audio.example/private.ogg'),
        headers: okHeader(),
      }),
    ],
  ] as const) {
    const { fetch } = createFetch(responses);
    const result = await transcribeWithSeedAsrAuc({
      apiKey: 'secret-key',
      audioFormat: 'ogg',
      audioUrl: 'https://audio.example/private.ogg',
      fetch,
      now: () => 0,
      requestId: 'request-1',
      sleep: async () => undefined,
      uid: 'user-1',
    });

    assert.deepEqual(result, { errorCode: 'malformed', ok: false, requestId: 'request-1' });
  }
});

test('c0SeedAsrAucClient: returns timeout when polling exceeds the injected clock budget', async () => {
  const { fetch } = createFetch([
    response({ headers: okHeader() }),
    response({ headers: okHeader('20000001') }),
    response({ headers: okHeader('20000001') }),
  ]);
  const ticks = [0, 10, 60];

  const result = await transcribeWithSeedAsrAuc({
    apiKey: 'secret-key',
    audioFormat: 'ogg',
    audioUrl: 'https://audio.example/private.ogg',
    fetch,
    now: () => ticks.shift() ?? 60,
    pollIntervalMs: 5,
    requestId: 'request-1',
    sleep: async () => undefined,
    timeoutMs: 50,
    uid: 'user-1',
  });

  assert.deepEqual(result, { errorCode: 'timeout', ok: false, requestId: 'request-1' });
});

test('c0SeedAsrAucClient: maps abort signals and AbortError fetch failures to abort', async () => {
  const preAborted = new AbortController();
  preAborted.abort();
  const preAbortResult = await transcribeWithSeedAsrAuc({
    apiKey: 'secret-key',
    audioFormat: 'ogg',
    audioUrl: 'https://audio.example/private.ogg',
    fetch: async () => response({ headers: okHeader() }),
    now: () => 0,
    requestId: 'request-1',
    signal: preAborted.signal,
    sleep: async () => undefined,
    uid: 'user-1',
  });
  assert.deepEqual(preAbortResult, { errorCode: 'abort', ok: false, requestId: 'request-1' });

  const abortError = new Error('The operation was aborted');
  abortError.name = 'AbortError';
  const { fetch } = createFetch([abortError]);
  const fetchAbortResult = await transcribeWithSeedAsrAuc({
    apiKey: 'secret-key',
    audioFormat: 'ogg',
    audioUrl: 'https://audio.example/private.ogg',
    fetch,
    now: () => 0,
    requestId: 'request-2',
    sleep: async () => undefined,
    uid: 'user-1',
  });

  assert.deepEqual(fetchAbortResult, { errorCode: 'abort', ok: false, requestId: 'request-2' });
});

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import {
  createBackfillAudioUrlSource,
  createFfmpegOggOpusRemuxer,
  createVolcengineTosBackfillStagingClient,
  type BackfillAudioRemuxer,
  type BackfillAudioStagingClient,
} from '../../src/main/backfillAudioUrlSource.js';
import { resolveBackfillAudioUrlSettings } from '../../src/main/backfillAudioUrlSettings.js';

type StagingCall =
  | {
      readonly body: Uint8Array;
      readonly contentType: string;
      readonly key: string;
      readonly kind: 'put';
      readonly signal?: AbortSignal;
    }
  | {
      readonly key: string;
      readonly kind: 'getUrl';
      readonly ttlSeconds: number;
    }
  | {
      readonly key: string;
      readonly kind: 'delete';
      readonly signal?: AbortSignal;
    };

function configuredSettings() {
  return {
    configured: true,
    tos: {
      accessKeyId: 'ak-test-secret',
      accessKeySecret: 'sk-test-secret',
      bucket: 'reo-private-bucket',
      endpoint: 'https://tos-cn-beijing.volces.com',
      keyPrefix: 'reo/backfill',
      region: 'cn-beijing',
    },
    ffmpegPath: '/opt/reo-private/ffmpeg',
    presignedUrlTtlSeconds: 60,
  } as const;
}

function createFakeStagingClient({
  getUrl = () =>
    'https://bucket.tos-cn-beijing.volces.com/reo/backfill/private-object.ogg?X-Tos-Signature=secret',
  put = async () => undefined,
}: {
  readonly getUrl?: (key: string, ttlSeconds: number) => string | Promise<string>;
  readonly put?: (input: {
    readonly body: Uint8Array;
    readonly contentType: string;
    readonly key: string;
    readonly signal?: AbortSignal;
  }) => Promise<void>;
} = {}) {
  const calls: StagingCall[] = [];
  const client: BackfillAudioStagingClient = {
    deleteObject: async ({ key, signal }) => {
      calls.push({ key, kind: 'delete', ...(signal ? { signal } : {}) });
    },
    getObjectGetUrl: async ({ key, ttlSeconds }) => {
      calls.push({ key, kind: 'getUrl', ttlSeconds });
      return getUrl(key, ttlSeconds);
    },
    putObject: async ({ body, contentType, key, signal }) => {
      calls.push({ body, contentType, key, kind: 'put', ...(signal ? { signal } : {}) });
      await put({ body, contentType, key, ...(signal ? { signal } : {}) });
    },
  };
  return { calls, client };
}

function createFakeRemuxer(
  remux: BackfillAudioRemuxer['remux'] = async () => ({
    bytes: new Uint8Array([9, 8, 7]),
    codec: 'opus',
    container: 'ogg',
  })
) {
  const calls: Parameters<BackfillAudioRemuxer['remux']>[0][] = [];
  const remuxer: BackfillAudioRemuxer = {
    remux: async (input) => {
      calls.push(input);
      return remux(input);
    },
  };
  return { calls, remuxer };
}

test('backfill audio URL source remuxes WebM Opus, uploads OGG, returns GET URL, and cleans up once', async () => {
  const staging = createFakeStagingClient();
  const remuxer = createFakeRemuxer();
  const source = createBackfillAudioUrlSource({
    objectKeyId: () => 'upload-id',
    remuxer: remuxer.remuxer,
    settings: configuredSettings(),
    stagingClient: staging.client,
  });

  const result = await source.createUrl({
    audioByteLength: 3,
    audioBytes: new Uint8Array([1, 2, 3]),
    audioPath: '/Users/yck/private/audio.webm',
    codec: 'opus',
    container: 'webm',
    memoryId: 'mem_private',
    segmentId: 'seg_private',
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(
    result.url,
    'https://bucket.tos-cn-beijing.volces.com/reo/backfill/private-object.ogg?X-Tos-Signature=secret'
  );
  assert.match(result.expiresAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(remuxer.calls, [
    {
      audioByteLength: 3,
      audioBytes: new Uint8Array([1, 2, 3]),
      audioPath: '/Users/yck/private/audio.webm',
      codec: 'opus',
      container: 'webm',
    },
  ]);
  assert.equal(staging.calls[0]?.kind, 'put');
  assert.deepEqual(staging.calls[0], {
    body: new Uint8Array([9, 8, 7]),
    contentType: 'audio/ogg; codecs=opus',
    key: 'reo/backfill/mem_private/seg_private/upload-id.ogg',
    kind: 'put',
  });
  assert.deepEqual(staging.calls[1], {
    key: 'reo/backfill/mem_private/seg_private/upload-id.ogg',
    kind: 'getUrl',
    ttlSeconds: 60,
  });

  assert.equal(await result.cleanup(), undefined);
  assert.equal(await result.cleanup(), undefined);
  assert.deepEqual(staging.calls.slice(2), [
    {
      key: 'reo/backfill/mem_private/seg_private/upload-id.ogg',
      kind: 'delete',
    },
  ]);
});

test('backfill audio URL source rejects non WebM Opus input before remux or upload', async () => {
  const staging = createFakeStagingClient();
  const remuxer = createFakeRemuxer();
  const source = createBackfillAudioUrlSource({
    remuxer: remuxer.remuxer,
    settings: configuredSettings(),
    stagingClient: staging.client,
  });

  const result = await source.createUrl({
    audioByteLength: 3,
    audioBytes: new Uint8Array([1, 2, 3]),
    audioPath: '/Users/yck/private/audio.mp3',
    codec: 'mp3',
    container: 'mp3',
    memoryId: 'mem_private',
    segmentId: 'seg_private',
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.equal(result.error.code, 'unsupported-audio-format');
  assert.deepEqual(remuxer.calls, []);
  assert.deepEqual(staging.calls, []);
});

test('backfill audio URL source honors abort before remux and attempts cleanup without the aborted task signal', async () => {
  const aborted = new AbortController();
  aborted.abort();
  const staging = createFakeStagingClient();
  const remuxer = createFakeRemuxer();
  const source = createBackfillAudioUrlSource({
    remuxer: remuxer.remuxer,
    settings: configuredSettings(),
    stagingClient: staging.client,
  });

  const abortedResult = await source.createUrl(
    {
      audioByteLength: 3,
      audioBytes: new Uint8Array([1, 2, 3]),
      audioPath: '/Users/yck/private/audio.webm',
      codec: 'opus',
      container: 'webm',
      memoryId: 'mem_private',
      segmentId: 'seg_private',
    },
    { signal: aborted.signal }
  );

  assert.equal(abortedResult.ok, false);
  if (!abortedResult.ok) {
    assert.equal(abortedResult.error.code, 'aborted');
  }
  assert.deepEqual(remuxer.calls, []);
  assert.deepEqual(staging.calls, []);

  const uploadAbort = new AbortController();
  const uploadStaging = createFakeStagingClient({
    put: async ({ signal }) => {
      assert.equal(signal, uploadAbort.signal);
      uploadAbort.abort();
      throw new Error('upload aborted');
    },
  });
  const uploadSource = createBackfillAudioUrlSource({
    objectKeyId: () => 'upload-id',
    remuxer: createFakeRemuxer().remuxer,
    settings: configuredSettings(),
    stagingClient: uploadStaging.client,
  });

  const uploadResult = await uploadSource.createUrl(
    {
      audioByteLength: 3,
      audioBytes: new Uint8Array([1, 2, 3]),
      audioPath: '/Users/yck/private/audio.webm',
      codec: 'opus',
      container: 'webm',
      memoryId: 'mem_private',
      segmentId: 'seg_private',
    },
    { signal: uploadAbort.signal }
  );

  assert.equal(uploadResult.ok, false);
  if (!uploadResult.ok) {
    assert.equal(uploadResult.error.code, 'aborted');
  }
  assert.equal(uploadStaging.calls[0]?.kind, 'put');
  assert.equal(uploadStaging.calls[0]?.signal, uploadAbort.signal);
  assert.equal(uploadStaging.calls[1]?.kind, 'delete');
  assert.equal(uploadStaging.calls[1]?.signal, undefined);
});

test('backfill audio URL source rejects remuxers that do not return OGG Opus', async () => {
  const staging = createFakeStagingClient();
  const remuxer = createFakeRemuxer(async () => ({
    bytes: new Uint8Array([4]),
    codec: 'opus',
    container: 'webm',
  }));
  const source = createBackfillAudioUrlSource({
    remuxer: remuxer.remuxer,
    settings: configuredSettings(),
    stagingClient: staging.client,
  });

  const result = await source.createUrl({
    audioByteLength: 3,
    audioBytes: new Uint8Array([1, 2, 3]),
    audioPath: '/Users/yck/private/audio.webm',
    codec: 'opus',
    container: 'webm',
    memoryId: 'mem_private',
    segmentId: 'seg_private',
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.equal(result.error.code, 'invalid-remux-output');
  assert.deepEqual(staging.calls, []);
});

test('backfill audio URL source deletes uploaded OGG when URL creation fails', async () => {
  const staging = createFakeStagingClient({
    getUrl: () => {
      throw new Error('signed url failed with /Users/yck/private/audio.webm and secret object key');
    },
  });
  const remuxer = createFakeRemuxer();
  const source = createBackfillAudioUrlSource({
    objectKeyId: () => 'upload-id',
    remuxer: remuxer.remuxer,
    settings: configuredSettings(),
    stagingClient: staging.client,
  });

  const result = await source.createUrl({
    audioByteLength: 3,
    audioBytes: new Uint8Array([1, 2, 3]),
    audioPath: '/Users/yck/private/audio.webm',
    codec: 'opus',
    container: 'webm',
    memoryId: 'mem_private',
    segmentId: 'seg_private',
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.equal(result.error.code, 'url-create-failed');
  assert.deepEqual(
    staging.calls.map((call) => call.kind),
    ['put', 'getUrl', 'delete']
  );
});

test('backfill audio URL source reports explicit unconfigured state without side effects', async () => {
  const staging = createFakeStagingClient();
  const remuxer = createFakeRemuxer();
  const settings = resolveBackfillAudioUrlSettings({});
  const source = createBackfillAudioUrlSource({
    remuxer: remuxer.remuxer,
    settings,
    stagingClient: staging.client,
  });

  const result = await source.createUrl({
    audioByteLength: 3,
    audioBytes: new Uint8Array([1, 2, 3]),
    audioPath: '/Users/yck/private/audio.webm',
    codec: 'opus',
    container: 'webm',
    memoryId: 'mem_private',
    segmentId: 'seg_private',
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.equal(result.error.code, 'unconfigured');
  assert.equal(result.error.reason, 'missing-tos-settings');
  assert.deepEqual(remuxer.calls, []);
  assert.deepEqual(staging.calls, []);
});

test('backfill audio URL source treats missing ffmpeg path as unconfigured before remux or upload', async () => {
  const staging = createFakeStagingClient();
  const remuxer = createFakeRemuxer();
  const settings = resolveBackfillAudioUrlSettings({
    REO_BACKFILL_TOS_ACCESS_KEY_ID: 'ak-test-secret',
    REO_BACKFILL_TOS_ACCESS_KEY_SECRET: 'sk-test-secret',
    REO_BACKFILL_TOS_BUCKET: 'reo-private-bucket',
    REO_BACKFILL_TOS_ENDPOINT: 'https://tos-cn-beijing.volces.com',
    REO_BACKFILL_TOS_REGION: 'cn-beijing',
  });
  const source = createBackfillAudioUrlSource({
    remuxer: remuxer.remuxer,
    settings,
    stagingClient: staging.client,
  });

  const result = await source.createUrl({
    audioByteLength: 3,
    audioBytes: new Uint8Array([1, 2, 3]),
    audioPath: '/Users/yck/private/audio.webm',
    codec: 'opus',
    container: 'webm',
    memoryId: 'mem_private',
    segmentId: 'seg_private',
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.equal(result.error.code, 'unconfigured');
  assert.equal(result.error.reason, 'missing-ffmpeg-path');
  assert.deepEqual(remuxer.calls, []);
  assert.deepEqual(staging.calls, []);
});

test('ffmpeg remux waits for child close after abort before settling', async () => {
  class FakeFfmpegProcess extends EventEmitter {
    killedSignal: NodeJS.Signals | null = null;

    kill(signal?: NodeJS.Signals | number): boolean {
      this.killedSignal = typeof signal === 'string' ? signal : null;
      return true;
    }
  }

  const fakeChild = new FakeFfmpegProcess();
  let notifySpawned: () => void = () => undefined;
  const spawned = new Promise<void>((resolve) => {
    notifySpawned = resolve;
  });
  const controller = new AbortController();
  const remuxer = createFfmpegOggOpusRemuxer({
    ffmpegPath: '/opt/reo-private/ffmpeg',
    spawnProcess: () => {
      notifySpawned();
      return fakeChild as never;
    },
  });
  let settled = false;
  const remuxResult = remuxer
    .remux({
      audioByteLength: 3,
      audioBytes: new Uint8Array([1, 2, 3]),
      audioPath: '/Users/yck/private/audio.webm',
      codec: 'opus',
      container: 'webm',
      signal: controller.signal,
    })
    .catch((error: unknown) => error)
    .finally(() => {
      settled = true;
    });

  await spawned;
  controller.abort();
  await Promise.resolve();

  assert.equal(fakeChild.killedSignal, 'SIGTERM');
  assert.equal(settled, false);

  fakeChild.emit('close', null);
  const error = await remuxResult;

  assert.equal(error instanceof Error, true);
  assert.match((error as Error).message, /aborted/);
});

test('backfill audio URL diagnostics redact paths URLs keys and provider credentials', async () => {
  const staging = createFakeStagingClient({
    put: async () => {
      throw new Error(
        'upload failed for /Users/yck/private/audio.webm https://bucket.tos-cn-beijing.volces.com/private-object.ogg ak-test-secret sk-test-secret'
      );
    },
  });
  const remuxer = createFakeRemuxer();
  const source = createBackfillAudioUrlSource({
    objectKeyId: () => 'private-object',
    remuxer: remuxer.remuxer,
    settings: configuredSettings(),
    stagingClient: staging.client,
  });

  const result = await source.createUrl({
    audioByteLength: 3,
    audioBytes: new Uint8Array([1, 2, 3]),
    audioPath: '/Users/yck/private/audio.webm',
    codec: 'opus',
    container: 'webm',
    memoryId: 'mem_private',
    segmentId: 'seg_private',
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  const serialized = JSON.stringify(result.error);
  assert.equal(serialized.includes('/Users/yck/private/audio.webm'), false);
  assert.equal(serialized.includes('https://bucket.tos-cn-beijing.volces.com'), false);
  assert.equal(
    serialized.includes('reo/backfill/mem_private/seg_private/private-object.ogg'),
    false
  );
  assert.equal(serialized.includes('ak-test-secret'), false);
  assert.equal(serialized.includes('sk-test-secret'), false);
  assert.deepEqual(
    staging.calls.map((call) => call.kind),
    ['put', 'delete']
  );
  assert.deepEqual(result.error.diagnostics, {
    audioByteLength: 3,
    inputCodec: 'opus',
    inputContainer: 'webm',
    stage: 'upload',
  });
});

test('Volcengine TOS staging client signs PUT DELETE and short-lived GET without SDK dependency', async () => {
  const calls: Array<{
    readonly body?: Uint8Array;
    readonly headers: Record<string, string>;
    readonly method: 'DELETE' | 'PUT';
    readonly url: string;
  }> = [];
  const client = createVolcengineTosBackfillStagingClient(configuredSettings(), {
    fetch: async (url, init) => {
      calls.push({
        ...(init.body ? { body: init.body } : {}),
        headers: init.headers,
        method: init.method,
        url,
      });
      return { ok: true, status: 200 };
    },
    now: () => new Date('2026-05-17T12:34:56.000Z'),
  });

  await client.putObject({
    body: new Uint8Array([1, 2, 3]),
    contentType: 'audio/ogg; codecs=opus',
    key: 'reo/backfill/mem_private/seg_private/upload-id.ogg',
  });
  const url = await client.getObjectGetUrl({
    key: 'reo/backfill/mem_private/seg_private/upload-id.ogg',
    ttlSeconds: 60,
  });
  await client.deleteObject({
    key: 'reo/backfill/mem_private/seg_private/upload-id.ogg',
  });

  assert.equal(calls.length, 2);
  assert.equal(
    calls[0]?.url,
    'https://reo-private-bucket.tos-cn-beijing.volces.com/reo%2Fbackfill%2Fmem_private%2Fseg_private%2Fupload-id.ogg'
  );
  assert.equal(calls[0]?.method, 'PUT');
  assert.equal(calls[0]?.headers['x-tos-date'], '20260517T123456Z');
  assert.equal(calls[0]?.headers['x-tos-content-sha256'], 'UNSIGNED-PAYLOAD');
  assert.equal(calls[0]?.headers['content-type'], 'audio/ogg; codecs=opus');
  assert.match(
    calls[0]?.headers['authorization'] ?? '',
    /^TOS4-HMAC-SHA256 Credential=ak-test-secret\/20260517\/cn-beijing\/tos\/request, SignedHeaders=content-type;host;x-tos-content-sha256;x-tos-date, Signature=[a-f0-9]{64}$/
  );
  assert.equal(calls[1]?.method, 'DELETE');
  assert.equal(
    calls[1]?.url,
    'https://reo-private-bucket.tos-cn-beijing.volces.com/reo%2Fbackfill%2Fmem_private%2Fseg_private%2Fupload-id.ogg'
  );
  assert.match(
    calls[1]?.headers['authorization'] ?? '',
    /^TOS4-HMAC-SHA256 Credential=ak-test-secret\/20260517\/cn-beijing\/tos\/request, SignedHeaders=host;x-tos-content-sha256;x-tos-date, Signature=[a-f0-9]{64}$/
  );
  assert.match(
    url,
    /^https:\/\/reo-private-bucket\.tos-cn-beijing\.volces\.com\/reo\/backfill\/mem_private\/seg_private\/upload-id\.ogg\?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=ak-test-secret%2F20260517%2Fcn-beijing%2Ftos%2Frequest&X-Tos-Date=20260517T123456Z&X-Tos-Expires=60&X-Tos-SignedHeaders=host&X-Tos-Signature=[a-f0-9]{64}$/
  );
  const serialized = JSON.stringify({ calls, url });
  assert.equal(serialized.includes('sk-test-secret'), false);
});

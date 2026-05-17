import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkspaceErrorEnvelope } from '../../src/workspace-contract/workspace-contract.js';
import {
  createWorkspaceBackfillQueue,
  scanWorkspaceBackfillTargets,
} from '../../src/main/backfillRuntime.js';
import type { BackfillAudioUrlSource } from '../../src/main/backfillAudioUrlSource.js';
import type { BackfillQueueTask } from '../../src/main/backfillQueue.js';

type AssertWorkspaceUsable = () => { readonly ok: true } | WorkspaceErrorEnvelope;

function okWorkspace(): { readonly ok: true } {
  return { ok: true };
}

function voiceSettingsStore(apiKey: string | null = 'seed-asr-key') {
  return {
    readDecryptedApiKey: () => apiKey,
  };
}

function segmentTask(
  overrides: Partial<Extract<BackfillQueueTask, { readonly kind: 'segment' }>> = {}
): BackfillQueueTask {
  return {
    kind: 'segment',
    memoryId: 'mem_runtime',
    rootPath: '/private/workspace',
    segmentId: 'seg_runtime',
    source: 'manual',
    workspaceHandle: 'wh_runtime',
    workspaceId: 'workspace-runtime',
    assertWorkspaceUsable: okWorkspace,
    ...overrides,
  };
}

function supplementTask(
  overrides: Partial<Extract<BackfillQueueTask, { readonly kind: 'supplement' }>> = {}
): BackfillQueueTask {
  return {
    kind: 'supplement',
    memoryId: 'mem_runtime',
    rootPath: '/private/workspace',
    segmentId: 'seg_runtime',
    source: 'auto',
    supplementId: 'sup_runtime',
    workspaceHandle: 'wh_runtime',
    workspaceId: 'workspace-runtime',
    assertWorkspaceUsable: okWorkspace,
    ...overrides,
  };
}

function createUrlSource(): {
  readonly calls: unknown[];
  readonly cleanupCalls: string[];
  readonly source: BackfillAudioUrlSource;
} {
  const calls: unknown[] = [];
  const cleanupCalls: string[] = [];
  return {
    calls,
    cleanupCalls,
    source: {
      createUrl: async (input) => {
        calls.push(input);
        return {
          cleanup: async () => {
            cleanupCalls.push('cleanup');
          },
          expiresAt: '2026-05-17T12:01:00.000Z',
          ok: true,
          url: 'https://private-bucket.example/reo/backfill/audio.ogg?signature=redacted',
        };
      },
    },
  };
}

test('workspace backfill runtime transcribes manual segment audio without exposing renderer state', async () => {
  const urlSource = createUrlSource();
  const transcribeCalls: unknown[] = [];
  const saveCalls: unknown[] = [];
  const queue = createWorkspaceBackfillQueue({
    audioUrlSource: urlSource.source,
    readSegmentAudio: async () => ({
      audio: new Uint8Array([1, 2, 3]),
      audioByteLength: 3,
      ok: true,
      transcript: { exists: false, text: '' },
    }),
    readSupplementAudio: async () => assert.fail('supplement audio should not be read'),
    saveSegmentTranscript: async (input) => {
      saveCalls.push(input);
      return { ok: true };
    },
    saveSupplementTranscript: async () => assert.fail('supplement transcript should not be saved'),
    transcribe: async (input) => {
      transcribeCalls.push(input);
      return { ok: true, requestId: 'request-runtime', transcriptText: 'manual transcript' };
    },
    voiceSettingsStore: voiceSettingsStore(),
  });

  const result = await queue.runManual(segmentTask());

  assert.deepEqual(result, { ok: true, transcriptText: 'manual transcript' });
  assert.equal(urlSource.calls.length, 1);
  assert.deepEqual(urlSource.cleanupCalls, ['cleanup']);
  assert.deepEqual(saveCalls, []);
  assert.deepEqual(transcribeCalls, [
    {
      apiKey: 'seed-asr-key',
      audioCodec: 'opus',
      audioFormat: 'ogg',
      audioUrl: 'https://private-bucket.example/reo/backfill/audio.ogg?signature=redacted',
      signal: transcribeCalls[0] && (transcribeCalls[0] as { signal: AbortSignal }).signal,
      uid: 'workspace-runtime',
    },
  ]);
});

test('workspace backfill runtime saves successful automatic supplement transcripts', async () => {
  const urlSource = createUrlSource();
  const saveCalls: unknown[] = [];
  const queue = createWorkspaceBackfillQueue({
    audioUrlSource: urlSource.source,
    readSegmentAudio: async () => assert.fail('segment audio should not be read'),
    readSupplementAudio: async () => ({
      audio: new Uint8Array([4, 5, 6]),
      audioByteLength: 3,
      ok: true,
      transcript: { exists: false, text: '' },
    }),
    saveSegmentTranscript: async () => assert.fail('segment transcript should not be saved'),
    saveSupplementTranscript: async (input) => {
      saveCalls.push(input);
      return { ok: true };
    },
    transcribe: async () => ({
      ok: true,
      requestId: 'request-runtime',
      transcriptText: 'automatic supplement transcript',
    }),
    voiceSettingsStore: voiceSettingsStore(),
  });
  const task = supplementTask();

  assert.deepEqual(queue.enqueueAutomaticBatch([task]), {
    accepted: 1,
    capped: 0,
    duplicates: 0,
  });
  const result = await queue.awaitTask(task);

  assert.deepEqual(result, { ok: true, transcriptText: 'automatic supplement transcript' });
  assert.deepEqual(saveCalls, [
    {
      assertWorkspaceUsable: okWorkspace,
      markdown: 'automatic supplement transcript',
      memoryId: 'mem_runtime',
      rootPath: '/private/workspace',
      segmentId: 'seg_runtime',
      supplementId: 'sup_runtime',
      workspaceId: 'workspace-runtime',
    },
  ]);
});

test('workspace backfill runtime maps URL-source abort and unconfigured states without provider work', async () => {
  const abortQueue = createWorkspaceBackfillQueue({
    audioUrlSource: {
      createUrl: async () => ({
        error: {
          code: 'aborted',
          diagnostics: {
            audioByteLength: 3,
            inputCodec: 'opus',
            inputContainer: 'webm',
            stage: 'upload',
          },
        },
        ok: false,
      }),
    },
    readSegmentAudio: async () => ({
      audio: new Uint8Array([1, 2, 3]),
      audioByteLength: 3,
      ok: true,
      transcript: { exists: false, text: '' },
    }),
    readSupplementAudio: async () => assert.fail('supplement audio should not be read'),
    saveSegmentTranscript: async () => assert.fail('transcript should not be saved'),
    saveSupplementTranscript: async () => assert.fail('supplement transcript should not be saved'),
    transcribe: async () => assert.fail('provider should not be called'),
    voiceSettingsStore: voiceSettingsStore(),
  });
  assert.deepEqual(await abortQueue.runManual(segmentTask()), {
    errorCode: 'canceled',
    ok: false,
  });

  const unconfiguredQueue = createWorkspaceBackfillQueue({
    audioUrlSource: {
      createUrl: async () => ({
        error: {
          code: 'unconfigured',
          diagnostics: {
            audioByteLength: 3,
            inputCodec: 'opus',
            inputContainer: 'webm',
            stage: 'settings',
          },
          reason: 'missing-ffmpeg-path',
        },
        ok: false,
      }),
    },
    readSegmentAudio: async () => ({
      audio: new Uint8Array([1, 2, 3]),
      audioByteLength: 3,
      ok: true,
      transcript: { exists: false, text: '' },
    }),
    readSupplementAudio: async () => assert.fail('supplement audio should not be read'),
    saveSegmentTranscript: async () => assert.fail('transcript should not be saved'),
    saveSupplementTranscript: async () => assert.fail('supplement transcript should not be saved'),
    transcribe: async () => assert.fail('provider should not be called'),
    voiceSettingsStore: voiceSettingsStore(),
  });
  assert.deepEqual(await unconfiguredQueue.runManual(segmentTask()), {
    errorCode: 'url-source-unconfigured',
    ok: false,
  });
});

test('workspace backfill runtime does not save late automatic transcript after cancellation', async () => {
  const capturedSignals: AbortSignal[] = [];
  let startTranscribe: () => void = () => undefined;
  let resolveTranscribe: (result: {
    readonly ok: true;
    readonly requestId: string;
    readonly transcriptText: string;
  }) => void = () => undefined;
  const transcribeStarted = new Promise<void>((resolve) => {
    startTranscribe = resolve;
  });
  const transcribeResult = new Promise<{
    readonly ok: true;
    readonly requestId: string;
    readonly transcriptText: string;
  }>((resolve) => {
    resolveTranscribe = resolve;
  });
  let saveCalls = 0;
  const queue = createWorkspaceBackfillQueue({
    audioUrlSource: createUrlSource().source,
    readSegmentAudio: async () => assert.fail('segment audio should not be read'),
    readSupplementAudio: async () => ({
      audio: new Uint8Array([4, 5, 6]),
      audioByteLength: 3,
      ok: true,
      transcript: { exists: false, text: '' },
    }),
    saveSegmentTranscript: async () => assert.fail('segment transcript should not be saved'),
    saveSupplementTranscript: async () => {
      saveCalls += 1;
      return { ok: true };
    },
    transcribe: async ({ signal }) => {
      capturedSignals.push(signal);
      startTranscribe();
      return transcribeResult;
    },
    voiceSettingsStore: voiceSettingsStore(),
  });
  const task = supplementTask();

  queue.enqueueAutomaticBatch([task]);
  const result = queue.awaitTask(task);
  await transcribeStarted;
  queue.cancelAll('workspace-switch');
  resolveTranscribe({ ok: true, requestId: 'request-runtime', transcriptText: 'late transcript' });

  assert.equal(capturedSignals[0]?.aborted, true);
  assert.deepEqual(await result, { errorCode: 'canceled', ok: false });
  assert.equal(saveCalls, 0);
});

test('workspace backfill scanner reads memory details and returns failed missing transcript targets', async () => {
  const assertWorkspaceUsable: AssertWorkspaceUsable = okWorkspace;
  const scanned = await scanWorkspaceBackfillTargets(
    {
      assertWorkspaceUsable,
      limit: 20,
      rootPath: '/private/workspace',
      workspaceId: 'workspace-runtime',
    },
    {
      readMemoryDetail: async ({ memoryId }) => ({
        ok: true,
        value: {
          audioByteLength: 3,
          createdAt: '2026-05-17T10:00:00.000Z',
          description: '',
          durationMs: 1000,
          hasTranscript: false,
          memoryId,
          segmentCount: 1,
          segments: [
            {
              audioByteLength: 3,
              createdAt: '2026-05-17T10:00:00.000Z',
              durationMs: 1000,
              lastTranscriptionAttempt: 'failed',
              memoryId,
              segmentId: 'seg_runtime',
              supplementCount: 1,
              supplements: [
                {
                  audioByteLength: 3,
                  createdAt: '2026-05-17T10:00:00.000Z',
                  durationMs: 1000,
                  lastTranscriptionAttempt: 'failed',
                  memoryId,
                  segmentId: 'seg_runtime',
                  supplementId: 'sup_runtime',
                  title: 'supplement',
                  transcript: { exists: false },
                  type: 'audio',
                  updatedAt: '2026-05-17T12:00:00.000Z',
                  workspaceId: 'workspace-runtime',
                },
              ],
              title: 'segment',
              transcript: { exists: false },
              type: 'audio',
              updatedAt: '2026-05-17T11:00:00.000Z',
              workspaceId: 'workspace-runtime',
            },
          ],
          supplementCount: 1,
          title: 'memory',
          updatedAt: '2026-05-17T12:00:00.000Z',
          workspaceId: 'workspace-runtime',
        },
      }),
      readWorkspaceSnapshot: async () => ({
        ok: true,
        snapshot: {
          description: '',
          memories: [
            {
              audioByteLength: 3,
              createdAt: '2026-05-17T10:00:00.000Z',
              description: '',
              durationMs: 1000,
              hasTranscript: false,
              memoryId: 'mem_runtime',
              segmentCount: 1,
              supplementCount: 1,
              title: 'memory',
              updatedAt: '2026-05-17T12:00:00.000Z',
            },
          ],
          title: 'workspace',
          workspaceId: 'workspace-runtime',
        },
      }),
    }
  );

  assert.deepEqual(scanned, [
    {
      kind: 'supplement',
      memoryId: 'mem_runtime',
      segmentId: 'seg_runtime',
      supplementId: 'sup_runtime',
      updatedAt: '2026-05-17T12:00:00.000Z',
      workspaceId: 'workspace-runtime',
    },
    {
      kind: 'segment',
      memoryId: 'mem_runtime',
      segmentId: 'seg_runtime',
      updatedAt: '2026-05-17T11:00:00.000Z',
      workspaceId: 'workspace-runtime',
    },
  ]);
});

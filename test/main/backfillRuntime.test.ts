import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWorkspaceBackfillRuntime,
  scanWorkspaceBackfillTargets,
} from '../../src/main/backfillRuntime.js';
import { BACKFILL_AUDIO_MAX_INPUT_BYTES } from '../../src/main/backfillAudioDataSource.js';
import type {
  WorkspaceErrorEnvelope,
  WorkspaceMemoryDetailProjection,
  WorkspaceSnapshot,
} from '../../src/workspace-contract/workspace-contract.js';

const usable = () => ({ ok: true as const });

const validVoiceSettingsStore = {
  read: () => ({
    apiKeyConfigured: true,
    apiKeyLastFour: 'key1',
    enabled: true,
    lastValidationCode: 'ok' as const,
    lastValidationOk: true,
    lastValidatedAt: '2026-05-17T01:00:00.000Z',
  }),
  readDecryptedApiKey: () => 'api-key-1',
};

function invalidVoiceSettingsStore(
  overrides: Partial<ReturnType<typeof validVoiceSettingsStore.read>>,
  apiKey: string | null = 'api-key-1'
) {
  return {
    read: () => ({
      ...validVoiceSettingsStore.read(),
      ...overrides,
    }),
    readDecryptedApiKey: () => apiKey,
  };
}

async function waitForSaved(saved: readonly string[], count: number) {
  for (let index = 0; index < 10; index += 1) {
    if (saved.length >= count) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

type SegmentManualInput = Parameters<
  ReturnType<typeof createWorkspaceBackfillRuntime>['requestSegmentBackfill']
>[0];

function segmentTask(): SegmentManualInput {
  return {
    assertWorkspaceUsable: usable,
    memoryId: 'mem_1',
    mode: 'fill-missing',
    rootPath: '/tmp/reo-workspace',
    segmentId: 'seg_1',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  };
}

type SupplementManualInput = Parameters<
  ReturnType<typeof createWorkspaceBackfillRuntime>['requestSupplementBackfill']
>[0];

function supplementTask(): SupplementManualInput {
  return {
    assertWorkspaceUsable: usable,
    memoryId: 'mem_1',
    mode: 'fill-missing',
    rootPath: '/tmp/reo-workspace',
    segmentId: 'seg_1',
    supplementId: 'sup_1',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  };
}

function memoryDetail(): WorkspaceMemoryDetailProjection {
  return {
    audioByteLength: 1,
    createdAt: '2026-05-17T01:00:00.000Z',
    durationMs: 1000,
    hasTranscript: false,
    memoryId: 'mem_1',
    segmentCount: 1,
    segments: [
      {
        audioByteLength: 10,
        createdAt: '2026-05-17T01:00:00.000Z',
        durationMs: 1000,
        lastTranscriptionAttempt: 'failed',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        supplementCount: 1,
        supplements: [
          {
            audioByteLength: 10,
            createdAt: '2026-05-17T01:01:00.000Z',
            durationMs: 1000,
            lastTranscriptionAttempt: 'failed',
            memoryId: 'mem_1',
            segmentId: 'seg_1',
            supplementId: 'sup_1',
            title: 'Supplement',
            transcript: { exists: false },
            type: 'audio',
            updatedAt: '2026-05-17T01:03:00.000Z',
            workspaceId: 'ws_1',
          },
        ],
        title: 'Segment',
        transcript: { exists: false },
        type: 'audio',
        updatedAt: '2026-05-17T01:02:00.000Z',
        workspaceId: 'ws_1',
      },
    ],
    supplementCount: 1,
    title: 'Memory',
    updatedAt: '2026-05-17T01:03:00.000Z',
    workspaceId: 'ws_1',
  };
}

function memoryDetailWithSegment(
  overrides: Partial<WorkspaceMemoryDetailProjection['segments'][number]>
): WorkspaceMemoryDetailProjection {
  const detail = memoryDetail();
  const segment = detail.segments[0];
  assert.ok(segment);
  return {
    ...detail,
    segments: [
      {
        ...segment,
        ...overrides,
      },
    ],
  };
}

function memoryDetailWithSupplement(
  overrides: Partial<WorkspaceMemoryDetailProjection['segments'][number]['supplements'][number]>
): WorkspaceMemoryDetailProjection {
  const detail = memoryDetail();
  const segment = detail.segments[0];
  const supplement = segment?.supplements[0];
  assert.ok(segment);
  assert.ok(supplement);
  return {
    ...detail,
    segments: [
      {
        ...segment,
        supplements: [
          {
            ...supplement,
            ...overrides,
          },
        ],
      },
    ],
  };
}

function savedSegmentResponse() {
  return {
    memory: {
      audioByteLength: 1,
      createdAt: '2026-05-17T01:00:00.000Z',
      durationMs: 1000,
      hasTranscript: true,
      memoryId: 'mem_1',
      segmentCount: 1,
      supplementCount: 1,
      title: 'Memory',
      updatedAt: '2026-05-17T01:00:00.000Z',
    },
    ok: true as const,
    saved: true as const,
  };
}

function savedSupplementResponse() {
  const detail = memoryDetail();
  const segment = detail.segments[0];
  const supplement = segment?.supplements[0];
  assert.ok(segment);
  assert.ok(supplement);
  return {
    ...savedSegmentResponse(),
    segment,
    supplement: {
      ...supplement,
      lastTranscriptionAttempt: 'success' as const,
      transcript: { exists: true as const },
    },
  };
}

test('workspace backfill runtime runs manual segment backfill with injected remux and Turbo client', async () => {
  const calls: string[] = [];
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async ({ finalizedWebmBytes }) => {
      calls.push(`prepare:${finalizedWebmBytes.byteLength}`);
      return {
        base64: 'b2dnLW9wdXM=',
        byteLength: 12,
        contentType: 'audio/ogg; codecs=opus',
        format: 'ogg-opus',
      };
    },
    readMemoryDetail: async () => ({ ok: true, value: memoryDetail() }),
    readSegmentAudio: async ({ maxBytes }) => {
      assert.equal(maxBytes, BACKFILL_AUDIO_MAX_INPUT_BYTES);
      return {
        audio: new Uint8Array([1, 2, 3]),
        audioByteLength: 3,
        lastTranscriptionAttempt: 'failed',
        ok: true,
        transcript: { exists: false, text: '' },
      };
    },
    recognize: async ({ apiKey, audioDataBase64 }) => {
      calls.push(`recognize:${apiKey}:${audioDataBase64}`);
      return {
        ok: true,
        requestId: 'request-1',
        transcriptText: '补转录完成。',
      };
    },
    saveSegmentTranscript: async ({ markdown, requireTranscriptMissing }) => {
      assert.equal(requireTranscriptMissing, true);
      calls.push(`save:${markdown}`);
      return {
        memory: {
          audioByteLength: 1,
          createdAt: '2026-05-17T01:00:00.000Z',
          durationMs: 1000,
          hasTranscript: true,
          memoryId: 'mem_1',
          segmentCount: 1,
          supplementCount: 0,
          title: 'Memory',
          updatedAt: '2026-05-17T01:00:00.000Z',
        },
        ok: true,
        saved: true,
      };
    },
    saveSupplementTranscript: async () =>
      ({
        error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' },
        ok: false,
      }) as WorkspaceErrorEnvelope,
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const response = await runtime.requestSegmentBackfill(segmentTask());

  assert.equal(response.ok, true);
  assert.deepEqual(calls, ['prepare:3', 'recognize:api-key-1:b2dnLW9wdXM=', 'save:补转录完成。']);
});

test('workspace backfill runtime regenerates an existing segment transcript with a snapshot guard', async () => {
  const calls: string[] = [];
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => ({
      base64: 'b2dnLW9wdXM=',
      byteLength: 12,
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    }),
    readMemoryDetail: async () => ({
      ok: true,
      value: memoryDetailWithSegment({
        lastTranscriptionAttempt: 'success',
        transcript: { exists: true },
      }),
    }),
    readSegmentAudio: async () => ({
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'success',
      ok: true,
      transcript: { exists: true, text: '旧转录' },
    }),
    recognize: async () => ({
      ok: true,
      requestId: 'request-regenerate',
      transcriptText: '新转录',
    }),
    saveSegmentTranscript: async ({
      allowOverwrite,
      expectedTranscriptDigest,
      markdown,
      requireTranscriptMissing,
    }) => {
      assert.equal(allowOverwrite, true);
      assert.equal(typeof expectedTranscriptDigest, 'string');
      assert.equal(requireTranscriptMissing, false);
      calls.push(`save:${markdown}`);
      return savedSegmentResponse();
    },
    saveSupplementTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const response = await runtime.requestSegmentBackfill({
    ...segmentTask(),
    mode: 'regenerate',
  });

  assert.equal(response.ok, true);
  assert.deepEqual(calls, ['save:新转录']);
});

test('workspace backfill runtime skips memory detail preflight for manual regenerate', async () => {
  let detailRead = false;
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => ({
      base64: 'b2dnLW9wdXM=',
      byteLength: 12,
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    }),
    readMemoryDetail: async () => {
      detailRead = true;
      throw new Error('manual regenerate should not read full memory detail before audio');
    },
    readSegmentAudio: async () => ({
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'success',
      ok: true,
      transcript: { exists: true, text: '旧转录' },
    }),
    recognize: async () => ({
      ok: true,
      requestId: 'request-regenerate-no-preflight',
      transcriptText: '新转录',
    }),
    saveSegmentTranscript: async () => savedSegmentResponse(),
    saveSupplementTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const response = await runtime.requestSegmentBackfill({
    ...segmentTask(),
    mode: 'regenerate',
  });

  assert.equal(response.ok, true);
  assert.equal(detailRead, false);
});

test('workspace backfill runtime keeps fill-missing missing-only behavior', async () => {
  let saved = false;
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => {
      throw new Error('prepare should not run for existing transcript fill-missing');
    },
    readMemoryDetail: async () => ({
      ok: true,
      value: memoryDetailWithSegment({
        lastTranscriptionAttempt: 'failed',
        transcript: { exists: true },
      }),
    }),
    readSegmentAudio: async () => {
      throw new Error('audio should not be read for existing transcript fill-missing');
    },
    recognize: async () => ({ ok: true, requestId: 'unused', transcriptText: 'unused' }),
    saveSegmentTranscript: async () => {
      saved = true;
      return savedSegmentResponse();
    },
    saveSupplementTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const response = await runtime.requestSegmentBackfill(segmentTask());

  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'ERR_BACKFILL_TARGET_NOT_ELIGIBLE');
  assert.equal(saved, false);
});

test('workspace backfill runtime reports changed segment transcripts without writing the regenerate result', async () => {
  let saved = false;
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => ({
      base64: 'b2dnLW9wdXM=',
      byteLength: 12,
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    }),
    readMemoryDetail: async () => ({
      ok: true,
      value: memoryDetailWithSegment({
        lastTranscriptionAttempt: 'success',
        transcript: { exists: true },
      }),
    }),
    readSegmentAudio: async () => ({
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'success',
      ok: true,
      transcript: { exists: true, text: '旧转录' },
    }),
    recognize: async () => ({ ok: true, requestId: 'request-changed', transcriptText: '新转录' }),
    saveSegmentTranscript: async ({ allowOverwrite, expectedTranscriptDigest }) => {
      assert.equal(allowOverwrite, true);
      assert.equal(typeof expectedTranscriptDigest, 'string');
      saved = true;
      return {
        error: {
          code: 'ERR_BACKFILL_TRANSCRIPT_CHANGED',
          message: 'Transcript changed during backfill',
        },
        ok: false,
      };
    },
    saveSupplementTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const response = await runtime.requestSegmentBackfill({
    ...segmentTask(),
    mode: 'regenerate',
  });

  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'ERR_BACKFILL_TRANSCRIPT_CHANGED');
  assert.equal(saved, true);
});

test('workspace backfill runtime keeps transcript and manifest unchanged when regenerate recognition fails', async () => {
  let saved = false;
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => ({
      base64: 'b2dnLW9wdXM=',
      byteLength: 12,
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    }),
    readMemoryDetail: async () => ({
      ok: true,
      value: memoryDetailWithSegment({
        lastTranscriptionAttempt: 'success',
        transcript: { exists: true },
      }),
    }),
    readSegmentAudio: async () => ({
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'success',
      ok: true,
      transcript: { exists: true, text: '旧转录' },
    }),
    recognize: async () => ({ errorCode: 'network', ok: false, requestId: 'request-failed' }),
    saveSegmentTranscript: async () => {
      saved = true;
      return savedSegmentResponse();
    },
    saveSupplementTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const response = await runtime.requestSegmentBackfill({
    ...segmentTask(),
    mode: 'regenerate',
  });

  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'ERR_BACKFILL_TRANSCRIBE_FAILED');
  assert.equal(saved, false);
});

test('workspace backfill runtime does not re-read or save after regenerate is canceled post snapshot', async () => {
  let recognizeStarted = false;
  let releaseRecognize = () => {};
  let saved = false;
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => ({
      base64: 'b2dnLW9wdXM=',
      byteLength: 12,
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    }),
    readMemoryDetail: async () => ({
      ok: true,
      value: memoryDetailWithSegment({
        lastTranscriptionAttempt: 'success',
        transcript: { exists: true },
      }),
    }),
    readSegmentAudio: async () => ({
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'success',
      ok: true,
      transcript: { exists: true, text: '旧转录' },
    }),
    recognize: async () => {
      recognizeStarted = true;
      await new Promise<void>((resolve) => {
        releaseRecognize = resolve;
      });
      return { ok: true, requestId: 'request-canceled', transcriptText: '新转录' };
    },
    saveSegmentTranscript: async () => {
      saved = true;
      return savedSegmentResponse();
    },
    saveSupplementTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const request = runtime.requestSegmentBackfill({
    ...segmentTask(),
    mode: 'regenerate',
  });
  while (!recognizeStarted) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const drain = runtime.cancelAllAndDrain('workspace-switch');
  releaseRecognize();
  const response = await request;
  await drain;

  assert.equal(response.ok, false);
  if (!response.ok) {
    assert.equal(response.error.code, 'ERR_BACKFILL_UNAVAILABLE');
  }
  assert.equal(saved, false);
});

test('workspace backfill runtime returns lock lost before regenerate overwrite write', async () => {
  let writeAttempted = false;
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => ({
      base64: 'b2dnLW9wdXM=',
      byteLength: 12,
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    }),
    readMemoryDetail: async () => ({
      ok: true,
      value: memoryDetailWithSegment({
        lastTranscriptionAttempt: 'success',
        transcript: { exists: true },
      }),
    }),
    readSegmentAudio: async () => ({
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'success',
      ok: true,
      transcript: { exists: true, text: '旧转录' },
    }),
    recognize: async () => ({ ok: true, requestId: 'request-lock', transcriptText: '新转录' }),
    saveSegmentTranscript: async ({ assertWorkspaceUsable, expectedTranscriptDigest }) => {
      assert.equal(typeof expectedTranscriptDigest, 'string');
      const usableResult = assertWorkspaceUsable?.();
      if (usableResult && !usableResult.ok) {
        return usableResult;
      }
      writeAttempted = true;
      return savedSegmentResponse();
    },
    saveSupplementTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const response = await runtime.requestSegmentBackfill({
    ...segmentTask(),
    assertWorkspaceUsable: () =>
      ({
        error: { code: 'ERR_WORKSPACE_LOCK_LOST', message: 'Workspace lock was lost' },
        ok: false,
      }) as WorkspaceErrorEnvelope,
    mode: 'regenerate',
  });

  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  assert.equal(writeAttempted, false);
});

test('workspace backfill runtime mirrors regenerate snapshot guard for supplements', async () => {
  const calls: string[] = [];
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => ({
      base64: 'b2dnLW9wdXM=',
      byteLength: 12,
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    }),
    readMemoryDetail: async () => ({
      ok: true,
      value: memoryDetailWithSupplement({
        lastTranscriptionAttempt: 'success',
        transcript: { exists: true },
      }),
    }),
    readSegmentAudio: async () => {
      throw new Error('segment audio should not be read for supplement regenerate');
    },
    readSupplementAudio: async () => ({
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'success',
      ok: true,
      transcript: { exists: true, text: '旧补充转录' },
    }),
    recognize: async () => ({
      ok: true,
      requestId: 'request-supplement-regenerate',
      transcriptText: '新补充转录',
    }),
    saveSegmentTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    saveSupplementTranscript: async ({
      allowOverwrite,
      expectedTranscriptDigest,
      markdown,
      requireTranscriptMissing,
    }) => {
      assert.equal(allowOverwrite, true);
      assert.equal(typeof expectedTranscriptDigest, 'string');
      assert.equal(requireTranscriptMissing, false);
      calls.push(`save:${markdown}`);
      return savedSupplementResponse();
    },
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const response = await runtime.requestSupplementBackfill({
    ...supplementTask(),
    mode: 'regenerate',
  });

  assert.equal(response.ok, true);
  assert.deepEqual(calls, ['save:新补充转录']);
});

test('workspace backfill runtime does not save a supplement regenerate after cancellation post snapshot', async () => {
  let recognizeStarted = false;
  let releaseRecognize = () => {};
  let saved = false;
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => ({
      base64: 'b2dnLW9wdXM=',
      byteLength: 12,
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    }),
    readMemoryDetail: async () => ({
      ok: true,
      value: memoryDetailWithSupplement({
        lastTranscriptionAttempt: 'success',
        transcript: { exists: true },
      }),
    }),
    readSupplementAudio: async () => ({
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'success',
      ok: true,
      transcript: { exists: true, text: '旧补充转录' },
    }),
    recognize: async () => {
      recognizeStarted = true;
      await new Promise<void>((resolve) => {
        releaseRecognize = resolve;
      });
      return { ok: true, requestId: 'request-supplement-canceled', transcriptText: '新补充转录' };
    },
    saveSegmentTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    saveSupplementTranscript: async () => {
      saved = true;
      return savedSupplementResponse();
    },
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const request = runtime.requestSupplementBackfill({
    ...supplementTask(),
    mode: 'regenerate',
  });
  while (!recognizeStarted) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const drain = runtime.cancelAllAndDrain('lock-lost');
  releaseRecognize();
  const response = await request;
  await drain;

  assert.equal(response.ok, false);
  if (!response.ok) {
    assert.equal(response.error.code, 'ERR_BACKFILL_UNAVAILABLE');
  }
  assert.equal(saved, false);
});

test('workspace backfill runtime cancels regenerate on app quit after snapshot', async () => {
  let recognizeStarted = false;
  let releaseRecognize = () => {};
  let saved = false;
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => ({
      base64: 'b2dnLW9wdXM=',
      byteLength: 12,
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    }),
    readSegmentAudio: async () => ({
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'success',
      ok: true,
      transcript: { exists: true, text: '旧转录' },
    }),
    recognize: async () => {
      recognizeStarted = true;
      await new Promise<void>((resolve) => {
        releaseRecognize = resolve;
      });
      return { ok: true, requestId: 'request-app-quit-canceled', transcriptText: '新转录' };
    },
    saveSegmentTranscript: async () => {
      saved = true;
      return savedSegmentResponse();
    },
    saveSupplementTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const request = runtime.requestSegmentBackfill({
    ...segmentTask(),
    mode: 'regenerate',
  });
  while (!recognizeStarted) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const drain = runtime.cancelAllAndDrain('app-quit');
  releaseRecognize();
  const response = await request;
  await drain;

  assert.equal(response.ok, false);
  if (!response.ok) {
    assert.equal(response.error.code, 'ERR_BACKFILL_UNAVAILABLE');
  }
  assert.equal(saved, false);
});

test('workspace backfill runtime returns lock lost before supplement regenerate overwrite write', async () => {
  let writeAttempted = false;
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => ({
      base64: 'b2dnLW9wdXM=',
      byteLength: 12,
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    }),
    readMemoryDetail: async () => ({
      ok: true,
      value: memoryDetailWithSupplement({
        lastTranscriptionAttempt: 'success',
        transcript: { exists: true },
      }),
    }),
    readSupplementAudio: async () => ({
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'success',
      ok: true,
      transcript: { exists: true, text: '旧补充转录' },
    }),
    recognize: async () => ({
      ok: true,
      requestId: 'request-supplement-lock',
      transcriptText: '新补充转录',
    }),
    saveSegmentTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    saveSupplementTranscript: async ({ assertWorkspaceUsable, expectedTranscriptDigest }) => {
      assert.equal(typeof expectedTranscriptDigest, 'string');
      const usableResult = assertWorkspaceUsable?.();
      if (usableResult && !usableResult.ok) {
        return usableResult;
      }
      writeAttempted = true;
      return savedSupplementResponse();
    },
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const response = await runtime.requestSupplementBackfill({
    ...supplementTask(),
    assertWorkspaceUsable: () =>
      ({
        error: { code: 'ERR_WORKSPACE_LOCK_LOST', message: 'Workspace lock was lost' },
        ok: false,
      }) as WorkspaceErrorEnvelope,
    mode: 'regenerate',
  });

  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  assert.equal(writeAttempted, false);
});

test('workspace backfill runtime cancels before transcript save can write', async () => {
  let saveStarted = false;
  let releaseSave = () => {};
  let saved = false;
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => ({
      base64: 'b2dnLW9wdXM=',
      byteLength: 12,
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    }),
    readMemoryDetail: async () => ({ ok: true, value: memoryDetail() }),
    readSegmentAudio: async () => ({
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'failed',
      ok: true,
      transcript: { exists: false, text: '' },
    }),
    recognize: async () => ({ ok: true, requestId: 'request-cancel', transcriptText: 'text' }),
    saveSegmentTranscript: async ({ assertWorkspaceUsable }) => {
      saveStarted = true;
      await new Promise<void>((resolve) => {
        releaseSave = resolve;
      });
      assert.ok(assertWorkspaceUsable);
      const usable = assertWorkspaceUsable();
      if (!usable.ok) {
        return usable;
      }
      saved = true;
      return {
        memory: {
          audioByteLength: 1,
          createdAt: '2026-05-17T01:00:00.000Z',
          durationMs: 1000,
          hasTranscript: true,
          memoryId: 'mem_1',
          segmentCount: 1,
          supplementCount: 0,
          title: 'Memory',
          updatedAt: '2026-05-17T01:00:00.000Z',
        },
        ok: true,
        saved: true,
      };
    },
    saveSupplementTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const request = runtime.requestSegmentBackfill(segmentTask());
  while (!saveStarted) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const drain = runtime.cancelAllAndDrain('workspace-switch');
  releaseSave();

  const response = await request;
  await drain;

  assert.equal(response.ok, false);
  assert.equal(saved, false);
});

test('workspace backfill runtime treats regenerate save abort checkpoints as canceled', async () => {
  let saveStarted = false;
  let releaseSave = () => {};
  let saved = false;
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => ({
      base64: 'b2dnLW9wdXM=',
      byteLength: 12,
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    }),
    readMemoryDetail: async () => ({
      ok: true,
      value: memoryDetailWithSegment({
        lastTranscriptionAttempt: 'success',
        transcript: { exists: true },
      }),
    }),
    readSegmentAudio: async () => ({
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'success',
      ok: true,
      transcript: { exists: true, text: '旧转录' },
    }),
    recognize: async () => ({ ok: true, requestId: 'request-cancel-save', transcriptText: '新转录' }),
    saveSegmentTranscript: async (input) => {
      saveStarted = true;
      await new Promise<void>((resolve) => {
        releaseSave = resolve;
      });
      const abortAwareInput = input as typeof input & {
        readonly isAbortRequested?: () => boolean;
      };
      if (abortAwareInput.isAbortRequested?.()) {
        return {
          error: { code: 'ERR_BACKFILL_UNAVAILABLE', message: 'Backfill was canceled' },
          ok: false,
        };
      }
      const usableResult = input.assertWorkspaceUsable?.();
      if (usableResult && !usableResult.ok) {
        return usableResult;
      }
      saved = true;
      return savedSegmentResponse();
    },
    saveSupplementTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const request = runtime.requestSegmentBackfill({
    ...segmentTask(),
    mode: 'regenerate',
  });
  while (!saveStarted) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const drain = runtime.cancelAllAndDrain('workspace-switch');
  releaseSave();

  const response = await request;
  await drain;

  assert.equal(response.ok, false);
  if (!response.ok) {
    assert.equal(response.error.code, 'ERR_BACKFILL_UNAVAILABLE');
  }
  assert.equal(saved, false);
});

test('workspace backfill runtime scans and enqueues automatic eligible targets silently', async () => {
  const saved: string[] = [];
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => ({
      base64: 'b2dnLW9wdXM=',
      byteLength: 12,
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    }),
    readMemoryDetail: async () => ({ ok: true, value: memoryDetail() }),
    readSegmentAudio: async () => ({
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'failed',
      ok: true,
      transcript: { exists: false, text: '' },
    }),
    readSupplementAudio: async () => ({
      audio: new Uint8Array([2]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'failed',
      ok: true,
      transcript: { exists: false, text: '' },
    }),
    recognize: async () => ({ ok: true, requestId: 'request-auto', transcriptText: 'auto text' }),
    saveSegmentTranscript: async () => {
      saved.push('segment');
      return {
        memory: {
          audioByteLength: 1,
          createdAt: '2026-05-17T01:00:00.000Z',
          durationMs: 1000,
          hasTranscript: true,
          memoryId: 'mem_1',
          segmentCount: 1,
          supplementCount: 1,
          title: 'Memory',
          updatedAt: '2026-05-17T01:00:00.000Z',
        },
        ok: true,
        saved: true,
      };
    },
    saveSupplementTranscript: async () => {
      const detail = memoryDetail();
      const segment = detail.segments[0];
      const supplement = segment?.supplements[0];
      assert.ok(segment);
      assert.ok(supplement);
      saved.push('supplement');
      return {
        memory: {
          audioByteLength: 1,
          createdAt: '2026-05-17T01:00:00.000Z',
          durationMs: 1000,
          hasTranscript: true,
          memoryId: 'mem_1',
          segmentCount: 1,
          supplementCount: 1,
          title: 'Memory',
          updatedAt: '2026-05-17T01:00:00.000Z',
        },
        ok: true,
        saved: true,
        segment,
        supplement,
      };
    },
    voiceSettingsStore: validVoiceSettingsStore,
  });

  assert.deepEqual(
    await runtime.enqueueAutomaticTargets({
      assertWorkspaceUsable: usable,
      rootPath: '/tmp/reo-workspace',
      targets: [
        {
          kind: 'segment',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          updatedAt: '2026-05-17T01:02:00.000Z',
          workspaceId: 'ws_1',
        },
        {
          kind: 'supplement',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          supplementId: 'sup_1',
          updatedAt: '2026-05-17T01:03:00.000Z',
          workspaceId: 'ws_1',
        },
      ],
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
    }),
    { accepted: 2, capped: 0, duplicates: 0 }
  );
  await waitForSaved(saved, 2);

  assert.deepEqual(saved.sort(), ['segment', 'supplement']);
});

test('workspace backfill runtime skips stale automatic targets before reading audio', async () => {
  let audioRead = false;
  let saved = false;
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => {
      throw new Error('prepare should not run for stale automatic targets');
    },
    readMemoryDetail: async () => ({
      ok: true,
      value: memoryDetailWithSegment({
        transcript: { exists: true },
      }),
    }),
    readSegmentAudio: async () => {
      audioRead = true;
      return {
        audio: new Uint8Array([1]),
        audioByteLength: 1,
        lastTranscriptionAttempt: 'failed',
        ok: true,
        transcript: { exists: true, text: 'already written' },
      };
    },
    recognize: async () => ({ ok: true, requestId: 'unused', transcriptText: 'unused' }),
    saveSegmentTranscript: async () => {
      saved = true;
      return { error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false };
    },
    saveSupplementTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const result = await runtime.enqueueAutomaticTargets({
    assertWorkspaceUsable: usable,
    rootPath: '/tmp/reo-workspace',
    targets: [
      {
        kind: 'segment',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        updatedAt: '2026-05-17T01:02:00.000Z',
        workspaceId: 'ws_1',
      },
    ],
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.deepEqual(result, { accepted: 1, capped: 0, duplicates: 0 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(audioRead, false);
  assert.equal(saved, false);
});

test('workspace backfill runtime applies automatic batch cap through the queue', async () => {
  const runtime = createWorkspaceBackfillRuntime({
    automaticBatchLimit: 1,
    prepareAudioData: async () => {
      throw new Error('prepare should not run before enqueue result');
    },
    readSegmentAudio: async () => ({
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'failed',
      ok: true,
      transcript: { exists: false, text: '' },
    }),
    recognize: async () => ({ ok: true, requestId: 'unused', transcriptText: 'unused' }),
    saveSegmentTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    saveSupplementTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const result = await runtime.enqueueAutomaticTargets({
    assertWorkspaceUsable: usable,
    rootPath: '/tmp/reo-workspace',
    targets: [
      {
        kind: 'segment',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        updatedAt: '2026-05-17T01:02:00.000Z',
        workspaceId: 'ws_1',
      },
      {
        kind: 'segment',
        memoryId: 'mem_1',
        segmentId: 'seg_2',
        updatedAt: '2026-05-17T01:03:00.000Z',
        workspaceId: 'ws_1',
      },
    ],
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.deepEqual(result, { accepted: 1, capped: 1, duplicates: 0 });
});

test('workspace backfill runtime skips stale automatic workspace scans', async () => {
  let current = true;
  let saved = false;
  const snapshot: WorkspaceSnapshot = {
    description: '',
    memories: [
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T01:00:00.000Z',
        durationMs: 1000,
        hasTranscript: false,
        memoryId: 'mem_1',
        segmentCount: 1,
        supplementCount: 0,
        title: 'Memory',
        updatedAt: '2026-05-17T01:00:00.000Z',
      },
    ],
    title: 'Workspace',
    workspaceId: 'ws_1',
  };
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => {
      throw new Error('prepare should not run for stale scans');
    },
    readMemoryDetail: async () => {
      current = false;
      return { ok: true, value: memoryDetail() };
    },
    readWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
    readSegmentAudio: async () => ({
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'failed',
      ok: true,
      transcript: { exists: false, text: '' },
    }),
    recognize: async () => ({ ok: true, requestId: 'unused', transcriptText: 'unused' }),
    saveSegmentTranscript: async () => {
      saved = true;
      return { error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false };
    },
    saveSupplementTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const result = await runtime.enqueueAutomaticWorkspace({
    assertWorkspaceUsable: usable,
    isCurrent: () => current,
    rootPath: '/tmp/reo-workspace',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.deepEqual(result, { accepted: 0, capped: 0, duplicates: 0 });
  assert.equal(saved, false);
});

test('workspace backfill runtime drops an automatic scan that finishes after cancellation', async () => {
  const snapshot: WorkspaceSnapshot = {
    description: '',
    memories: [
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T01:00:00.000Z',
        durationMs: 1000,
        hasTranscript: false,
        memoryId: 'mem_1',
        segmentCount: 1,
        supplementCount: 0,
        title: 'Memory',
        updatedAt: '2026-05-17T01:00:00.000Z',
      },
    ],
    title: 'Workspace',
    workspaceId: 'ws_1',
  };
  let releaseScan = () => {};
  let scanStarted = false;
  let saved = false;
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => {
      throw new Error('prepare should not run after cancellation');
    },
    readMemoryDetail: async () => {
      scanStarted = true;
      await new Promise<void>((resolve) => {
        releaseScan = resolve;
      });
      return { ok: true, value: memoryDetail() };
    },
    readWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
    readSegmentAudio: async () => ({
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'failed',
      ok: true,
      transcript: { exists: false, text: '' },
    }),
    recognize: async () => ({ ok: true, requestId: 'unused', transcriptText: 'unused' }),
    saveSegmentTranscript: async () => {
      saved = true;
      return { error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false };
    },
    saveSupplementTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const scan = runtime.enqueueAutomaticWorkspace({
    assertWorkspaceUsable: usable,
    rootPath: '/tmp/reo-workspace',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });
  while (!scanStarted) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  runtime.cancelAll('app-quit');
  releaseScan();

  assert.deepEqual(await scan, { accepted: 0, capped: 0, duplicates: 0 });
  assert.equal(saved, false);
});

test('workspace backfill runtime rejects manual targets when voice settings are not enabled and validated', async () => {
  for (const [name, voiceSettingsStore] of [
    ['disabled', invalidVoiceSettingsStore({ enabled: false })],
    ['not configured', invalidVoiceSettingsStore({ apiKeyConfigured: false })],
    ['not validated', invalidVoiceSettingsStore({ lastValidationOk: false })],
    ['missing decrypted key', invalidVoiceSettingsStore({}, null)],
  ] as const) {
    let recognized = false;
    const runtime = createWorkspaceBackfillRuntime({
      prepareAudioData: async () => ({
        base64: 'b2dnLW9wdXM=',
        byteLength: 12,
        contentType: 'audio/ogg; codecs=opus',
        format: 'ogg-opus',
      }),
      readSegmentAudio: async () => ({
        audio: new Uint8Array([1]),
        audioByteLength: 1,
        lastTranscriptionAttempt: 'failed',
        ok: true,
        transcript: { exists: false, text: '' },
      }),
      recognize: async () => {
        recognized = true;
        return { ok: true, requestId: 'unused', transcriptText: 'unused' };
      },
      saveSegmentTranscript: async () =>
        ({
          error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' },
          ok: false,
        }) as never,
      saveSupplementTranscript: async () =>
        ({
          error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' },
          ok: false,
        }) as never,
      voiceSettingsStore,
    });

    const response = await runtime.requestSegmentBackfill(segmentTask());

    assert.equal(response.ok, false, name);
    assert.equal(response.error.code, 'ERR_BACKFILL_AUTH_FAILED', name);
    assert.equal(recognized, false, name);
  }
});

test('workspace backfill runtime rejects manual target that is not eligible before reading audio', async () => {
  for (const [name, lastTranscriptionAttempt, transcript, audioByteLength] of [
    ['success attempt', 'success' as const, { exists: false, text: '' }, 1],
    ['existing transcript', 'failed' as const, { exists: true, text: 'done' }, 1],
    ['zero byte audio', 'failed' as const, { exists: false, text: '' }, 0],
  ] as const) {
    let audioRead = false;
    const projectedTranscript = { exists: transcript.exists };
    const runtime = createWorkspaceBackfillRuntime({
      prepareAudioData: async () => {
        throw new Error('prepare should not run');
      },
      readMemoryDetail: async () => ({
        ok: true,
        value: memoryDetailWithSegment({
          audioByteLength,
          lastTranscriptionAttempt,
          transcript: projectedTranscript,
        }),
      }),
      readSegmentAudio: async () => {
        audioRead = true;
        return {
          audio: new Uint8Array([1]),
          audioByteLength,
          lastTranscriptionAttempt,
          ok: true,
          transcript,
        };
      },
      recognize: async () => ({ ok: true, requestId: 'unused', transcriptText: 'unused' }),
      saveSegmentTranscript: async () =>
        ({
          error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' },
          ok: false,
        }) as never,
      saveSupplementTranscript: async () =>
        ({
          error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' },
          ok: false,
        }) as never,
      voiceSettingsStore: validVoiceSettingsStore,
    });

    const response = await runtime.requestSegmentBackfill(segmentTask());

    assert.equal(response.ok, false, name);
    assert.equal(response.error.code, 'ERR_BACKFILL_TARGET_NOT_ELIGIBLE', name);
    assert.equal(audioRead, false, name);
  }
});

test('workspace backfill runtime preserves precise saveTranscript failures for manual requests', async () => {
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => ({
      base64: 'b2dnLW9wdXM=',
      byteLength: 12,
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    }),
    readMemoryDetail: async () => ({ ok: true, value: memoryDetail() }),
    readSegmentAudio: async () => ({
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      lastTranscriptionAttempt: 'failed',
      ok: true,
      transcript: { exists: false, text: '' },
    }),
    recognize: async () => ({ ok: true, requestId: 'request-save', transcriptText: 'text' }),
    saveSegmentTranscript: async () =>
      ({
        error: {
          code: 'ERR_WORKSPACE_INDEX_WRITE_FAILED',
          message: 'Workspace index is stale',
          dataRetention: 'file-written-index-stale',
        },
        ok: false,
      }) as WorkspaceErrorEnvelope,
    saveSupplementTranscript: async () =>
      ({ error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false }) as never,
    voiceSettingsStore: validVoiceSettingsStore,
  });

  const response = await runtime.requestSegmentBackfill(segmentTask());

  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'ERR_WORKSPACE_INDEX_WRITE_FAILED');
  assert.equal(response.error.dataRetention, 'file-written-index-stale');
});

test('scanWorkspaceBackfillTargets reads file-truth details before filtering targets', async () => {
  const snapshot: WorkspaceSnapshot = {
    description: '',
    memories: [
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T01:00:00.000Z',
        durationMs: 1000,
        hasTranscript: false,
        memoryId: 'mem_1',
        segmentCount: 1,
        supplementCount: 1,
        title: 'Memory',
        updatedAt: '2026-05-17T01:00:00.000Z',
      },
    ],
    title: 'Workspace',
    workspaceId: 'ws_1',
  };

  const targets = await scanWorkspaceBackfillTargets(
    {
      assertWorkspaceUsable: usable,
      limit: 20,
      rootPath: '/tmp/reo-workspace',
      workspaceId: 'ws_1',
    },
    {
      readMemoryDetail: async () => ({ ok: true, value: memoryDetail() }),
      readWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
    }
  );

  assert.deepEqual(
    targets.map((target: (typeof targets)[number]) => target.kind),
    ['supplement', 'segment']
  );
});

test('scanWorkspaceBackfillTargets applies the automatic cap after sorting all eligible targets', async () => {
  const snapshot: WorkspaceSnapshot = {
    description: '',
    memories: [
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T01:00:00.000Z',
        durationMs: 1000,
        hasTranscript: false,
        memoryId: 'mem_old',
        segmentCount: 1,
        supplementCount: 0,
        title: 'Old',
        updatedAt: '2026-05-17T01:00:00.000Z',
      },
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T02:00:00.000Z',
        durationMs: 1000,
        hasTranscript: false,
        memoryId: 'mem_new',
        segmentCount: 1,
        supplementCount: 0,
        title: 'New',
        updatedAt: '2026-05-17T02:00:00.000Z',
      },
    ],
    title: 'Workspace',
    workspaceId: 'ws_1',
  };
  const baseDetail = memoryDetail();
  const baseSegment = baseDetail.segments[0];
  assert.ok(baseSegment);
  const detailReads: string[] = [];
  const details = new Map<string, WorkspaceMemoryDetailProjection>([
    [
      'mem_old',
      {
        ...baseDetail,
        memoryId: 'mem_old',
        segments: [
          {
            ...baseSegment,
            memoryId: 'mem_old',
            segmentId: 'seg_old',
            supplements: [],
            updatedAt: '2026-05-17T01:00:00.000Z',
          },
        ],
      },
    ],
    [
      'mem_new',
      {
        ...baseDetail,
        memoryId: 'mem_new',
        segments: [
          {
            ...baseSegment,
            memoryId: 'mem_new',
            segmentId: 'seg_new',
            supplements: [],
            updatedAt: '2026-05-17T02:00:00.000Z',
          },
        ],
      },
    ],
  ]);

  const targets = await scanWorkspaceBackfillTargets(
    {
      limit: 1,
      rootPath: '/tmp/reo-workspace',
      workspaceId: 'ws_1',
    },
    {
      readMemoryDetail: async ({ memoryId }) => {
        detailReads.push(memoryId);
        const value = details.get(memoryId);
        assert.ok(value);
        return { ok: true, value };
      },
      readWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
    }
  );

  assert.deepEqual(detailReads, ['mem_new']);
  assert.deepEqual(
    targets.map((target) => (target.kind === 'segment' ? target.segmentId : '')),
    ['seg_new']
  );
});

test('scanWorkspaceBackfillTargets skips memory summaries with no audio candidates', async () => {
  let detailReads = 0;
  const snapshot: WorkspaceSnapshot = {
    description: '',
    memories: [
      {
        audioByteLength: 0,
        createdAt: '2026-05-17T01:00:00.000Z',
        durationMs: 0,
        hasTranscript: false,
        memoryId: 'mem_empty',
        segmentCount: 0,
        supplementCount: 0,
        title: 'Empty',
        updatedAt: '2026-05-17T01:00:00.000Z',
      },
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T02:00:00.000Z',
        durationMs: 1000,
        hasTranscript: false,
        memoryId: 'mem_1',
        segmentCount: 1,
        supplementCount: 0,
        title: 'Audio',
        updatedAt: '2026-05-17T02:00:00.000Z',
      },
    ],
    title: 'Workspace',
    workspaceId: 'ws_1',
  };

  const targets = await scanWorkspaceBackfillTargets(
    {
      limit: 20,
      rootPath: '/tmp/reo-workspace',
      workspaceId: 'ws_1',
    },
    {
      readMemoryDetail: async ({ memoryId }) => {
        detailReads += 1;
        assert.equal(memoryId, 'mem_1');
        return { ok: true, value: memoryDetail() };
      },
      readWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
    }
  );

  assert.equal(detailReads, 1);
  assert.equal(targets.length, 2);
});

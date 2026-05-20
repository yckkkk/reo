import assert from 'node:assert/strict';
import { closeSync, openSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createWorkspaceBackfillRuntime,
  scanWorkspaceBackfillTargets,
} from '../../src/main/backfillRuntime.js';
import { BACKFILL_AUDIO_MAX_INPUT_BYTES } from '../../src/main/backfillAudioDataSource.js';
import { initializeWorkspaceFiles } from '../../src/main/workspaceFiles.js';
import { renderWorkspaceMarkdownObject } from '../../src/main/workspaceMarkdownObjects.js';
import type {
  WorkspaceErrorEnvelope,
  WorkspaceMemoryDetailProjection,
  WorkspaceSegmentProjection,
  WorkspaceSegmentSupplementProjection,
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

function createDeferred<T = void>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
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
type AudioWorkspaceSegmentProjection = Extract<
  WorkspaceSegmentProjection,
  { readonly type: 'audio' }
>;
type AudioWorkspaceSegmentSupplementProjection = Extract<
  WorkspaceSegmentSupplementProjection,
  { readonly type: 'audio' }
>;
type NoteWorkspaceSegmentProjection = Extract<
  WorkspaceSegmentProjection,
  { readonly type: 'note' }
>;

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
    audioDurationMs: 1000,
    hasAudioTranscript: false,
    memoryId: 'mem_1',
    segmentCount: 1,
    audioSegmentCount: 1,
    noteSegmentCount: 0,
    hasAnyNote: false,
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
  overrides: Partial<AudioWorkspaceSegmentProjection>
): WorkspaceMemoryDetailProjection {
  const detail = memoryDetail();
  const segment = detail.segments[0];
  assert.ok(segment);
  assert.equal(segment.type, 'audio');
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
  overrides: Partial<AudioWorkspaceSegmentSupplementProjection>
): WorkspaceMemoryDetailProjection {
  const detail = memoryDetail();
  const segment = detail.segments[0];
  const supplement = segment?.supplements[0];
  assert.ok(segment);
  assert.ok(supplement);
  assert.equal(segment.type, 'audio');
  assert.equal(supplement.type, 'audio');
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

async function writeFinalizedBackfillSegment({
  memoryId,
  rootPath,
  segmentId,
  workspaceId,
}: {
  readonly memoryId: string;
  readonly rootPath: string;
  readonly segmentId: string;
  readonly workspaceId: string;
}) {
  const memoryDirectory = path.join(rootPath, 'memories', memoryId);
  const segmentDirectory = path.join(memoryDirectory, 'segments', segmentId);
  await mkdir(segmentDirectory, { recursive: true });
  await mkdir(path.join(rootPath, '.reo', 'objects', 'memories'), { recursive: true });
  await mkdir(path.join(rootPath, '.reo', 'objects', 'segments'), { recursive: true });
  await writeFile(
    path.join(memoryDirectory, 'memory.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'memory',
      data: { title: '自动补转录' },
      content: '# 自动补转录\n',
    })
  );
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'memories', `${memoryId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'memory',
        memoryId,
        createdAt: '2026-05-17T01:00:00.000Z',
        updatedAt: '2026-05-17T01:01:00.000Z',
      },
      null,
      2
    )}\n`
  );
  await writeFile(path.join(segmentDirectory, 'audio.webm'), Buffer.from('webm-opus-bytes'));
  await writeFile(
    path.join(segmentDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title: '自动补转录片段', kind: 'audio' },
      content: '# 自动补转录片段\n\n## Transcript\n\n',
    })
  );
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'segments', `${segmentId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'segment',
        workspaceId,
        memoryId,
        segmentId,
        kind: 'audio',
        createdAt: '2026-05-17T01:00:00.000Z',
        finalizedAt: '2026-05-17T01:01:00.000Z',
        updatedAt: '2026-05-17T01:01:00.000Z',
        durationMs: 1000,
        nextSequence: 1,
        audioByteLength: Buffer.byteLength('webm-opus-bytes'),
        lastTranscriptionAttempt: 'failed',
      },
      null,
      2
    )}\n`
  );
}

function savedSegmentResponse() {
  return {
    memory: {
      audioByteLength: 1,
      createdAt: '2026-05-17T01:00:00.000Z',
      audioDurationMs: 1000,
      hasAudioTranscript: true,
      memoryId: 'mem_1',
      segmentCount: 1,
      audioSegmentCount: 1,
      noteSegmentCount: 0,
      hasAnyNote: false,
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
      assert.ok(finalizedWebmBytes);
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
          audioDurationMs: 1000,
          hasAudioTranscript: true,
          memoryId: 'mem_1',
          segmentCount: 1,
          audioSegmentCount: 1,
          noteSegmentCount: 0,
          hasAnyNote: false,
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

test('workspace backfill runtime passes finalized audio file descriptors to the remux step', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'reo-backfill-runtime-fd-test-'));
  const sourcePath = path.join(temporaryRoot, 'audio.webm');
  await writeFile(sourcePath, Buffer.from('webm-opus-bytes'));
  const fd = openSync(sourcePath, 'r');
  let disposed = false;
  const calls: string[] = [];

  try {
    const runtime = createWorkspaceBackfillRuntime({
      prepareAudioData: async ({ finalizedWebmByteLength, finalizedWebmFileDescriptor }) => {
        calls.push(`prepare-fd:${finalizedWebmFileDescriptor}:${finalizedWebmByteLength}`);
        assert.equal(finalizedWebmFileDescriptor, fd);
        assert.equal(finalizedWebmByteLength, Buffer.byteLength('webm-opus-bytes'));
        return {
          base64: 'b2dnLW9wdXM=',
          byteLength: 12,
          contentType: 'audio/ogg; codecs=opus',
          format: 'ogg-opus',
        };
      },
      readMemoryDetail: async () => ({ ok: true, value: memoryDetail() }),
      readSegmentAudio: async () => ({
        audioByteLength: Buffer.byteLength('webm-opus-bytes'),
        audioFileDescriptor: fd,
        dispose: () => {
          disposed = true;
          closeSync(fd);
        },
        lastTranscriptionAttempt: 'failed',
        ok: true,
        transcript: { exists: false, text: '' },
      }),
      recognize: async () => ({
        ok: true,
        requestId: 'request-fd',
        transcriptText: '补转录完成。',
      }),
      saveSegmentTranscript: async () => savedSegmentResponse(),
      saveSupplementTranscript: async () =>
        ({
          error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' },
          ok: false,
        }) as WorkspaceErrorEnvelope,
      voiceSettingsStore: validVoiceSettingsStore,
    });

    const response = await runtime.requestSegmentBackfill(segmentTask());

    assert.equal(response.ok, true);
    assert.deepEqual(calls, [`prepare-fd:${fd}:${Buffer.byteLength('webm-opus-bytes')}`]);
    assert.equal(disposed, true);
  } finally {
    if (!disposed) {
      closeSync(fd);
    }
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});

test('workspace backfill runtime allows manual fill-missing for finalized audio without transcript', async () => {
  for (const lastTranscriptionAttempt of ['never', 'success'] as const) {
    const calls: string[] = [];
    const runtime = createWorkspaceBackfillRuntime({
      prepareAudioData: async ({ finalizedWebmBytes }) => {
        assert.ok(finalizedWebmBytes);
        calls.push(`prepare:${finalizedWebmBytes.byteLength}`);
        return {
          base64: 'b2dnLW9wdXM=',
          byteLength: 12,
          contentType: 'audio/ogg; codecs=opus',
          format: 'ogg-opus',
        };
      },
      readMemoryDetail: async () => ({
        ok: true,
        value: memoryDetailWithSegment({
          lastTranscriptionAttempt,
          transcript: { exists: false },
        }),
      }),
      readSegmentAudio: async ({ transcriptReadMode }) => {
        assert.equal(transcriptReadMode, 'assume-missing', lastTranscriptionAttempt);
        return {
          audio: new Uint8Array([1, 2, 3]),
          audioByteLength: 3,
          lastTranscriptionAttempt,
          ok: true,
          transcript: { exists: false, text: '' },
        };
      },
      recognize: async () => ({
        ok: true,
        requestId: `request-${lastTranscriptionAttempt}`,
        transcriptText: '首次转录。',
      }),
      saveSegmentTranscript: async ({ markdown, requireTranscriptMissing }) => {
        assert.equal(requireTranscriptMissing, true, lastTranscriptionAttempt);
        calls.push(`save:${markdown}`);
        return savedSegmentResponse();
      },
      saveSupplementTranscript: async () =>
        ({
          error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' },
          ok: false,
        }) as WorkspaceErrorEnvelope,
      voiceSettingsStore: validVoiceSettingsStore,
    });

    const response = await runtime.requestSegmentBackfill(segmentTask());

    assert.equal(response.ok, true, lastTranscriptionAttempt);
    assert.deepEqual(calls, ['prepare:3', 'save:首次转录。'], lastTranscriptionAttempt);
  }
});

test('workspace backfill runtime allows manual supplement fill-missing for finalized audio without transcript', async () => {
  for (const lastTranscriptionAttempt of ['never', 'success'] as const) {
    const calls: string[] = [];
    const runtime = createWorkspaceBackfillRuntime({
      prepareAudioData: async ({ finalizedWebmBytes }) => {
        assert.ok(finalizedWebmBytes);
        calls.push(`prepare:${finalizedWebmBytes.byteLength}`);
        return {
          base64: 'b2dnLW9wdXM=',
          byteLength: 12,
          contentType: 'audio/ogg; codecs=opus',
          format: 'ogg-opus',
        };
      },
      readMemoryDetail: async () => ({
        ok: true,
        value: memoryDetailWithSupplement({
          lastTranscriptionAttempt,
          transcript: { exists: false },
        }),
      }),
      readSegmentAudio: async () => {
        throw new Error('segment audio should not be read for supplement fill-missing');
      },
      readSupplementAudio: async ({ transcriptReadMode }) => {
        assert.equal(transcriptReadMode, 'assume-missing', lastTranscriptionAttempt);
        return {
          audio: new Uint8Array([1, 2, 3]),
          audioByteLength: 3,
          lastTranscriptionAttempt,
          ok: true,
          transcript: { exists: false, text: '' },
        };
      },
      recognize: async () => ({
        ok: true,
        requestId: `request-supplement-${lastTranscriptionAttempt}`,
        transcriptText: '补充首次转录。',
      }),
      saveSegmentTranscript: async () =>
        ({
          error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' },
          ok: false,
        }) as WorkspaceErrorEnvelope,
      saveSupplementTranscript: async ({ markdown, requireTranscriptMissing }) => {
        assert.equal(requireTranscriptMissing, true, lastTranscriptionAttempt);
        calls.push(`save:${markdown}`);
        return savedSupplementResponse();
      },
      voiceSettingsStore: validVoiceSettingsStore,
    });

    const response = await runtime.requestSupplementBackfill(supplementTask());

    assert.equal(response.ok, true, lastTranscriptionAttempt);
    assert.deepEqual(calls, ['prepare:3', 'save:补充首次转录。'], lastTranscriptionAttempt);
  }
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
    readSegmentAudio: async ({ transcriptReadMode }) => {
      assert.equal(transcriptReadMode, 'read');
      return {
        audio: new Uint8Array([1]),
        audioByteLength: 1,
        lastTranscriptionAttempt: 'success',
        ok: true,
        transcript: { exists: true, text: '旧转录' },
      };
    },
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
  const recognizeStarted = createDeferred();
  const releaseRecognize = createDeferred();
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
      recognizeStarted.resolve();
      await releaseRecognize.promise;
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
  await recognizeStarted.promise;
  const drain = runtime.cancelAllAndDrain('workspace-switch');
  releaseRecognize.resolve();
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
  const recognizeStarted = createDeferred();
  const releaseRecognize = createDeferred();
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
      recognizeStarted.resolve();
      await releaseRecognize.promise;
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
  await recognizeStarted.promise;
  const drain = runtime.cancelAllAndDrain('lock-lost');
  releaseRecognize.resolve();
  const response = await request;
  await drain;

  assert.equal(response.ok, false);
  if (!response.ok) {
    assert.equal(response.error.code, 'ERR_BACKFILL_UNAVAILABLE');
  }
  assert.equal(saved, false);
});

test('workspace backfill runtime cancels regenerate on app quit after snapshot', async () => {
  const recognizeStarted = createDeferred();
  const releaseRecognize = createDeferred();
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
      recognizeStarted.resolve();
      await releaseRecognize.promise;
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
  await recognizeStarted.promise;
  const drain = runtime.cancelAllAndDrain('app-quit');
  releaseRecognize.resolve();
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
  const saveStarted = createDeferred();
  const releaseSave = createDeferred();
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
      saveStarted.resolve();
      await releaseSave.promise;
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
          audioDurationMs: 1000,
          hasAudioTranscript: true,
          memoryId: 'mem_1',
          segmentCount: 1,
          audioSegmentCount: 1,
          noteSegmentCount: 0,
          hasAnyNote: false,
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
  await saveStarted.promise;
  const drain = runtime.cancelAllAndDrain('workspace-switch');
  releaseSave.resolve();

  const response = await request;
  await drain;

  assert.equal(response.ok, false);
  assert.equal(saved, false);
});

test('workspace backfill runtime treats regenerate save abort checkpoints as canceled', async () => {
  const saveStarted = createDeferred();
  const releaseSave = createDeferred();
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
    recognize: async () => ({
      ok: true,
      requestId: 'request-cancel-save',
      transcriptText: '新转录',
    }),
    saveSegmentTranscript: async (input) => {
      saveStarted.resolve();
      await releaseSave.promise;
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
  await saveStarted.promise;
  const drain = runtime.cancelAllAndDrain('workspace-switch');
  releaseSave.resolve();

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
          audioDurationMs: 1000,
          hasAudioTranscript: true,
          memoryId: 'mem_1',
          segmentCount: 1,
          audioSegmentCount: 1,
          noteSegmentCount: 0,
          hasAnyNote: false,
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
          audioDurationMs: 1000,
          hasAudioTranscript: true,
          memoryId: 'mem_1',
          segmentCount: 1,
          audioSegmentCount: 1,
          noteSegmentCount: 0,
          hasAnyNote: false,
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

test('workspace backfill runtime revalidates automatic targets with a narrow projection before reading audio', async () => {
  let detailRead = false;
  let audioRead = false;
  let saved = false;
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => {
      throw new Error('prepare should not run for stale automatic targets');
    },
    readBackfillTargetProjection: async () => ({
      ok: true,
      value: {
        audioByteLength: 1,
        lastTranscriptionAttempt: 'success',
        transcript: { exists: false },
      },
    }),
    readMemoryDetail: async () => {
      detailRead = true;
      throw new Error('memory detail should not be read for target revalidation');
    },
    readSegmentAudio: async () => {
      audioRead = true;
      return {
        audio: new Uint8Array([1]),
        audioByteLength: 1,
        lastTranscriptionAttempt: 'failed',
        ok: true,
        transcript: { exists: false, text: '' },
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
  assert.equal(detailRead, false);
  assert.equal(audioRead, false);
  assert.equal(saved, false);
});

test('workspace backfill runtime still reads audio after file-truth target revalidation', async () => {
  let audioRead = false;
  const saved: string[] = [];
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => ({
      base64: 'b2dnLW9wdXM=',
      byteLength: 12,
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    }),
    readBackfillTargetProjection: async () => ({
      ok: true,
      value: {
        audioByteLength: 1,
        lastTranscriptionAttempt: 'failed',
        transcript: { exists: false },
      },
    }),
    readSegmentAudio: async () => {
      audioRead = true;
      return {
        audio: new Uint8Array([1]),
        audioByteLength: 1,
        lastTranscriptionAttempt: 'failed',
        ok: true,
        transcript: { exists: false, text: '' },
      };
    },
    recognize: async () => ({ ok: true, requestId: 'request-duplicate', transcriptText: 'text' }),
    saveSegmentTranscript: async () => {
      saved.push('segment');
      return {
        memory: {
          audioByteLength: 1,
          createdAt: '2026-05-17T01:00:00.000Z',
          audioDurationMs: 1000,
          hasAudioTranscript: true,
          memoryId: 'mem_1',
          segmentCount: 1,
          audioSegmentCount: 1,
          noteSegmentCount: 0,
          hasAnyNote: false,
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
  await waitForSaved(saved, 1);
  assert.equal(audioRead, true);
  assert.deepEqual(saved, ['segment']);
});

test('workspace backfill runtime skips automatic targets that are no longer failed-only before remux', async () => {
  for (const lastTranscriptionAttempt of ['never', 'success'] as const) {
    let prepared = false;
    let saved = false;
    const runtime = createWorkspaceBackfillRuntime({
      prepareAudioData: async () => {
        prepared = true;
        return {
          base64: 'b2dnLW9wdXM=',
          byteLength: 12,
          contentType: 'audio/ogg; codecs=opus',
          format: 'ogg-opus',
        };
      },
      readMemoryDetail: async () => ({
        ok: true,
        value: memoryDetailWithSegment({
          lastTranscriptionAttempt: 'failed',
          transcript: { exists: false },
        }),
      }),
      readSegmentAudio: async () => ({
        audio: new Uint8Array([1]),
        audioByteLength: 1,
        lastTranscriptionAttempt,
        ok: true,
        transcript: { exists: false, text: '' },
      }),
      recognize: async () => ({ ok: true, requestId: 'unused', transcriptText: 'unused' }),
      saveSegmentTranscript: async () => {
        saved = true;
        return { error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' }, ok: false };
      },
      saveSupplementTranscript: async () =>
        ({
          error: { code: 'ERR_WORKSPACE_INVALID_REQUEST', message: 'unused' },
          ok: false,
        }) as never,
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

    assert.deepEqual(result, { accepted: 1, capped: 0, duplicates: 0 }, lastTranscriptionAttempt);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(prepared, false, lastTranscriptionAttempt);
    assert.equal(saved, false, lastTranscriptionAttempt);
  }
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
        audioDurationMs: 1000,
        hasAudioTranscript: false,
        memoryId: 'mem_1',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        hasAnyNote: false,
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
        audioDurationMs: 1000,
        hasAudioTranscript: false,
        memoryId: 'mem_1',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        hasAnyNote: false,
        supplementCount: 0,
        title: 'Memory',
        updatedAt: '2026-05-17T01:00:00.000Z',
      },
    ],
    title: 'Workspace',
    workspaceId: 'ws_1',
  };
  const scanStarted = createDeferred();
  const releaseScan = createDeferred();
  let saved = false;
  const runtime = createWorkspaceBackfillRuntime({
    prepareAudioData: async () => {
      throw new Error('prepare should not run after cancellation');
    },
    readMemoryDetail: async () => {
      scanStarted.resolve();
      await releaseScan.promise;
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
  await scanStarted.promise;
  runtime.cancelAll('app-quit');
  releaseScan.resolve();

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

test('scanWorkspaceBackfillTargets refreshes file truth before automatic candidate filtering', async () => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'reo-backfill-stale-index-'));
  const workspaceId = 'ws_stale_backfill_index';
  const memoryId = 'mem_stale_backfill_index';
  const segmentId = 'seg_stale_backfill_index';

  try {
    await initializeWorkspaceFiles({
      rootPath,
      title: '自动补转录',
      description: '',
      createWorkspaceId: () => workspaceId,
      now: () => '2026-05-17T01:00:00.000Z',
    });
    await writeFinalizedBackfillSegment({ memoryId, rootPath, segmentId, workspaceId });

    const targets = await scanWorkspaceBackfillTargets({
      limit: 20,
      rootPath,
      workspaceId,
    });

    assert.deepEqual(
      targets.map((target) => ({
        kind: target.kind,
        memoryId: target.memoryId,
        segmentId: target.segmentId,
      })),
      [{ kind: 'segment', memoryId, segmentId }]
    );
  } finally {
    await rm(rootPath, { force: true, recursive: true });
  }
});

test('scanWorkspaceBackfillTargets reads file-truth details before filtering targets', async () => {
  const snapshot: WorkspaceSnapshot = {
    description: '',
    memories: [
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T01:00:00.000Z',
        audioDurationMs: 1000,
        hasAudioTranscript: false,
        memoryId: 'mem_1',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        hasAnyNote: false,
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
      refreshWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
    }
  );

  assert.deepEqual(
    targets.map((target: (typeof targets)[number]) => target.kind),
    ['supplement', 'segment']
  );
});

test('scanWorkspaceBackfillTargets refreshes file truth when index candidates are below cap', async () => {
  const indexedSnapshot: WorkspaceSnapshot = {
    description: '',
    memories: [
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T01:00:00.000Z',
        audioDurationMs: 1000,
        hasAudioTranscript: false,
        memoryId: 'mem_indexed',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        hasAnyNote: false,
        supplementCount: 0,
        title: 'Indexed',
        updatedAt: '2026-05-17T01:00:00.000Z',
      },
    ],
    title: 'Workspace',
    workspaceId: 'ws_1',
  };
  const refreshedSnapshot: WorkspaceSnapshot = {
    ...indexedSnapshot,
    memories: [
      ...indexedSnapshot.memories,
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T02:00:00.000Z',
        audioDurationMs: 1000,
        hasAudioTranscript: false,
        memoryId: 'mem_refreshed',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        hasAnyNote: false,
        supplementCount: 0,
        title: 'Refreshed',
        updatedAt: '2026-05-17T02:00:00.000Z',
      },
    ],
  };
  const baseDetail = memoryDetailWithSegment({ supplements: [] });
  const baseSegment = baseDetail.segments[0];
  assert.ok(baseSegment);
  const details = new Map<string, WorkspaceMemoryDetailProjection>([
    [
      'mem_indexed',
      {
        ...baseDetail,
        memoryId: 'mem_indexed',
        segments: [
          {
            ...baseSegment,
            memoryId: 'mem_indexed',
            segmentId: 'seg_indexed',
            updatedAt: '2026-05-17T01:00:00.000Z',
          },
        ],
      },
    ],
    [
      'mem_refreshed',
      {
        ...baseDetail,
        memoryId: 'mem_refreshed',
        segments: [
          {
            ...baseSegment,
            memoryId: 'mem_refreshed',
            segmentId: 'seg_refreshed',
            updatedAt: '2026-05-17T02:00:00.000Z',
          },
        ],
      },
    ],
  ]);
  let refreshReads = 0;

  const targets = await scanWorkspaceBackfillTargets(
    {
      limit: 2,
      rootPath: '/tmp/reo-workspace',
      workspaceId: 'ws_1',
    },
    {
      readMemoryDetail: async ({ memoryId }) => {
        const value = details.get(memoryId);
        assert.ok(value);
        return { ok: true, value };
      },
      readWorkspaceSnapshot: async () => ({ ok: true, snapshot: indexedSnapshot }),
      refreshWorkspaceSnapshot: async () => {
        refreshReads += 1;
        return { ok: true, snapshot: refreshedSnapshot };
      },
    }
  );

  assert.equal(refreshReads, 1);
  assert.deepEqual(
    targets.map((target) => (target.kind === 'segment' ? target.segmentId : '')),
    ['seg_refreshed', 'seg_indexed']
  );
});

test('scanWorkspaceBackfillTargets reuses unchanged detail reads after below-cap refresh', async () => {
  const snapshot: WorkspaceSnapshot = {
    description: '',
    memories: [
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T01:00:00.000Z',
        audioDurationMs: 1000,
        hasAudioTranscript: false,
        memoryId: 'mem_unchanged_refresh',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        hasAnyNote: false,
        supplementCount: 0,
        title: 'Unchanged',
        updatedAt: '2026-05-17T01:00:00.000Z',
      },
    ],
    title: 'Workspace',
    workspaceId: 'ws_1',
  };
  const baseDetail = memoryDetailWithSegment({ supplements: [] });
  const segment = baseDetail.segments[0];
  assert.ok(segment);
  let detailReads = 0;

  const targets = await scanWorkspaceBackfillTargets(
    {
      limit: 2,
      rootPath: '/tmp/reo-workspace',
      workspaceId: 'ws_1',
    },
    {
      readMemoryDetail: async ({ memoryId }) => {
        detailReads += 1;
        assert.equal(memoryId, 'mem_unchanged_refresh');
        return {
          ok: true,
          value: {
            ...baseDetail,
            memoryId,
            segments: [
              {
                ...segment,
                memoryId,
                segmentId: 'seg_unchanged_refresh',
              },
            ],
          },
        };
      },
      readWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
      refreshWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
    }
  );

  assert.equal(detailReads, 1);
  assert.deepEqual(
    targets.map((target) => (target.kind === 'segment' ? target.segmentId : '')),
    ['seg_unchanged_refresh']
  );
});

test('scanWorkspaceBackfillTargets applies the automatic cap from the newest eligible memory first', async () => {
  const snapshot: WorkspaceSnapshot = {
    description: '',
    memories: [
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T02:00:00.000Z',
        audioDurationMs: 1000,
        hasAudioTranscript: false,
        memoryId: 'mem_new',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        hasAnyNote: false,
        supplementCount: 0,
        title: 'New',
        updatedAt: '2026-05-17T02:00:00.000Z',
      },
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T01:00:00.000Z',
        audioDurationMs: 1000,
        hasAudioTranscript: false,
        memoryId: 'mem_old',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        hasAnyNote: false,
        supplementCount: 0,
        title: 'Old',
        updatedAt: '2026-05-17T01:00:00.000Z',
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
      refreshWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
    }
  );

  assert.deepEqual(detailReads, ['mem_new']);
  assert.deepEqual(
    targets.map((target) => (target.kind === 'segment' ? target.segmentId : '')),
    ['seg_new']
  );
});

test('scanWorkspaceBackfillTargets refreshes file truth even when index candidates hit the cap', async () => {
  const indexedSnapshot: WorkspaceSnapshot = {
    description: '',
    memories: [
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T01:00:00.000Z',
        audioDurationMs: 1000,
        hasAudioTranscript: false,
        memoryId: 'mem_index_cap',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        hasAnyNote: false,
        supplementCount: 0,
        title: 'Indexed cap',
        updatedAt: '2026-05-17T01:00:00.000Z',
      },
    ],
    title: 'Workspace',
    workspaceId: 'ws_1',
  };
  const refreshedSnapshot: WorkspaceSnapshot = {
    ...indexedSnapshot,
    memories: [
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T02:00:00.000Z',
        audioDurationMs: 1000,
        hasAudioTranscript: false,
        memoryId: 'mem_refreshed_cap',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        hasAnyNote: false,
        supplementCount: 0,
        title: 'Refreshed cap',
        updatedAt: '2026-05-17T02:00:00.000Z',
      },
      ...indexedSnapshot.memories,
    ],
  };
  const baseDetail = memoryDetailWithSegment({ supplements: [] });
  const baseSegment = baseDetail.segments[0];
  assert.ok(baseSegment);
  const details = new Map<string, WorkspaceMemoryDetailProjection>([
    [
      'mem_index_cap',
      {
        ...baseDetail,
        memoryId: 'mem_index_cap',
        segments: [
          {
            ...baseSegment,
            memoryId: 'mem_index_cap',
            segmentId: 'seg_index_cap',
            updatedAt: '2026-05-17T01:00:00.000Z',
          },
        ],
      },
    ],
    [
      'mem_refreshed_cap',
      {
        ...baseDetail,
        memoryId: 'mem_refreshed_cap',
        segments: [
          {
            ...baseSegment,
            memoryId: 'mem_refreshed_cap',
            segmentId: 'seg_refreshed_cap',
            updatedAt: '2026-05-17T02:00:00.000Z',
          },
        ],
      },
    ],
  ]);
  let refreshReads = 0;

  const targets = await scanWorkspaceBackfillTargets(
    {
      limit: 1,
      rootPath: '/tmp/reo-workspace',
      workspaceId: 'ws_1',
    },
    {
      readMemoryDetail: async ({ memoryId }) => {
        const value = details.get(memoryId);
        assert.ok(value);
        return { ok: true, value };
      },
      readWorkspaceSnapshot: async () => ({ ok: true, snapshot: indexedSnapshot }),
      refreshWorkspaceSnapshot: async () => {
        refreshReads += 1;
        return { ok: true, snapshot: refreshedSnapshot };
      },
    }
  );

  assert.equal(refreshReads, 1);
  assert.deepEqual(
    targets.map((target) => (target.kind === 'segment' ? target.segmentId : '')),
    ['seg_refreshed_cap']
  );
});

test('scanWorkspaceBackfillTargets does not stop early when snapshot memory summaries are unsorted', async () => {
  const snapshot: WorkspaceSnapshot = {
    description: '',
    memories: [
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T01:00:00.000Z',
        audioDurationMs: 1000,
        hasAudioTranscript: false,
        memoryId: 'mem_old_unsorted',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        hasAnyNote: false,
        supplementCount: 0,
        title: 'Old',
        updatedAt: '2026-05-17T01:00:00.000Z',
      },
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T02:00:00.000Z',
        audioDurationMs: 1000,
        hasAudioTranscript: false,
        memoryId: 'mem_new_unsorted',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        hasAnyNote: false,
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
  const details = new Map<string, WorkspaceMemoryDetailProjection>([
    [
      'mem_old_unsorted',
      {
        ...baseDetail,
        memoryId: 'mem_old_unsorted',
        segments: [
          {
            ...baseSegment,
            memoryId: 'mem_old_unsorted',
            segmentId: 'seg_old_unsorted',
            supplements: [],
            updatedAt: '2026-05-17T01:00:00.000Z',
          },
        ],
      },
    ],
    [
      'mem_new_unsorted',
      {
        ...baseDetail,
        memoryId: 'mem_new_unsorted',
        segments: [
          {
            ...baseSegment,
            memoryId: 'mem_new_unsorted',
            segmentId: 'seg_new_unsorted',
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
        const value = details.get(memoryId);
        assert.ok(value);
        return { ok: true, value };
      },
      readWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
      refreshWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
    }
  );

  assert.deepEqual(
    targets.map((target) => (target.kind === 'segment' ? target.segmentId : '')),
    ['seg_new_unsorted']
  );
});

test('scanWorkspaceBackfillTargets normalizes fractional and invalid limits once', async () => {
  const snapshot: WorkspaceSnapshot = {
    description: '',
    memories: [
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T01:00:00.000Z',
        audioDurationMs: 1000,
        hasAudioTranscript: false,
        memoryId: 'mem_limit',
        segmentCount: 2,
        audioSegmentCount: 2,
        noteSegmentCount: 0,
        hasAnyNote: false,
        supplementCount: 0,
        title: 'Limit',
        updatedAt: '2026-05-17T01:00:00.000Z',
      },
    ],
    title: 'Workspace',
    workspaceId: 'ws_1',
  };
  const baseDetail = memoryDetail();
  const baseSegment = baseDetail.segments[0];
  assert.ok(baseSegment);
  const detail = {
    ...baseDetail,
    memoryId: 'mem_limit',
    segments: [
      {
        ...baseSegment,
        memoryId: 'mem_limit',
        segmentId: 'seg_older',
        supplements: [],
        updatedAt: '2026-05-17T01:00:00.000Z',
      },
      {
        ...baseSegment,
        memoryId: 'mem_limit',
        segmentId: 'seg_newer',
        supplements: [],
        updatedAt: '2026-05-17T02:00:00.000Z',
      },
    ],
  };

  const fractionalTargets = await scanWorkspaceBackfillTargets(
    {
      limit: 1.9,
      rootPath: '/tmp/reo-workspace',
      workspaceId: 'ws_1',
    },
    {
      readMemoryDetail: async () => ({ ok: true, value: detail }),
      readWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
      refreshWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
    }
  );
  const invalidLimitTargets = await scanWorkspaceBackfillTargets(
    {
      limit: Number.NaN,
      rootPath: '/tmp/reo-workspace',
      workspaceId: 'ws_1',
    },
    {
      readMemoryDetail: async () => ({ ok: true, value: detail }),
      readWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
      refreshWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
    }
  );

  assert.deepEqual(
    fractionalTargets.map((target) => (target.kind === 'segment' ? target.segmentId : '')),
    ['seg_newer']
  );
  assert.deepEqual(
    invalidLimitTargets.map((target) => (target.kind === 'segment' ? target.segmentId : '')),
    ['seg_newer', 'seg_older']
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
        audioDurationMs: 0,
        hasAudioTranscript: false,
        memoryId: 'mem_empty',
        segmentCount: 0,
        audioSegmentCount: 0,
        noteSegmentCount: 0,
        hasAnyNote: false,
        supplementCount: 0,
        title: 'Empty',
        updatedAt: '2026-05-17T01:00:00.000Z',
      },
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T02:00:00.000Z',
        audioDurationMs: 1000,
        hasAudioTranscript: false,
        memoryId: 'mem_1',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        hasAnyNote: false,
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
      limit: 2,
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
      refreshWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
    }
  );

  assert.equal(detailReads, 1);
  assert.equal(targets.length, 2);
});

test('scanWorkspaceBackfillTargets includes audio supplements under note segments', async () => {
  const snapshot: WorkspaceSnapshot = {
    description: '',
    memories: [
      {
        audioByteLength: 0,
        createdAt: '2026-05-17T01:00:00.000Z',
        audioDurationMs: 0,
        hasAudioTranscript: false,
        memoryId: 'mem_note_audio_supplement',
        segmentCount: 1,
        audioSegmentCount: 0,
        noteSegmentCount: 1,
        hasAnyNote: true,
        supplementCount: 1,
        title: 'Note with audio supplement',
        updatedAt: '2026-05-17T02:00:00.000Z',
      },
    ],
    title: 'Workspace',
    workspaceId: 'ws_1',
  };
  const audioSupplement: AudioWorkspaceSegmentSupplementProjection = {
    audioByteLength: 10,
    createdAt: '2026-05-17T01:01:00.000Z',
    durationMs: 1000,
    lastTranscriptionAttempt: 'failed',
    memoryId: 'mem_note_audio_supplement',
    segmentId: 'seg_note_parent',
    supplementId: 'sup_audio_child',
    title: 'Audio supplement',
    transcript: { exists: false },
    type: 'audio',
    updatedAt: '2026-05-17T02:00:00.000Z',
    workspaceId: 'ws_1',
  };
  const noteSegment: NoteWorkspaceSegmentProjection = {
    bodyByteLength: 120,
    createdAt: '2026-05-17T01:00:00.000Z',
    memoryId: 'mem_note_audio_supplement',
    segmentId: 'seg_note_parent',
    supplementCount: 1,
    supplements: [audioSupplement],
    title: 'Note parent',
    type: 'note',
    updatedAt: '2026-05-17T01:00:00.000Z',
    workspaceId: 'ws_1',
  };
  const noteMemory = snapshot.memories[0];
  assert.ok(noteMemory);
  let detailReads = 0;

  const targets = await scanWorkspaceBackfillTargets(
    {
      limit: 2,
      rootPath: '/tmp/reo-workspace',
      workspaceId: 'ws_1',
    },
    {
      readMemoryDetail: async ({ memoryId }) => {
        detailReads += 1;
        assert.equal(memoryId, 'mem_note_audio_supplement');
        return {
          ok: true,
          value: {
            ...noteMemory,
            segments: [noteSegment],
            workspaceId: 'ws_1',
          },
        };
      },
      readWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
      refreshWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
    }
  );

  assert.equal(detailReads, 1);
  assert.deepEqual(targets, [
    {
      kind: 'supplement',
      memoryId: 'mem_note_audio_supplement',
      segmentId: 'seg_note_parent',
      supplementId: 'sup_audio_child',
      updatedAt: '2026-05-17T02:00:00.000Z',
      workspaceId: 'ws_1',
    },
  ]);
});

test('scanWorkspaceBackfillTargets returns no targets without reading details when the limit is zero', async () => {
  let detailReads = 0;
  const snapshot: WorkspaceSnapshot = {
    description: '',
    memories: [
      {
        audioByteLength: 1,
        createdAt: '2026-05-17T01:00:00.000Z',
        audioDurationMs: 1000,
        hasAudioTranscript: false,
        memoryId: 'mem_1',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        hasAnyNote: false,
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
      limit: 0,
      rootPath: '/tmp/reo-workspace',
      workspaceId: 'ws_1',
    },
    {
      readMemoryDetail: async () => {
        detailReads += 1;
        return { ok: true, value: memoryDetail() };
      },
      readWorkspaceSnapshot: async () => ({ ok: true, snapshot }),
    }
  );

  assert.equal(detailReads, 0);
  assert.deepEqual(targets, []);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORKSPACE_CHOOSE_DIRECTORY_CHANNEL,
  WORKSPACE_IPC_CHANNELS,
  workspaceCloseRequestSchema,
  workspaceGenericOkResponseSchema,
  workspaceInitializeRequestSchema,
  workspaceInitializeResponseSchema,
  workspaceListMemorySpacesResponseSchema,
  workspaceMemoryDetailResponseSchema,
  workspaceMicrophoneIntentResponseSchema,
  workspaceOpenRequestSchema,
  workspaceOpenMemorySpaceRequestSchema,
  workspaceRemoveMemorySpaceRequestSchema,
  workspaceRecordingAppendRequestSchema,
  workspaceRecordingAudioChunkRequestSchema,
  workspaceRecordingFinalizeRequestSchema,
  workspaceRecordingMarkdownSaveRequestSchema,
  workspaceRecordingReadRequestSchema,
  workspaceChooseDirectoryResponseSchema,
  workspaceChooseDirectoryResultSchema,
  workspaceErrorEnvelopeSchema,
  workspaceNoInputSchema,
} from '../../src/main/workspaceContract.js';

test('workspace contract exposes only the explicit chooseDirectory channel', () => {
  assert.equal(WORKSPACE_CHOOSE_DIRECTORY_CHANNEL, 'workspace:chooseDirectory');
  assert.deepEqual(WORKSPACE_IPC_CHANNELS, [
    'workspace:chooseDirectory',
    'workspace:listMemorySpaces',
    'workspace:initialize',
    'workspace:open',
    'workspace:openMemorySpace',
    'workspace:removeMemorySpace',
    'workspace:close',
    'workspace:createRecordingDraft',
    'workspace:appendRecordingAudioChunk',
    'workspace:finalizeRecordingDraft',
    'workspace:discardRecordingDraft',
    'workspace:getMemoryDetail',
    'workspace:getRecordingDetail',
    'workspace:readRecordingAudioManifest',
    'workspace:readRecordingAudioChunk',
    'workspace:saveTranscript',
    'workspace:saveReflections',
    'workspace:beginMicrophoneIntent',
    'workspace:clearMicrophoneIntent',
  ]);
  assert.ok(WORKSPACE_IPC_CHANNELS.every((channel) => !channel.includes('*')));
});

test('workspace memory space registry contract exposes memory space metadata but never rootPath', () => {
  const response = workspaceListMemorySpacesResponseSchema.parse({
    ok: true,
    value: {
      memorySpaces: [
        {
          workspaceId: 'ws_1',
          title: 'Runtime validated memory',
          description: 'Final runtime validation workspace.',
          addedAt: '2026-05-08T07:48:00.000Z',
          lastOpenedAt: '2026-05-08T07:49:00.000Z',
        },
      ],
    },
  });

  assert.deepEqual(response, {
    ok: true,
    value: {
      memorySpaces: [
        {
          workspaceId: 'ws_1',
          title: 'Runtime validated memory',
          description: 'Final runtime validation workspace.',
          addedAt: '2026-05-08T07:48:00.000Z',
          lastOpenedAt: '2026-05-08T07:49:00.000Z',
        },
      ],
    },
  });

  assert.deepEqual(workspaceOpenMemorySpaceRequestSchema.parse({ workspaceId: 'ws_1' }), {
    workspaceId: 'ws_1',
  });
  assert.deepEqual(workspaceRemoveMemorySpaceRequestSchema.parse({ workspaceId: 'ws_1' }), {
    workspaceId: 'ws_1',
  });
  assert.throws(() =>
    workspaceListMemorySpacesResponseSchema.parse({
      ok: true,
      value: {
        memorySpaces: [
          {
            workspaceId: 'ws_1',
            title: 'Runtime validated memory',
            description: 'Final runtime validation workspace.',
            rootPath: '/Users/example/Runtime validated memory',
            addedAt: '2026-05-08T07:48:00.000Z',
            lastOpenedAt: '2026-05-08T07:49:00.000Z',
          },
        ],
      },
    })
  );
  assert.throws(() =>
    workspaceOpenMemorySpaceRequestSchema.parse({
      workspaceId: 'ws_1',
      rootPath: '/Users/example/Runtime validated memory',
    })
  );
  assert.throws(() =>
    workspaceRemoveMemorySpaceRequestSchema.parse({
      workspaceId: 'ws_1',
      rootPath: '/Users/example/Runtime validated memory',
    })
  );
});

test('initializeWorkspace contract returns opaque handle, workspaceId, snapshot, and no rootPath', () => {
  assert.deepEqual(
    workspaceInitializeRequestSchema.parse({
      selectionToken: 'selection-token-1',
      title: '新的 workspace',
      description: '',
    }),
    {
      selectionToken: 'selection-token-1',
      title: '新的 workspace',
      description: '',
    }
  );

  const response = workspaceInitializeResponseSchema.parse({
    ok: true,
    value: {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      rootPath: '/Users/example/Voice Notes',
      snapshot: {
        workspaceId: 'ws_1',
        title: '新的 workspace',
        description: '',
        memories: [],
        recordings: [],
      },
    },
  });

  assert.deepEqual(response, {
    ok: true,
    value: {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      snapshot: {
        workspaceId: 'ws_1',
        title: '新的 workspace',
        description: '',
        memories: [],
        recordings: [],
      },
    },
  });
});

test('initializeWorkspace contract rejects unsafe workspace folder names and reports same-name folders', () => {
  assert.throws(() =>
    workspaceInitializeRequestSchema.parse({
      selectionToken: 'selection-token-1',
      title: 'nested/workspace',
      description: '',
    })
  );
  assert.deepEqual(
    workspaceErrorEnvelopeSchema.parse({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_ALREADY_EXISTS',
        message: 'Workspace directory already exists',
        dataRetention: 'none-written',
      },
    }),
    {
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_ALREADY_EXISTS',
        message: 'Workspace directory already exists',
        dataRetention: 'none-written',
      },
    }
  );
});

test('open and close contracts use token or handle but never rootPath', () => {
  assert.deepEqual(workspaceOpenRequestSchema.parse({ selectionToken: 'selection-token-1' }), {
    selectionToken: 'selection-token-1',
  });
  assert.throws(() =>
    workspaceOpenRequestSchema.parse({
      selectionToken: 'selection-token-1',
      rootPath: '/Users/example/Voice Notes',
    })
  );

  assert.deepEqual(workspaceCloseRequestSchema.parse({ workspaceHandle: 'wh_1' }), {
    workspaceHandle: 'wh_1',
  });
  assert.deepEqual(workspaceGenericOkResponseSchema.parse({ ok: true, value: { closed: true } }), {
    ok: true,
    value: { closed: true },
  });
});

test('recording append contract caps chunks at 1 MiB and requires opaque workspace handle', () => {
  const chunk = new Uint8Array(1_048_576);
  assert.deepEqual(
    workspaceRecordingAppendRequestSchema.parse({
      workspaceHandle: 'wh_1',
      recordingId: 'rec_20260506_000001',
      sequence: 0,
      chunk,
    }),
    {
      workspaceHandle: 'wh_1',
      recordingId: 'rec_20260506_000001',
      sequence: 0,
      chunk,
    }
  );
  assert.throws(() =>
    workspaceRecordingAppendRequestSchema.parse({
      workspaceHandle: 'wh_1',
      recordingId: 'rec_20260506_000001',
      sequence: 0,
      chunk: new Uint8Array(1_048_577),
    })
  );
});

test('recording finalize contract requires explicit durable duration', () => {
  assert.deepEqual(
    workspaceRecordingFinalizeRequestSchema.parse({
      durationMs: 2000,
      recordingId: 'rec_20260506_000001',
      title: '录音',
      workspaceHandle: 'wh_1',
    }),
    {
      durationMs: 2000,
      recordingId: 'rec_20260506_000001',
      title: '录音',
      workspaceHandle: 'wh_1',
    }
  );
  assert.throws(() =>
    workspaceRecordingFinalizeRequestSchema.parse({
      recordingId: 'rec_20260506_000001',
      title: '录音',
      workspaceHandle: 'wh_1',
    })
  );
});

test('finalized recording read and save contracts require memory id plus recording id', () => {
  assert.deepEqual(
    workspaceRecordingReadRequestSchema.parse({
      memoryId: 'mem_20260506_000001',
      recordingId: 'rec_20260506_000001',
      workspaceHandle: 'wh_1',
    }),
    {
      memoryId: 'mem_20260506_000001',
      recordingId: 'rec_20260506_000001',
      workspaceHandle: 'wh_1',
    }
  );
  assert.throws(() =>
    workspaceRecordingReadRequestSchema.parse({
      recordingId: 'rec_20260506_000001',
      workspaceHandle: 'wh_1',
    })
  );
  assert.throws(() =>
    workspaceRecordingAudioChunkRequestSchema.parse({
      length: 1,
      offset: 0,
      recordingId: 'rec_20260506_000001',
      workspaceHandle: 'wh_1',
    })
  );
  assert.throws(() =>
    workspaceRecordingMarkdownSaveRequestSchema.parse({
      markdown: 'note',
      recordingId: 'rec_20260506_000001',
      workspaceHandle: 'wh_1',
    })
  );
});

test('memory detail response contract strips raw paths', () => {
  assert.deepEqual(
    workspaceMemoryDetailResponseSchema.parse({
      ok: true,
      value: {
        memoryId: 'mem_20260506_000001',
        title: '录音记忆',
        sourceKind: 'recording',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:09:00.000Z',
        recordingIds: ['rec_20260506_000001'],
        recordingCount: 1,
        recordingsTruncated: false,
        hasTranscript: true,
        hasReflections: false,
        rootPath: '/Users/example/Voice Notes',
        recordings: [
          {
            recordingId: 'rec_20260506_000001',
            title: '录音',
            durationMs: 1000,
            audioByteLength: 3,
            rootPath: '/Users/example/Voice Notes',
          },
        ],
      },
    }),
    {
      ok: true,
      value: {
        memoryId: 'mem_20260506_000001',
        title: '录音记忆',
        sourceKind: 'recording',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:09:00.000Z',
        recordingIds: ['rec_20260506_000001'],
        recordingCount: 1,
        recordingsTruncated: false,
        hasTranscript: true,
        hasReflections: false,
        recordings: [
          {
            recordingId: 'rec_20260506_000001',
            title: '录音',
            durationMs: 1000,
            audioByteLength: 3,
          },
        ],
      },
    }
  );
});

test('microphone intent response exposes no token-like authority', () => {
  assert.deepEqual(
    workspaceMicrophoneIntentResponseSchema.parse({
      ok: true,
      value: {
        registered: true,
        microphoneIntentId: 'mic_1',
        expiresAt: 16_000,
      },
    }),
    {
      ok: true,
      value: { registered: true },
    }
  );
});

test('chooseDirectory has no request payload', () => {
  assert.equal(workspaceNoInputSchema.parse(undefined), undefined);
  assert.throws(() => workspaceNoInputSchema.parse({}));
});

test('chooseDirectory result does not expose raw root path or early judgments', () => {
  const selected = workspaceChooseDirectoryResultSchema.parse({
    status: 'selected',
    selectionToken: 'selection-token-1',
    displayPath: 'Voice Notes',
    rootPath: '/Users/example/Voice Notes',
    conflict: true,
    permission: 'granted',
  });

  assert.deepEqual(selected, {
    status: 'selected',
    selectionToken: 'selection-token-1',
    displayPath: 'Voice Notes',
  });
  assert.throws(() =>
    workspaceChooseDirectoryResultSchema.parse({
      status: 'selected',
      rootPath: '/Users/example/Voice Notes',
    })
  );
  assert.throws(() =>
    workspaceChooseDirectoryResultSchema.parse({
      status: 'conflict',
      displayPath: '/Users/example/Voice Notes',
    })
  );
  assert.throws(() =>
    workspaceChooseDirectoryResultSchema.parse({
      status: 'permissionDenied',
      displayPath: '/Users/example/Voice Notes',
    })
  );
});

test('workspace response envelope strips unsafe error fields', () => {
  assert.deepEqual(
    workspaceChooseDirectoryResponseSchema.parse({
      ok: true,
      value: { status: 'canceled' },
    }),
    { ok: true, value: { status: 'canceled' } }
  );

  assert.deepEqual(
    workspaceErrorEnvelopeSchema.parse({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_UNTRUSTED_SENDER',
        message: 'Sender is not trusted',
        rootPath: '/Users/example/Voice Notes',
      },
    }),
    {
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_UNTRUSTED_SENDER',
        message: 'Sender is not trusted',
      },
    }
  );
});

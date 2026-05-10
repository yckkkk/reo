import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORKSPACE_CHOOSE_DIRECTORY_CHANNEL,
  WORKSPACE_CREATE_MEMORY_CHANNEL,
  WORKSPACE_IPC_CHANNELS,
  WORKSPACE_CLONE_RECORDING_DRAFT_PREFIX_CHANNEL,
  WORKSPACE_READ_RECORDING_DRAFT_AUDIO_CHANNEL,
  WORKSPACE_RECORDING_TRANSCRIPTION_EVENT_CHANNEL,
  WORKSPACE_RENDERER_EVENT_CHANNELS,
  WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL,
  workspaceCreateMemoryRequestSchema,
  workspaceCreateMemoryResponseSchema,
  workspaceCreateRecordingDraftResponseSchema,
  workspaceCloseRequestSchema,
  workspaceCloseResponseSchema,
  workspaceClearMicrophoneIntentResponseSchema,
  workspaceInitializeRequestSchema,
  workspaceInitializeResponseSchema,
  workspaceListMemorySpacesResponseSchema,
  workspaceMicrophoneIntentResponseSchema,
  workspaceRecordingTranscriptionAudioRequestSchema,
  workspaceRecordingTranscriptionCloseRequestSchema,
  workspaceRecordingTranscriptionControlResponseSchema,
  workspaceRecordingTranscriptionEventSchema,
  workspaceRecordingTranscriptionStartRequestSchema,
  workspaceUpdateMemoryTitleRequestSchema,
  workspaceUpdateMemoryTitleResponseSchema,
  workspaceOpenRequestSchema,
  workspaceOpenMemorySpaceRequestSchema,
  workspaceRemoveMemorySpaceResponseSchema,
  workspaceRemoveMemorySpaceRequestSchema,
  workspaceRecordingAppendRequestSchema,
  workspaceRecordingDraftPrefixCloneRequestSchema,
  workspaceRecordingDraftPrefixCloneResponseSchema,
  workspaceRecordingDraftAudioResponseSchema,
  workspaceRecordingDraftAudioRequestSchema,
  workspaceRecordingFinalizeRequestSchema,
  workspaceRecordingMarkdownSaveRequestSchema,
  workspaceRecordingReadRequestSchema,
  workspaceChooseDirectoryResponseSchema,
  workspaceChooseDirectoryResultSchema,
  workspaceErrorEnvelopeSchema,
  workspaceNoInputSchema,
  workspaceMemorySummarySchema,
  workspaceSnapshotSchema,
} from '../../src/workspace-contract/workspace-contract.js';

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
    'workspace:createMemory',
    'workspace:createRecordingDraft',
    'workspace:readRecordingDraftAudio',
    'workspace:appendRecordingAudioChunk',
    'workspace:cloneRecordingDraftPrefix',
    'workspace:finalizeRecordingDraft',
    'workspace:discardRecordingDraft',
    'workspace:updateMemoryTitle',
    'workspace:saveTranscript',
    'workspace:beginMicrophoneIntent',
    'workspace:clearMicrophoneIntent',
    'workspace:startRecordingTranscription',
    'workspace:sendRecordingTranscriptionAudio',
    'workspace:finishRecordingTranscription',
    'workspace:closeRecordingTranscription',
  ]);
  assert.ok(WORKSPACE_IPC_CHANNELS.every((channel) => !channel.includes('*')));
  assert.deepEqual(WORKSPACE_RENDERER_EVENT_CHANNELS, ['workspace:recordingTranscriptionEvent']);
  assert.equal(
    WORKSPACE_RECORDING_TRANSCRIPTION_EVENT_CHANNEL,
    'workspace:recordingTranscriptionEvent'
  );
  assert.equal(WORKSPACE_CREATE_MEMORY_CHANNEL, 'workspace:createMemory');
  assert.equal(WORKSPACE_READ_RECORDING_DRAFT_AUDIO_CHANNEL, 'workspace:readRecordingDraftAudio');
  assert.equal(
    WORKSPACE_CLONE_RECORDING_DRAFT_PREFIX_CHANNEL,
    'workspace:cloneRecordingDraftPrefix'
  );
  assert.equal(WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL, 'workspace:updateMemoryTitle');
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

  assert.deepEqual(
    workspaceInitializeResponseSchema.parse({
      ok: true,
      value: {
        workspaceHandle: 'wh_1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: '新的 workspace',
          description: '',
          memories: [],
        },
      },
    }),
    {
      ok: true,
      value: {
        workspaceHandle: 'wh_1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: '新的 workspace',
          description: '',
          memories: [],
        },
      },
    }
  );
  assert.throws(() =>
    workspaceInitializeResponseSchema.parse({
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
        },
      },
    })
  );
});

test('workspace snapshot contract rejects top-level segments projection', () => {
  assert.throws(() =>
    workspaceSnapshotSchema.parse({
      workspaceId: 'ws_1',
      title: '新的 workspace',
      description: '',
      memories: [],
      segments: [],
    })
  );
});

test('workspace memory summary contract rejects unknown nested fields', () => {
  assert.deepEqual(
    workspaceMemorySummarySchema.parse({
      memoryId: 'mem_1',
      title: '产品灵感',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      segmentCount: 1,
      durationMs: 1000,
      audioByteLength: 2048,
      hasTranscript: false,
      attachmentCount: 0,
    }),
    {
      memoryId: 'mem_1',
      title: '产品灵感',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      segmentCount: 1,
      durationMs: 1000,
      audioByteLength: 2048,
      hasTranscript: false,
      attachmentCount: 0,
    }
  );
  assert.throws(() =>
    workspaceMemorySummarySchema.parse({
      memoryId: 'mem_1',
      title: '产品灵感',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      segmentCount: 1,
      durationMs: 1000,
      audioByteLength: 2048,
      hasTranscript: false,
      attachmentCount: 0,
      staleRecordingProjection: ['seg_old'],
    })
  );
  assert.throws(() =>
    workspaceMemorySummarySchema.parse({
      memoryId: 'recording_1',
      title: '产品灵感',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      segmentCount: 1,
      durationMs: 1000,
      audioByteLength: 2048,
      hasTranscript: false,
      attachmentCount: 0,
    })
  );
});

test('createRecordingDraft response contract exposes a flat draft identity payload', () => {
  assert.deepEqual(
    workspaceCreateRecordingDraftResponseSchema.parse({
      ok: true,
      value: {
        segmentId: 'seg_20260508_000001',
        nextSequence: 0,
      },
    }),
    {
      ok: true,
      value: {
        segmentId: 'seg_20260508_000001',
        nextSequence: 0,
      },
    }
  );
  assert.throws(() =>
    workspaceCreateRecordingDraftResponseSchema.parse({
      ok: true,
      value: {
        ok: true,
        segmentId: 'seg_20260508_000001',
        nextSequence: 0,
      },
    })
  );
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
  assert.deepEqual(workspaceCloseResponseSchema.parse({ ok: true, value: { closed: true } }), {
    ok: true,
    value: { closed: true },
  });
  assert.throws(() => workspaceCloseResponseSchema.parse({ ok: true, value: { removed: true } }));
  assert.deepEqual(
    workspaceRemoveMemorySpaceResponseSchema.parse({ ok: true, value: { removed: true } }),
    {
      ok: true,
      value: { removed: true },
    }
  );
  assert.deepEqual(
    workspaceClearMicrophoneIntentResponseSchema.parse({ ok: true, value: { cleared: true } }),
    {
      ok: true,
      value: { cleared: true },
    }
  );
});

test('recording append contract caps chunks at 1 MiB and requires opaque workspace handle', () => {
  const chunk = new Uint8Array(1_048_576);
  assert.deepEqual(
    workspaceRecordingAppendRequestSchema.parse({
      workspaceHandle: 'wh_1',
      segmentId: 'seg_20260506_000001',
      sequence: 0,
      chunk,
    }),
    {
      workspaceHandle: 'wh_1',
      segmentId: 'seg_20260506_000001',
      sequence: 0,
      chunk,
    }
  );
  assert.throws(() =>
    workspaceRecordingAppendRequestSchema.parse({
      workspaceHandle: 'wh_1',
      segmentId: 'seg_20260506_000001',
      sequence: 0,
      chunk: new Uint8Array(1_048_577),
    })
  );
});

test('recording draft prefix clone contract keeps replacement copy explicit and bounded', () => {
  assert.deepEqual(
    workspaceRecordingDraftPrefixCloneRequestSchema.parse({
      workspaceHandle: 'workspace-handle-secret',
      sourceSegmentId: 'seg_source',
      targetSegmentId: 'seg_target',
      retainedByteLength: 2048,
      nextSequence: 0,
    }),
    {
      workspaceHandle: 'workspace-handle-secret',
      sourceSegmentId: 'seg_source',
      targetSegmentId: 'seg_target',
      retainedByteLength: 2048,
      nextSequence: 0,
    }
  );
  assert.throws(() =>
    workspaceRecordingDraftPrefixCloneRequestSchema.parse({
      workspaceHandle: 'workspace-handle-secret',
      sourceSegmentId: 'seg_same',
      targetSegmentId: 'seg_same',
      retainedByteLength: 2048,
      nextSequence: 0,
    })
  );
  assert.deepEqual(
    workspaceRecordingDraftPrefixCloneResponseSchema.parse({
      ok: true,
      value: { audioByteLength: 2048, nextSequence: 1 },
    }),
    {
      ok: true,
      value: { audioByteLength: 2048, nextSequence: 1 },
    }
  );
});

test('draft audio read response returns only current draft bytes and append cursor', () => {
  assert.deepEqual(
    workspaceRecordingDraftAudioRequestSchema.parse({
      workspaceHandle: 'wh_1',
      segmentId: 'seg_20260506_000001',
      maxBytes: 4096,
    }),
    {
      workspaceHandle: 'wh_1',
      segmentId: 'seg_20260506_000001',
      maxBytes: 4096,
    }
  );
  assert.throws(() =>
    workspaceRecordingDraftAudioRequestSchema.parse({
      workspaceHandle: 'wh_1',
      segmentId: 'seg_20260506_000001',
      maxBytes: 64 * 1024 * 1024 + 1,
    })
  );

  const audio = new Uint8Array([1, 2, 3]);
  assert.deepEqual(
    workspaceRecordingDraftAudioResponseSchema.parse({
      ok: true,
      value: {
        audio,
        audioByteLength: 3,
        nextSequence: 2,
      },
    }),
    {
      ok: true,
      value: {
        audio,
        audioByteLength: 3,
        nextSequence: 2,
      },
    }
  );
  assert.throws(() =>
    workspaceRecordingDraftAudioResponseSchema.parse({
      ok: true,
      value: {
        audio: [1, 2, 3],
        audioByteLength: 3,
        nextSequence: 2,
      },
    })
  );
});

test('recording finalize contract requires explicit durable duration', () => {
  assert.deepEqual(
    workspaceRecordingFinalizeRequestSchema.parse({
      durationMs: 2000,
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      title: '录音',
      workspaceHandle: 'wh_1',
    }),
    {
      durationMs: 2000,
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      title: '录音',
      workspaceHandle: 'wh_1',
    }
  );
  assert.throws(() =>
    workspaceRecordingFinalizeRequestSchema.parse({
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      title: '录音',
      workspaceHandle: 'wh_1',
    })
  );
  assert.throws(() =>
    workspaceRecordingFinalizeRequestSchema.parse({
      durationMs: 2000,
      segmentId: 'seg_20260506_000001',
      title: '录音',
      workspaceHandle: 'wh_1',
    })
  );
});

test('finalized audio segment transcript save contract requires memory id plus segment id', () => {
  assert.deepEqual(
    workspaceRecordingReadRequestSchema.parse({
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      workspaceHandle: 'wh_1',
    }),
    {
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      workspaceHandle: 'wh_1',
    }
  );
  assert.throws(() =>
    workspaceRecordingReadRequestSchema.parse({
      segmentId: 'seg_20260506_000001',
      workspaceHandle: 'wh_1',
    })
  );
  assert.throws(() =>
    workspaceRecordingMarkdownSaveRequestSchema.parse({
      markdown: 'note',
      segmentId: 'seg_20260506_000001',
      workspaceHandle: 'wh_1',
    })
  );
});

test('memory title update contract is scoped to a memory container and strips raw paths', () => {
  assert.deepEqual(
    workspaceUpdateMemoryTitleRequestSchema.parse({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_20260506_000001',
      title: '产品灵感与思考',
    }),
    {
      workspaceHandle: 'wh_1',
      memoryId: 'mem_20260506_000001',
      title: '产品灵感与思考',
    }
  );
  assert.throws(() =>
    workspaceUpdateMemoryTitleRequestSchema.parse({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_20260506_000001',
      title: '',
    })
  );
  assert.throws(() =>
    workspaceUpdateMemoryTitleRequestSchema.parse({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_20260506_000001',
      title: '产品灵感与思考',
      segmentId: 'seg_20260506_000001',
    })
  );

  assert.throws(() =>
    workspaceUpdateMemoryTitleResponseSchema.parse({
      ok: true,
      value: {
        memoryId: 'mem_20260506_000001',
        title: '产品灵感与思考',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-08T14:42:00.000Z',
        segmentCount: 5,
        durationMs: 1000,
        audioByteLength: 3,
        hasTranscript: true,
        attachmentCount: 0,
        rootPath: '/Users/example/Reo',
        segmentIds: ['seg_20260506_000001'],
      },
    })
  );
});

test('memory create contract creates a named Memory container without raw path authority', () => {
  assert.deepEqual(
    workspaceCreateMemoryRequestSchema.parse({
      workspaceHandle: 'wh_1',
      title: '产品灵感与思考',
    }),
    {
      workspaceHandle: 'wh_1',
      title: '产品灵感与思考',
    }
  );
  assert.throws(() =>
    workspaceCreateMemoryRequestSchema.parse({
      workspaceHandle: 'wh_1',
      title: '',
    })
  );
  assert.throws(() =>
    workspaceCreateMemoryRequestSchema.parse({
      workspaceHandle: 'wh_1',
      title: '产品灵感与思考',
      rootPath: '/Users/example/Reo',
    })
  );
  assert.throws(() =>
    workspaceCreateMemoryRequestSchema.parse({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_20260506_000001',
      title: '产品灵感与思考',
    })
  );

  assert.throws(() =>
    workspaceCreateMemoryResponseSchema.parse({
      ok: true,
      value: {
        memoryId: 'mem_20260506_000001',
        title: '产品灵感与思考',
        createdAt: '2026-05-08T14:42:00.000Z',
        updatedAt: '2026-05-08T14:42:00.000Z',
        segmentCount: 0,
        durationMs: 0,
        audioByteLength: 0,
        hasTranscript: false,
        attachmentCount: 0,
        rootPath: '/Users/example/Reo',
        segmentIds: [],
      },
    })
  );
});

test('microphone intent response exposes no token-like authority', () => {
  assert.throws(() =>
    workspaceMicrophoneIntentResponseSchema.parse({
      ok: true,
      value: {
        registered: true,
        microphoneIntentId: 'mic_1',
        expiresAt: 16_000,
      },
    })
  );
});

test('recording transcription contract keeps credentials out of renderer payloads', () => {
  const start = workspaceRecordingTranscriptionStartRequestSchema.parse({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    timeOffsetMs: 2000,
    workspaceHandle: 'wh_1',
  });
  assert.deepEqual(start, {
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    timeOffsetMs: 2000,
    workspaceHandle: 'wh_1',
  });
  assert.throws(() =>
    workspaceRecordingTranscriptionStartRequestSchema.parse({
      ...start,
      accessToken: 'secret',
      appId: 'secret',
    })
  );

  const audio = new Uint8Array([1, 2, 3]);
  assert.deepEqual(
    workspaceRecordingTranscriptionAudioRequestSchema.parse({
      chunk: audio,
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: 'wh_1',
    }),
    {
      chunk: audio,
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: 'wh_1',
    }
  );
  assert.throws(() =>
    workspaceRecordingTranscriptionAudioRequestSchema.parse({
      chunk: new Uint8Array(65_537),
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: 'wh_1',
    })
  );

  assert.deepEqual(
    workspaceRecordingTranscriptionCloseRequestSchema.parse({
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: 'wh_1',
    }),
    {
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: 'wh_1',
    }
  );
  assert.deepEqual(
    workspaceRecordingTranscriptionControlResponseSchema.parse({
      ok: true,
      value: { accepted: true },
    }),
    { ok: true, value: { accepted: true } }
  );
});

test('recording transcription event contract carries only segment state and safe errors', () => {
  assert.deepEqual(
    workspaceRecordingTranscriptionEventSchema.parse({
      kind: 'segments',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      segments: [
        {
          endTimeMs: 2400,
          isFinal: false,
          recordingSessionId: 'recording-1',
          revisionId: 'recording-1-revision-0',
          startTimeMs: 1200,
          text: '实时转写',
        },
      ],
    }),
    {
      kind: 'segments',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      segments: [
        {
          endTimeMs: 2400,
          isFinal: false,
          recordingSessionId: 'recording-1',
          revisionId: 'recording-1-revision-0',
          startTimeMs: 1200,
          text: '实时转写',
        },
      ],
    }
  );
  assert.throws(() =>
    workspaceRecordingTranscriptionEventSchema.parse({
      kind: 'segments',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      rootPath: '/Users/example/Reo',
      segments: [],
    })
  );
  assert.throws(() =>
    workspaceRecordingTranscriptionEventSchema.parse({
      kind: 'error',
      accessToken: 'secret',
      message: 'failed',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
    })
  );
});

test('chooseDirectory has no request payload', () => {
  assert.equal(workspaceNoInputSchema.parse(undefined), undefined);
  assert.throws(() => workspaceNoInputSchema.parse({}));
});

test('chooseDirectory result does not expose raw root path or early judgments', () => {
  assert.throws(() =>
    workspaceChooseDirectoryResultSchema.parse({
      status: 'selected',
      selectionToken: 'selection-token-1',
      displayPath: 'Voice Notes',
      rootPath: '/Users/example/Voice Notes',
      conflict: true,
      permission: 'granted',
    })
  );
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

test('workspace response envelope rejects unsafe error fields', () => {
  assert.deepEqual(
    workspaceChooseDirectoryResponseSchema.parse({
      ok: true,
      value: { status: 'canceled' },
    }),
    { ok: true, value: { status: 'canceled' } }
  );

  assert.throws(() =>
    workspaceErrorEnvelopeSchema.parse({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_UNTRUSTED_SENDER',
        message: 'Sender is not trusted',
        rootPath: '/Users/example/Voice Notes',
      },
    })
  );
});

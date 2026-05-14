import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORKSPACE_CHOOSE_DIRECTORY_CHANNEL,
  WORKSPACE_CREATE_MEMORY_CHANNEL,
  WORKSPACE_DELETE_MEMORY_CHANNEL,
  WORKSPACE_DELETE_SEGMENT_CHANNEL,
  WORKSPACE_CREATE_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_IPC_CHANNELS,
  WORKSPACE_APPEND_SEGMENT_ATTACHMENT_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_CLONE_RECORDING_DRAFT_PREFIX_CHANNEL,
  WORKSPACE_FINALIZE_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_DISCARD_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_ATTACHMENT_CHANNEL,
  WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_CHANNEL,
  WORKSPACE_READ_MEMORY_DETAIL_CHANNEL,
  WORKSPACE_READ_WORKSPACE_SNAPSHOT_CHANNEL,
  WORKSPACE_RESTORE_DELETED_MEMORY_CHANNEL,
  WORKSPACE_RESTORE_DELETED_SEGMENT_CHANNEL,
  WORKSPACE_READ_RECORDING_DRAFT_AUDIO_CHANNEL,
  WORKSPACE_RECORDING_TRANSCRIPTION_EVENT_CHANNEL,
  WORKSPACE_RENDERER_EVENT_CHANNELS,
  WORKSPACE_UPDATE_MEMORY_SPACE_TITLE_CHANNEL,
  WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL,
  WORKSPACE_UPDATE_SEGMENT_TITLE_CHANNEL,
  workspaceCreateMemoryRequestSchema,
  workspaceCreateMemoryResponseSchema,
  workspaceDeleteMemoryRequestSchema,
  workspaceDeleteMemoryResponseSchema,
  workspaceDeleteSegmentRequestSchema,
  workspaceDeleteSegmentResponseSchema,
  workspaceReadMemoryDetailRequestSchema,
  workspaceReadMemoryDetailResponseSchema,
  workspaceReadWorkspaceSnapshotRequestSchema,
  workspaceReadWorkspaceSnapshotResponseSchema,
  workspaceRestoreDeletedMemoryRequestSchema,
  workspaceRestoreDeletedMemoryResponseSchema,
  workspaceRestoreDeletedSegmentRequestSchema,
  workspaceRestoreDeletedSegmentResponseSchema,
  workspaceReadFinalizedAudioSegmentRequestSchema,
  workspaceReadFinalizedAudioSegmentResponseSchema,
  workspaceReadFinalizedAudioSegmentAttachmentRequestSchema,
  workspaceReadFinalizedAudioSegmentAttachmentResponseSchema,
  workspaceCreateRecordingDraftResponseSchema,
  workspaceCreateSegmentAttachmentRecordingDraftRequestSchema,
  workspaceCreateSegmentAttachmentRecordingDraftResponseSchema,
  workspaceAppendSegmentAttachmentRecordingAudioRequestSchema,
  workspaceFinalizeSegmentAttachmentRecordingDraftRequestSchema,
  workspaceFinalizeSegmentAttachmentRecordingDraftResponseSchema,
  workspaceSegmentAttachmentIdRequestSchema,
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
  workspaceUpdateSegmentTitleRequestSchema,
  workspaceUpdateSegmentTitleResponseSchema,
  workspaceUpdateMemorySpaceTitleRequestSchema,
  workspaceUpdateMemorySpaceTitleResponseSchema,
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
    'workspace:updateMemorySpaceTitle',
    'workspace:close',
    'workspace:readWorkspaceSnapshot',
    'workspace:createMemory',
    'workspace:deleteMemory',
    'workspace:restoreDeletedMemory',
    'workspace:deleteSegment',
    'workspace:restoreDeletedSegment',
    'workspace:readMemoryDetail',
    'workspace:readFinalizedAudioSegment',
    'workspace:readFinalizedAudioSegmentAttachment',
    'workspace:createRecordingDraft',
    'workspace:createSegmentAttachmentRecordingDraft',
    'workspace:readRecordingDraftAudio',
    'workspace:appendRecordingAudioChunk',
    'workspace:appendSegmentAttachmentRecordingAudioChunk',
    'workspace:cloneRecordingDraftPrefix',
    'workspace:finalizeRecordingDraft',
    'workspace:finalizeSegmentAttachmentRecordingDraft',
    'workspace:discardRecordingDraft',
    'workspace:discardSegmentAttachmentRecordingDraft',
    'workspace:updateMemoryTitle',
    'workspace:updateSegmentTitle',
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
  assert.equal(WORKSPACE_DELETE_MEMORY_CHANNEL, 'workspace:deleteMemory');
  assert.equal(WORKSPACE_RESTORE_DELETED_MEMORY_CHANNEL, 'workspace:restoreDeletedMemory');
  assert.equal(WORKSPACE_DELETE_SEGMENT_CHANNEL, 'workspace:deleteSegment');
  assert.equal(WORKSPACE_RESTORE_DELETED_SEGMENT_CHANNEL, 'workspace:restoreDeletedSegment');
  assert.equal(WORKSPACE_READ_WORKSPACE_SNAPSHOT_CHANNEL, 'workspace:readWorkspaceSnapshot');
  assert.equal(WORKSPACE_READ_MEMORY_DETAIL_CHANNEL, 'workspace:readMemoryDetail');
  assert.equal(
    WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_CHANNEL,
    'workspace:readFinalizedAudioSegment'
  );
  assert.equal(
    WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_ATTACHMENT_CHANNEL,
    'workspace:readFinalizedAudioSegmentAttachment'
  );
  assert.equal(WORKSPACE_READ_RECORDING_DRAFT_AUDIO_CHANNEL, 'workspace:readRecordingDraftAudio');
  assert.equal(
    WORKSPACE_CLONE_RECORDING_DRAFT_PREFIX_CHANNEL,
    'workspace:cloneRecordingDraftPrefix'
  );
  assert.equal(WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL, 'workspace:updateMemoryTitle');
  assert.equal(WORKSPACE_UPDATE_SEGMENT_TITLE_CHANNEL, 'workspace:updateSegmentTitle');
  assert.equal(WORKSPACE_UPDATE_MEMORY_SPACE_TITLE_CHANNEL, 'workspace:updateMemorySpaceTitle');
  assert.equal(
    WORKSPACE_CREATE_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
    'workspace:createSegmentAttachmentRecordingDraft'
  );
  assert.equal(
    WORKSPACE_APPEND_SEGMENT_ATTACHMENT_RECORDING_AUDIO_CHUNK_CHANNEL,
    'workspace:appendSegmentAttachmentRecordingAudioChunk'
  );
  assert.equal(
    WORKSPACE_FINALIZE_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
    'workspace:finalizeSegmentAttachmentRecordingDraft'
  );
  assert.equal(
    WORKSPACE_DISCARD_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
    'workspace:discardSegmentAttachmentRecordingDraft'
  );
});

test('workspace snapshot read contract refreshes file truth without exposing raw paths', () => {
  assert.deepEqual(
    workspaceReadWorkspaceSnapshotRequestSchema.parse({
      workspaceHandle: 'wh_1',
    }),
    {
      workspaceHandle: 'wh_1',
    }
  );
  const response = workspaceReadWorkspaceSnapshotResponseSchema.parse({
    ok: true,
    value: {
      workspaceId: 'ws_1',
      title: '外部更新空间',
      description: '由 Codex 更新',
      memories: [
        {
          memoryId: 'mem_1',
          title: '外部更新记忆',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-08T14:42:00.000Z',
          segmentCount: 1,
          durationMs: 1000,
          audioByteLength: 3,
          hasTranscript: true,
          attachmentCount: 0,
        },
      ],
    },
  });

  assert.equal(response.ok, true);
  if (response.ok) {
    assert.equal('rootPath' in response.value, false);
    assert.equal('workspaceHandle' in response.value, false);
  }
});

test('memory dangerous operation contract keeps delete and restore path explicit', () => {
  assert.deepEqual(
    workspaceDeleteMemoryRequestSchema.parse({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_1',
    }),
    {
      workspaceHandle: 'wh_1',
      memoryId: 'mem_1',
    }
  );
  assert.deepEqual(
    workspaceDeleteMemoryResponseSchema.parse({
      ok: true,
      value: {
        memoryId: 'mem_1',
        restoreToken: 'mem_1',
        memories: [],
      },
    }),
    {
      ok: true,
      value: {
        memoryId: 'mem_1',
        restoreToken: 'mem_1',
        memories: [],
      },
    }
  );
  assert.deepEqual(
    workspaceRestoreDeletedMemoryRequestSchema.parse({
      workspaceHandle: 'wh_1',
      restoreToken: 'mem_1',
    }),
    {
      workspaceHandle: 'wh_1',
      restoreToken: 'mem_1',
    }
  );
  const restored = workspaceRestoreDeletedMemoryResponseSchema.parse({
    ok: true,
    value: {
      memory: {
        memoryId: 'mem_1',
        title: 'Memory',
        createdAt: '2026-05-10T13:00:00.000Z',
        updatedAt: '2026-05-10T13:00:00.000Z',
        segmentCount: 0,
        durationMs: 0,
        audioByteLength: 0,
        hasTranscript: false,
        attachmentCount: 0,
      },
      memories: [
        {
          memoryId: 'mem_1',
          title: 'Memory',
          createdAt: '2026-05-10T13:00:00.000Z',
          updatedAt: '2026-05-10T13:00:00.000Z',
          segmentCount: 0,
          durationMs: 0,
          audioByteLength: 0,
          hasTranscript: false,
          attachmentCount: 0,
        },
      ],
    },
  });
  assert.equal(restored.ok, true);
});

test('segment dangerous operation contract keeps parent identity and restore token explicit', () => {
  assert.deepEqual(
    workspaceDeleteSegmentRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    }
  );
  assert.deepEqual(
    workspaceDeleteSegmentResponseSchema.parse({
      ok: true,
      value: {
        memory: {
          memoryId: 'mem_1',
          title: 'Memory',
          createdAt: '2026-05-10T13:00:00.000Z',
          updatedAt: '2026-05-10T13:00:00.000Z',
          segmentCount: 0,
          durationMs: 0,
          audioByteLength: 0,
          hasTranscript: false,
          attachmentCount: 0,
        },
        segmentId: 'seg_1',
        restoreToken: 'seg_1',
      },
    }),
    {
      ok: true,
      value: {
        memory: {
          memoryId: 'mem_1',
          title: 'Memory',
          createdAt: '2026-05-10T13:00:00.000Z',
          updatedAt: '2026-05-10T13:00:00.000Z',
          segmentCount: 0,
          durationMs: 0,
          audioByteLength: 0,
          hasTranscript: false,
          attachmentCount: 0,
        },
        segmentId: 'seg_1',
        restoreToken: 'seg_1',
      },
    }
  );
  assert.deepEqual(
    workspaceRestoreDeletedSegmentRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      restoreToken: 'seg_1',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      restoreToken: 'seg_1',
    }
  );
  const restored = workspaceRestoreDeletedSegmentResponseSchema.parse({
    ok: true,
    value: {
      memory: {
        memoryId: 'mem_1',
        title: 'Memory',
        createdAt: '2026-05-10T13:00:00.000Z',
        updatedAt: '2026-05-10T13:00:00.000Z',
        segmentCount: 1,
        durationMs: 1000,
        audioByteLength: 3,
        hasTranscript: false,
        attachmentCount: 0,
      },
      segment: {
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        type: 'audio',
        title: 'Segment',
        createdAt: '2026-05-10T13:13:00.000Z',
        updatedAt: '2026-05-10T13:14:00.000Z',
        durationMs: 1000,
        audioByteLength: 3,
        transcript: { exists: false },
        attachmentCount: 0,
        attachments: [],
      },
    },
  });
  assert.equal(restored.ok, true);
  if (restored.ok) {
    assert.equal('rootPath' in restored.value, false);
    assert.equal('workspaceHandle' in restored.value, false);
  }
});

test('segment attachment recording contract keeps parent identity explicit', () => {
  assert.deepEqual(
    workspaceCreateSegmentAttachmentRecordingDraftRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    }
  );
  assert.deepEqual(
    workspaceCreateSegmentAttachmentRecordingDraftResponseSchema.parse({
      ok: true,
      value: {
        attachmentId: 'att_1',
        nextSequence: 0,
      },
    }),
    {
      ok: true,
      value: {
        attachmentId: 'att_1',
        nextSequence: 0,
      },
    }
  );
  assert.deepEqual(
    workspaceAppendSegmentAttachmentRecordingAudioRequestSchema.parse({
      workspaceHandle: 'wh_1',
      attachmentId: 'att_1',
      sequence: 0,
      chunk: new Uint8Array([1]),
    }),
    {
      workspaceHandle: 'wh_1',
      attachmentId: 'att_1',
      sequence: 0,
      chunk: new Uint8Array([1]),
    }
  );
  const response = workspaceFinalizeSegmentAttachmentRecordingDraftResponseSchema.parse({
    ok: true,
    value: {
      memory: {
        memoryId: 'mem_1',
        title: 'Memory',
        createdAt: '2026-05-10T13:13:00.000Z',
        updatedAt: '2026-05-10T13:14:00.000Z',
        segmentCount: 1,
        durationMs: 1000,
        audioByteLength: 3,
        hasTranscript: false,
        attachmentCount: 1,
      },
      segment: {
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        type: 'audio',
        title: 'Segment',
        createdAt: '2026-05-10T13:13:00.000Z',
        updatedAt: '2026-05-10T13:14:00.000Z',
        durationMs: 1000,
        audioByteLength: 3,
        transcript: { exists: false },
        attachmentCount: 1,
        attachments: [
          {
            workspaceId: 'ws_1',
            memoryId: 'mem_1',
            segmentId: 'seg_1',
            attachmentId: 'att_1',
            type: 'audio',
            title: 'Attachment',
            createdAt: '2026-05-10T13:14:00.000Z',
            updatedAt: '2026-05-10T13:15:00.000Z',
            durationMs: 500,
            audioByteLength: 2,
            transcript: { exists: false },
          },
        ],
      },
      attachment: {
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        attachmentId: 'att_1',
        type: 'audio',
        title: 'Attachment',
        createdAt: '2026-05-10T13:14:00.000Z',
        updatedAt: '2026-05-10T13:15:00.000Z',
        durationMs: 500,
        audioByteLength: 2,
        transcript: { exists: false },
      },
    },
  });
  assert.equal(response.ok, true);
  assert.deepEqual(
    workspaceFinalizeSegmentAttachmentRecordingDraftRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      attachmentId: 'att_1',
      title: 'Attachment',
      durationMs: 500,
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      attachmentId: 'att_1',
      title: 'Attachment',
      durationMs: 500,
    }
  );
  assert.deepEqual(
    workspaceSegmentAttachmentIdRequestSchema.parse({
      workspaceHandle: 'wh_1',
      attachmentId: 'att_1',
    }),
    {
      workspaceHandle: 'wh_1',
      attachmentId: 'att_1',
    }
  );
  assert.deepEqual(
    workspaceReadFinalizedAudioSegmentAttachmentRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      attachmentId: 'att_1',
      requestId: 'request_att_1',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      attachmentId: 'att_1',
      requestId: 'request_att_1',
    }
  );
  assert.deepEqual(
    workspaceReadFinalizedAudioSegmentAttachmentResponseSchema.parse({
      ok: true,
      value: {
        requestId: 'request_att_1',
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        attachmentId: 'att_1',
        audio: new Uint8Array([4, 5]),
        audioByteLength: 2,
      },
    }),
    {
      ok: true,
      value: {
        requestId: 'request_att_1',
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        attachmentId: 'att_1',
        audio: new Uint8Array([4, 5]),
        audioByteLength: 2,
      },
    }
  );
});

test('workspace memory detail contract keeps handle out of response data', () => {
  assert.deepEqual(
    workspaceReadMemoryDetailRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      requestId: 'request_mem_1',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      requestId: 'request_mem_1',
    }
  );

  const response = workspaceReadMemoryDetailResponseSchema.parse({
    ok: true,
    value: {
      requestId: 'request_mem_1',
      detail: {
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        title: '产品灵感与思考',
        createdAt: '2026-05-08T14:42:00.000Z',
        updatedAt: '2026-05-08T14:42:00.000Z',
        segmentCount: 1,
        durationMs: 1000,
        audioByteLength: 3,
        hasTranscript: true,
        attachmentCount: 0,
        segments: [
          {
            workspaceId: 'ws_1',
            memoryId: 'mem_1',
            segmentId: 'seg_1',
            type: 'audio',
            title: '第一段录音',
            createdAt: '2026-05-08T14:42:00.000Z',
            updatedAt: '2026-05-08T14:43:00.000Z',
            durationMs: 1000,
            audioByteLength: 3,
            transcript: { exists: true },
            attachmentCount: 0,
            attachments: [],
          },
        ],
      },
    },
  });

  assert.equal(response.ok, true);
  if (response.ok) {
    assert.equal('workspaceHandle' in response.value.detail, false);
    assert.equal('rootPath' in response.value.detail, false);
    const [segment] = response.value.detail.segments;
    assert.ok(segment);
    assert.equal('workspaceHandle' in segment, false);
  }
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

test('finalized audio segment read contract requires memory and segment identity', () => {
  assert.deepEqual(
    workspaceReadFinalizedAudioSegmentRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      requestId: 'request_1',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      requestId: 'request_1',
    }
  );
  const response = workspaceReadFinalizedAudioSegmentResponseSchema.parse({
    ok: true,
    value: {
      requestId: 'request_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      audio: new Uint8Array([1, 2, 3]),
      audioByteLength: 3,
      transcript: { exists: true, text: '正文' },
    },
  });
  assert.equal(response.ok, true);
  if (response.ok) {
    assert.deepEqual(response.value, {
      requestId: 'request_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      audio: new Uint8Array([1, 2, 3]),
      audioByteLength: 3,
      transcript: { exists: true, text: '正文' },
    });
  }
  assert.throws(() =>
    workspaceReadFinalizedAudioSegmentRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      segmentId: 'seg_20260506_000001',
      requestId: 'request_1',
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

test('segment title update contract returns memory and segment projections without raw paths', () => {
  assert.deepEqual(
    workspaceUpdateSegmentTitleRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      title: '录音1',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      title: '录音1',
    }
  );
  assert.throws(() =>
    workspaceUpdateSegmentTitleRequestSchema.parse({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      title: '录音1',
    })
  );
  assert.throws(() =>
    workspaceUpdateSegmentTitleRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      title: '',
    })
  );

  assert.throws(() =>
    workspaceUpdateSegmentTitleResponseSchema.parse({
      ok: true,
      value: {
        memory: {
          memoryId: 'mem_20260506_000001',
          title: '产品灵感与思考',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-08T14:42:00.000Z',
          segmentCount: 1,
          durationMs: 1000,
          audioByteLength: 3,
          hasTranscript: true,
          attachmentCount: 0,
        },
        segment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_20260506_000001',
          segmentId: 'seg_20260506_000001',
          type: 'audio',
          title: '录音1',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-08T14:42:00.000Z',
          durationMs: 1000,
          audioByteLength: 3,
          transcript: { exists: true },
          attachmentCount: 0,
          attachments: [],
          rootPath: '/Users/example/Reo',
        },
      },
    })
  );
});

test('memory space title update contract accepts either active handle or registry workspace id', () => {
  assert.deepEqual(
    workspaceUpdateMemorySpaceTitleRequestSchema.parse({
      workspaceHandle: 'wh_1',
      title: '测试工作区1',
    }),
    {
      workspaceHandle: 'wh_1',
      title: '测试工作区1',
    }
  );
  assert.deepEqual(
    workspaceUpdateMemorySpaceTitleRequestSchema.parse({
      workspaceId: 'ws_1',
      title: '测试工作区1',
    }),
    {
      workspaceId: 'ws_1',
      title: '测试工作区1',
    }
  );
  assert.throws(() =>
    workspaceUpdateMemorySpaceTitleRequestSchema.parse({
      title: '测试工作区1',
    })
  );
  assert.throws(() =>
    workspaceUpdateMemorySpaceTitleRequestSchema.parse({
      workspaceId: 'ws_1',
      workspaceHandle: 'wh_1',
      title: '测试工作区1',
    })
  );
  assert.throws(() =>
    workspaceUpdateMemorySpaceTitleRequestSchema.parse({
      workspaceId: 'ws_1',
      title: '',
    })
  );
  assert.deepEqual(
    workspaceUpdateMemorySpaceTitleResponseSchema.parse({
      ok: true,
      value: {
        workspaceId: 'ws_1',
        title: '测试工作区1',
        description: 'Private notes',
        memories: [],
      },
    }),
    {
      ok: true,
      value: {
        workspaceId: 'ws_1',
        title: '测试工作区1',
        description: 'Private notes',
        memories: [],
      },
    }
  );
  assert.throws(() =>
    workspaceUpdateMemorySpaceTitleResponseSchema.parse({
      ok: true,
      value: {
        workspaceId: 'ws_1',
        title: '测试工作区1',
        description: 'Private notes',
        memories: [],
        rootPath: '/Users/example/Workspace',
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

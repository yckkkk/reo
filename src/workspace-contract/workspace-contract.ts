import { z } from 'zod';
import { MAX_RECORDING_DRAFT_AUDIO_READ_BYTES } from './recording-audio.js';
import { isSafeWorkspaceDirectoryName } from './workspace-name.js';
import { WORKSPACE_TITLE_MAX_LENGTH } from './workspace-title.js';

export * from './workspace-channels.js';

export const MEMORY_ID_PATTERN = /^mem_[A-Za-z0-9_-]+$/;
export const SEGMENT_ID_PATTERN = /^seg_[A-Za-z0-9_-]+$/;

const memoryIdSchema = z.string().regex(MEMORY_ID_PATTERN);
const segmentIdSchema = z.string().regex(SEGMENT_ID_PATTERN);
const workspaceTitleTextSchema = z.string().trim().min(1).max(WORKSPACE_TITLE_MAX_LENGTH);

export const workspaceNoInputSchema = z.undefined();

export const workspaceChooseDirectoryResultSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('selected'),
    selectionToken: z.string().min(1),
    displayPath: z
      .string()
      .min(1)
      .refine((value) => !value.includes('/') && !value.includes('\\')),
  }),
  z.strictObject({
    status: z.literal('canceled'),
  }),
]);

export const workspaceErrorCodeSchema = z.enum([
  'ERR_WORKSPACE_INVALID_REQUEST',
  'ERR_WORKSPACE_UNTRUSTED_SENDER',
  'ERR_WORKSPACE_SELECTION_NOT_FOUND',
  'ERR_WORKSPACE_SELECTION_EXPIRED',
  'ERR_WORKSPACE_SELECTION_SENDER_MISMATCH',
  'ERR_WORKSPACE_CHOOSE_FAILED',
  'ERR_WORKSPACE_MEMORY_SPACE_NOT_FOUND',
  'ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_READ_FAILED',
  'ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_WRITE_FAILED',
  'ERR_WORKSPACE_ROOT_MISSING',
  'ERR_WORKSPACE_UNSAFE_PATH',
  'ERR_WORKSPACE_ALREADY_EXISTS',
  'ERR_WORKSPACE_AGENTS_CONFLICT',
  'ERR_WORKSPACE_METADATA_INVALID',
  'ERR_WORKSPACE_LOCKED',
  'ERR_WORKSPACE_LOCK_FAILED',
  'ERR_WORKSPACE_LOCK_LOST',
  'ERR_WORKSPACE_HANDLE_NOT_FOUND',
  'ERR_WORKSPACE_HANDLE_UNTRUSTED',
  'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
  'ERR_WORKSPACE_INIT_FAILED',
  'ERR_WORKSPACE_OPEN_FAILED',
  'ERR_RECORDING_INVALID_ID',
  'ERR_RECORDING_NOT_FOUND',
  'ERR_RECORDING_SEQUENCE',
  'ERR_RECORDING_APPEND_FAILED',
  'ERR_RECORDING_APPEND_IN_FLIGHT',
  'ERR_RECORDING_CHUNK_TOO_LARGE',
  'ERR_RECORDING_FINALIZED',
  'ERR_RECORDING_AUDIO_MISSING',
  'ERR_RECORDING_INVALID_RANGE',
  'ERR_RECORDING_FINALIZE_FAILED',
  'ERR_RECORDING_TRANSCRIPTION_UNAVAILABLE',
  'ERR_RECORDING_TRANSCRIPTION_FAILED',
  'ERR_WORKSPACE_INDEX_WRITE_FAILED',
  'ERR_MEMORY_NOT_FOUND',
  'ERR_MEMORY_CREATE_FAILED',
  'ERR_MEMORY_UPDATE_FAILED',
  'ERR_MIC_INTENT_ALREADY_ACTIVE',
]);

export const workspaceErrorSchema = z.strictObject({
  code: workspaceErrorCodeSchema,
  message: z.string().min(1),
  dataRetention: z
    .enum([
      'none-written',
      'previous-file-preserved',
      'draft-preserved',
      'durable-marker-recovery-required',
      'file-written-index-stale',
      'unknown',
    ])
    .optional(),
});

export const workspaceErrorEnvelopeSchema = z.strictObject({
  ok: z.literal(false),
  error: workspaceErrorSchema,
});

export const workspaceChooseDirectoryResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: workspaceChooseDirectoryResultSchema,
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceMemorySummarySchema = z.strictObject({
  memoryId: memoryIdSchema,
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  segmentCount: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  audioByteLength: z.number().int().nonnegative(),
  hasTranscript: z.boolean(),
  attachmentCount: z.number().int().nonnegative(),
});

export const workspaceSnapshotSchema = z.strictObject({
  workspaceId: z.string().min(1),
  title: z.string(),
  description: z.string(),
  memories: z.array(workspaceMemorySummarySchema),
});

export const workspaceInitializeRequestSchema = z.strictObject({
  selectionToken: z.string().min(1),
  title: z
    .string()
    .trim()
    .min(1)
    .refine(isSafeWorkspaceDirectoryName, 'Workspace title must be a safe folder name'),
  description: z.string(),
});

export const workspaceOpenRequestSchema = z.strictObject({
  selectionToken: z.string().min(1),
});

export const workspaceMemorySpaceIdRequestSchema = z.strictObject({
  workspaceId: z.string().min(1),
});

export const workspaceOpenMemorySpaceRequestSchema = workspaceMemorySpaceIdRequestSchema;
export const workspaceRemoveMemorySpaceRequestSchema = workspaceMemorySpaceIdRequestSchema;

export const workspaceCloseRequestSchema = z.strictObject({
  workspaceHandle: z.string().min(1),
});

export const workspaceInitializeResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      workspaceHandle: z.string().min(1),
      workspaceId: z.string().min(1),
      snapshot: workspaceSnapshotSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceMemorySpaceSchema = z.strictObject({
  workspaceId: z.string().min(1),
  title: z.string(),
  description: z.string(),
  addedAt: z.string(),
  lastOpenedAt: z.string(),
});

export const workspaceListMemorySpacesResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memorySpaces: z.array(workspaceMemorySpaceSchema),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceCloseResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      closed: z.literal(true),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceRemoveMemorySpaceResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      removed: z.literal(true),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceClearMicrophoneIntentResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      cleared: z.literal(true),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const draftSegmentMetadataSchema = z.strictObject({
  schemaVersion: z.literal(1),
  workspaceId: z.string().min(1),
  segmentId: z.string().regex(SEGMENT_ID_PATTERN),
  type: z.literal('audio'),
  status: z.literal('draft'),
  title: z.string(),
  createdAt: z.string(),
  nextSequence: z.number().int().nonnegative(),
  audioByteLength: z.number().int().nonnegative(),
});

export const finalizedSegmentMetadataSchema = z.strictObject({
  schemaVersion: z.literal(1),
  workspaceId: z.string().min(1),
  segmentId: z.string().regex(SEGMENT_ID_PATTERN),
  memoryId: z.string().regex(MEMORY_ID_PATTERN),
  type: z.literal('audio'),
  status: z.literal('finalized'),
  title: z.string(),
  createdAt: z.string(),
  finalizedAt: z.string(),
  durationMs: z.number().int().nonnegative(),
  nextSequence: z.number().int().nonnegative(),
  audioByteLength: z.number().int().nonnegative(),
  transcriptPath: z.literal('transcript.md'),
});

export const segmentMetadataSchema = z.discriminatedUnion('status', [
  draftSegmentMetadataSchema,
  finalizedSegmentMetadataSchema,
]);

export const workspaceHandleRequestSchema = z.strictObject({
  workspaceHandle: z.string().min(1),
});

const workspaceHandleSchema = workspaceHandleRequestSchema;
export const workspaceMemoryTitleSchema = workspaceTitleTextSchema;
export const workspaceRecordingTitleSchema = workspaceTitleTextSchema;

export const workspaceRecordingAppendRequestSchema = workspaceHandleSchema
  .extend({
    segmentId: segmentIdSchema,
    sequence: z.number().int().nonnegative(),
    chunk: z.instanceof(Uint8Array).refine((chunk) => chunk.byteLength <= 1_048_576),
  })
  .strict();

export const workspaceRecordingDraftPrefixCloneRequestSchema = workspaceHandleSchema
  .extend({
    sourceSegmentId: segmentIdSchema,
    targetSegmentId: segmentIdSchema,
    retainedByteLength: z.number().int().nonnegative(),
    nextSequence: z.number().int().nonnegative(),
  })
  .strict()
  .refine((request) => request.sourceSegmentId !== request.targetSegmentId, {
    message: 'Replacement draft source and target must be different',
  });

export const workspaceSegmentIdRequestSchema = workspaceHandleSchema
  .extend({
    segmentId: segmentIdSchema,
  })
  .strict();

export const workspaceRecordingDraftAudioRequestSchema = workspaceSegmentIdRequestSchema
  .extend({
    maxBytes: z.number().int().positive().max(MAX_RECORDING_DRAFT_AUDIO_READ_BYTES).optional(),
  })
  .strict();

export const workspaceRecordingReadRequestSchema = workspaceSegmentIdRequestSchema
  .extend({
    memoryId: memoryIdSchema,
  })
  .strict();

export const workspaceMemoryIdRequestSchema = workspaceHandleSchema
  .extend({
    memoryId: memoryIdSchema,
  })
  .strict();

export const workspaceUpdateMemoryTitleRequestSchema = workspaceMemoryIdRequestSchema
  .extend({
    title: workspaceMemoryTitleSchema,
  })
  .strict();

export const workspaceCreateMemoryRequestSchema = workspaceHandleSchema
  .extend({
    title: workspaceMemoryTitleSchema,
  })
  .strict();

export const workspaceUpdateMemoryTitleResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: workspaceMemorySummarySchema,
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceCreateMemoryResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: workspaceMemorySummarySchema,
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceCreateRecordingDraftResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      segmentId: segmentIdSchema,
      nextSequence: z.number().int().nonnegative(),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceRecordingDraftAudioResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      audio: z.instanceof(Uint8Array),
      audioByteLength: z.number().int().nonnegative(),
      nextSequence: z.number().int().nonnegative(),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceRecordingAppendResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      nextSequence: z.number().int().nonnegative(),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceRecordingDraftPrefixCloneResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      audioByteLength: z.number().int().nonnegative(),
      nextSequence: z.number().int().nonnegative(),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceRecordingFinalizeResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      segment: z.strictObject({
        memoryId: memoryIdSchema,
        segmentId: segmentIdSchema,
        type: z.literal('audio'),
        title: z.string(),
        durationMs: z.number().int().nonnegative(),
        audioByteLength: z.number().int().nonnegative(),
      }),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceDiscardRecordingDraftResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      discarded: z.literal(true),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceRecordingMarkdownSaveResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      saved: z.literal(true),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceMicrophoneIntentRequestSchema = workspaceHandleSchema
  .extend({
    recordingFlowSessionId: z.string().min(1),
  })
  .strict();

const recordingTranscriptionSessionSchema = workspaceHandleSchema
  .extend({
    recordingFlowSessionId: z.string().min(1),
    recordingSessionId: z.string().min(1),
    revisionId: z.string().min(1),
  })
  .strict();

export const workspaceRecordingTranscriptionStartRequestSchema = recordingTranscriptionSessionSchema
  .extend({
    timeOffsetMs: z.number().int().nonnegative(),
  })
  .strict();

export const workspaceRecordingTranscriptionAudioRequestSchema = recordingTranscriptionSessionSchema
  .extend({
    chunk: z.instanceof(Uint8Array).refine((chunk) => chunk.byteLength <= 65_536),
  })
  .strict();

export const workspaceRecordingTranscriptionCloseRequestSchema =
  recordingTranscriptionSessionSchema;

export const workspaceTranscriptSegmentSchema = z.strictObject({
  endTimeMs: z.number().int().nonnegative(),
  isFinal: z.boolean(),
  recordingSessionId: z.string().min(1),
  revisionId: z.string().min(1),
  startTimeMs: z.number().int().nonnegative(),
  text: z.string().trim().min(1),
});

export const workspaceRecordingTranscriptionControlResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      accepted: z.boolean(),
      segments: z.array(workspaceTranscriptSegmentSchema).optional(),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceRecordingTranscriptionEventSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('segments'),
    recordingSessionId: z.string().min(1),
    revisionId: z.string().min(1),
    segments: z.array(workspaceTranscriptSegmentSchema),
  }),
  z.strictObject({
    kind: z.literal('error'),
    message: z.string().min(1),
    recordingSessionId: z.string().min(1),
    revisionId: z.string().min(1),
  }),
  z.strictObject({
    kind: z.literal('closed'),
    recordingSessionId: z.string().min(1),
    revisionId: z.string().min(1),
  }),
]);

export const workspaceRecordingFinalizeRequestSchema = workspaceSegmentIdRequestSchema
  .extend({
    memoryId: memoryIdSchema,
    title: workspaceRecordingTitleSchema,
    durationMs: z.number().int().nonnegative(),
  })
  .strict();

export const workspaceRecordingMarkdownSaveRequestSchema = workspaceRecordingReadRequestSchema
  .extend({
    markdown: z.string(),
  })
  .strict();

export const workspaceMicrophoneIntentResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      registered: z.literal(true),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export type WorkspaceErrorCode = z.infer<typeof workspaceErrorCodeSchema>;
export type WorkspaceError = z.infer<typeof workspaceErrorSchema>;
export type WorkspaceErrorEnvelope = z.infer<typeof workspaceErrorEnvelopeSchema>;
export type WorkspaceChooseDirectoryResult = z.infer<typeof workspaceChooseDirectoryResultSchema>;
export type WorkspaceChooseDirectoryResponse = z.infer<
  typeof workspaceChooseDirectoryResponseSchema
>;
export type DraftSegmentMetadata = z.infer<typeof draftSegmentMetadataSchema>;
export type FinalizedSegmentMetadata = z.infer<typeof finalizedSegmentMetadataSchema>;
export type SegmentMetadata = z.infer<typeof segmentMetadataSchema>;
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;
export type WorkspaceMemorySummary = z.infer<typeof workspaceMemorySummarySchema>;
export type WorkspaceMemorySpace = z.infer<typeof workspaceMemorySpaceSchema>;
export type WorkspaceHandleRequest = z.infer<typeof workspaceHandleRequestSchema>;
export type WorkspaceInitializeRequest = z.infer<typeof workspaceInitializeRequestSchema>;
export type WorkspaceInitializeResponse = z.infer<typeof workspaceInitializeResponseSchema>;
export type WorkspaceOpenRequest = z.infer<typeof workspaceOpenRequestSchema>;
export type WorkspaceMemorySpaceIdRequest = z.infer<typeof workspaceMemorySpaceIdRequestSchema>;
export type WorkspaceCloseRequest = z.infer<typeof workspaceCloseRequestSchema>;
export type WorkspaceListMemorySpacesResponse = z.infer<
  typeof workspaceListMemorySpacesResponseSchema
>;
export type WorkspaceCloseResponse = z.infer<typeof workspaceCloseResponseSchema>;
export type WorkspaceRemoveMemorySpaceResponse = z.infer<
  typeof workspaceRemoveMemorySpaceResponseSchema
>;
export type WorkspaceClearMicrophoneIntentResponse = z.infer<
  typeof workspaceClearMicrophoneIntentResponseSchema
>;
type WorkspaceRecordingAppendRequestFromSchema = z.infer<
  typeof workspaceRecordingAppendRequestSchema
>;
export type WorkspaceRecordingAppendRequest = Omit<
  WorkspaceRecordingAppendRequestFromSchema,
  'chunk'
> & {
  readonly chunk: Uint8Array<ArrayBufferLike>;
};
export type WorkspaceRecordingDraftPrefixCloneRequest = z.infer<
  typeof workspaceRecordingDraftPrefixCloneRequestSchema
>;
export type WorkspaceSegmentIdRequest = z.infer<typeof workspaceSegmentIdRequestSchema>;
export type WorkspaceRecordingDraftAudioRequest = z.infer<
  typeof workspaceRecordingDraftAudioRequestSchema
>;
export type WorkspaceUpdateMemoryTitleRequest = z.infer<
  typeof workspaceUpdateMemoryTitleRequestSchema
>;
export type WorkspaceCreateMemoryRequest = z.infer<typeof workspaceCreateMemoryRequestSchema>;
export type WorkspaceUpdateMemoryTitleResponse = z.infer<
  typeof workspaceUpdateMemoryTitleResponseSchema
>;
export type WorkspaceCreateMemoryResponse = z.infer<typeof workspaceCreateMemoryResponseSchema>;
export type WorkspaceCreateRecordingDraftResponse = z.infer<
  typeof workspaceCreateRecordingDraftResponseSchema
>;
export type WorkspaceRecordingDraftAudioResponse = z.infer<
  typeof workspaceRecordingDraftAudioResponseSchema
>;
export type WorkspaceRecordingAppendResponse = z.infer<
  typeof workspaceRecordingAppendResponseSchema
>;
export type WorkspaceRecordingDraftPrefixCloneResponse = z.infer<
  typeof workspaceRecordingDraftPrefixCloneResponseSchema
>;
export type WorkspaceRecordingFinalizeResponse = z.infer<
  typeof workspaceRecordingFinalizeResponseSchema
>;
export type WorkspaceDiscardRecordingDraftResponse = z.infer<
  typeof workspaceDiscardRecordingDraftResponseSchema
>;
export type WorkspaceRecordingMarkdownSaveResponse = z.infer<
  typeof workspaceRecordingMarkdownSaveResponseSchema
>;
export type WorkspaceMicrophoneIntentRequest = z.infer<
  typeof workspaceMicrophoneIntentRequestSchema
>;
export type WorkspaceTranscriptSegment = z.infer<typeof workspaceTranscriptSegmentSchema>;
export type WorkspaceRecordingTranscriptionStartRequest = z.infer<
  typeof workspaceRecordingTranscriptionStartRequestSchema
>;
type WorkspaceRecordingTranscriptionAudioRequestFromSchema = z.infer<
  typeof workspaceRecordingTranscriptionAudioRequestSchema
>;
export type WorkspaceRecordingTranscriptionAudioRequest = Omit<
  WorkspaceRecordingTranscriptionAudioRequestFromSchema,
  'chunk'
> & {
  readonly chunk: Uint8Array<ArrayBufferLike>;
};
export type WorkspaceRecordingTranscriptionCloseRequest = z.infer<
  typeof workspaceRecordingTranscriptionCloseRequestSchema
>;
export type WorkspaceRecordingTranscriptionControlResponse = z.infer<
  typeof workspaceRecordingTranscriptionControlResponseSchema
>;
export type WorkspaceRecordingTranscriptionEvent = z.infer<
  typeof workspaceRecordingTranscriptionEventSchema
>;
export type WorkspaceRecordingFinalizeRequest = z.infer<
  typeof workspaceRecordingFinalizeRequestSchema
>;
export type WorkspaceRecordingMarkdownSaveRequest = z.infer<
  typeof workspaceRecordingMarkdownSaveRequestSchema
>;
export type WorkspaceMicrophoneIntentResponse = z.infer<
  typeof workspaceMicrophoneIntentResponseSchema
>;

export function workspaceError(
  code: WorkspaceErrorCode,
  message: string,
  dataRetention?: WorkspaceError['dataRetention']
): WorkspaceErrorEnvelope {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(dataRetention ? { dataRetention } : {}),
    },
  };
}

export { isSafeWorkspaceDirectoryName } from './workspace-name.js';
export { WORKSPACE_TITLE_MAX_LENGTH } from './workspace-title.js';

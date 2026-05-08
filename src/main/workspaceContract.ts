import { z } from 'zod';
import { MEMORY_ID_PATTERN, RECORDING_ID_PATTERN } from './recordingMetadata.js';
import { isSafeWorkspaceDirectoryName } from './workspaceName.js';
export {
  WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_CHOOSE_DIRECTORY_CHANNEL,
  WORKSPACE_CLOSE_CHANNEL,
  WORKSPACE_BEGIN_MICROPHONE_INTENT_CHANNEL,
  WORKSPACE_CLEAR_MICROPHONE_INTENT_CHANNEL,
  WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_GET_MEMORY_DETAIL_CHANNEL,
  WORKSPACE_GET_RECORDING_DETAIL_CHANNEL,
  WORKSPACE_INITIALIZE_CHANNEL,
  WORKSPACE_IPC_CHANNELS,
  WORKSPACE_LIST_MEMORY_SPACES_CHANNEL,
  WORKSPACE_OPEN_CHANNEL,
  WORKSPACE_OPEN_MEMORY_SPACE_CHANNEL,
  WORKSPACE_REMOVE_MEMORY_SPACE_CHANNEL,
  WORKSPACE_READ_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_READ_RECORDING_AUDIO_MANIFEST_CHANNEL,
  WORKSPACE_SAVE_REFLECTIONS_CHANNEL,
  WORKSPACE_SAVE_TRANSCRIPT_CHANNEL,
  type WorkspaceIpcChannel,
} from './workspaceChannels.js';

export const workspaceNoInputSchema = z.undefined();

export const workspaceChooseDirectoryResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('selected'),
    selectionToken: z.string().min(1),
    displayPath: z
      .string()
      .min(1)
      .refine((value) => !value.includes('/') && !value.includes('\\')),
  }),
  z.object({
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
  'ERR_WORKSPACE_INDEX_WRITE_FAILED',
  'ERR_MEMORY_NOT_FOUND',
  'ERR_MIC_INTENT_ALREADY_ACTIVE',
]);

export const workspaceErrorSchema = z.object({
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

export const workspaceErrorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: workspaceErrorSchema,
});

export const workspaceChooseDirectoryResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    value: workspaceChooseDirectoryResultSchema,
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceRecordingSummarySchema = z.object({
  recordingId: z.string().min(1),
  title: z.string(),
  audioByteLength: z.number().int().nonnegative(),
});

export const workspaceMemorySummarySchema = z.object({
  memoryId: z.string().min(1),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  recordingCount: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  audioByteLength: z.number().int().nonnegative(),
  hasTranscript: z.boolean(),
  hasReflections: z.boolean(),
});

export const workspaceSnapshotSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string(),
  description: z.string(),
  memories: z.array(workspaceMemorySummarySchema),
  recordings: z.array(workspaceRecordingSummarySchema),
});

export const workspaceInitializeRequestSchema = z
  .object({
    selectionToken: z.string().min(1),
    title: z
      .string()
      .trim()
      .min(1)
      .refine(isSafeWorkspaceDirectoryName, 'Workspace title must be a safe folder name'),
    description: z.string(),
  })
  .strict();

export const workspaceOpenRequestSchema = z
  .object({
    selectionToken: z.string().min(1),
  })
  .strict();

export const workspaceMemorySpaceIdRequestSchema = z
  .object({
    workspaceId: z.string().min(1),
  })
  .strict();

export const workspaceOpenMemorySpaceRequestSchema = workspaceMemorySpaceIdRequestSchema;

export const workspaceRemoveMemorySpaceRequestSchema = workspaceMemorySpaceIdRequestSchema;

export const workspaceCloseRequestSchema = z
  .object({
    workspaceHandle: z.string().min(1),
  })
  .strict();

export const workspaceInitializeResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    value: z.object({
      workspaceHandle: z.string().min(1),
      workspaceId: z.string().min(1),
      snapshot: workspaceSnapshotSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceMemorySpaceSchema = z
  .object({
    workspaceId: z.string().min(1),
    title: z.string(),
    description: z.string(),
    addedAt: z.string(),
    lastOpenedAt: z.string(),
  })
  .strict();

export const workspaceListMemorySpacesResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    value: z.object({
      memorySpaces: z.array(workspaceMemorySpaceSchema),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceGenericOkResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    value: z.record(z.string(), z.boolean()),
  }),
  workspaceErrorEnvelopeSchema,
]);

const workspaceHandleSchema = z.object({
  workspaceHandle: z.string().min(1),
});

const recordingIdSchema = z.string().regex(RECORDING_ID_PATTERN);
const memoryIdSchema = z.string().regex(MEMORY_ID_PATTERN);

export const workspaceRecordingAppendRequestSchema = workspaceHandleSchema
  .extend({
    recordingId: recordingIdSchema,
    sequence: z.number().int().nonnegative(),
    chunk: z.instanceof(Uint8Array).refine((chunk) => chunk.byteLength <= 1_048_576),
  })
  .strict();

export const workspaceRecordingIdRequestSchema = workspaceHandleSchema
  .extend({
    recordingId: recordingIdSchema,
  })
  .strict();

export const workspaceRecordingReadRequestSchema = workspaceRecordingIdRequestSchema
  .extend({
    memoryId: memoryIdSchema,
  })
  .strict();

export const workspaceMemoryIdRequestSchema = workspaceHandleSchema
  .extend({
    memoryId: memoryIdSchema,
  })
  .strict();

export const workspaceMemoryRecordingSummarySchema = z.object({
  recordingId: recordingIdSchema,
  title: z.string(),
  durationMs: z.number().int().nonnegative(),
  audioByteLength: z.number().int().nonnegative(),
});

export const workspaceMemoryDetailResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    value: z.object({
      memoryId: memoryIdSchema,
      title: z.string(),
      sourceKind: z.literal('recording'),
      createdAt: z.string(),
      updatedAt: z.string(),
      recordingIds: z.array(recordingIdSchema),
      recordingCount: z.number().int().nonnegative(),
      recordingsTruncated: z.boolean(),
      hasTranscript: z.boolean(),
      hasReflections: z.boolean(),
      recordings: z.array(workspaceMemoryRecordingSummarySchema),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceMicrophoneIntentRequestSchema = workspaceHandleSchema
  .extend({
    drawerSessionId: z.string().min(1),
  })
  .strict();

export const workspaceRecordingFinalizeRequestSchema = workspaceRecordingIdRequestSchema
  .extend({
    memoryId: memoryIdSchema.optional(),
    title: z.string().trim().min(1),
    durationMs: z.number().int().nonnegative(),
  })
  .strict();

export const workspaceRecordingAudioChunkRequestSchema = workspaceRecordingReadRequestSchema
  .extend({
    offset: z.number().int().nonnegative(),
    length: z.number().int().positive().max(1_048_576),
  })
  .strict();

export const workspaceRecordingMarkdownSaveRequestSchema = workspaceRecordingReadRequestSchema
  .extend({
    markdown: z.string(),
  })
  .strict();

export const workspaceMicrophoneIntentResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    value: z.object({
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
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;
export type WorkspaceInitializeRequest = z.infer<typeof workspaceInitializeRequestSchema>;
export type WorkspaceInitializeResponse = z.infer<typeof workspaceInitializeResponseSchema>;

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

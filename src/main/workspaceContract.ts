import { z } from 'zod';
export {
  WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_CHOOSE_DIRECTORY_CHANNEL,
  WORKSPACE_CLOSE_CHANNEL,
  WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_GET_RECORDING_DETAIL_CHANNEL,
  WORKSPACE_INITIALIZE_CHANNEL,
  WORKSPACE_IPC_CHANNELS,
  WORKSPACE_OPEN_CHANNEL,
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
  'ERR_WORKSPACE_UNSAFE_PATH',
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
  'ERR_RECORDING_APPEND_IN_FLIGHT',
  'ERR_RECORDING_CHUNK_TOO_LARGE',
  'ERR_RECORDING_AUDIO_MISSING',
  'ERR_RECORDING_INVALID_RANGE',
  'ERR_RECORDING_FINALIZE_FAILED',
]);

export const workspaceErrorSchema = z.object({
  code: workspaceErrorCodeSchema,
  message: z.string().min(1),
  dataRetention: z
    .enum(['none-written', 'previous-file-preserved', 'draft-preserved', 'unknown'])
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

export const workspaceSnapshotSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string(),
  description: z.string(),
  recordings: z.array(workspaceRecordingSummarySchema),
});

export const workspaceInitializeRequestSchema = z
  .object({
    selectionToken: z.string().min(1),
    title: z.string().trim().min(1),
    description: z.string(),
  })
  .strict();

export const workspaceOpenRequestSchema = z
  .object({
    selectionToken: z.string().min(1),
  })
  .strict();

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

const recordingIdSchema = z.string().regex(/^rec_[A-Za-z0-9_-]+$/);

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

export const workspaceRecordingFinalizeRequestSchema = workspaceRecordingIdRequestSchema
  .extend({
    title: z.string().trim().min(1),
  })
  .strict();

export const workspaceRecordingAudioChunkRequestSchema = workspaceRecordingIdRequestSchema
  .extend({
    offset: z.number().int().nonnegative(),
    length: z.number().int().positive().max(1_048_576),
  })
  .strict();

export const workspaceRecordingMarkdownSaveRequestSchema = workspaceRecordingIdRequestSchema
  .extend({
    markdown: z.string(),
  })
  .strict();

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

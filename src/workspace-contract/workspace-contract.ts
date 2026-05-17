import { z } from 'zod';
import { MAX_RECORDING_DRAFT_AUDIO_READ_BYTES } from './recording-audio.js';
import { isSafeWorkspaceDirectoryName } from './workspace-name.js';
import { WORKSPACE_TITLE_MAX_LENGTH } from './workspace-title.js';

export * from './workspace-channels.js';

export const MEMORY_ID_PATTERN = /^mem_[A-Za-z0-9_-]+$/;
export const SEGMENT_ID_PATTERN = /^seg_[A-Za-z0-9_-]+$/;
export const SUPPLEMENT_ID_PATTERN = /^sup_[A-Za-z0-9_-]+$/;

const memoryIdSchema = z.string().regex(MEMORY_ID_PATTERN);
const segmentIdSchema = z.string().regex(SEGMENT_ID_PATTERN);
const supplementIdSchema = z.string().regex(SUPPLEMENT_ID_PATTERN);
export const LAST_TRANSCRIPTION_ATTEMPTS = ['success', 'failed', 'never'] as const;
export type LastTranscriptionAttempt = (typeof LAST_TRANSCRIPTION_ATTEMPTS)[number];
export const lastTranscriptionAttemptSchema = z.enum(LAST_TRANSCRIPTION_ATTEMPTS);
export const FINALIZE_TRANSCRIPTION_ATTEMPTS = [
  'failed',
  'never',
] as const satisfies readonly LastTranscriptionAttempt[];
export type FinalizeTranscriptionAttempt = (typeof FINALIZE_TRANSCRIPTION_ATTEMPTS)[number];
const finalizeTranscriptionAttemptSchema = z.enum(FINALIZE_TRANSCRIPTION_ATTEMPTS);
const workspaceTitleTextSchema = z.string().trim().min(1).max(WORKSPACE_TITLE_MAX_LENGTH);
const workspaceMemorySpaceTitleSchema = workspaceTitleTextSchema.refine(
  isSafeWorkspaceDirectoryName,
  'Workspace title must be a safe folder name'
);

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
  'ERR_WORKSPACE_MEMORY_NOT_FOUND',
  'ERR_WORKSPACE_SEGMENT_NOT_FOUND',
  'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND',
  'ERR_MEMORY_SPACE_AGENTS_FILE_MISSING',
  'ERR_ENTITY_DOCUMENT_MISSING',
  'ERR_SHELL_OPEN_FAILED',
  'ERR_CLIPBOARD_WRITE_FAILED',
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
  'ERR_WORKSPACE_UPDATE_FAILED',
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
  'ERR_VOICE_SETTINGS_STORAGE_UNAVAILABLE',
  'ERR_VOICE_SETTINGS_WRITE_FAILED',
  'ERR_VOICE_TRANSCRIPTION_PROBE_FAILED',
  'ERR_VOICE_TRANSCRIPTION_PROVIDER_CONSOLE_REJECTED',
  'ERR_WORKSPACE_INDEX_WRITE_FAILED',
  'ERR_MEMORY_NOT_FOUND',
  'ERR_MEMORY_CREATE_FAILED',
  'ERR_MEMORY_UPDATE_FAILED',
  'ERR_MEMORY_DELETE_FAILED',
  'ERR_MEMORY_RESTORE_FAILED',
  'ERR_SEGMENT_DELETE_FAILED',
  'ERR_SEGMENT_RESTORE_FAILED',
  'ERR_SEGMENT_RESTORE_PARENT_MISSING',
  'ERR_SEGMENT_SUPPLEMENT_DELETE_FAILED',
  'ERR_SEGMENT_SUPPLEMENT_RESTORE_FAILED',
  'ERR_SEGMENT_SUPPLEMENT_RESTORE_PARENT_MISSING',
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

export const voiceTranscriptionSettingsSnapshotSchema = z.strictObject({
  enabled: z.boolean(),
  apiKeyConfigured: z.boolean(),
  apiKeyLastFour: z.string().length(4).nullable(),
  lastValidatedAt: z.string().nullable(),
  lastValidationOk: z.boolean().nullable(),
  lastValidationCode: z.enum(['ok', 'auth', 'network']).nullable(),
});

const voiceTranscriptionSettingsResponseValueSchema = z.strictObject({
  settings: voiceTranscriptionSettingsSnapshotSchema,
});

export const workspaceReadVoiceTranscriptionSettingsRequestSchema = workspaceNoInputSchema;

export const workspaceReadVoiceTranscriptionSettingsResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: voiceTranscriptionSettingsResponseValueSchema,
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceSetVoiceTranscriptionEnabledRequestSchema = z.strictObject({
  enabled: z.boolean(),
});

export const workspaceSetVoiceTranscriptionEnabledResponseSchema =
  workspaceReadVoiceTranscriptionSettingsResponseSchema;

export const workspaceSaveVoiceTranscriptionApiKeyRequestSchema = z.strictObject({
  apiKey: z.string().min(4).max(1024),
});

export const workspaceSaveVoiceTranscriptionApiKeyResponseSchema =
  workspaceReadVoiceTranscriptionSettingsResponseSchema;

export const workspaceClearVoiceTranscriptionApiKeyRequestSchema = workspaceNoInputSchema;

export const workspaceClearVoiceTranscriptionApiKeyResponseSchema =
  workspaceReadVoiceTranscriptionSettingsResponseSchema;

export const workspaceValidateVoiceTranscriptionCredentialsRequestSchema = workspaceNoInputSchema;

export const workspaceValidateVoiceTranscriptionCredentialsResponseSchema = z.discriminatedUnion(
  'ok',
  [
    z.strictObject({
      ok: z.literal(true),
      value: z.strictObject({
        code: z.enum(['ok', 'auth', 'network']),
        message: z.string().optional(),
      }),
    }),
    workspaceErrorEnvelopeSchema,
  ]
);

export const workspaceOpenVoiceTranscriptionProviderConsoleRequestSchema = workspaceNoInputSchema;

export const workspaceOpenVoiceTranscriptionProviderConsoleResponseSchema = z.discriminatedUnion(
  'ok',
  [
    z.strictObject({
      ok: z.literal(true),
      value: z.strictObject({}),
    }),
    workspaceErrorEnvelopeSchema,
  ]
);

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
  supplementCount: z.number().int().nonnegative(),
});

export const workspaceSegmentSupplementProjectionSchema = z.strictObject({
  workspaceId: z.string().min(1),
  memoryId: memoryIdSchema,
  segmentId: segmentIdSchema,
  supplementId: supplementIdSchema,
  type: z.literal('audio'),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  durationMs: z.number().int().nonnegative(),
  audioByteLength: z.number().int().nonnegative(),
  lastTranscriptionAttempt: lastTranscriptionAttemptSchema,
  transcript: z.strictObject({
    exists: z.boolean(),
  }),
});

export const workspaceSegmentProjectionSchema = z.strictObject({
  workspaceId: z.string().min(1),
  memoryId: memoryIdSchema,
  segmentId: segmentIdSchema,
  type: z.literal('audio'),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  durationMs: z.number().int().nonnegative(),
  audioByteLength: z.number().int().nonnegative(),
  lastTranscriptionAttempt: lastTranscriptionAttemptSchema,
  transcript: z.strictObject({
    exists: z.boolean(),
  }),
  supplementCount: z.number().int().nonnegative(),
  supplements: z.array(workspaceSegmentSupplementProjectionSchema),
});

export const workspaceMemoryDetailProjectionSchema = workspaceMemorySummarySchema.extend({
  workspaceId: z.string().min(1),
  segments: z.array(workspaceSegmentProjectionSchema),
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

export const workspaceUpdateMemorySpaceTitleResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: workspaceSnapshotSchema,
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

export const draftSegmentSupplementMetadataSchema = z.strictObject({
  schemaVersion: z.literal(1),
  workspaceId: z.string().min(1),
  memoryId: memoryIdSchema,
  segmentId: segmentIdSchema,
  supplementId: supplementIdSchema,
  type: z.literal('audio'),
  status: z.literal('draft'),
  title: z.string(),
  createdAt: z.string(),
  nextSequence: z.number().int().nonnegative(),
  audioByteLength: z.number().int().nonnegative(),
});

export const workspaceHandleRequestSchema = z.strictObject({
  workspaceHandle: z.string().min(1),
});

const workspaceHandleSchema = workspaceHandleRequestSchema;
export const workspaceReadWorkspaceSnapshotRequestSchema = workspaceHandleSchema;

export const workspaceReadWorkspaceSnapshotResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: workspaceSnapshotSchema,
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceUpdateActiveMemorySpaceTitleRequestSchema = workspaceHandleSchema
  .extend({
    title: workspaceMemorySpaceTitleSchema,
  })
  .strict();

export const workspaceUpdateRegisteredMemorySpaceTitleRequestSchema =
  workspaceMemorySpaceIdRequestSchema
    .extend({
      title: workspaceMemorySpaceTitleSchema,
    })
    .strict();

export const workspaceUpdateMemorySpaceTitleRequestSchema = z.union([
  workspaceUpdateActiveMemorySpaceTitleRequestSchema,
  workspaceUpdateRegisteredMemorySpaceTitleRequestSchema,
]);

export const workspaceMemoryTitleSchema = workspaceTitleTextSchema;
export const workspaceRecordingTitleSchema = workspaceTitleTextSchema;

export const workspaceRecordingAppendRequestSchema = workspaceHandleSchema
  .extend({
    segmentId: segmentIdSchema,
    sequence: z.number().int().nonnegative(),
    chunk: z.instanceof(Uint8Array).refine((chunk) => chunk.byteLength <= 1_048_576),
  })
  .strict();

export const workspaceCreateSegmentSupplementRecordingDraftRequestSchema = workspaceHandleSchema
  .extend({
    workspaceId: z.string().min(1),
    memoryId: memoryIdSchema,
    segmentId: segmentIdSchema,
  })
  .strict();

export const workspaceAppendSegmentSupplementRecordingAudioRequestSchema = workspaceHandleSchema
  .extend({
    supplementId: supplementIdSchema,
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

export const workspaceSegmentSupplementIdRequestSchema = workspaceHandleSchema
  .extend({
    supplementId: supplementIdSchema,
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

export const workspaceUpdateSegmentTitleRequestSchema = workspaceMemoryIdRequestSchema
  .extend({
    workspaceId: z.string().min(1),
    segmentId: segmentIdSchema,
    title: workspaceRecordingTitleSchema,
  })
  .strict();

export const workspaceUpdateSegmentSupplementTitleRequestSchema = workspaceMemoryIdRequestSchema
  .extend({
    workspaceId: z.string().min(1),
    segmentId: segmentIdSchema,
    supplementId: supplementIdSchema,
    title: workspaceRecordingTitleSchema,
  })
  .strict();

export const workspaceCreateMemoryRequestSchema = workspaceHandleSchema
  .extend({
    title: workspaceMemoryTitleSchema,
  })
  .strict();

export const workspaceDeleteMemoryRequestSchema = workspaceMemoryIdRequestSchema;

export const workspaceRestoreDeletedMemoryRequestSchema = workspaceHandleSchema
  .extend({
    restoreToken: memoryIdSchema,
  })
  .strict();

export const workspaceDeleteSegmentRequestSchema = workspaceMemoryIdRequestSchema
  .extend({
    workspaceId: z.string().min(1),
    segmentId: segmentIdSchema,
  })
  .strict();

export const workspaceRestoreDeletedSegmentRequestSchema = workspaceMemoryIdRequestSchema
  .extend({
    workspaceId: z.string().min(1),
    restoreToken: segmentIdSchema,
  })
  .strict();

export const workspaceDeleteSegmentSupplementRequestSchema = workspaceMemoryIdRequestSchema
  .extend({
    workspaceId: z.string().min(1),
    segmentId: segmentIdSchema,
    supplementId: supplementIdSchema,
  })
  .strict();

export const workspaceRestoreDeletedSegmentSupplementRequestSchema = workspaceMemoryIdRequestSchema
  .extend({
    workspaceId: z.string().min(1),
    segmentId: segmentIdSchema,
    restoreToken: supplementIdSchema,
  })
  .strict();

export const workspaceReadMemoryDetailRequestSchema = workspaceMemoryIdRequestSchema
  .extend({
    workspaceId: z.string().min(1),
    requestId: z.string().min(1),
  })
  .strict();

export const workspaceReadFinalizedAudioSegmentRequestSchema = workspaceRecordingReadRequestSchema
  .extend({
    workspaceId: z.string().min(1),
    requestId: z.string().min(1),
    maxBytes: z.number().int().positive().max(MAX_RECORDING_DRAFT_AUDIO_READ_BYTES).optional(),
  })
  .strict();

export const workspaceReadFinalizedAudioSegmentSupplementRequestSchema =
  workspaceRecordingReadRequestSchema
    .extend({
      workspaceId: z.string().min(1),
      supplementId: supplementIdSchema,
      requestId: z.string().min(1),
      maxBytes: z.number().int().positive().max(MAX_RECORDING_DRAFT_AUDIO_READ_BYTES).optional(),
    })
    .strict();

const workspaceMemoryEntityRequestSchema = workspaceMemoryIdRequestSchema
  .extend({
    workspaceId: z.string().min(1),
  })
  .strict();

const workspaceSegmentEntityRequestSchema = workspaceMemoryEntityRequestSchema
  .extend({
    segmentId: segmentIdSchema,
  })
  .strict();

const workspaceSegmentSupplementEntityRequestSchema = workspaceSegmentEntityRequestSchema
  .extend({
    supplementId: supplementIdSchema,
  })
  .strict();

export const workspaceRevealMemorySpaceInFinderRequestSchema = workspaceMemorySpaceIdRequestSchema;
export const workspaceRevealMemoryInFinderRequestSchema = workspaceMemoryEntityRequestSchema;
export const workspaceRevealSegmentInFinderRequestSchema = workspaceSegmentEntityRequestSchema;
export const workspaceRevealSegmentSupplementInFinderRequestSchema =
  workspaceSegmentSupplementEntityRequestSchema;
export const workspaceOpenMemorySpaceAgentsFileRequestSchema = workspaceMemorySpaceIdRequestSchema;
export const workspaceOpenMemoryDocumentRequestSchema = workspaceMemoryEntityRequestSchema;
export const workspaceOpenSegmentDocumentRequestSchema = workspaceSegmentEntityRequestSchema;
export const workspaceOpenSegmentSupplementDocumentRequestSchema =
  workspaceSegmentSupplementEntityRequestSchema;
export const workspaceCopyMemorySpaceAbsolutePathRequestSchema =
  workspaceMemorySpaceIdRequestSchema;
export const workspaceCopyMemoryAbsolutePathRequestSchema = workspaceMemoryEntityRequestSchema;
export const workspaceCopySegmentAbsolutePathRequestSchema = workspaceSegmentEntityRequestSchema;
export const workspaceCopySegmentSupplementAbsolutePathRequestSchema =
  workspaceSegmentSupplementEntityRequestSchema;
export const workspaceCopyMemoryRelativePathRequestSchema = workspaceMemoryEntityRequestSchema;
export const workspaceCopySegmentRelativePathRequestSchema = workspaceSegmentEntityRequestSchema;
export const workspaceCopySegmentSupplementRelativePathRequestSchema =
  workspaceSegmentSupplementEntityRequestSchema;

export const workspaceFinalizeSegmentSupplementRecordingDraftRequestSchema = workspaceHandleSchema
  .extend({
    workspaceId: z.string().min(1),
    memoryId: memoryIdSchema,
    segmentId: segmentIdSchema,
    supplementId: supplementIdSchema,
    title: workspaceRecordingTitleSchema,
    durationMs: z.number().int().nonnegative(),
    lastTranscriptionAttemptOnFinalize: finalizeTranscriptionAttemptSchema.optional(),
  })
  .strict();

export const workspaceUpdateMemoryTitleResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: workspaceMemorySummarySchema,
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceUpdateSegmentTitleResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      segment: workspaceSegmentProjectionSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceUpdateSegmentSupplementTitleResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      segment: workspaceSegmentProjectionSchema,
      supplement: workspaceSegmentSupplementProjectionSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

const workspaceEntityActionErrorEnvelopeSchema = z.strictObject({
  ok: z.literal(false),
  error: z.strictObject({
    code: workspaceErrorCodeSchema,
    message: z.string().min(1),
  }),
});

export const workspaceEntityActionResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
  }),
  workspaceEntityActionErrorEnvelopeSchema,
]);

export const workspaceCreateMemoryResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: workspaceMemorySummarySchema,
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceDeleteMemoryResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memoryId: memoryIdSchema,
      restoreToken: memoryIdSchema,
      memories: z.array(workspaceMemorySummarySchema),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceRestoreDeletedMemoryResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      memories: z.array(workspaceMemorySummarySchema),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceDeleteSegmentResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      segmentId: segmentIdSchema,
      restoreToken: segmentIdSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceRestoreDeletedSegmentResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      segment: workspaceSegmentProjectionSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceDeleteSegmentSupplementResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      segment: workspaceSegmentProjectionSchema,
      supplementId: supplementIdSchema,
      restoreToken: supplementIdSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceRestoreDeletedSegmentSupplementResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      segment: workspaceSegmentProjectionSchema,
      supplement: workspaceSegmentSupplementProjectionSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceReadMemoryDetailResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      requestId: z.string().min(1),
      detail: workspaceMemoryDetailProjectionSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceReadFinalizedAudioSegmentResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      requestId: z.string().min(1),
      workspaceId: z.string().min(1),
      memoryId: memoryIdSchema,
      segmentId: segmentIdSchema,
      audio: z.instanceof(Uint8Array),
      audioByteLength: z.number().int().nonnegative(),
      transcript: z.strictObject({
        exists: z.boolean(),
        text: z.string(),
      }),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceReadFinalizedAudioSegmentSupplementResponseSchema = z.discriminatedUnion(
  'ok',
  [
    z.strictObject({
      ok: z.literal(true),
      value: z.strictObject({
        requestId: z.string().min(1),
        workspaceId: z.string().min(1),
        memoryId: memoryIdSchema,
        segmentId: segmentIdSchema,
        supplementId: supplementIdSchema,
        audio: z.instanceof(Uint8Array),
        audioByteLength: z.number().int().nonnegative(),
        transcript: z.strictObject({
          exists: z.boolean(),
          text: z.string(),
        }),
      }),
    }),
    workspaceErrorEnvelopeSchema,
  ]
);

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

export const workspaceCreateSegmentSupplementRecordingDraftResponseSchema = z.discriminatedUnion(
  'ok',
  [
    z.strictObject({
      ok: z.literal(true),
      value: z.strictObject({
        supplementId: supplementIdSchema,
        nextSequence: z.number().int().nonnegative(),
      }),
    }),
    workspaceErrorEnvelopeSchema,
  ]
);

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

export const workspaceSegmentSupplementRecordingAppendResponseSchema =
  workspaceRecordingAppendResponseSchema;

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
      segment: workspaceSegmentProjectionSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceFinalizeSegmentSupplementRecordingDraftResponseSchema = z.discriminatedUnion(
  'ok',
  [
    z.strictObject({
      ok: z.literal(true),
      value: z.strictObject({
        memory: workspaceMemorySummarySchema,
        segment: workspaceSegmentProjectionSchema,
        supplement: workspaceSegmentSupplementProjectionSchema,
      }),
    }),
    workspaceErrorEnvelopeSchema,
  ]
);

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

export const workspaceSegmentSupplementMarkdownSaveResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      segment: workspaceSegmentProjectionSchema,
      supplement: workspaceSegmentSupplementProjectionSchema,
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
      transcriptionMode: z.enum(['live', 'disabled']).optional(),
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
    lastTranscriptionAttemptOnFinalize: finalizeTranscriptionAttemptSchema.optional(),
  })
  .strict();

export const workspaceRecordingMarkdownSaveRequestSchema = workspaceRecordingReadRequestSchema
  .extend({
    markdown: z.string(),
  })
  .strict();

export const workspaceSegmentSupplementMarkdownSaveRequestSchema =
  workspaceReadFinalizedAudioSegmentSupplementRequestSchema
    .omit({ requestId: true, maxBytes: true })
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
export type VoiceTranscriptionSettingsSnapshot = z.infer<
  typeof voiceTranscriptionSettingsSnapshotSchema
>;
export type WorkspaceReadVoiceTranscriptionSettingsRequest = z.infer<
  typeof workspaceReadVoiceTranscriptionSettingsRequestSchema
>;
export type WorkspaceReadVoiceTranscriptionSettingsResponse = z.infer<
  typeof workspaceReadVoiceTranscriptionSettingsResponseSchema
>;
export type WorkspaceSetVoiceTranscriptionEnabledRequest = z.infer<
  typeof workspaceSetVoiceTranscriptionEnabledRequestSchema
>;
export type WorkspaceSetVoiceTranscriptionEnabledResponse = z.infer<
  typeof workspaceSetVoiceTranscriptionEnabledResponseSchema
>;
export type WorkspaceSaveVoiceTranscriptionApiKeyRequest = z.infer<
  typeof workspaceSaveVoiceTranscriptionApiKeyRequestSchema
>;
export type WorkspaceSaveVoiceTranscriptionApiKeyResponse = z.infer<
  typeof workspaceSaveVoiceTranscriptionApiKeyResponseSchema
>;
export type WorkspaceClearVoiceTranscriptionApiKeyRequest = z.infer<
  typeof workspaceClearVoiceTranscriptionApiKeyRequestSchema
>;
export type WorkspaceClearVoiceTranscriptionApiKeyResponse = z.infer<
  typeof workspaceClearVoiceTranscriptionApiKeyResponseSchema
>;
export type WorkspaceValidateVoiceTranscriptionCredentialsRequest = z.infer<
  typeof workspaceValidateVoiceTranscriptionCredentialsRequestSchema
>;
export type WorkspaceValidateVoiceTranscriptionCredentialsResponse = z.infer<
  typeof workspaceValidateVoiceTranscriptionCredentialsResponseSchema
>;
export type WorkspaceOpenVoiceTranscriptionProviderConsoleRequest = z.infer<
  typeof workspaceOpenVoiceTranscriptionProviderConsoleRequestSchema
>;
export type WorkspaceOpenVoiceTranscriptionProviderConsoleResponse = z.infer<
  typeof workspaceOpenVoiceTranscriptionProviderConsoleResponseSchema
>;
export type WorkspaceChooseDirectoryResult = z.infer<typeof workspaceChooseDirectoryResultSchema>;
export type WorkspaceChooseDirectoryResponse = z.infer<
  typeof workspaceChooseDirectoryResponseSchema
>;
export type DraftSegmentMetadata = z.infer<typeof draftSegmentMetadataSchema>;
export type DraftSegmentSupplementMetadata = z.infer<typeof draftSegmentSupplementMetadataSchema>;
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;
export type WorkspaceMemorySummary = z.infer<typeof workspaceMemorySummarySchema>;
export type WorkspaceSegmentProjection = z.infer<typeof workspaceSegmentProjectionSchema>;
export type WorkspaceSegmentSupplementProjection = z.infer<
  typeof workspaceSegmentSupplementProjectionSchema
>;
export type WorkspaceMemoryDetailProjection = z.infer<typeof workspaceMemoryDetailProjectionSchema>;
export type WorkspaceMemorySpace = z.infer<typeof workspaceMemorySpaceSchema>;
export type WorkspaceHandleRequest = z.infer<typeof workspaceHandleRequestSchema>;
export type WorkspaceInitializeRequest = z.infer<typeof workspaceInitializeRequestSchema>;
export type WorkspaceInitializeResponse = z.infer<typeof workspaceInitializeResponseSchema>;
export type WorkspaceOpenRequest = z.infer<typeof workspaceOpenRequestSchema>;
export type WorkspaceMemorySpaceIdRequest = z.infer<typeof workspaceMemorySpaceIdRequestSchema>;
export type WorkspaceMemorySpaceEntityActionRequest = WorkspaceMemorySpaceIdRequest;
export type WorkspaceMemoryEntityActionRequest = z.infer<typeof workspaceMemoryEntityRequestSchema>;
export type WorkspaceSegmentEntityActionRequest = z.infer<
  typeof workspaceSegmentEntityRequestSchema
>;
export type WorkspaceSegmentSupplementEntityActionRequest = z.infer<
  typeof workspaceSegmentSupplementEntityRequestSchema
>;
export type WorkspaceRevealMemorySpaceInFinderRequest = z.infer<
  typeof workspaceRevealMemorySpaceInFinderRequestSchema
>;
export type WorkspaceRevealMemoryInFinderRequest = z.infer<
  typeof workspaceRevealMemoryInFinderRequestSchema
>;
export type WorkspaceRevealSegmentInFinderRequest = z.infer<
  typeof workspaceRevealSegmentInFinderRequestSchema
>;
export type WorkspaceRevealSegmentSupplementInFinderRequest = z.infer<
  typeof workspaceRevealSegmentSupplementInFinderRequestSchema
>;
export type WorkspaceOpenMemorySpaceAgentsFileRequest = z.infer<
  typeof workspaceOpenMemorySpaceAgentsFileRequestSchema
>;
export type WorkspaceOpenMemoryDocumentRequest = z.infer<
  typeof workspaceOpenMemoryDocumentRequestSchema
>;
export type WorkspaceOpenSegmentDocumentRequest = z.infer<
  typeof workspaceOpenSegmentDocumentRequestSchema
>;
export type WorkspaceOpenSegmentSupplementDocumentRequest = z.infer<
  typeof workspaceOpenSegmentSupplementDocumentRequestSchema
>;
export type WorkspaceCopyMemorySpaceAbsolutePathRequest = z.infer<
  typeof workspaceCopyMemorySpaceAbsolutePathRequestSchema
>;
export type WorkspaceCopyMemoryAbsolutePathRequest = z.infer<
  typeof workspaceCopyMemoryAbsolutePathRequestSchema
>;
export type WorkspaceCopySegmentAbsolutePathRequest = z.infer<
  typeof workspaceCopySegmentAbsolutePathRequestSchema
>;
export type WorkspaceCopySegmentSupplementAbsolutePathRequest = z.infer<
  typeof workspaceCopySegmentSupplementAbsolutePathRequestSchema
>;
export type WorkspaceCopyMemoryRelativePathRequest = z.infer<
  typeof workspaceCopyMemoryRelativePathRequestSchema
>;
export type WorkspaceCopySegmentRelativePathRequest = z.infer<
  typeof workspaceCopySegmentRelativePathRequestSchema
>;
export type WorkspaceCopySegmentSupplementRelativePathRequest = z.infer<
  typeof workspaceCopySegmentSupplementRelativePathRequestSchema
>;
export type WorkspaceUpdateMemorySpaceTitleRequest = z.infer<
  typeof workspaceUpdateMemorySpaceTitleRequestSchema
>;
export type WorkspaceCloseRequest = z.infer<typeof workspaceCloseRequestSchema>;
export type WorkspaceReadWorkspaceSnapshotRequest = z.infer<
  typeof workspaceReadWorkspaceSnapshotRequestSchema
>;
export type WorkspaceListMemorySpacesResponse = z.infer<
  typeof workspaceListMemorySpacesResponseSchema
>;
export type WorkspaceCloseResponse = z.infer<typeof workspaceCloseResponseSchema>;
export type WorkspaceReadWorkspaceSnapshotResponse = z.infer<
  typeof workspaceReadWorkspaceSnapshotResponseSchema
>;
export type WorkspaceRemoveMemorySpaceResponse = z.infer<
  typeof workspaceRemoveMemorySpaceResponseSchema
>;
export type WorkspaceUpdateMemorySpaceTitleResponse = z.infer<
  typeof workspaceUpdateMemorySpaceTitleResponseSchema
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
export type WorkspaceCreateSegmentSupplementRecordingDraftRequest = z.infer<
  typeof workspaceCreateSegmentSupplementRecordingDraftRequestSchema
>;
type WorkspaceAppendSegmentSupplementRecordingAudioRequestFromSchema = z.infer<
  typeof workspaceAppendSegmentSupplementRecordingAudioRequestSchema
>;
export type WorkspaceAppendSegmentSupplementRecordingAudioRequest = Omit<
  WorkspaceAppendSegmentSupplementRecordingAudioRequestFromSchema,
  'chunk'
> & {
  readonly chunk: Uint8Array<ArrayBufferLike>;
};
export type WorkspaceRecordingDraftPrefixCloneRequest = z.infer<
  typeof workspaceRecordingDraftPrefixCloneRequestSchema
>;
export type WorkspaceSegmentIdRequest = z.infer<typeof workspaceSegmentIdRequestSchema>;
export type WorkspaceSegmentSupplementIdRequest = z.infer<
  typeof workspaceSegmentSupplementIdRequestSchema
>;
export type WorkspaceRecordingDraftAudioRequest = z.infer<
  typeof workspaceRecordingDraftAudioRequestSchema
>;
export type WorkspaceUpdateMemoryTitleRequest = z.infer<
  typeof workspaceUpdateMemoryTitleRequestSchema
>;
export type WorkspaceUpdateSegmentTitleRequest = z.infer<
  typeof workspaceUpdateSegmentTitleRequestSchema
>;
export type WorkspaceUpdateSegmentSupplementTitleRequest = z.infer<
  typeof workspaceUpdateSegmentSupplementTitleRequestSchema
>;
export type WorkspaceCreateMemoryRequest = z.infer<typeof workspaceCreateMemoryRequestSchema>;
export type WorkspaceDeleteMemoryRequest = z.infer<typeof workspaceDeleteMemoryRequestSchema>;
export type WorkspaceRestoreDeletedMemoryRequest = z.infer<
  typeof workspaceRestoreDeletedMemoryRequestSchema
>;
export type WorkspaceDeleteSegmentRequest = z.infer<typeof workspaceDeleteSegmentRequestSchema>;
export type WorkspaceRestoreDeletedSegmentRequest = z.infer<
  typeof workspaceRestoreDeletedSegmentRequestSchema
>;
export type WorkspaceDeleteSegmentSupplementRequest = z.infer<
  typeof workspaceDeleteSegmentSupplementRequestSchema
>;
export type WorkspaceRestoreDeletedSegmentSupplementRequest = z.infer<
  typeof workspaceRestoreDeletedSegmentSupplementRequestSchema
>;
export type WorkspaceReadMemoryDetailRequest = z.infer<
  typeof workspaceReadMemoryDetailRequestSchema
>;
export type WorkspaceReadFinalizedAudioSegmentRequest = z.infer<
  typeof workspaceReadFinalizedAudioSegmentRequestSchema
>;
export type WorkspaceReadFinalizedAudioSegmentSupplementRequest = z.infer<
  typeof workspaceReadFinalizedAudioSegmentSupplementRequestSchema
>;
export type WorkspaceUpdateMemoryTitleResponse = z.infer<
  typeof workspaceUpdateMemoryTitleResponseSchema
>;
export type WorkspaceUpdateSegmentTitleResponse = z.infer<
  typeof workspaceUpdateSegmentTitleResponseSchema
>;
export type WorkspaceUpdateSegmentSupplementTitleResponse = z.infer<
  typeof workspaceUpdateSegmentSupplementTitleResponseSchema
>;
export type WorkspaceEntityActionResponse = z.infer<typeof workspaceEntityActionResponseSchema>;
export type WorkspaceCreateMemoryResponse = z.infer<typeof workspaceCreateMemoryResponseSchema>;
export type WorkspaceDeleteMemoryResponse = z.infer<typeof workspaceDeleteMemoryResponseSchema>;
export type WorkspaceRestoreDeletedMemoryResponse = z.infer<
  typeof workspaceRestoreDeletedMemoryResponseSchema
>;
export type WorkspaceDeleteSegmentResponse = z.infer<typeof workspaceDeleteSegmentResponseSchema>;
export type WorkspaceRestoreDeletedSegmentResponse = z.infer<
  typeof workspaceRestoreDeletedSegmentResponseSchema
>;
export type WorkspaceDeleteSegmentSupplementResponse = z.infer<
  typeof workspaceDeleteSegmentSupplementResponseSchema
>;
export type WorkspaceRestoreDeletedSegmentSupplementResponse = z.infer<
  typeof workspaceRestoreDeletedSegmentSupplementResponseSchema
>;
export type WorkspaceReadMemoryDetailResponse = z.infer<
  typeof workspaceReadMemoryDetailResponseSchema
>;
export type WorkspaceReadFinalizedAudioSegmentResponse = z.infer<
  typeof workspaceReadFinalizedAudioSegmentResponseSchema
>;
export type WorkspaceReadFinalizedAudioSegmentSupplementResponse = z.infer<
  typeof workspaceReadFinalizedAudioSegmentSupplementResponseSchema
>;
export type WorkspaceCreateRecordingDraftResponse = z.infer<
  typeof workspaceCreateRecordingDraftResponseSchema
>;
export type WorkspaceCreateSegmentSupplementRecordingDraftResponse = z.infer<
  typeof workspaceCreateSegmentSupplementRecordingDraftResponseSchema
>;
export type WorkspaceRecordingDraftAudioResponse = z.infer<
  typeof workspaceRecordingDraftAudioResponseSchema
>;
export type WorkspaceRecordingAppendResponse = z.infer<
  typeof workspaceRecordingAppendResponseSchema
>;
export type WorkspaceSegmentSupplementRecordingAppendResponse = z.infer<
  typeof workspaceSegmentSupplementRecordingAppendResponseSchema
>;
export type WorkspaceRecordingDraftPrefixCloneResponse = z.infer<
  typeof workspaceRecordingDraftPrefixCloneResponseSchema
>;
export type WorkspaceRecordingFinalizeResponse = z.infer<
  typeof workspaceRecordingFinalizeResponseSchema
>;
export type WorkspaceFinalizeSegmentSupplementRecordingDraftResponse = z.infer<
  typeof workspaceFinalizeSegmentSupplementRecordingDraftResponseSchema
>;
export type WorkspaceDiscardRecordingDraftResponse = z.infer<
  typeof workspaceDiscardRecordingDraftResponseSchema
>;
export type WorkspaceRecordingMarkdownSaveResponse = z.infer<
  typeof workspaceRecordingMarkdownSaveResponseSchema
>;
export type WorkspaceSegmentSupplementMarkdownSaveResponse = z.infer<
  typeof workspaceSegmentSupplementMarkdownSaveResponseSchema
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
export type WorkspaceFinalizeSegmentSupplementRecordingDraftRequest = z.infer<
  typeof workspaceFinalizeSegmentSupplementRecordingDraftRequestSchema
>;
export type WorkspaceRecordingMarkdownSaveRequest = z.infer<
  typeof workspaceRecordingMarkdownSaveRequestSchema
>;
export type WorkspaceSegmentSupplementMarkdownSaveRequest = z.infer<
  typeof workspaceSegmentSupplementMarkdownSaveRequestSchema
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

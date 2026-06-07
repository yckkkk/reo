import { z } from 'zod';
import type { JSONContent } from '@tiptap/core';
import { isReoTiptapHighlightColor } from '../tiptap-markdown/tiptapHighlightColors.js';
import { MAX_RECORDING_DRAFT_AUDIO_READ_BYTES } from './recording-audio.js';
import { isSafeWorkspaceDirectoryName } from './workspace-name.js';
import { WORKSPACE_TITLE_MAX_LENGTH } from './workspace-title.js';

export * from './workspace-channels.js';

export const MEMORY_ID_PATTERN = /^mem_[A-Za-z0-9_-]+$/;
export const SEGMENT_ID_PATTERN = /^seg_[A-Za-z0-9_-]+$/;
export const SUPPLEMENT_ID_PATTERN = /^sup_[A-Za-z0-9_-]+$/;
export const WIDGET_ID_PATTERN = /^wdg_[A-Za-z0-9_-]+$/;

const memoryIdSchema = z.string().regex(MEMORY_ID_PATTERN);
const segmentIdSchema = z.string().regex(SEGMENT_ID_PATTERN);
const supplementIdSchema = z.string().regex(SUPPLEMENT_ID_PATTERN);
const widgetIdSchema = z.string().regex(WIDGET_ID_PATTERN);
export const workspaceSegmentContentTabOrderItemSchema = z.union([
  z.literal('segment'),
  z.templateLiteral([z.literal('supplement:'), supplementIdSchema]),
]);
export type WorkspaceSegmentContentTabOrderItem = z.infer<
  typeof workspaceSegmentContentTabOrderItemSchema
>;
export const workspaceWidgetTabOrderItemSchema = widgetIdSchema;
export type WorkspaceWidgetTabOrderItem = z.infer<typeof workspaceWidgetTabOrderItemSchema>;
export const LAST_TRANSCRIPTION_ATTEMPTS = ['success', 'failed', 'never'] as const;
export type LastTranscriptionAttempt = (typeof LAST_TRANSCRIPTION_ATTEMPTS)[number];
export const lastTranscriptionAttemptSchema = z.enum(LAST_TRANSCRIPTION_ATTEMPTS);
export const SPEECH_SYNTHESIS_ATTEMPTS = ['success', 'failed', 'never'] as const;
export type SpeechSynthesisAttempt = (typeof SPEECH_SYNTHESIS_ATTEMPTS)[number];
export const speechSynthesisAttemptSchema = z.enum(SPEECH_SYNTHESIS_ATTEMPTS);
export const NOTE_SPEECH_SYNTHESIS_FAILURE_REASONS = ['text-too-long'] as const;
export type NoteSpeechSynthesisFailureReason =
  (typeof NOTE_SPEECH_SYNTHESIS_FAILURE_REASONS)[number];
export const noteSpeechSynthesisFailureReasonSchema = z.enum(NOTE_SPEECH_SYNTHESIS_FAILURE_REASONS);
export const VOICE_SPEECH_SYNTHESIS_SPEAKERS = [
  'zh_female_vv_uranus_bigtts',
  'zh_female_xiaohe_uranus_bigtts',
  'zh_male_m191_uranus_bigtts',
  'zh_male_shaonianzixin_uranus_bigtts',
] as const;
export type VoiceSpeechSynthesisSpeaker = (typeof VOICE_SPEECH_SYNTHESIS_SPEAKERS)[number];
export const voiceSpeechSynthesisSpeakerSchema = z.enum(VOICE_SPEECH_SYNTHESIS_SPEAKERS);
export const DEFAULT_VOICE_SPEECH_SYNTHESIS_SPEAKER =
  'zh_female_vv_uranus_bigtts' as const satisfies VoiceSpeechSynthesisSpeaker;
export const VOICE_SPEECH_SYNTHESIS_MODEL = 'seed-tts-2.0-expressive' as const;
export const VOICE_SPEECH_SYNTHESIS_RESOURCE_ID = 'seed-tts-2.0' as const;
export const VOICE_SPEECH_SYNTHESIS_SAMPLE_RATE = 24000 as const;
export const WORKSPACE_CONTENT_KINDS = ['audio', 'note', 'artifact'] as const;
export type WorkspaceContentKind = (typeof WORKSPACE_CONTENT_KINDS)[number];
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

const coverFilenameSchema = z
  .string()
  .min(1)
  .max(255)
  .refine((value) => !value.includes('/') && !value.includes('\\') && !value.includes('..'))
  .refine((value) => {
    const lower = value.toLowerCase();
    return (
      lower.endsWith('.png') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.webp')
    );
  });
const coverVersionSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/);
export const WORKSPACE_DEFAULT_COVER_TEMPLATE_IDS = [
  'cover-01',
  'cover-02',
  'cover-03',
  'cover-04',
  'cover-05',
  'cover-06',
  'cover-07',
  'cover-08',
  'cover-09',
  'cover-10',
  'cover-11',
  'cover-12',
  'cover-13',
] as const;
export const workspaceDefaultCoverTemplateIdSchema = z.enum(WORKSPACE_DEFAULT_COVER_TEMPLATE_IDS);
const memoryCoverRestoreTokenSchema = z
  .string()
  .min(1)
  .max(180)
  .regex(/^cover_[A-Za-z0-9_-]+_[a-f0-9]{32}$/);
const segmentCoverRestoreTokenSchema = z
  .string()
  .min(1)
  .max(220)
  .regex(/^cover__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+__[a-f0-9]{32}$/);

export const workspaceCoverProjectionSchema = z.discriminatedUnion('source', [
  z.strictObject({
    source: z.literal('default'),
    templateId: workspaceDefaultCoverTemplateIdSchema.optional(),
  }),
  z.strictObject({
    source: z.literal('custom'),
    filename: coverFilenameSchema,
    version: coverVersionSchema,
  }),
]);
export const workspaceMemoryCoverProjectionSchema = workspaceCoverProjectionSchema;

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
  'ERR_WORKSPACE_PROTECTED_ENTITY',
  'ERR_WORKSPACE_ROOT_MISSING',
  'ERR_WORKSPACE_UNSAFE_PATH',
  'ERR_WORKSPACE_MEMORY_NOT_FOUND',
  'ERR_WORKSPACE_MEMORY_COVER_NOT_FOUND',
  'ERR_WORKSPACE_SEGMENT_NOT_FOUND',
  'ERR_WORKSPACE_SEGMENT_COVER_NOT_FOUND',
  'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND',
  'ERR_WORKSPACE_WIDGET_NOT_FOUND',
  'ERR_MEMORY_SPACE_AGENT_ENTRY_MISSING',
  'ERR_ENTITY_DOCUMENT_MISSING',
  'ERR_SHELL_OPEN_FAILED',
  'ERR_CLIPBOARD_WRITE_FAILED',
  'ERR_WORKSPACE_ALREADY_EXISTS',
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
  'ERR_BACKFILL_ALREADY_RUNNING',
  'ERR_BACKFILL_AUDIO_EMPTY',
  'ERR_BACKFILL_AUDIO_TOO_LARGE',
  'ERR_BACKFILL_AUDIO_TRANSCODE_FAILED',
  'ERR_BACKFILL_AUTH_FAILED',
  'ERR_BACKFILL_RATE_LIMITED',
  'ERR_BACKFILL_TRANSCRIBE_FAILED',
  'ERR_BACKFILL_TARGET_NOT_ELIGIBLE',
  'ERR_BACKFILL_TRANSCRIPT_CHANGED',
  'ERR_BACKFILL_UNAVAILABLE',
  'ERR_SPEECH_SYNTHESIS_ALREADY_RUNNING',
  'ERR_SPEECH_SYNTHESIS_AUDIO_TOO_LARGE',
  'ERR_SPEECH_SYNTHESIS_AUTH_FAILED',
  'ERR_SPEECH_SYNTHESIS_NOTE_CHANGED',
  'ERR_SPEECH_SYNTHESIS_TARGET_NOT_ELIGIBLE',
  'ERR_SPEECH_SYNTHESIS_TEXT_EMPTY',
  'ERR_SPEECH_SYNTHESIS_TEXT_TOO_LONG',
  'ERR_SPEECH_SYNTHESIS_UNAVAILABLE',
  'ERR_SPEECH_SYNTHESIS_WRITE_FAILED',
  'ERR_VOICE_SETTINGS_STORAGE_UNAVAILABLE',
  'ERR_VOICE_SETTINGS_WRITE_FAILED',
  'ERR_VOICE_TRANSCRIPTION_PROBE_FAILED',
  'ERR_VOICE_SPEECH_SYNTHESIS_PROBE_FAILED',
  'ERR_VOICE_TRANSCRIPTION_PROVIDER_CONSOLE_REJECTED',
  'ERR_MARKDOWN_EXTERNAL_LINK_REJECTED',
  'ERR_WORKSPACE_INDEX_WRITE_FAILED',
  'ERR_MEMORY_NOT_FOUND',
  'ERR_MEMORY_CREATE_FAILED',
  'ERR_MEMORY_UPDATE_FAILED',
  'ERR_MEMORY_DELETE_FAILED',
  'ERR_MEMORY_COVER_RESET_FAILED',
  'ERR_MEMORY_COVER_RESTORE_FAILED',
  'ERR_MEMORY_RESTORE_FAILED',
  'ERR_SEGMENT_DELETE_FAILED',
  'ERR_SEGMENT_COVER_RESET_FAILED',
  'ERR_SEGMENT_COVER_RESTORE_FAILED',
  'ERR_SEGMENT_RESTORE_FAILED',
  'ERR_SEGMENT_RESTORE_PARENT_MISSING',
  'ERR_SEGMENT_SUPPLEMENT_DELETE_FAILED',
  'ERR_SEGMENT_SUPPLEMENT_RESTORE_FAILED',
  'ERR_SEGMENT_SUPPLEMENT_RESTORE_PARENT_MISSING',
  'ERR_WORKSPACE_WIDGET_UPDATE_FAILED',
  'ERR_WORKSPACE_WIDGET_DELETE_FAILED',
  'ERR_WORKSPACE_WIDGET_RESTORE_FAILED',
  'ERR_MIC_INTENT_ALREADY_ACTIVE',
  'ERR_WORKSPACE_ATTACHMENT_NOT_FOUND',
  'ERR_ATTACHMENT_UNSUPPORTED_MIME',
  'ERR_ATTACHMENT_TOO_LARGE',
  'ERR_ATTACHMENT_WRITE_FAILED',
  'ERR_SEGMENT_CONTENT_STALE',
]);

export const workspaceContentHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const baselineContentHashSchema = workspaceContentHashSchema;
export const NOTE_BODY_MARKDOWN_MAX_LENGTH = 1_048_576;
export const TIPTAP_JSON_CONTENT_MAX_DEPTH = 64;
export const TIPTAP_JSON_CONTENT_MAX_NODES = 10_000;
export const TIPTAP_JSON_CONTENT_MAX_MARKS = 20_000;
export const TIPTAP_JSON_CONTENT_MAX_TEXT_LENGTH = NOTE_BODY_MARKDOWN_MAX_LENGTH;
export const TIPTAP_JSON_CONTENT_MAX_ATTRS_LENGTH = 262_144;
export const TIPTAP_JSON_CONTENT_SIDECAR_MAX_BYTES = 2_097_152;
export const workspaceEditableMarkdownBodySchema = z.string().max(NOTE_BODY_MARKDOWN_MAX_LENGTH);
const noteBodyMarkdownSchema = workspaceEditableMarkdownBodySchema;

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown, depth = 0): boolean {
  if (depth > 32) {
    return false;
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item, depth + 1));
  }
  if (isJsonRecord(value)) {
    return Object.values(value).every((item) => isJsonValue(item, depth + 1));
  }
  return false;
}

function isArtifactRuntimeStateJson(value: unknown): value is Record<string, unknown> {
  return isJsonRecord(value) && isJsonValue(value);
}

export const workspaceArtifactRuntimeStateJsonSchema = z.custom<Record<string, unknown>>(
  isArtifactRuntimeStateJson
);

type TiptapJsonContentStats = {
  nodes: number;
  marks: number;
  textLength: number;
  attrsLength: number;
};

function addTiptapAttrsLength(stats: TiptapJsonContentStats, attrs: unknown): boolean {
  if (attrs === undefined) {
    return true;
  }
  if (!isJsonValue(attrs)) {
    return false;
  }
  stats.attrsLength += JSON.stringify(attrs).length;
  return stats.attrsLength <= TIPTAP_JSON_CONTENT_MAX_ATTRS_LENGTH;
}

function areTiptapMarkAttrsAllowed(mark: Record<string, unknown>): boolean {
  if (mark['type'] !== 'highlight') {
    return true;
  }
  const attrs = mark['attrs'];
  if (attrs === undefined || attrs === null) {
    return true;
  }
  if (!isJsonRecord(attrs)) {
    return false;
  }
  const color = attrs['color'];
  return color === undefined || color === null || color === '' || isReoTiptapHighlightColor(color);
}

function isTiptapJsonContentWithinLimits(
  value: unknown,
  stats: TiptapJsonContentStats,
  depth = 0
): value is JSONContent {
  if (
    depth > TIPTAP_JSON_CONTENT_MAX_DEPTH ||
    !isJsonRecord(value) ||
    typeof value['type'] !== 'string'
  ) {
    return false;
  }
  stats.nodes += 1;
  if (stats.nodes > TIPTAP_JSON_CONTENT_MAX_NODES) {
    return false;
  }
  if (!addTiptapAttrsLength(stats, value['attrs'])) {
    return false;
  }
  if (value['text'] !== undefined) {
    if (typeof value['text'] !== 'string') {
      return false;
    }
    stats.textLength += value['text'].length;
    if (stats.textLength > TIPTAP_JSON_CONTENT_MAX_TEXT_LENGTH) {
      return false;
    }
  }
  const marks = value['marks'];
  if (marks !== undefined) {
    if (!Array.isArray(marks) || stats.marks + marks.length > TIPTAP_JSON_CONTENT_MAX_MARKS) {
      return false;
    }
    stats.marks += marks.length;
    for (const mark of marks) {
      if (!isJsonRecord(mark) || typeof mark['type'] !== 'string') {
        return false;
      }
      if (!addTiptapAttrsLength(stats, mark['attrs'])) {
        return false;
      }
      if (!areTiptapMarkAttrsAllowed(mark)) {
        return false;
      }
    }
  }
  const content = value['content'];
  if (content !== undefined) {
    if (!Array.isArray(content)) {
      return false;
    }
    return content.every((child) => isTiptapJsonContentWithinLimits(child, stats, depth + 1));
  }
  return true;
}

export function isTiptapJsonContent(value: unknown): value is JSONContent {
  return isTiptapJsonContentWithinLimits(value, {
    attrsLength: 0,
    marks: 0,
    nodes: 0,
    textLength: 0,
  });
}

export const workspaceTiptapJsonContentSchema = z.custom<JSONContent>(isTiptapJsonContent);
export type WorkspaceTiptapJsonContent = z.infer<typeof workspaceTiptapJsonContentSchema>;

export const workspaceErrorSchema = z
  .strictObject({
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
    currentBodyMarkdown: noteBodyMarkdownSchema.optional(),
    currentBodyTiptapJson: workspaceTiptapJsonContentSchema.optional(),
    currentBaselineContentHash: baselineContentHashSchema.optional(),
    currentBaselineTiptapContentHash: baselineContentHashSchema.optional(),
  })
  .superRefine((error, context) => {
    const hasConflictBody = error.currentBodyMarkdown !== undefined;
    const hasConflictHash = error.currentBaselineContentHash !== undefined;
    const hasConflictTiptapBody = error.currentBodyTiptapJson !== undefined;
    const hasConflictTiptapHash = error.currentBaselineTiptapContentHash !== undefined;
    if (error.code === 'ERR_SEGMENT_CONTENT_STALE') {
      if (!hasConflictBody) {
        context.addIssue({
          code: 'custom',
          path: ['currentBodyMarkdown'],
          message: 'Stale note content errors must include the current body',
        });
      }
      if (!hasConflictHash) {
        context.addIssue({
          code: 'custom',
          path: ['currentBaselineContentHash'],
          message: 'Stale note content errors must include the current baseline hash',
        });
      }
      if (!hasConflictTiptapBody) {
        context.addIssue({
          code: 'custom',
          path: ['currentBodyTiptapJson'],
          message: 'Stale note content errors must include the current Tiptap content',
        });
      }
      if (!hasConflictTiptapHash) {
        context.addIssue({
          code: 'custom',
          path: ['currentBaselineTiptapContentHash'],
          message: 'Stale note content errors must include the current Tiptap baseline hash',
        });
      }
      return;
    }
    if (hasConflictBody || hasConflictHash || hasConflictTiptapBody || hasConflictTiptapHash) {
      context.addIssue({
        code: 'custom',
        message: 'Only stale note content errors may include current content payload',
      });
    }
  });

export const workspaceErrorEnvelopeSchema = z.strictObject({
  ok: z.literal(false),
  error: workspaceErrorSchema,
});

export const voiceTranscriptionSettingsSnapshotSchema = z.strictObject({
  enabled: z.boolean(),
  apiKeyConfigured: z.boolean(),
  apiKeyLastFour: z.string().length(4).nullable(),
  speechSynthesisSpeaker: voiceSpeechSynthesisSpeakerSchema,
  lastTranscriptionValidatedAt: z.string().nullable(),
  lastTranscriptionValidationOk: z.boolean().nullable(),
  lastTranscriptionValidationCode: z.enum(['ok', 'auth', 'network']).nullable(),
  lastSpeechSynthesisValidatedAt: z.string().nullable(),
  lastSpeechSynthesisValidationOk: z.boolean().nullable(),
  lastSpeechSynthesisValidationCode: z.enum(['ok', 'auth', 'network']).nullable(),
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

export const workspaceSetVoiceSpeechSynthesisSpeakerRequestSchema = z.strictObject({
  speaker: voiceSpeechSynthesisSpeakerSchema,
});

export const workspaceSetVoiceSpeechSynthesisSpeakerResponseSchema =
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

export const workspaceOpenMarkdownExternalLinkRequestSchema = z.strictObject({
  url: z.string().min(1).max(2048),
});

export const workspaceOpenMarkdownExternalLinkResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({}),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceChooseDirectoryResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: workspaceChooseDirectoryResultSchema,
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceMemorySystemRoleSchema = z.enum(['draft-default-memory']);
export const workspaceMemoryCapabilitiesSchema = z.strictObject({
  canRename: z.boolean(),
  canDelete: z.boolean(),
});

export const workspaceMemorySummarySchema = z.strictObject({
  memoryId: memoryIdSchema,
  title: z.string(),
  systemRole: workspaceMemorySystemRoleSchema.optional(),
  capabilities: workspaceMemoryCapabilitiesSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  segmentCount: z.number().int().nonnegative(),
  audioSegmentCount: z.number().int().nonnegative(),
  noteSegmentCount: z.number().int().nonnegative(),
  artifactSegmentCount: z.number().int().nonnegative(),
  audioDurationMs: z.number().int().nonnegative(),
  audioByteLength: z.number().int().nonnegative(),
  hasAudioTranscript: z.boolean(),
  hasAnyNote: z.boolean(),
  supplementCount: z.number().int().nonnegative(),
  cover: workspaceMemoryCoverProjectionSchema.optional(),
});

export const workspaceNoteSpeechSynthesisStatusSchema = z.enum([
  'missing',
  'ready',
  'stale',
  'failed',
  'unsupported',
]);

export const workspaceNoteSpeechSynthesisProjectionSchema = z.strictObject({
  status: workspaceNoteSpeechSynthesisStatusSchema,
  audioByteLength: z.number().int().nonnegative().nullable(),
  contentHash: workspaceContentHashSchema.nullable(),
  format: z.literal('mp3').nullable(),
  lastSynthesisAttempt: speechSynthesisAttemptSchema,
  mimeType: z.literal('audio/mpeg').nullable(),
  model: z.literal(VOICE_SPEECH_SYNTHESIS_MODEL).nullable(),
  reason: noteSpeechSynthesisFailureReasonSchema.nullable(),
  resourceId: z.literal(VOICE_SPEECH_SYNTHESIS_RESOURCE_ID).nullable(),
  sampleRate: z.literal(VOICE_SPEECH_SYNTHESIS_SAMPLE_RATE).nullable(),
  speaker: voiceSpeechSynthesisSpeakerSchema.nullable(),
  updatedAt: z.string().nullable(),
});

const workspaceArtifactRuntimeFaultSchema = z.strictObject({
  reason: z.enum(['missing-entry', 'oversized-entry']),
  diagnostic: z.string().min(1),
});

const workspaceWidgetIconProjectionSchema = z.discriminatedUnion('source', [
  z.strictObject({
    source: z.literal('default'),
  }),
  z.strictObject({
    source: z.literal('custom-mask'),
    url: z.string().min(1),
    version: workspaceContentHashSchema,
  }),
]);

const workspaceWidgetProjectionBaseSchema = z.strictObject({
  workspaceId: z.string().min(1),
  widgetId: widgetIdSchema,
  type: z.literal('widget'),
  format: z.literal('html'),
  mount: z.literal('workspace-rail'),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  icon: workspaceWidgetIconProjectionSchema,
});

const workspaceReadyWidgetProjectionSchema = workspaceWidgetProjectionBaseSchema.extend({
  runtimeFault: z.undefined().optional(),
  entryByteLength: z.number().int().nonnegative(),
  entryHash: workspaceContentHashSchema,
  previewVersion: workspaceContentHashSchema,
});

const workspaceFaultWidgetProjectionSchema = workspaceWidgetProjectionBaseSchema.extend({
  runtimeFault: workspaceArtifactRuntimeFaultSchema,
});

export const workspaceWidgetProjectionSchema = z.union([
  workspaceReadyWidgetProjectionSchema,
  workspaceFaultWidgetProjectionSchema,
]);

const workspaceAudioSegmentSupplementProjectionSchema = z.strictObject({
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

const workspaceNoteSegmentSupplementProjectionSchema = z.strictObject({
  workspaceId: z.string().min(1),
  memoryId: memoryIdSchema,
  segmentId: segmentIdSchema,
  supplementId: supplementIdSchema,
  type: z.literal('note'),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  bodyByteLength: z.number().int().nonnegative(),
});

const workspaceArtifactSegmentSupplementProjectionBaseSchema = z.strictObject({
  workspaceId: z.string().min(1),
  memoryId: memoryIdSchema,
  segmentId: segmentIdSchema,
  supplementId: supplementIdSchema,
  type: z.literal('artifact'),
  format: z.literal('html'),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const workspaceReadyArtifactSegmentSupplementProjectionSchema =
  workspaceArtifactSegmentSupplementProjectionBaseSchema.extend({
    runtimeFault: z.undefined().optional(),
    entryByteLength: z.number().int().nonnegative(),
    entryHash: workspaceContentHashSchema,
    previewVersion: workspaceContentHashSchema,
  });

const workspaceFaultArtifactSegmentSupplementProjectionSchema =
  workspaceArtifactSegmentSupplementProjectionBaseSchema.extend({
    runtimeFault: workspaceArtifactRuntimeFaultSchema,
  });

const workspaceArtifactSegmentSupplementProjectionSchema = z.union([
  workspaceReadyArtifactSegmentSupplementProjectionSchema,
  workspaceFaultArtifactSegmentSupplementProjectionSchema,
]);

export const workspaceSegmentSupplementProjectionSchema = z.union([
  workspaceAudioSegmentSupplementProjectionSchema,
  workspaceNoteSegmentSupplementProjectionSchema,
  workspaceArtifactSegmentSupplementProjectionSchema,
]);

const workspaceAudioSegmentProjectionSchema = z.strictObject({
  workspaceId: z.string().min(1),
  memoryId: memoryIdSchema,
  segmentId: segmentIdSchema,
  type: z.literal('audio'),
  title: z.string(),
  contentTitle: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  durationMs: z.number().int().nonnegative(),
  audioByteLength: z.number().int().nonnegative(),
  lastTranscriptionAttempt: lastTranscriptionAttemptSchema,
  transcript: z.strictObject({
    exists: z.boolean(),
  }),
  cover: workspaceCoverProjectionSchema.optional(),
  supplementCount: z.number().int().nonnegative(),
  supplements: z.array(workspaceSegmentSupplementProjectionSchema),
  contentTabOrder: z.array(workspaceSegmentContentTabOrderItemSchema).optional(),
});

const workspaceNoteSegmentProjectionSchema = z.strictObject({
  workspaceId: z.string().min(1),
  memoryId: memoryIdSchema,
  segmentId: segmentIdSchema,
  type: z.literal('note'),
  title: z.string(),
  contentTitle: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  bodyByteLength: z.number().int().nonnegative(),
  speechSynthesis: workspaceNoteSpeechSynthesisProjectionSchema,
  cover: workspaceCoverProjectionSchema.optional(),
  supplementCount: z.number().int().nonnegative(),
  supplements: z.array(workspaceSegmentSupplementProjectionSchema),
  contentTabOrder: z.array(workspaceSegmentContentTabOrderItemSchema).optional(),
});

const workspaceArtifactSegmentProjectionBaseSchema = z.strictObject({
  workspaceId: z.string().min(1),
  memoryId: memoryIdSchema,
  segmentId: segmentIdSchema,
  type: z.literal('artifact'),
  format: z.literal('html'),
  title: z.string(),
  contentTitle: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  cover: workspaceCoverProjectionSchema.optional(),
  supplementCount: z.number().int().nonnegative(),
  supplements: z.array(workspaceSegmentSupplementProjectionSchema),
  contentTabOrder: z.array(workspaceSegmentContentTabOrderItemSchema).optional(),
});

const workspaceReadyArtifactSegmentProjectionSchema =
  workspaceArtifactSegmentProjectionBaseSchema.extend({
    runtimeFault: z.undefined().optional(),
    entryByteLength: z.number().int().nonnegative(),
    entryHash: workspaceContentHashSchema,
    previewVersion: workspaceContentHashSchema,
  });

const workspaceFaultArtifactSegmentProjectionSchema =
  workspaceArtifactSegmentProjectionBaseSchema.extend({
    runtimeFault: workspaceArtifactRuntimeFaultSchema,
  });

const workspaceArtifactSegmentProjectionSchema = z.union([
  workspaceReadyArtifactSegmentProjectionSchema,
  workspaceFaultArtifactSegmentProjectionSchema,
]);

export const workspaceSegmentProjectionSchema = z.union([
  workspaceAudioSegmentProjectionSchema,
  workspaceNoteSegmentProjectionSchema,
  workspaceArtifactSegmentProjectionSchema,
]);

export const workspaceMemoryDetailProjectionSchema = workspaceMemorySummarySchema.extend({
  workspaceId: z.string().min(1),
  segments: z.array(workspaceSegmentProjectionSchema),
});

export const workspaceReviewSummarySchema = z.strictObject({
  needsReviewCount: z.number().int().nonnegative(),
  markdownCandidateCount: z.number().int().nonnegative(),
  tiptapSidecarCount: z.number().int().nonnegative(),
});

export const workspaceSnapshotSchema = z.strictObject({
  workspaceId: z.string().min(1),
  title: z.string(),
  description: z.string(),
  memories: z.array(workspaceMemorySummarySchema),
  widgets: z.array(workspaceWidgetProjectionSchema).optional(),
  review: workspaceReviewSummarySchema.optional(),
});

export const workspaceSystemDraftProjectionSchema = z.strictObject({
  workspaceId: z.string().min(1),
  title: z.string(),
  systemRole: z.literal('draft-space'),
  defaultMemoryId: memoryIdSchema,
  capabilities: z.strictObject({
    canRename: z.literal(false),
    canRemove: z.literal(false),
    canCreateMemory: z.literal(true),
  }),
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

export const workspaceReadSystemDraftWorkspaceResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      draft: workspaceSystemDraftProjectionSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceOpenSystemDraftWorkspaceResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      workspaceHandle: z.string().min(1),
      workspaceId: z.string().min(1),
      defaultMemoryId: memoryIdSchema,
      draft: workspaceSystemDraftProjectionSchema,
      snapshot: workspaceSnapshotSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceReadRecentExpressionsRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(50).optional(),
});

const workspaceRecentExpressionBaseSchema = z.strictObject({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  workspaceTitle: z.string(),
  memoryId: memoryIdSchema,
  memoryTitle: z.string(),
  segmentId: segmentIdSchema,
  contentKind: z.enum(WORKSPACE_CONTENT_KINDS),
  title: z.string(),
  preview: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const workspaceRecentExpressionItemSchema = z.discriminatedUnion('objectType', [
  workspaceRecentExpressionBaseSchema.extend({
    objectType: z.literal('segment'),
  }),
  workspaceRecentExpressionBaseSchema.extend({
    objectType: z.literal('supplement'),
    supplementId: supplementIdSchema,
  }),
]);

export const workspaceRecentExpressionSkippedSchema = z.strictObject({
  workspaceId: z.string().min(1),
  workspaceTitle: z.string(),
  reason: z.enum(['missing', 'locked', 'unsafe', 'invalid', 'read-error']),
});

export const workspaceReadRecentExpressionsResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      items: z.array(workspaceRecentExpressionItemSchema),
      skipped: z.array(workspaceRecentExpressionSkippedSchema),
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

export const workspaceCreateNoteSegmentDraftRequestSchema = workspaceHandleSchema
  .extend({
    workspaceId: z.string().min(1),
    memoryId: memoryIdSchema,
    title: workspaceRecordingTitleSchema,
  })
  .strict();

export const workspaceCreateSegmentSupplementNoteDraftRequestSchema = workspaceHandleSchema
  .extend({
    workspaceId: z.string().min(1),
    memoryId: memoryIdSchema,
    segmentId: segmentIdSchema,
    title: workspaceRecordingTitleSchema,
  })
  .strict();

export const workspaceWriteNoteSegmentDraftBodyRequestSchema = workspaceHandleSchema
  .extend({
    segmentId: segmentIdSchema,
    bodyMarkdown: noteBodyMarkdownSchema,
    bodyTiptapJson: workspaceTiptapJsonContentSchema.optional(),
    revision: z.number().int().nonnegative(),
  })
  .strict();

export const workspaceWriteSegmentSupplementNoteDraftBodyRequestSchema = workspaceHandleSchema
  .extend({
    supplementId: supplementIdSchema,
    bodyMarkdown: noteBodyMarkdownSchema,
    bodyTiptapJson: workspaceTiptapJsonContentSchema.optional(),
    revision: z.number().int().nonnegative(),
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

export const workspaceUpdateSegmentContentTitleRequestSchema = workspaceMemoryIdRequestSchema
  .extend({
    workspaceId: z.string().min(1),
    segmentId: segmentIdSchema,
    contentTitle: workspaceRecordingTitleSchema,
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

export const workspaceUpdateSegmentContentTabOrderRequestSchema = workspaceMemoryIdRequestSchema
  .extend({
    workspaceId: z.string().min(1),
    segmentId: segmentIdSchema,
    contentTabOrder: z.array(workspaceSegmentContentTabOrderItemSchema).min(1),
  })
  .strict();

export const workspaceWidgetIdRequestSchema = workspaceHandleSchema
  .extend({
    workspaceId: z.string().min(1),
    widgetId: widgetIdSchema,
  })
  .strict();

export const workspaceUpdateWidgetTitleRequestSchema = workspaceWidgetIdRequestSchema
  .extend({
    title: workspaceRecordingTitleSchema,
  })
  .strict();

export const workspaceUpdateWidgetTabOrderRequestSchema = workspaceHandleSchema
  .extend({
    workspaceId: z.string().min(1),
    widgetTabOrder: z.array(workspaceWidgetTabOrderItemSchema),
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

export const workspaceResetMemoryCoverRequestSchema = workspaceMemoryIdRequestSchema;

export const workspaceRestoreMemoryCoverRequestSchema = workspaceMemoryIdRequestSchema
  .extend({
    restoreToken: memoryCoverRestoreTokenSchema,
  })
  .strict();

export const workspaceSwitchMemoryDefaultCoverRequestSchema = workspaceMemoryIdRequestSchema
  .extend({
    templateId: workspaceDefaultCoverTemplateIdSchema,
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

export const workspaceDeleteWidgetRequestSchema = workspaceWidgetIdRequestSchema;

export const workspaceRestoreDeletedWidgetRequestSchema = workspaceHandleSchema
  .extend({
    workspaceId: z.string().min(1),
    restoreToken: widgetIdSchema,
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
  })
  .strict();

export const workspaceReadFinalizedAudioSegmentSupplementRequestSchema =
  workspaceRecordingReadRequestSchema
    .extend({
      workspaceId: z.string().min(1),
      supplementId: supplementIdSchema,
      requestId: z.string().min(1),
    })
    .strict();

export const workspaceReadFinalizedAudioSegmentAudioRequestSchema =
  workspaceRecordingReadRequestSchema
    .extend({
      workspaceId: z.string().min(1),
      requestId: z.string().min(1),
      audioByteLength: z.number().int().nonnegative(),
      audioHash: workspaceContentHashSchema.nullable().optional(),
      maxBytes: z.number().int().positive().max(MAX_RECORDING_DRAFT_AUDIO_READ_BYTES).optional(),
    })
    .strict();

export const workspaceReadFinalizedAudioSegmentSupplementAudioRequestSchema =
  workspaceRecordingReadRequestSchema
    .extend({
      workspaceId: z.string().min(1),
      supplementId: supplementIdSchema,
      requestId: z.string().min(1),
      audioByteLength: z.number().int().nonnegative(),
      audioHash: workspaceContentHashSchema.nullable().optional(),
      maxBytes: z.number().int().positive().max(MAX_RECORDING_DRAFT_AUDIO_READ_BYTES).optional(),
    })
    .strict();

export const workspaceFinalizeNoteSegmentDraftRequestSchema = workspaceHandleSchema
  .extend({
    workspaceId: z.string().min(1),
    memoryId: memoryIdSchema,
    segmentId: segmentIdSchema,
    title: workspaceRecordingTitleSchema,
  })
  .strict();

export const workspaceFinalizeSegmentSupplementNoteDraftRequestSchema = workspaceHandleSchema
  .extend({
    workspaceId: z.string().min(1),
    memoryId: memoryIdSchema,
    segmentId: segmentIdSchema,
    supplementId: supplementIdSchema,
    title: workspaceRecordingTitleSchema,
  })
  .strict();

export const workspaceReadSegmentContentRequestSchema = workspaceRecordingReadRequestSchema
  .extend({
    workspaceId: z.string().min(1),
    requestId: z.string().min(1),
  })
  .strict();

export const workspaceReadSegmentSupplementContentRequestSchema =
  workspaceRecordingReadRequestSchema
    .extend({
      workspaceId: z.string().min(1),
      supplementId: supplementIdSchema,
      requestId: z.string().min(1),
    })
    .strict();

export const workspaceReadSegmentSpeechAudioRequestSchema = workspaceRecordingReadRequestSchema
  .extend({
    workspaceId: z.string().min(1),
    audioByteLength: z.number().int().nonnegative().max(MAX_RECORDING_DRAFT_AUDIO_READ_BYTES),
    contentHash: baselineContentHashSchema,
    requestId: z.string().min(1),
    speaker: voiceSpeechSynthesisSpeakerSchema,
    updatedAt: z.string().min(1),
  })
  .strict();

export const workspaceReadSegmentSupplementSpeechAudioRequestSchema =
  workspaceRecordingReadRequestSchema
    .extend({
      workspaceId: z.string().min(1),
      supplementId: supplementIdSchema,
      audioByteLength: z.number().int().nonnegative().max(MAX_RECORDING_DRAFT_AUDIO_READ_BYTES),
      contentHash: baselineContentHashSchema,
      requestId: z.string().min(1),
      speaker: voiceSpeechSynthesisSpeakerSchema,
      updatedAt: z.string().min(1),
    })
    .strict();

function requireBaselineTiptapContentHashWhenTiptapJsonPresent(
  jsonField: 'bodyTiptapJson' | 'tiptapJson'
) {
  return (
    value: {
      readonly bodyTiptapJson?: unknown;
      readonly tiptapJson?: unknown;
      readonly baselineTiptapContentHash?: unknown;
    },
    ctx: z.RefinementCtx
  ) => {
    if (value[jsonField] !== undefined && value.baselineTiptapContentHash === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'baselineTiptapContentHash is required when Tiptap JSON is provided',
        path: ['baselineTiptapContentHash'],
      });
    }
  };
}

export const workspaceWriteSegmentContentRequestSchema = workspaceRecordingReadRequestSchema
  .extend({
    workspaceId: z.string().min(1),
    bodyMarkdown: noteBodyMarkdownSchema,
    bodyTiptapJson: workspaceTiptapJsonContentSchema.optional(),
    baselineContentHash: baselineContentHashSchema,
    baselineTiptapContentHash: baselineContentHashSchema.optional(),
  })
  .strict()
  .superRefine(requireBaselineTiptapContentHashWhenTiptapJsonPresent('bodyTiptapJson'));

export const workspaceWriteSegmentSupplementContentRequestSchema =
  workspaceReadSegmentSupplementContentRequestSchema
    .omit({ requestId: true })
    .extend({
      bodyMarkdown: noteBodyMarkdownSchema,
      bodyTiptapJson: workspaceTiptapJsonContentSchema.optional(),
      baselineContentHash: baselineContentHashSchema,
      baselineTiptapContentHash: baselineContentHashSchema.optional(),
    })
    .strict()
    .superRefine(requireBaselineTiptapContentHashWhenTiptapJsonPresent('bodyTiptapJson'));

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

export const workspaceResetSegmentCoverRequestSchema = workspaceSegmentEntityRequestSchema;

export const workspaceRestoreSegmentCoverRequestSchema = workspaceSegmentEntityRequestSchema
  .extend({
    restoreToken: segmentCoverRestoreTokenSchema,
  })
  .strict();

export const workspaceSwitchSegmentDefaultCoverRequestSchema = workspaceSegmentEntityRequestSchema
  .extend({
    templateId: workspaceDefaultCoverTemplateIdSchema,
  })
  .strict();

const workspaceSegmentSupplementEntityRequestSchema = workspaceSegmentEntityRequestSchema
  .extend({
    supplementId: supplementIdSchema,
  })
  .strict();

const attachmentPayloadSchema = z.instanceof(Uint8Array);
const workspaceSaveSegmentAttachmentBaseSchema = workspaceSegmentEntityRequestSchema
  .extend({
    originalFilename: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(100),
    payload: attachmentPayloadSchema,
  })
  .strict();

export const workspaceSaveSegmentAttachmentRequestSchema = workspaceSaveSegmentAttachmentBaseSchema;
export const workspaceListSegmentAttachmentsRequestSchema = workspaceSegmentEntityRequestSchema;
export const workspaceSaveSegmentSupplementAttachmentRequestSchema =
  workspaceSegmentSupplementEntityRequestSchema
    .extend({
      originalFilename: z.string().min(1).max(255),
      mimeType: z.string().min(1).max(100),
      payload: attachmentPayloadSchema,
    })
    .strict();
export const workspaceListSegmentSupplementAttachmentsRequestSchema =
  workspaceSegmentSupplementEntityRequestSchema;

export const workspaceRevealMemorySpaceInFinderRequestSchema = workspaceMemorySpaceIdRequestSchema;
export const workspaceRevealMemoryInFinderRequestSchema = workspaceMemoryEntityRequestSchema;
export const workspaceRevealSegmentInFinderRequestSchema = workspaceSegmentEntityRequestSchema;
export const workspaceRevealSegmentSupplementInFinderRequestSchema =
  workspaceSegmentSupplementEntityRequestSchema;
export const workspaceRevealWidgetInFinderRequestSchema = workspaceWidgetIdRequestSchema;
export const workspaceOpenMemorySpaceAgentsFileRequestSchema = workspaceMemorySpaceIdRequestSchema;
export const workspaceOpenMemoryDocumentRequestSchema = workspaceMemoryEntityRequestSchema;
export const workspaceOpenSegmentDocumentRequestSchema = workspaceSegmentEntityRequestSchema;
export const workspaceOpenSegmentSupplementDocumentRequestSchema =
  workspaceSegmentSupplementEntityRequestSchema;
export const workspaceOpenWidgetDocumentRequestSchema = workspaceWidgetIdRequestSchema;
export const workspaceCopyMemorySpaceAbsolutePathRequestSchema =
  workspaceMemorySpaceIdRequestSchema;
export const workspaceCopyMemoryAbsolutePathRequestSchema = workspaceMemoryEntityRequestSchema;
export const workspaceCopySegmentAbsolutePathRequestSchema = workspaceSegmentEntityRequestSchema;
export const workspaceCopySegmentSupplementAbsolutePathRequestSchema =
  workspaceSegmentSupplementEntityRequestSchema;
export const workspaceCopyWidgetAbsolutePathRequestSchema = workspaceWidgetIdRequestSchema;
export const workspaceCopyMemoryRelativePathRequestSchema = workspaceMemoryEntityRequestSchema;
export const workspaceCopySegmentRelativePathRequestSchema = workspaceSegmentEntityRequestSchema;
export const workspaceCopySegmentSupplementRelativePathRequestSchema =
  workspaceSegmentSupplementEntityRequestSchema;
export const workspaceCopyWidgetRelativePathRequestSchema = workspaceWidgetIdRequestSchema;
const workspaceCopyArtifactAgentPromptBaseSchema = workspaceHandleSchema.extend({
  workspaceId: z.string().min(1),
  memoryId: memoryIdSchema,
});
export const workspaceCopyArtifactAgentPromptRequestSchema = z.discriminatedUnion('action', [
  workspaceCopyArtifactAgentPromptBaseSchema
    .extend({
      action: z.literal('create-segment'),
    })
    .strict(),
  workspaceCopyArtifactAgentPromptBaseSchema
    .extend({
      action: z.literal('create-supplement'),
      segmentId: segmentIdSchema,
    })
    .strict(),
  workspaceCopyArtifactAgentPromptBaseSchema
    .extend({
      action: z.literal('update-segment'),
      segmentId: segmentIdSchema,
    })
    .strict(),
  workspaceCopyArtifactAgentPromptBaseSchema
    .extend({
      action: z.literal('update-supplement'),
      segmentId: segmentIdSchema,
      supplementId: supplementIdSchema,
    })
    .strict(),
]);
export const workspaceCopyWidgetAgentPromptRequestSchema = z.discriminatedUnion('action', [
  workspaceHandleSchema
    .extend({
      workspaceId: z.string().min(1),
      action: z.literal('create-widget'),
    })
    .strict(),
  workspaceWidgetIdRequestSchema
    .extend({
      action: z.literal('update-widget'),
    })
    .strict(),
]);

const workspaceArtifactRuntimeTargetBaseSchema = workspaceHandleSchema.extend({
  workspaceId: z.string().min(1),
  memoryId: memoryIdSchema,
  segmentId: segmentIdSchema,
});
export const workspaceArtifactRuntimeTargetRequestSchema = z.discriminatedUnion('targetType', [
  workspaceArtifactRuntimeTargetBaseSchema
    .extend({
      targetType: z.literal('segment'),
    })
    .strict(),
  workspaceArtifactRuntimeTargetBaseSchema
    .extend({
      targetType: z.literal('supplement'),
      supplementId: supplementIdSchema,
    })
    .strict(),
  workspaceHandleSchema
    .extend({
      workspaceId: z.string().min(1),
      targetType: z.literal('widget'),
      widgetId: widgetIdSchema,
    })
    .strict(),
]);
export const workspaceReadArtifactRuntimeStateRequestSchema =
  workspaceArtifactRuntimeTargetRequestSchema.and(
    z.strictObject({
      requestId: z.string().min(1),
    })
  );
export const workspaceWriteArtifactRuntimeStateRequestSchema =
  workspaceArtifactRuntimeTargetRequestSchema.and(
    z.strictObject({
      requestId: z.string().min(1),
      baselineVersion: baselineContentHashSchema,
      state: workspaceArtifactRuntimeStateJsonSchema,
    })
  );
export const workspaceCopyNeedsReviewAgentPromptRequestSchema = workspaceHandleSchema
  .extend({
    workspaceId: z.string().min(1),
    needsReviewCount: z.number().int().nonnegative(),
  })
  .strict();

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

export const workspaceUpdateSegmentContentTitleResponseSchema =
  workspaceUpdateSegmentTitleResponseSchema;

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

export const workspaceUpdateSegmentContentTabOrderResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      segment: workspaceSegmentProjectionSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceUpdateWidgetTitleResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      widget: workspaceWidgetProjectionSchema,
      widgets: z.array(workspaceWidgetProjectionSchema),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceUpdateWidgetTabOrderResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      widgets: z.array(workspaceWidgetProjectionSchema),
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

const workspaceArtifactRuntimeStateReadValueSchema = z.strictObject({
  requestId: z.string().min(1),
  source: z.enum(['file', 'missing', 'invalid']),
  state: workspaceArtifactRuntimeStateJsonSchema,
  version: baselineContentHashSchema,
});

export const workspaceReadArtifactRuntimeStateResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: workspaceArtifactRuntimeStateReadValueSchema,
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceWriteArtifactRuntimeStateResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.discriminatedUnion('status', [
      z.strictObject({
        status: z.literal('saved'),
        requestId: z.string().min(1),
        state: workspaceArtifactRuntimeStateJsonSchema,
        version: baselineContentHashSchema,
      }),
      z.strictObject({
        status: z.literal('stale'),
        requestId: z.string().min(1),
        currentState: workspaceArtifactRuntimeStateJsonSchema,
        currentVersion: baselineContentHashSchema,
      }),
    ]),
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

export const workspaceDeleteWidgetResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      widgets: z.array(workspaceWidgetProjectionSchema),
      restoreToken: widgetIdSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceRestoreDeletedWidgetResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      widget: workspaceWidgetProjectionSchema,
      widgets: z.array(workspaceWidgetProjectionSchema),
    }),
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

export const workspaceResetMemoryCoverResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      memories: z.array(workspaceMemorySummarySchema),
      restoreToken: memoryCoverRestoreTokenSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceRestoreMemoryCoverResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      memories: z.array(workspaceMemorySummarySchema),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceSwitchMemoryDefaultCoverResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      memories: z.array(workspaceMemorySummarySchema),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceResetSegmentCoverResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      segment: workspaceSegmentProjectionSchema,
      restoreToken: segmentCoverRestoreTokenSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceRestoreSegmentCoverResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      segment: workspaceSegmentProjectionSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceSwitchSegmentDefaultCoverResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      segment: workspaceSegmentProjectionSchema,
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

const workspaceTranscriptContentSchema = z.strictObject({
  exists: z.boolean(),
  text: workspaceEditableMarkdownBodySchema,
  baselineHash: baselineContentHashSchema,
  tiptapJson: workspaceTiptapJsonContentSchema,
  baselineTiptapContentHash: baselineContentHashSchema,
});

export const workspaceReadFinalizedAudioSegmentResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      requestId: z.string().min(1),
      workspaceId: z.string().min(1),
      memoryId: memoryIdSchema,
      segmentId: segmentIdSchema,
      audioByteLength: z.number().int().nonnegative(),
      audioHash: workspaceContentHashSchema.nullable(),
      transcript: workspaceTranscriptContentSchema,
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
        audioByteLength: z.number().int().nonnegative(),
        audioHash: workspaceContentHashSchema.nullable(),
        transcript: workspaceTranscriptContentSchema,
      }),
    }),
    workspaceErrorEnvelopeSchema,
  ]
);

export const workspaceReadFinalizedAudioSegmentAudioResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      requestId: z.string().min(1),
      workspaceId: z.string().min(1),
      memoryId: memoryIdSchema,
      segmentId: segmentIdSchema,
      audio: z.instanceof(Uint8Array),
      audioByteLength: z.number().int().nonnegative(),
      audioHash: workspaceContentHashSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceReadFinalizedAudioSegmentSupplementAudioResponseSchema = z.discriminatedUnion(
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
        audioHash: workspaceContentHashSchema,
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

export const workspaceCreateNoteSegmentDraftResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      segmentId: segmentIdSchema,
      revision: z.number().int().nonnegative(),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceCreateSegmentSupplementNoteDraftResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      supplementId: supplementIdSchema,
      revision: z.number().int().nonnegative(),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceWriteNoteSegmentDraftBodyResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      bodyByteLength: z.number().int().nonnegative(),
      revision: z.number().int().nonnegative(),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceWriteSegmentSupplementNoteDraftBodyResponseSchema =
  workspaceWriteNoteSegmentDraftBodyResponseSchema;

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

export const workspaceFinalizeNoteSegmentDraftResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      memory: workspaceMemorySummarySchema,
      segment: workspaceNoteSegmentProjectionSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceFinalizeSegmentSupplementNoteDraftResponseSchema = z.discriminatedUnion(
  'ok',
  [
    z.strictObject({
      ok: z.literal(true),
      value: z.strictObject({
        memory: workspaceMemorySummarySchema,
        segment: workspaceSegmentProjectionSchema,
        supplement: workspaceNoteSegmentSupplementProjectionSchema,
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
      baselineTranscriptHash: baselineContentHashSchema,
      baselineTiptapContentHash: baselineContentHashSchema,
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
      baselineTranscriptHash: baselineContentHashSchema,
      baselineTiptapContentHash: baselineContentHashSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

const workspaceNoteSegmentContentSchema = z.strictObject({
  requestId: z.string().min(1),
  workspaceId: z.string().min(1),
  memoryId: memoryIdSchema,
  segmentId: segmentIdSchema,
  type: z.literal('note'),
  title: workspaceRecordingTitleSchema,
  bodyMarkdown: noteBodyMarkdownSchema,
  bodyTiptapJson: workspaceTiptapJsonContentSchema,
  bodyByteLength: z.number().int().nonnegative(),
  baselineContentHash: baselineContentHashSchema,
  baselineTiptapContentHash: baselineContentHashSchema,
  speechSynthesis: workspaceNoteSpeechSynthesisProjectionSchema,
});

const workspaceNoteSegmentSupplementContentSchema = workspaceNoteSegmentContentSchema.extend({
  supplementId: supplementIdSchema,
});

export const workspaceReadSegmentContentResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: workspaceNoteSegmentContentSchema,
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceReadSegmentSupplementContentResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: workspaceNoteSegmentSupplementContentSchema,
  }),
  workspaceErrorEnvelopeSchema,
]);

const workspaceNoteSpeechAudioSchema = z.strictObject({
  requestId: z.string().min(1),
  workspaceId: z.string().min(1),
  memoryId: memoryIdSchema,
  segmentId: segmentIdSchema,
  audio: z.instanceof(Uint8Array),
  audioByteLength: z.number().int().nonnegative(),
  contentHash: baselineContentHashSchema,
  mimeType: z.literal('audio/mpeg'),
});

export const workspaceReadSegmentSpeechAudioResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: workspaceNoteSpeechAudioSchema,
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceReadSegmentSupplementSpeechAudioResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: workspaceNoteSpeechAudioSchema.extend({ supplementId: supplementIdSchema }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceWriteSegmentContentResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      bodyByteLength: z.number().int().nonnegative(),
      baselineContentHash: baselineContentHashSchema,
      baselineTiptapContentHash: baselineContentHashSchema,
      saved: z.literal(true),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceWriteSegmentSupplementContentResponseSchema =
  workspaceWriteSegmentContentResponseSchema;

export const workspaceAttachmentMetadataSchema = z.strictObject({
  relativePath: z.string().regex(/^attachments\/[^/]+$/),
  byteLength: z.number().int().nonnegative(),
  mimeType: z.string().min(1),
});

export const workspaceSaveAttachmentResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      relativePath: z.string().regex(/^attachments\/[^/]+$/),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceListAttachmentsResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      attachments: z.array(workspaceAttachmentMetadataSchema),
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
    recordingFlowSessionId: z.string().min(1),
    recordingSessionId: z.string().min(1),
    revisionId: z.string().min(1),
    segments: z.array(workspaceTranscriptSegmentSchema),
  }),
  z.strictObject({
    kind: z.literal('error'),
    message: z.string().min(1),
    recordingFlowSessionId: z.string().min(1),
    recordingSessionId: z.string().min(1),
    revisionId: z.string().min(1),
  }),
  z.strictObject({
    kind: z.literal('closed'),
    recordingFlowSessionId: z.string().min(1),
    recordingSessionId: z.string().min(1),
    revisionId: z.string().min(1),
  }),
]);

export const workspaceFileTruthChangedEventSchema = z.strictObject({
  kind: z.literal('changed'),
  reason: z.literal('file-system'),
  sequence: z.number().int().positive(),
  workspaceHandle: z.string().min(1),
  workspaceId: z.string().min(1),
});

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
    markdown: workspaceEditableMarkdownBodySchema,
    baselineTranscriptHash: baselineContentHashSchema.optional(),
    tiptapJson: workspaceTiptapJsonContentSchema.optional(),
    baselineTiptapContentHash: baselineContentHashSchema.optional(),
  })
  .strict()
  .superRefine(requireBaselineTiptapContentHashWhenTiptapJsonPresent('tiptapJson'));

export const workspaceSegmentSupplementMarkdownSaveRequestSchema =
  workspaceReadFinalizedAudioSegmentSupplementRequestSchema
    .omit({ requestId: true })
    .extend({
      markdown: workspaceEditableMarkdownBodySchema,
      baselineTranscriptHash: baselineContentHashSchema.optional(),
      tiptapJson: workspaceTiptapJsonContentSchema.optional(),
      baselineTiptapContentHash: baselineContentHashSchema.optional(),
    })
    .strict()
    .superRefine(requireBaselineTiptapContentHashWhenTiptapJsonPresent('tiptapJson'));

export const workspaceRequestSegmentTranscriptionBackfillRequestSchema =
  workspaceSegmentEntityRequestSchema
    .extend({ mode: z.enum(['fill-missing', 'regenerate']) })
    .strict();
export const workspaceRequestSegmentSupplementTranscriptionBackfillRequestSchema =
  workspaceSegmentSupplementEntityRequestSchema
    .extend({ mode: z.enum(['fill-missing', 'regenerate']) })
    .strict();
export const workspaceRequestSegmentTranscriptionBackfillResponseSchema =
  workspaceRecordingMarkdownSaveResponseSchema;
export const workspaceRequestSegmentSupplementTranscriptionBackfillResponseSchema =
  workspaceSegmentSupplementMarkdownSaveResponseSchema;

export const workspaceRequestSegmentSpeechSynthesisRequestSchema =
  workspaceSegmentEntityRequestSchema
    .extend({
      mode: z.enum(['fill-missing', 'regenerate']),
      speaker: voiceSpeechSynthesisSpeakerSchema.optional(),
    })
    .strict();
export const workspaceRequestSegmentSupplementSpeechSynthesisRequestSchema =
  workspaceSegmentSupplementEntityRequestSchema
    .extend({
      mode: z.enum(['fill-missing', 'regenerate']),
      speaker: voiceSpeechSynthesisSpeakerSchema.optional(),
    })
    .strict();
const workspaceRegenerateImportedSpeechSynthesisActiveWorkspaceSchema = z.strictObject({
  workspaceHandle: z.string().min(1),
  workspaceId: z.string().min(1),
});
export const workspaceSpeechSynthesisBatchTargetSchema = z.discriminatedUnion('kind', [
  workspaceSegmentEntityRequestSchema
    .omit({ workspaceHandle: true })
    .extend({ kind: z.literal('segment') })
    .strict(),
  workspaceSegmentSupplementEntityRequestSchema
    .omit({ workspaceHandle: true })
    .extend({ kind: z.literal('supplement') })
    .strict(),
]);
export const workspaceRegenerateImportedSpeechSynthesisRequestSchema = z.discriminatedUnion(
  'mode',
  [
    z.strictObject({
      activeWorkspace: workspaceRegenerateImportedSpeechSynthesisActiveWorkspaceSchema.optional(),
      mode: z.literal('all'),
      speaker: voiceSpeechSynthesisSpeakerSchema,
    }),
    z.strictObject({
      activeWorkspace: workspaceRegenerateImportedSpeechSynthesisActiveWorkspaceSchema.optional(),
      mode: z.literal('retry'),
      speaker: voiceSpeechSynthesisSpeakerSchema,
      targets: z.array(workspaceSpeechSynthesisBatchTargetSchema).min(1).max(500),
    }),
  ]
);
export const workspaceSpeechSynthesisResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      speechSynthesis: workspaceNoteSpeechSynthesisProjectionSchema,
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);
export const workspaceRequestSegmentSpeechSynthesisResponseSchema =
  workspaceSpeechSynthesisResponseSchema;
export const workspaceRequestSegmentSupplementSpeechSynthesisResponseSchema =
  workspaceSpeechSynthesisResponseSchema;
export const workspaceRegenerateImportedSpeechSynthesisResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    value: z.strictObject({
      failed: z.number().int().min(0),
      failedTargets: z.array(workspaceSpeechSynthesisBatchTargetSchema).max(500),
      generated: z.number().int().min(0),
      skipped: z.number().int().min(0),
      speaker: voiceSpeechSynthesisSpeakerSchema,
      total: z.number().int().min(0),
    }),
  }),
  workspaceErrorEnvelopeSchema,
]);

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
export type WorkspaceSetVoiceSpeechSynthesisSpeakerRequest = z.infer<
  typeof workspaceSetVoiceSpeechSynthesisSpeakerRequestSchema
>;
export type WorkspaceSetVoiceSpeechSynthesisSpeakerResponse = z.infer<
  typeof workspaceSetVoiceSpeechSynthesisSpeakerResponseSchema
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
export type WorkspaceOpenMarkdownExternalLinkRequest = z.infer<
  typeof workspaceOpenMarkdownExternalLinkRequestSchema
>;
export type WorkspaceOpenMarkdownExternalLinkResponse = z.infer<
  typeof workspaceOpenMarkdownExternalLinkResponseSchema
>;
export type WorkspaceRequestSegmentSpeechSynthesisRequest = z.infer<
  typeof workspaceRequestSegmentSpeechSynthesisRequestSchema
>;
export type WorkspaceRequestSegmentSpeechSynthesisResponse = z.infer<
  typeof workspaceRequestSegmentSpeechSynthesisResponseSchema
>;
export type WorkspaceRequestSegmentSupplementSpeechSynthesisRequest = z.infer<
  typeof workspaceRequestSegmentSupplementSpeechSynthesisRequestSchema
>;
export type WorkspaceRequestSegmentSupplementSpeechSynthesisResponse = z.infer<
  typeof workspaceRequestSegmentSupplementSpeechSynthesisResponseSchema
>;
export type WorkspaceSpeechSynthesisBatchTarget = z.infer<
  typeof workspaceSpeechSynthesisBatchTargetSchema
>;
export type WorkspaceRegenerateImportedSpeechSynthesisRequest = z.infer<
  typeof workspaceRegenerateImportedSpeechSynthesisRequestSchema
>;
export type WorkspaceRegenerateImportedSpeechSynthesisResponse = z.infer<
  typeof workspaceRegenerateImportedSpeechSynthesisResponseSchema
>;
export type WorkspaceChooseDirectoryResult = z.infer<typeof workspaceChooseDirectoryResultSchema>;
export type WorkspaceChooseDirectoryResponse = z.infer<
  typeof workspaceChooseDirectoryResponseSchema
>;
export type DraftSegmentMetadata = z.infer<typeof draftSegmentMetadataSchema>;
export type DraftSegmentSupplementMetadata = z.infer<typeof draftSegmentSupplementMetadataSchema>;
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;
export type WorkspaceSystemDraftProjection = z.infer<typeof workspaceSystemDraftProjectionSchema>;
export type WorkspaceReadSystemDraftWorkspaceResponse = z.infer<
  typeof workspaceReadSystemDraftWorkspaceResponseSchema
>;
export type WorkspaceOpenSystemDraftWorkspaceResponse = z.infer<
  typeof workspaceOpenSystemDraftWorkspaceResponseSchema
>;
export type WorkspaceReadRecentExpressionsRequest = z.infer<
  typeof workspaceReadRecentExpressionsRequestSchema
>;
export type WorkspaceRecentExpressionItem = z.infer<typeof workspaceRecentExpressionItemSchema>;
export type WorkspaceRecentExpressionSkipped = z.infer<
  typeof workspaceRecentExpressionSkippedSchema
>;
export type WorkspaceReadRecentExpressionsResponse = z.infer<
  typeof workspaceReadRecentExpressionsResponseSchema
>;
export type WorkspaceReviewSummary = z.infer<typeof workspaceReviewSummarySchema>;
export type WorkspaceDefaultCoverTemplateId = z.infer<typeof workspaceDefaultCoverTemplateIdSchema>;
export type WorkspaceCoverProjection = z.infer<typeof workspaceCoverProjectionSchema>;
export type WorkspaceMemoryCoverProjection = z.infer<typeof workspaceMemoryCoverProjectionSchema>;
export type WorkspaceArtifactRuntimeFaultProjection = z.infer<
  typeof workspaceArtifactRuntimeFaultSchema
>;
export type WorkspaceWidgetProjection = z.infer<typeof workspaceWidgetProjectionSchema>;
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
export type WorkspaceWidgetEntityActionRequest = z.infer<typeof workspaceWidgetIdRequestSchema>;
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
export type WorkspaceRevealWidgetInFinderRequest = z.infer<
  typeof workspaceRevealWidgetInFinderRequestSchema
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
export type WorkspaceOpenWidgetDocumentRequest = z.infer<
  typeof workspaceOpenWidgetDocumentRequestSchema
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
export type WorkspaceCopyWidgetAbsolutePathRequest = z.infer<
  typeof workspaceCopyWidgetAbsolutePathRequestSchema
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
export type WorkspaceCopyWidgetRelativePathRequest = z.infer<
  typeof workspaceCopyWidgetRelativePathRequestSchema
>;
export type WorkspaceCopyArtifactAgentPromptRequest = z.infer<
  typeof workspaceCopyArtifactAgentPromptRequestSchema
>;
export type WorkspaceCopyWidgetAgentPromptRequest = z.infer<
  typeof workspaceCopyWidgetAgentPromptRequestSchema
>;
export type WorkspaceArtifactRuntimeStateJson = z.infer<
  typeof workspaceArtifactRuntimeStateJsonSchema
>;
export type WorkspaceArtifactRuntimeTargetRequest = z.infer<
  typeof workspaceArtifactRuntimeTargetRequestSchema
>;
export type WorkspaceReadArtifactRuntimeStateRequest = z.infer<
  typeof workspaceReadArtifactRuntimeStateRequestSchema
>;
export type WorkspaceReadArtifactRuntimeStateResponse = z.infer<
  typeof workspaceReadArtifactRuntimeStateResponseSchema
>;
export type WorkspaceWriteArtifactRuntimeStateRequest = z.infer<
  typeof workspaceWriteArtifactRuntimeStateRequestSchema
>;
export type WorkspaceWriteArtifactRuntimeStateResponse = z.infer<
  typeof workspaceWriteArtifactRuntimeStateResponseSchema
>;
export type WorkspaceCopyNeedsReviewAgentPromptRequest = z.infer<
  typeof workspaceCopyNeedsReviewAgentPromptRequestSchema
>;
export type WorkspaceUpdateWidgetTitleRequest = z.infer<
  typeof workspaceUpdateWidgetTitleRequestSchema
>;
export type WorkspaceUpdateWidgetTitleResponse = z.infer<
  typeof workspaceUpdateWidgetTitleResponseSchema
>;
export type WorkspaceUpdateWidgetTabOrderRequest = z.infer<
  typeof workspaceUpdateWidgetTabOrderRequestSchema
>;
export type WorkspaceUpdateWidgetTabOrderResponse = z.infer<
  typeof workspaceUpdateWidgetTabOrderResponseSchema
>;
export type WorkspaceDeleteWidgetRequest = z.infer<typeof workspaceDeleteWidgetRequestSchema>;
export type WorkspaceDeleteWidgetResponse = z.infer<typeof workspaceDeleteWidgetResponseSchema>;
export type WorkspaceRestoreDeletedWidgetRequest = z.infer<
  typeof workspaceRestoreDeletedWidgetRequestSchema
>;
export type WorkspaceRestoreDeletedWidgetResponse = z.infer<
  typeof workspaceRestoreDeletedWidgetResponseSchema
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
export type WorkspaceCreateNoteSegmentDraftRequest = z.infer<
  typeof workspaceCreateNoteSegmentDraftRequestSchema
>;
export type WorkspaceCreateSegmentSupplementNoteDraftRequest = z.infer<
  typeof workspaceCreateSegmentSupplementNoteDraftRequestSchema
>;
export type WorkspaceWriteNoteSegmentDraftBodyRequest = z.infer<
  typeof workspaceWriteNoteSegmentDraftBodyRequestSchema
>;
export type WorkspaceWriteSegmentSupplementNoteDraftBodyRequest = z.infer<
  typeof workspaceWriteSegmentSupplementNoteDraftBodyRequestSchema
>;
export type WorkspaceFinalizeNoteSegmentDraftRequest = z.infer<
  typeof workspaceFinalizeNoteSegmentDraftRequestSchema
>;
export type WorkspaceFinalizeSegmentSupplementNoteDraftRequest = z.infer<
  typeof workspaceFinalizeSegmentSupplementNoteDraftRequestSchema
>;
export type WorkspaceReadSegmentContentRequest = z.infer<
  typeof workspaceReadSegmentContentRequestSchema
>;
export type WorkspaceReadSegmentSupplementContentRequest = z.infer<
  typeof workspaceReadSegmentSupplementContentRequestSchema
>;
export type WorkspaceReadSegmentSpeechAudioRequest = z.infer<
  typeof workspaceReadSegmentSpeechAudioRequestSchema
>;
export type WorkspaceReadSegmentSupplementSpeechAudioRequest = z.infer<
  typeof workspaceReadSegmentSupplementSpeechAudioRequestSchema
>;
export type WorkspaceWriteSegmentContentRequest = z.infer<
  typeof workspaceWriteSegmentContentRequestSchema
>;
export type WorkspaceWriteSegmentSupplementContentRequest = z.infer<
  typeof workspaceWriteSegmentSupplementContentRequestSchema
>;
type WorkspaceSaveSegmentAttachmentRequestFromSchema = z.infer<
  typeof workspaceSaveSegmentAttachmentRequestSchema
>;
export type WorkspaceSaveSegmentAttachmentRequest = Omit<
  WorkspaceSaveSegmentAttachmentRequestFromSchema,
  'payload'
> & {
  readonly payload: Uint8Array<ArrayBufferLike>;
};
export type WorkspaceListSegmentAttachmentsRequest = z.infer<
  typeof workspaceListSegmentAttachmentsRequestSchema
>;
type WorkspaceSaveSegmentSupplementAttachmentRequestFromSchema = z.infer<
  typeof workspaceSaveSegmentSupplementAttachmentRequestSchema
>;
export type WorkspaceSaveSegmentSupplementAttachmentRequest = Omit<
  WorkspaceSaveSegmentSupplementAttachmentRequestFromSchema,
  'payload'
> & {
  readonly payload: Uint8Array<ArrayBufferLike>;
};
export type WorkspaceListSegmentSupplementAttachmentsRequest = z.infer<
  typeof workspaceListSegmentSupplementAttachmentsRequestSchema
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
export type WorkspaceUpdateSegmentContentTitleRequest = z.infer<
  typeof workspaceUpdateSegmentContentTitleRequestSchema
>;
export type WorkspaceUpdateSegmentSupplementTitleRequest = z.infer<
  typeof workspaceUpdateSegmentSupplementTitleRequestSchema
>;
export type WorkspaceUpdateSegmentContentTabOrderRequest = z.infer<
  typeof workspaceUpdateSegmentContentTabOrderRequestSchema
>;
export type WorkspaceCreateMemoryRequest = z.infer<typeof workspaceCreateMemoryRequestSchema>;
export type WorkspaceDeleteMemoryRequest = z.infer<typeof workspaceDeleteMemoryRequestSchema>;
export type WorkspaceRestoreDeletedMemoryRequest = z.infer<
  typeof workspaceRestoreDeletedMemoryRequestSchema
>;
export type WorkspaceResetMemoryCoverRequest = z.infer<
  typeof workspaceResetMemoryCoverRequestSchema
>;
export type WorkspaceRestoreMemoryCoverRequest = z.infer<
  typeof workspaceRestoreMemoryCoverRequestSchema
>;
export type WorkspaceSwitchMemoryDefaultCoverRequest = z.infer<
  typeof workspaceSwitchMemoryDefaultCoverRequestSchema
>;
export type WorkspaceResetSegmentCoverRequest = z.infer<
  typeof workspaceResetSegmentCoverRequestSchema
>;
export type WorkspaceRestoreSegmentCoverRequest = z.infer<
  typeof workspaceRestoreSegmentCoverRequestSchema
>;
export type WorkspaceSwitchSegmentDefaultCoverRequest = z.infer<
  typeof workspaceSwitchSegmentDefaultCoverRequestSchema
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
export type WorkspaceReadFinalizedAudioSegmentAudioRequest = z.infer<
  typeof workspaceReadFinalizedAudioSegmentAudioRequestSchema
>;
export type WorkspaceReadFinalizedAudioSegmentSupplementAudioRequest = z.infer<
  typeof workspaceReadFinalizedAudioSegmentSupplementAudioRequestSchema
>;
export type WorkspaceUpdateMemoryTitleResponse = z.infer<
  typeof workspaceUpdateMemoryTitleResponseSchema
>;
export type WorkspaceUpdateSegmentTitleResponse = z.infer<
  typeof workspaceUpdateSegmentTitleResponseSchema
>;
export type WorkspaceUpdateSegmentContentTitleResponse = z.infer<
  typeof workspaceUpdateSegmentContentTitleResponseSchema
>;
export type WorkspaceUpdateSegmentSupplementTitleResponse = z.infer<
  typeof workspaceUpdateSegmentSupplementTitleResponseSchema
>;
export type WorkspaceUpdateSegmentContentTabOrderResponse = z.infer<
  typeof workspaceUpdateSegmentContentTabOrderResponseSchema
>;
export type WorkspaceEntityActionResponse = z.infer<typeof workspaceEntityActionResponseSchema>;
export type WorkspaceCreateMemoryResponse = z.infer<typeof workspaceCreateMemoryResponseSchema>;
export type WorkspaceDeleteMemoryResponse = z.infer<typeof workspaceDeleteMemoryResponseSchema>;
export type WorkspaceRestoreDeletedMemoryResponse = z.infer<
  typeof workspaceRestoreDeletedMemoryResponseSchema
>;
export type WorkspaceResetMemoryCoverResponse = z.infer<
  typeof workspaceResetMemoryCoverResponseSchema
>;
export type WorkspaceRestoreMemoryCoverResponse = z.infer<
  typeof workspaceRestoreMemoryCoverResponseSchema
>;
export type WorkspaceSwitchMemoryDefaultCoverResponse = z.infer<
  typeof workspaceSwitchMemoryDefaultCoverResponseSchema
>;
export type WorkspaceResetSegmentCoverResponse = z.infer<
  typeof workspaceResetSegmentCoverResponseSchema
>;
export type WorkspaceRestoreSegmentCoverResponse = z.infer<
  typeof workspaceRestoreSegmentCoverResponseSchema
>;
export type WorkspaceSwitchSegmentDefaultCoverResponse = z.infer<
  typeof workspaceSwitchSegmentDefaultCoverResponseSchema
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
export type WorkspaceReadFinalizedAudioSegmentAudioResponse = z.infer<
  typeof workspaceReadFinalizedAudioSegmentAudioResponseSchema
>;
export type WorkspaceReadFinalizedAudioSegmentSupplementAudioResponse = z.infer<
  typeof workspaceReadFinalizedAudioSegmentSupplementAudioResponseSchema
>;
export type WorkspaceReadSegmentSpeechAudioResponse = z.infer<
  typeof workspaceReadSegmentSpeechAudioResponseSchema
>;
export type WorkspaceReadSegmentSupplementSpeechAudioResponse = z.infer<
  typeof workspaceReadSegmentSupplementSpeechAudioResponseSchema
>;
export type WorkspaceCreateRecordingDraftResponse = z.infer<
  typeof workspaceCreateRecordingDraftResponseSchema
>;
export type WorkspaceCreateSegmentSupplementRecordingDraftResponse = z.infer<
  typeof workspaceCreateSegmentSupplementRecordingDraftResponseSchema
>;
export type WorkspaceCreateNoteSegmentDraftResponse = z.infer<
  typeof workspaceCreateNoteSegmentDraftResponseSchema
>;
export type WorkspaceCreateSegmentSupplementNoteDraftResponse = z.infer<
  typeof workspaceCreateSegmentSupplementNoteDraftResponseSchema
>;
export type WorkspaceWriteNoteSegmentDraftBodyResponse = z.infer<
  typeof workspaceWriteNoteSegmentDraftBodyResponseSchema
>;
export type WorkspaceWriteSegmentSupplementNoteDraftBodyResponse = z.infer<
  typeof workspaceWriteSegmentSupplementNoteDraftBodyResponseSchema
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
export type WorkspaceFinalizeNoteSegmentDraftResponse = z.infer<
  typeof workspaceFinalizeNoteSegmentDraftResponseSchema
>;
export type WorkspaceFinalizeSegmentSupplementNoteDraftResponse = z.infer<
  typeof workspaceFinalizeSegmentSupplementNoteDraftResponseSchema
>;
export type WorkspaceDiscardRecordingDraftResponse = z.infer<
  typeof workspaceDiscardRecordingDraftResponseSchema
>;
export type WorkspaceReadSegmentContentResponse = z.infer<
  typeof workspaceReadSegmentContentResponseSchema
>;
export type WorkspaceReadSegmentSupplementContentResponse = z.infer<
  typeof workspaceReadSegmentSupplementContentResponseSchema
>;
export type WorkspaceWriteSegmentContentResponse = z.infer<
  typeof workspaceWriteSegmentContentResponseSchema
>;
export type WorkspaceWriteSegmentSupplementContentResponse = z.infer<
  typeof workspaceWriteSegmentSupplementContentResponseSchema
>;
export type WorkspaceSaveAttachmentResponse = z.infer<typeof workspaceSaveAttachmentResponseSchema>;
export type WorkspaceListAttachmentsResponse = z.infer<
  typeof workspaceListAttachmentsResponseSchema
>;
export type WorkspaceRecordingMarkdownSaveResponse = z.infer<
  typeof workspaceRecordingMarkdownSaveResponseSchema
>;
export type WorkspaceSegmentSupplementMarkdownSaveResponse = z.infer<
  typeof workspaceSegmentSupplementMarkdownSaveResponseSchema
>;
export type WorkspaceRequestSegmentTranscriptionBackfillRequest = z.infer<
  typeof workspaceRequestSegmentTranscriptionBackfillRequestSchema
>;
export type WorkspaceRequestSegmentSupplementTranscriptionBackfillRequest = z.infer<
  typeof workspaceRequestSegmentSupplementTranscriptionBackfillRequestSchema
>;
export type WorkspaceRequestSegmentTranscriptionBackfillResponse = z.infer<
  typeof workspaceRequestSegmentTranscriptionBackfillResponseSchema
>;
export type WorkspaceRequestSegmentSupplementTranscriptionBackfillResponse = z.infer<
  typeof workspaceRequestSegmentSupplementTranscriptionBackfillResponseSchema
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
export type WorkspaceFileTruthChangedEvent = z.infer<typeof workspaceFileTruthChangedEventSchema>;
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

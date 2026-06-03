import { z } from 'zod';
import {
  VOICE_SPEECH_SYNTHESIS_MODEL,
  VOICE_SPEECH_SYNTHESIS_RESOURCE_ID,
  VOICE_SPEECH_SYNTHESIS_SAMPLE_RATE,
  noteSpeechSynthesisFailureReasonSchema,
  speechSynthesisAttemptSchema,
  voiceSpeechSynthesisSpeakerSchema,
  workspaceContentHashSchema,
  type NoteSpeechSynthesisFailureReason,
} from '../workspace-contract/workspace-contract.js';

export type { NoteSpeechSynthesisFailureReason };

export const noteSpeechSynthesisManifestSchema = z
  .object({
    audioByteLength: z.number().int().nonnegative(),
    audioHash: workspaceContentHashSchema.nullable().optional(),
    contentHash: workspaceContentHashSchema,
    format: z.literal('mp3'),
    lastSynthesisAttempt: speechSynthesisAttemptSchema,
    mimeType: z.literal('audio/mpeg'),
    model: z.literal(VOICE_SPEECH_SYNTHESIS_MODEL),
    reason: noteSpeechSynthesisFailureReasonSchema.nullable().optional(),
    resourceId: z.literal(VOICE_SPEECH_SYNTHESIS_RESOURCE_ID),
    sampleRate: z.literal(VOICE_SPEECH_SYNTHESIS_SAMPLE_RATE),
    speaker: voiceSpeechSynthesisSpeakerSchema,
    updatedAt: z.string().min(1),
  })
  .strict();

export type NoteSpeechSynthesisManifest = z.infer<typeof noteSpeechSynthesisManifestSchema>;

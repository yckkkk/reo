import { z } from 'zod';

export const MEMORY_ID_PATTERN = /^mem_[A-Za-z0-9_-]+$/;
export const RECORDING_ID_PATTERN = /^rec_[A-Za-z0-9_-]+$/;

export const draftRecordingMetadataSchema = z
  .object({
    schemaVersion: z.literal(1),
    workspaceId: z.string().min(1),
    recordingId: z.string().regex(RECORDING_ID_PATTERN),
    status: z.literal('draft'),
    title: z.string(),
    createdAt: z.string(),
    nextSequence: z.number().int().nonnegative(),
    audioByteLength: z.number().int().nonnegative(),
  })
  .strict();

export const finalizedRecordingMetadataSchema = z
  .object({
    schemaVersion: z.literal(1),
    workspaceId: z.string().min(1),
    recordingId: z.string().regex(RECORDING_ID_PATTERN),
    memoryId: z.string().regex(MEMORY_ID_PATTERN),
    status: z.literal('finalized'),
    title: z.string(),
    createdAt: z.string(),
    finalizedAt: z.string(),
    durationMs: z.number().int().nonnegative(),
    nextSequence: z.number().int().nonnegative(),
    audioByteLength: z.number().int().nonnegative(),
    transcriptPath: z.string(),
    reflectionsPath: z.string(),
  })
  .strict();

export const recordingMetadataSchema = z.discriminatedUnion('status', [
  draftRecordingMetadataSchema,
  finalizedRecordingMetadataSchema,
]);

export type FinalizedRecordingMetadata = z.infer<typeof finalizedRecordingMetadataSchema>;
export type RecordingMetadata = z.infer<typeof recordingMetadataSchema>;

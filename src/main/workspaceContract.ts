import { z } from 'zod';
export {
  WORKSPACE_CHOOSE_DIRECTORY_CHANNEL,
  WORKSPACE_IPC_CHANNELS,
  type WorkspaceIpcChannel,
} from './workspaceChannels.js';

export const workspaceNoInputSchema = z.undefined();

export const workspaceChooseDirectoryResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('selected'),
    selectionToken: z.string().min(1),
    displayPath: z.string().min(1),
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
]);

export const workspaceErrorSchema = z.object({
  code: workspaceErrorCodeSchema,
  message: z.string().min(1),
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

export type WorkspaceErrorCode = z.infer<typeof workspaceErrorCodeSchema>;
export type WorkspaceError = z.infer<typeof workspaceErrorSchema>;
export type WorkspaceErrorEnvelope = z.infer<typeof workspaceErrorEnvelopeSchema>;
export type WorkspaceChooseDirectoryResult = z.infer<typeof workspaceChooseDirectoryResultSchema>;
export type WorkspaceChooseDirectoryResponse = z.infer<
  typeof workspaceChooseDirectoryResponseSchema
>;

export function workspaceError(code: WorkspaceErrorCode, message: string): WorkspaceErrorEnvelope {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

import { workspaceError, type WorkspaceErrorEnvelope } from './workspaceContract.js';
import type { WorkspaceIpcChannel } from './workspaceChannels.js';

export interface TrustedSenderIdentity {
  readonly processId: number;
  readonly frameRoutingId: number;
  readonly origin: string;
  readonly sessionKey: string;
}

export interface TrustedSenderEventAdapter {
  readonly processId: number;
  readonly sender: {
    readonly session: object;
  };
  readonly senderFrame: {
    readonly routingId: number;
    readonly topRoutingId?: number;
    readonly top?: {
      readonly routingId: number;
    } | null;
    readonly url: string;
  } | null;
}

export interface ValidateTrustedWorkspaceSenderOptions {
  readonly event: TrustedSenderEventAdapter;
  readonly channel: string;
  readonly allowedChannels: ReadonlySet<WorkspaceIpcChannel | string>;
  readonly expectedSession: object;
  readonly expectedSessionKey: string;
  readonly isTrustedUrl: (url: string) => boolean;
}

export type TrustedSenderValidationResult =
  | {
      readonly ok: true;
      readonly sender: TrustedSenderIdentity;
    }
  | WorkspaceErrorEnvelope;

function fail(): WorkspaceErrorEnvelope {
  return workspaceError('ERR_WORKSPACE_UNTRUSTED_SENDER', 'IPC sender is not trusted');
}

function deriveOrigin(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.origin !== 'null') {
      return parsed.origin;
    }

    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return null;
  }
}

export function validateTrustedWorkspaceSender({
  event,
  channel,
  allowedChannels,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
}: ValidateTrustedWorkspaceSenderOptions): TrustedSenderValidationResult {
  if (!allowedChannels.has(channel)) {
    return fail();
  }

  const frame = event.senderFrame;
  const topRoutingId = frame?.topRoutingId ?? frame?.top?.routingId;

  if (!frame || topRoutingId === undefined || frame.routingId !== topRoutingId) {
    return fail();
  }

  if (event.sender.session !== expectedSession) {
    return fail();
  }

  if (!isTrustedUrl(frame.url)) {
    return fail();
  }

  const origin = deriveOrigin(frame.url);
  if (!origin) {
    return fail();
  }

  return {
    ok: true,
    sender: {
      processId: event.processId,
      frameRoutingId: frame.routingId,
      origin,
      sessionKey: expectedSessionKey,
    },
  };
}

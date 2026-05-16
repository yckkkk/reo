import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import {
  DOUBAO_STREAMING_ASR_ENDPOINT,
  DOUBAO_STREAMING_ASR_RESOURCE_ID,
} from './doubaoStreamingAsr.js';

const DEFAULT_TIMEOUT_MS = 1000;

export type VoiceTranscriptionProbeCode = 'auth' | 'network' | 'ok';

export type VoiceTranscriptionProbeResult =
  | {
      readonly code: 'ok';
      readonly ok: true;
    }
  | {
      readonly code: 'auth' | 'network';
      readonly message?: string;
      readonly ok: false;
    };

export type VoiceTranscriptionProbeSocketEvent = 'close' | 'error' | 'open' | 'unexpected-response';

export type VoiceTranscriptionProbeSocket = {
  readonly close: () => void;
  readonly on: (
    event: VoiceTranscriptionProbeSocketEvent,
    listener: (...args: readonly unknown[]) => void
  ) => VoiceTranscriptionProbeSocket;
  readonly terminate: () => void;
};

export type CreateVoiceTranscriptionProbeSocketInput = {
  readonly headers: Record<string, string>;
  readonly url: string;
};

export type RunVoiceTranscriptionProbeInput = {
  readonly apiKey: string;
  readonly createSocket?: (
    input: CreateVoiceTranscriptionProbeSocketInput
  ) => VoiceTranscriptionProbeSocket;
  readonly timeoutMs?: number;
};

function createDefaultVoiceTranscriptionProbeSocket({
  headers,
  url,
}: CreateVoiceTranscriptionProbeSocketInput): VoiceTranscriptionProbeSocket {
  const socket = new WebSocket(url, {
    handshakeTimeout: DEFAULT_TIMEOUT_MS,
    headers,
    perMessageDeflate: false,
  });

  const wrappedSocket: VoiceTranscriptionProbeSocket = {
    close: () => socket.close(),
    on: (event, listener) => {
      socket.on(event, listener as never);
      return wrappedSocket;
    },
    terminate: () => socket.terminate(),
  };
  return wrappedSocket;
}

function buildProbeHeaders(apiKey: string): Record<string, string> {
  return {
    'X-Api-Connect-Id': randomUUID(),
    'X-Api-Key': apiKey,
    'X-Api-Resource-Id': DOUBAO_STREAMING_ASR_RESOURCE_ID,
  };
}

function readHttpStatusCode(args: readonly unknown[]) {
  for (const arg of args) {
    if (
      typeof arg === 'object' &&
      arg !== null &&
      'statusCode' in arg &&
      typeof arg.statusCode === 'number'
    ) {
      return arg.statusCode;
    }
  }
  return null;
}

function settleSocket(
  socket: VoiceTranscriptionProbeSocket | null,
  result: VoiceTranscriptionProbeResult
) {
  if (!socket) return;
  try {
    if (result.ok) {
      socket.close();
    } else {
      socket.terminate();
    }
  } catch {
    // The probe result is already known; shutdown failures must not change validation.
  }
}

export function runVoiceTranscriptionProbe({
  apiKey,
  createSocket = createDefaultVoiceTranscriptionProbeSocket,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: RunVoiceTranscriptionProbeInput): Promise<VoiceTranscriptionProbeResult> {
  return new Promise((resolve) => {
    let settled = false;
    let socket: VoiceTranscriptionProbeSocket | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function settle(result: VoiceTranscriptionProbeResult) {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      settleSocket(socket, result);
      resolve(result);
    }

    try {
      socket = createSocket({
        headers: buildProbeHeaders(apiKey),
        url: DOUBAO_STREAMING_ASR_ENDPOINT,
      });
    } catch {
      settle({ code: 'network', message: 'probe connection failed', ok: false });
      return;
    }

    socket
      .on('open', () => settle({ code: 'ok', ok: true }))
      .on('error', () => settle({ code: 'network', message: 'probe network failure', ok: false }))
      .on('close', () => settle({ code: 'network', ok: false }))
      .on('unexpected-response', (...args) => {
        const statusCode = readHttpStatusCode(args);
        if (statusCode === 401 || statusCode === 403) {
          settle({ code: 'auth', ok: false });
          return;
        }
        settle({ code: 'network', message: 'probe unexpected response', ok: false });
      });

    timeoutId = setTimeout(
      () => settle({ code: 'network', message: 'probe timeout', ok: false }),
      Math.max(1, timeoutMs)
    );
  });
}

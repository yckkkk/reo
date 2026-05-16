import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import {
  buildDoubaoAsrAuthHeaders,
  buildDoubaoAsrFullRequestFrame,
  DOUBAO_STREAMING_ASR_ENDPOINT,
  parseDoubaoAsrResponseFrame,
  redactSecrets,
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

export type VoiceTranscriptionProbeSocketEvent =
  | 'close'
  | 'error'
  | 'message'
  | 'open'
  | 'unexpected-response';

export type VoiceTranscriptionProbeSocket = {
  readonly close: () => void;
  readonly on: (
    event: VoiceTranscriptionProbeSocketEvent,
    listener: (...args: readonly unknown[]) => void
  ) => VoiceTranscriptionProbeSocket;
  readonly send: (data: Buffer) => void;
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
    send: (data) => socket.send(data),
    terminate: () => socket.terminate(),
  };
  return wrappedSocket;
}

function buildProbeHeaders(apiKey: string): Record<string, string> {
  return buildDoubaoAsrAuthHeaders({ apiKey, connectId: randomUUID() });
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

function normalizeSocketMessageFrame(message: unknown): Buffer {
  if (Buffer.isBuffer(message)) {
    return message;
  }
  if (message instanceof ArrayBuffer) {
    return Buffer.from(message);
  }
  if (ArrayBuffer.isView(message)) {
    return Buffer.from(message.buffer, message.byteOffset, message.byteLength);
  }
  if (Array.isArray(message)) {
    return Buffer.concat(message.map((entry) => normalizeSocketMessageFrame(entry)));
  }
  if (typeof message === 'string') {
    return Buffer.from(message, 'utf8');
  }
  throw new Error('Doubao ASR probe response frame is unsupported.');
}

function probeMessage(error: unknown, apiKey: string) {
  const message = error instanceof Error ? error.message : String(error);
  return redactSecrets(message, [apiKey]);
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
      .on('open', () => {
        try {
          socket?.send(buildDoubaoAsrFullRequestFrame({ sequence: 1, uid: 'reo-probe' }));
        } catch {
          settle({ code: 'network', message: 'probe request failed', ok: false });
        }
      })
      .on('message', (message) => {
        try {
          const response = parseDoubaoAsrResponseFrame(normalizeSocketMessageFrame(message));
          if (response.kind === 'error') {
            settle({ code: 'auth', ok: false });
            return;
          }
          settle({ code: 'ok', ok: true });
        } catch (error) {
          settle({ code: 'network', message: probeMessage(error, apiKey), ok: false });
        }
      })
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

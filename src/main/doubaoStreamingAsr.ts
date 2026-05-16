import { randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import WebSocket from 'ws';
import {
  RECORDING_TRANSCRIPTION_PCM_BITS_PER_SAMPLE,
  RECORDING_TRANSCRIPTION_PCM_CHANNELS,
  RECORDING_TRANSCRIPTION_PCM_SAMPLE_RATE_HZ,
} from '../workspace-contract/recording-audio.js';

export const DOUBAO_STREAMING_ASR_ENDPOINT =
  'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async';
export const DOUBAO_STREAMING_ASR_RESOURCE_ID = 'volc.seedasr.sauc.duration';

const PROTOCOL_VERSION_V1 = 0b0001;
const MESSAGE_TYPE_CLIENT_FULL_REQUEST = 0b0001;
const MESSAGE_TYPE_CLIENT_AUDIO_ONLY_REQUEST = 0b0010;
const MESSAGE_TYPE_SERVER_FULL_RESPONSE = 0b1001;
const MESSAGE_TYPE_SERVER_ERROR_RESPONSE = 0b1111;
const MESSAGE_FLAG_POS_SEQUENCE = 0b0001;
const MESSAGE_FLAG_NEG_WITH_SEQUENCE = 0b0011;
const SERIALIZATION_TYPE_JSON = 0b0001;
const COMPRESSION_TYPE_GZIP = 0b0001;
const DEFAULT_FINAL_RESULT_TIMEOUT_MS = 5000;

type DoubaoAsrAuthInput = {
  readonly apiKey: string;
  readonly connectId: string;
};

type DoubaoFullRequestInput = {
  readonly sequence: number;
  readonly uid: string;
};

type DoubaoAudioRequestInput = {
  readonly audio: Uint8Array;
  readonly isLast: boolean;
  readonly sequence: number;
};

type DoubaoAsrSegmentIdentity = {
  readonly recordingSessionId: string;
  readonly revisionId: string;
};

type DoubaoStreamingAsrSocketEvent = 'close' | 'error' | 'message' | 'open';
type DoubaoStreamingAsrSocketListener = (payload?: Buffer | Error) => void;

export type DoubaoStreamingAsrSocket = {
  readonly close: () => void;
  readonly on: (
    event: DoubaoStreamingAsrSocketEvent,
    listener: DoubaoStreamingAsrSocketListener
  ) => DoubaoStreamingAsrSocket;
  readonly send: (data: Buffer) => void;
};

export type CreateDoubaoStreamingAsrSocketInput = {
  readonly headers: Record<string, string>;
  readonly url: string;
};

export type DoubaoStreamingAsrSessionInput = {
  readonly apiKey: string;
  readonly connectId?: string;
  readonly createSocket?: (input: CreateDoubaoStreamingAsrSocketInput) => DoubaoStreamingAsrSocket;
  readonly finalResultTimeoutMs?: number;
  readonly onError?: (message: string) => void;
  readonly onTerminalError?: (message: string) => void;
  readonly onTranscriptSegments?: (segments: DoubaoAsrTranscriptSegment[]) => void;
  readonly recordingSessionId: string;
  readonly revisionId: string;
  readonly uid: string;
  readonly url?: string;
};

export type DoubaoStreamingAsrSession = {
  readonly close: () => void;
  readonly finish: (finalAudio?: Uint8Array) => Promise<void>;
  readonly sendAudioChunk: (audio: Uint8Array) => void;
  readonly start: () => Promise<void>;
};

export type DoubaoAsrTranscriptSegment = {
  readonly endTimeMs: number;
  readonly isFinal: boolean;
  readonly recordingSessionId: string;
  readonly revisionId: string;
  readonly startTimeMs: number;
  readonly text: string;
};

export type DoubaoAsrResponse =
  | {
      readonly code: 0;
      readonly isLastPackage: boolean;
      readonly kind: 'result';
      readonly payload: DoubaoAsrResponsePayload | null;
      readonly sequence: number | null;
    }
  | {
      readonly code: number;
      readonly isLastPackage: boolean;
      readonly kind: 'error';
      readonly payload: unknown;
      readonly sequence: number | null;
    };

type DoubaoAsrResponsePayload = {
  readonly audio_info?: {
    readonly duration?: number;
  };
  readonly result?: {
    readonly text?: string;
    readonly utterances?: readonly DoubaoAsrUtterance[];
  };
};

type DoubaoAsrUtterance = {
  readonly definite?: boolean;
  readonly end_time?: number;
  readonly start_time?: number;
  readonly text?: string;
};

type PendingFinalResult = {
  readonly promise: Promise<void>;
  readonly reject: (error: Error) => void;
  readonly resolve: () => void;
  readonly timeoutId: ReturnType<typeof setTimeout>;
};

function protocolHeader({
  flags,
  messageType,
}: {
  readonly flags: number;
  readonly messageType: number;
}) {
  return Buffer.from([
    (PROTOCOL_VERSION_V1 << 4) | 1,
    (messageType << 4) | flags,
    (SERIALIZATION_TYPE_JSON << 4) | COMPRESSION_TYPE_GZIP,
    0x00,
  ]);
}

function writeSequenceAndPayload({
  header,
  payload,
  sequence,
}: {
  readonly header: Buffer;
  readonly payload: Buffer;
  readonly sequence: number;
}) {
  const frame = Buffer.alloc(header.byteLength + 8 + payload.byteLength);
  header.copy(frame, 0);
  frame.writeInt32BE(sequence, header.byteLength);
  frame.writeUInt32BE(payload.byteLength, header.byteLength + 4);
  payload.copy(frame, header.byteLength + 8);
  return frame;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function createDefaultDoubaoStreamingAsrSocket({
  headers,
  url,
}: CreateDoubaoStreamingAsrSocketInput): DoubaoStreamingAsrSocket {
  const socket = new WebSocket(url, {
    handshakeTimeout: 10_000,
    headers,
    maxPayload: 8 * 1024 * 1024,
    perMessageDeflate: false,
  });

  const wrappedSocket: DoubaoStreamingAsrSocket = {
    close: () => socket.close(),
    on: (event, listener) => {
      socket.on(event, listener as never);
      return wrappedSocket;
    },
    send: (data) => socket.send(data),
  };
  return wrappedSocket;
}

export function normalizeDoubaoAsrSocketMessageFrame(message: unknown): Buffer {
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
    return Buffer.concat(message.map((entry) => normalizeDoubaoAsrSocketMessageFrame(entry)));
  }
  if (typeof message === 'string') {
    return Buffer.from(message, 'utf8');
  }
  throw new Error('Doubao ASR response frame is unsupported.');
}

export function redactSecrets(message: string, secrets: readonly string[]) {
  return secrets.reduce((redactedMessage, secret) => {
    if (!secret) {
      return redactedMessage;
    }
    return redactedMessage.split(secret).join('[redacted]');
  }, message);
}

function errorMessageFromUnknown(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'unknown error';
}

function parseResponsePayload(payload: unknown): DoubaoAsrResponsePayload | null {
  if (!isObject(payload)) {
    return null;
  }

  const audioInfoValue = payload['audio_info'];
  const duration = isObject(audioInfoValue) ? asNumber(audioInfoValue['duration']) : null;
  const audioInfo = isObject(audioInfoValue) ? (duration === null ? {} : { duration }) : undefined;

  const resultValue = payload['result'];
  let result: DoubaoAsrResponsePayload['result'];
  if (isObject(resultValue)) {
    const nextResult: {
      text?: string;
      utterances?: DoubaoAsrUtterance[];
    } = {};
    const text = asString(resultValue['text']);
    if (text !== null) {
      nextResult.text = text;
    }

    const utterancesValue = resultValue['utterances'];
    if (Array.isArray(utterancesValue)) {
      nextResult.utterances = utterancesValue.flatMap((utterance): DoubaoAsrUtterance[] => {
        if (!isObject(utterance)) {
          return [];
        }
        const parsedUtterance: {
          definite?: boolean;
          end_time?: number;
          start_time?: number;
          text?: string;
        } = {};
        const definite = asBoolean(utterance['definite']);
        const endTime = asNumber(utterance['end_time']);
        const startTime = asNumber(utterance['start_time']);
        const utteranceText = asString(utterance['text']);
        if (definite !== null) {
          parsedUtterance.definite = definite;
        }
        if (endTime !== null) {
          parsedUtterance.end_time = endTime;
        }
        if (startTime !== null) {
          parsedUtterance.start_time = startTime;
        }
        if (utteranceText !== null) {
          parsedUtterance.text = utteranceText;
        }
        return [parsedUtterance];
      });
    }
    result = nextResult;
  }

  return {
    ...(audioInfo ? { audio_info: audioInfo } : {}),
    ...(result ? { result } : {}),
  };
}

function parseJsonPayload(payload: Buffer, compressed: boolean): unknown {
  const decodedPayload = compressed ? gunzipSync(payload) : payload;
  if (decodedPayload.byteLength === 0) {
    return null;
  }
  return JSON.parse(decodedPayload.toString('utf8')) as unknown;
}

export function buildDoubaoAsrAuthHeaders({
  apiKey,
  connectId,
}: DoubaoAsrAuthInput): Record<string, string> {
  return {
    'X-Api-Key': apiKey,
    'X-Api-Connect-Id': connectId,
    'X-Api-Resource-Id': DOUBAO_STREAMING_ASR_RESOURCE_ID,
  };
}

export function createDoubaoStreamingAsrSession({
  apiKey,
  connectId = randomUUID(),
  createSocket = createDefaultDoubaoStreamingAsrSocket,
  finalResultTimeoutMs = DEFAULT_FINAL_RESULT_TIMEOUT_MS,
  onError,
  onTerminalError,
  onTranscriptSegments,
  recordingSessionId,
  revisionId,
  uid,
  url = DOUBAO_STREAMING_ASR_ENDPOINT,
}: DoubaoStreamingAsrSessionInput): DoubaoStreamingAsrSession {
  const secrets = [apiKey];
  let isClosed = false;
  let isStarted = false;
  let closeRequested = false;
  let nextSequence = 1;
  let socket: DoubaoStreamingAsrSocket | null = null;
  let pendingFinalResult: PendingFinalResult | null = null;
  let startPromise: Promise<void> | null = null;
  let transportFailureReported = false;

  const safeErrorMessage = (message: string) => redactSecrets(message, secrets);

  const reportError = (message: string) => {
    const safeMessage = safeErrorMessage(message);
    onError?.(safeMessage);
    return safeMessage;
  };

  const reportTransportFailure = (message: string) => {
    transportFailureReported = true;
    return reportError(message);
  };

  const sendFrame = (frame: Buffer) => {
    if (isClosed || socket === null) {
      return;
    }
    socket.send(frame);
  };

  const settlePendingFinalResult = (settle: (pending: PendingFinalResult) => void) => {
    const pending = pendingFinalResult;
    if (pending === null) {
      return;
    }
    pendingFinalResult = null;
    clearTimeout(pending.timeoutId);
    settle(pending);
  };

  const resolvePendingFinalResult = () => {
    settlePendingFinalResult((pending) => pending.resolve());
  };

  const rejectPendingFinalResult = (message: string) => {
    settlePendingFinalResult((pending) => pending.reject(new Error(message)));
  };

  const waitForFinalResult = () => {
    if (pendingFinalResult !== null) {
      return pendingFinalResult.promise;
    }
    const timeoutMs = Math.max(1, finalResultTimeoutMs);
    let reject: PendingFinalResult['reject'] = () => {};
    let resolve: PendingFinalResult['resolve'] = () => {};
    const promise = new Promise<void>((innerResolve, innerReject) => {
      resolve = innerResolve;
      reject = innerReject;
    });
    const timeoutId = setTimeout(() => {
      const safeMessage = reportError('豆包流式语音识别最终结果未返回。');
      rejectPendingFinalResult(safeMessage);
      isClosed = true;
      closeRequested = true;
      socket?.close();
    }, timeoutMs);
    pendingFinalResult = { promise, reject, resolve, timeoutId };
    return promise;
  };

  const handleResponse = (message: unknown) => {
    try {
      const response = parseDoubaoAsrResponseFrame(normalizeDoubaoAsrSocketMessageFrame(message));
      if (response.kind === 'error') {
        const safeMessage = safeErrorMessage(`豆包流式语音识别服务返回错误：${response.code}。`);
        onTerminalError?.(safeMessage);
        rejectPendingFinalResult(safeMessage);
        isClosed = true;
        closeRequested = true;
        socket?.close();
        return;
      }

      const segments = mapDoubaoAsrResponseToTranscriptSegments(response, {
        recordingSessionId,
        revisionId,
      });
      if (segments.length > 0) {
        onTranscriptSegments?.(segments);
      }
      if (response.isLastPackage) {
        resolvePendingFinalResult();
        isClosed = true;
        closeRequested = true;
        socket?.close();
      }
    } catch (error) {
      const safeMessage = reportError(
        `豆包流式语音识别响应解析失败：${errorMessageFromUnknown(error)}`
      );
      rejectPendingFinalResult(safeMessage);
    }
  };

  const start = () => {
    if (startPromise !== null) {
      return startPromise;
    }

    socket = createSocket({
      headers: buildDoubaoAsrAuthHeaders({ apiKey, connectId }),
      url,
    });

    startPromise = new Promise<void>((resolve, reject) => {
      let isSettled = false;

      const resolveStart = () => {
        if (isSettled) {
          return;
        }
        isSettled = true;
        resolve();
      };

      const rejectStart = (message: string) => {
        if (isSettled) {
          return;
        }
        isSettled = true;
        reject(new Error(message));
      };

      socket
        ?.on('open', () => {
          if (isClosed) {
            return;
          }
          sendFrame(buildDoubaoAsrFullRequestFrame({ sequence: nextSequence, uid }));
          nextSequence += 1;
          isStarted = true;
          resolveStart();
        })
        .on('message', handleResponse)
        .on('error', (error) => {
          const safeMessage = reportTransportFailure(
            `豆包流式语音识别连接失败：${errorMessageFromUnknown(error)}`
          );
          rejectPendingFinalResult(safeMessage);
          if (!isStarted) {
            rejectStart(safeMessage);
          }
        })
        .on('close', () => {
          const wasExpected = closeRequested || isClosed;
          if (pendingFinalResult !== null) {
            rejectPendingFinalResult(reportTransportFailure('豆包流式语音识别连接已关闭。'));
          }
          isClosed = true;
          if (!isStarted && !isSettled) {
            rejectStart(reportTransportFailure('豆包流式语音识别连接已关闭。'));
            return;
          }
          if (isStarted && !wasExpected && !transportFailureReported) {
            reportTransportFailure('豆包流式语音识别连接已关闭。');
          }
        });
    });
    return startPromise;
  };

  return {
    close: () => {
      if (isClosed) {
        rejectPendingFinalResult('豆包流式语音识别连接已关闭。');
        return;
      }
      closeRequested = true;
      isClosed = true;
      socket?.close();
    },
    finish: async (finalAudio = new Uint8Array()) => {
      if (!isStarted) {
        await start();
      }
      if (isClosed) {
        return;
      }
      const finalResult = waitForFinalResult();
      sendFrame(
        buildDoubaoAsrAudioRequestFrame({
          audio: finalAudio,
          isLast: true,
          sequence: nextSequence,
        })
      );
      nextSequence += 1;
      await finalResult;
    },
    sendAudioChunk: (audio) => {
      if (!isStarted || audio.byteLength === 0) {
        return;
      }
      sendFrame(
        buildDoubaoAsrAudioRequestFrame({
          audio,
          isLast: false,
          sequence: nextSequence,
        })
      );
      nextSequence += 1;
    },
    start,
  };
}

export function buildDoubaoAsrFullRequestFrame({ sequence, uid }: DoubaoFullRequestInput): Buffer {
  const payload = gzipSync(
    Buffer.from(
      JSON.stringify({
        user: {
          uid,
        },
        audio: {
          format: 'pcm',
          codec: 'raw',
          rate: RECORDING_TRANSCRIPTION_PCM_SAMPLE_RATE_HZ,
          bits: RECORDING_TRANSCRIPTION_PCM_BITS_PER_SAMPLE,
          channel: RECORDING_TRANSCRIPTION_PCM_CHANNELS,
        },
        request: {
          model_name: 'bigmodel',
          enable_itn: true,
          enable_punc: true,
          enable_ddc: true,
          show_utterances: true,
          enable_nonstream: false,
        },
      }),
      'utf8'
    )
  );

  return writeSequenceAndPayload({
    header: protocolHeader({
      flags: MESSAGE_FLAG_POS_SEQUENCE,
      messageType: MESSAGE_TYPE_CLIENT_FULL_REQUEST,
    }),
    payload,
    sequence,
  });
}

export function buildDoubaoAsrAudioRequestFrame({
  audio,
  isLast,
  sequence,
}: DoubaoAudioRequestInput): Buffer {
  const payload = gzipSync(Buffer.from(audio));
  const frameSequence = isLast ? -Math.abs(sequence) : Math.abs(sequence);
  return writeSequenceAndPayload({
    header: protocolHeader({
      flags: isLast ? MESSAGE_FLAG_NEG_WITH_SEQUENCE : MESSAGE_FLAG_POS_SEQUENCE,
      messageType: MESSAGE_TYPE_CLIENT_AUDIO_ONLY_REQUEST,
    }),
    payload,
    sequence: frameSequence,
  });
}

export function parseDoubaoAsrResponseFrame(frame: Buffer): DoubaoAsrResponse {
  if (frame.byteLength < 4) {
    throw new Error('Doubao ASR response frame is too short.');
  }

  const headerSize = (frame[0] ?? 0) & 0x0f;
  let offset = headerSize * 4;
  const messageType = (frame[1] ?? 0) >> 4;
  const flags = (frame[1] ?? 0) & 0x0f;
  const serializationType = (frame[2] ?? 0) >> 4;
  const compressionType = (frame[2] ?? 0) & 0x0f;
  let sequence: number | null = null;
  let isLastPackage = false;

  if (flags & 0x01) {
    sequence = frame.readInt32BE(offset);
    offset += 4;
  }
  if (flags & 0x02) {
    isLastPackage = true;
  }
  if (flags & 0x04) {
    offset += 4;
  }

  if (serializationType !== SERIALIZATION_TYPE_JSON) {
    throw new Error('Doubao ASR response serialization is unsupported.');
  }

  if (messageType === MESSAGE_TYPE_SERVER_ERROR_RESPONSE) {
    const code = frame.readInt32BE(offset);
    offset += 4;
    const payloadSize = frame.readUInt32BE(offset);
    offset += 4;
    const payload = parseJsonPayload(
      frame.subarray(offset, offset + payloadSize),
      compressionType === COMPRESSION_TYPE_GZIP
    );
    return { code, isLastPackage, kind: 'error', payload, sequence };
  }

  if (messageType !== MESSAGE_TYPE_SERVER_FULL_RESPONSE) {
    throw new Error('Doubao ASR response message type is unsupported.');
  }

  const payloadSize = frame.readUInt32BE(offset);
  offset += 4;
  const payload = parseJsonPayload(
    frame.subarray(offset, offset + payloadSize),
    compressionType === COMPRESSION_TYPE_GZIP
  );
  return {
    code: 0,
    isLastPackage,
    kind: 'result',
    payload: parseResponsePayload(payload),
    sequence,
  };
}

export function mapDoubaoAsrResponseToTranscriptSegments(
  response: DoubaoAsrResponse,
  identity: DoubaoAsrSegmentIdentity
): DoubaoAsrTranscriptSegment[] {
  if (response.kind !== 'result') {
    return [];
  }

  const utterances = response.payload?.result?.utterances;
  if (utterances && utterances.length > 0) {
    return utterances.flatMap((utterance): DoubaoAsrTranscriptSegment[] => {
      const startTimeMs = asNumber(utterance.start_time);
      const endTimeMs = asNumber(utterance.end_time);
      const text = asString(utterance.text)?.trim();
      if (startTimeMs === null || endTimeMs === null || !text) {
        return [];
      }
      return [
        {
          endTimeMs,
          isFinal: Boolean(utterance.definite),
          recordingSessionId: identity.recordingSessionId,
          revisionId: identity.revisionId,
          startTimeMs,
          text,
        },
      ];
    });
  }

  const text = response.payload?.result?.text?.trim();
  const durationMs = response.payload?.audio_info?.duration;
  if (!text || typeof durationMs !== 'number' || durationMs <= 0) {
    return [];
  }
  return [
    {
      endTimeMs: durationMs,
      isFinal: response.isLastPackage,
      recordingSessionId: identity.recordingSessionId,
      revisionId: identity.revisionId,
      startTimeMs: 0,
      text,
    },
  ];
}

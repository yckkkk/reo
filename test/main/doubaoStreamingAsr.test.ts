import assert from 'node:assert/strict';
import { gzipSync, gunzipSync } from 'node:zlib';
import test from 'node:test';
import {
  DOUBAO_STREAMING_ASR_MAX_RESPONSE_FRAME_BYTES,
  DOUBAO_STREAMING_ASR_MAX_RESPONSE_JSON_BYTES,
  DOUBAO_STREAMING_ASR_RESOURCE_ID,
  buildDoubaoAsrAuthHeaders,
  buildDoubaoAsrAudioRequestFrame,
  buildDoubaoAsrFullRequestFrame,
  createDoubaoStreamingAsrSession,
  mapDoubaoAsrResponseToTranscriptSegments,
  normalizeDoubaoAsrSocketMessageFrame,
  parseDoubaoAsrResponseFrame,
  redactSecrets,
} from '../../src/main/doubaoStreamingAsr.js';

function readJsonPayload(frame: Buffer) {
  const payloadSize = frame.readUInt32BE(8);
  return JSON.parse(gunzipSync(frame.subarray(12, 12 + payloadSize)).toString('utf8')) as unknown;
}

function buildServerResultFrame(payload: unknown) {
  const encodedPayload = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
  const frame = Buffer.alloc(12 + encodedPayload.byteLength);
  frame[0] = 0x11;
  frame[1] = 0x91;
  frame[2] = 0x11;
  frame[3] = 0x00;
  frame.writeInt32BE(3, 4);
  frame.writeUInt32BE(encodedPayload.byteLength, 8);
  encodedPayload.copy(frame, 12);
  return frame;
}

function buildServerErrorFrame(payload: unknown, code = 401) {
  const encodedPayload = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
  const frame = Buffer.alloc(16 + encodedPayload.byteLength);
  frame[0] = 0x11;
  frame[1] = 0xf1;
  frame[2] = 0x11;
  frame[3] = 0x00;
  frame.writeInt32BE(4, 4);
  frame.writeInt32BE(code, 8);
  frame.writeUInt32BE(encodedPayload.byteLength, 12);
  encodedPayload.copy(frame, 16);
  return frame;
}

function buildAsyncServerResultFrame(payload: unknown, flags = 0) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8');
  const hasSequence = Boolean(flags & 0x01);
  const frame = Buffer.alloc((hasSequence ? 12 : 8) + encodedPayload.byteLength);
  frame[0] = 0x11;
  frame[1] = 0x90 | flags;
  frame[2] = 0x10;
  frame[3] = 0x00;
  let offset = 4;
  if (hasSequence) {
    frame.writeInt32BE(7, offset);
    offset += 4;
  }
  frame.writeUInt32BE(encodedPayload.byteLength, offset);
  offset += 4;
  encodedPayload.copy(frame, offset);
  return frame;
}

type MockSocketEvent = 'close' | 'error' | 'message' | 'open';
type MockSocketListener = (payload?: Buffer | Error) => void;

class MockAsrSocket {
  readonly headers: Record<string, string>;
  readonly sent: Buffer[] = [];
  readonly url: string;
  closeCalls = 0;
  private readonly listeners = new Map<MockSocketEvent, MockSocketListener[]>();

  constructor({
    headers,
    url,
  }: {
    readonly headers: Record<string, string>;
    readonly url: string;
  }) {
    this.headers = headers;
    this.url = url;
  }

  close() {
    this.closeCalls += 1;
    this.emit('close');
  }

  emit(event: MockSocketEvent, payload?: Buffer | Error) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(payload);
    }
  }

  on(event: MockSocketEvent, listener: MockSocketListener) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  send(data: Buffer) {
    this.sent.push(Buffer.from(data));
  }
}

function requireSocket(socket: MockAsrSocket | null): MockAsrSocket {
  assert.ok(socket);
  return socket;
}

async function settleAfterCurrentTurn(promise: Promise<unknown>) {
  return Promise.race([
    promise.then(
      () => 'resolved',
      (error: unknown) => (error instanceof Error ? error.message : String(error))
    ),
    new Promise<'pending'>((resolve) => {
      setImmediate(() => resolve('pending'));
    }),
  ]);
}

async function waitForSentFrameCount(socket: MockAsrSocket, count: number): Promise<void> {
  const deadline = Date.now() + 1000;
  while (socket.sent.length < count) {
    if (Date.now() > deadline) {
      throw new Error(`Expected ${count} sent frames, received ${socket.sent.length}.`);
    }
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }
}

test('builds Doubao ASR auth headers without storing credentials in code', () => {
  assert.equal(DOUBAO_STREAMING_ASR_RESOURCE_ID, 'volc.seedasr.sauc.duration');

  assert.deepEqual(
    buildDoubaoAsrAuthHeaders({
      apiKey: 'test-api-key',
      connectId: 'fixture-uuid',
    }),
    {
      'X-Api-Key': 'test-api-key',
      'X-Api-Connect-Id': 'fixture-uuid',
      'X-Api-Resource-Id': 'volc.seedasr.sauc.duration',
    }
  );
});

test('builds the gzip JSON full request frame expected by the streaming protocol', () => {
  const frame = buildDoubaoAsrFullRequestFrame({
    sequence: 1,
    uid: 'reo-local-user',
  });

  assert.deepEqual([...frame.subarray(0, 4)], [0x11, 0x11, 0x11, 0x00]);
  assert.equal(frame.readInt32BE(4), 1);
  assert.deepEqual(readJsonPayload(frame), {
    audio: {
      bits: 16,
      channel: 1,
      codec: 'raw',
      format: 'pcm',
      rate: 16000,
    },
    request: {
      enable_ddc: true,
      enable_itn: true,
      enable_nonstream: false,
      enable_punc: true,
      model_name: 'bigmodel',
      show_utterances: true,
    },
    user: {
      uid: 'reo-local-user',
    },
  });
});

test('builds positive and final audio-only frames with gzip audio payloads', () => {
  const audio = Buffer.from([1, 2, 3, 4]);
  const middleFrame = buildDoubaoAsrAudioRequestFrame({ audio, isLast: false, sequence: 2 });
  const finalFrame = buildDoubaoAsrAudioRequestFrame({ audio, isLast: true, sequence: 3 });

  assert.deepEqual([...middleFrame.subarray(0, 4)], [0x11, 0x21, 0x11, 0x00]);
  assert.equal(middleFrame.readInt32BE(4), 2);
  assert.deepEqual(gunzipSync(middleFrame.subarray(12)).subarray(0), audio);

  assert.deepEqual([...finalFrame.subarray(0, 4)], [0x11, 0x23, 0x11, 0x00]);
  assert.equal(finalFrame.readInt32BE(4), -3);
  assert.deepEqual(gunzipSync(finalFrame.subarray(12)).subarray(0), audio);
});

test('parses uncompressed async Doubao ASR result frames without a sequence number', () => {
  const parsed = parseDoubaoAsrResponseFrame(
    buildAsyncServerResultFrame({
      audio_info: { duration: 7060 },
      result: {
        text: '今天我想记录一次真实的豆包语音识别验证。',
      },
    })
  );

  assert.equal(parsed.kind, 'result');
  assert.equal(parsed.sequence, null);
  assert.equal(parsed.isLastPackage, false);
  assert.deepEqual(
    mapDoubaoAsrResponseToTranscriptSegments(parsed, {
      recordingSessionId: 'recording-1',
      revisionId: 'revision-1',
    }),
    [
      {
        endTimeMs: 7060,
        isFinal: false,
        recordingSessionId: 'recording-1',
        revisionId: 'revision-1',
        startTimeMs: 0,
        text: '今天我想记录一次真实的豆包语音识别验证。',
      },
    ]
  );
});

test('parses result frames and maps utterances to timestamped transcript segments', () => {
  const parsed = parseDoubaoAsrResponseFrame(
    buildServerResultFrame({
      audio_info: { duration: 1800 },
      result: {
        text: '我想起外婆家的花。',
        utterances: [
          {
            definite: false,
            end_time: 960,
            start_time: 0,
            text: '我想起外婆家',
          },
          {
            definite: true,
            end_time: 1800,
            start_time: 960,
            text: '的花。',
          },
        ],
      },
    })
  );

  assert.equal(parsed.kind, 'result');
  assert.equal(parsed.sequence, 3);
  assert.equal(parsed.isLastPackage, false);
  assert.deepEqual(
    mapDoubaoAsrResponseToTranscriptSegments(parsed, {
      recordingSessionId: 'recording-1',
      revisionId: 'revision-1',
    }),
    [
      {
        endTimeMs: 960,
        isFinal: false,
        recordingSessionId: 'recording-1',
        revisionId: 'revision-1',
        startTimeMs: 0,
        text: '我想起外婆家',
      },
      {
        endTimeMs: 1800,
        isFinal: true,
        recordingSessionId: 'recording-1',
        revisionId: 'revision-1',
        startTimeMs: 960,
        text: '的花。',
      },
    ]
  );
});

test('rejects oversized Doubao ASR response frames before payload parsing', () => {
  assert.throws(
    () =>
      parseDoubaoAsrResponseFrame(Buffer.alloc(DOUBAO_STREAMING_ASR_MAX_RESPONSE_FRAME_BYTES + 1)),
    /too large/
  );
});

test('rejects oversized decompressed Doubao ASR JSON payloads', () => {
  assert.throws(
    () =>
      parseDoubaoAsrResponseFrame(
        buildServerResultFrame({
          result: { text: 'a'.repeat(DOUBAO_STREAMING_ASR_MAX_RESPONSE_JSON_BYTES + 1) },
        })
      ),
    /too large/
  );
});

test('normalizes nested socket message frame arrays iteratively with frame size bounds', () => {
  const frame = buildAsyncServerResultFrame({
    audio_info: { duration: 1200 },
    result: { text: '实时转写' },
  });
  const normalized = normalizeDoubaoAsrSocketMessageFrame([
    frame.subarray(0, 2),
    [frame.subarray(2, 8), frame.subarray(8)],
  ]);

  assert.deepEqual(normalized, frame);
  assert.throws(
    () =>
      normalizeDoubaoAsrSocketMessageFrame([
        Buffer.alloc(DOUBAO_STREAMING_ASR_MAX_RESPONSE_FRAME_BYTES),
        Buffer.alloc(1),
      ]),
    /too large/
  );
});

test('redacts secrets containing regex characters in one escaped pass', () => {
  assert.equal(
    redactSecrets('failed with sk.test+(secret) and sk.test+(secret)', ['sk.test+(secret)']),
    'failed with [redacted] and [redacted]'
  );
});

test('opens a live Doubao ASR session and sends full, audio, and final frames', async () => {
  let socket: MockAsrSocket | null = null;
  const session = createDoubaoStreamingAsrSession({
    apiKey: 'test-api-key',
    createSocket: ({ headers, url }) => {
      socket = new MockAsrSocket({ headers, url });
      return socket;
    },
    recordingSessionId: 'recording-1',
    revisionId: 'revision-1',
    uid: 'reo-local-user',
  });

  const start = session.start();
  const activeSocket = requireSocket(socket);
  assert.equal(activeSocket.url, 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async');
  assert.deepEqual(activeSocket.headers, {
    'X-Api-Key': 'test-api-key',
    'X-Api-Connect-Id': activeSocket.headers['X-Api-Connect-Id'],
    'X-Api-Resource-Id': 'volc.seedasr.sauc.duration',
  });
  assert.ok(activeSocket.headers['X-Api-Connect-Id']);

  activeSocket.emit('open');
  await start;

  assert.equal(activeSocket.sent.length, 1);
  assert.deepEqual(readJsonPayload(activeSocket.sent[0]!), {
    audio: {
      bits: 16,
      channel: 1,
      codec: 'raw',
      format: 'pcm',
      rate: 16000,
    },
    request: {
      enable_ddc: true,
      enable_itn: true,
      enable_nonstream: false,
      enable_punc: true,
      model_name: 'bigmodel',
      show_utterances: true,
    },
    user: {
      uid: 'reo-local-user',
    },
  });

  session.sendAudioChunk(Buffer.from([1, 2, 3]));
  const finish = session.finish(Buffer.from([4, 5]));

  assert.equal(activeSocket.sent.length, 1);
  await waitForSentFrameCount(activeSocket, 3);
  assert.equal(activeSocket.sent.length, 3);
  assert.equal(activeSocket.sent[1]!.readInt32BE(4), 2);
  assert.deepEqual(gunzipSync(activeSocket.sent[1]!.subarray(12)), Buffer.from([1, 2, 3]));
  assert.equal(activeSocket.sent[2]!.readInt32BE(4), -3);
  assert.deepEqual(gunzipSync(activeSocket.sent[2]!.subarray(12)), Buffer.from([4, 5]));
  assert.equal(await settleAfterCurrentTurn(finish), 'pending');

  activeSocket.emit(
    'message',
    buildAsyncServerResultFrame(
      {
        audio_info: { duration: 1200 },
        result: { text: '最终结果' },
      },
      0x02
    )
  );
  await finish;
  assert.equal(activeSocket.closeCalls, 1);
});

test('rejects finish when the live Doubao ASR socket closes before the final package', async () => {
  let socket: MockAsrSocket | null = null;
  const session = createDoubaoStreamingAsrSession({
    apiKey: 'test-api-key',
    createSocket: ({ headers, url }) => {
      socket = new MockAsrSocket({ headers, url });
      return socket;
    },
    recordingSessionId: 'recording-1',
    revisionId: 'revision-1',
    uid: 'reo-local-user',
  });

  const start = session.start();
  const activeSocket = requireSocket(socket);
  activeSocket.emit('open');
  await start;

  const finish = session.finish(Buffer.from([1, 2]));
  assert.equal(await settleAfterCurrentTurn(finish), 'pending');

  activeSocket.emit('close');
  await assert.rejects(finish, /豆包流式语音识别连接已关闭/);
});

test('maps live Doubao ASR responses to transcript segments', async () => {
  let socket: MockAsrSocket | null = null;
  const receivedSegments: unknown[] = [];
  const session = createDoubaoStreamingAsrSession({
    apiKey: 'test-api-key',
    createSocket: ({ headers, url }) => {
      socket = new MockAsrSocket({ headers, url });
      return socket;
    },
    onTranscriptSegments: (segments) => receivedSegments.push(...segments),
    recordingSessionId: 'recording-1',
    revisionId: 'revision-1',
    uid: 'reo-local-user',
  });

  const start = session.start();
  const activeSocket = requireSocket(socket);
  activeSocket.emit('open');
  await start;
  activeSocket.emit(
    'message',
    buildServerResultFrame({
      result: {
        utterances: [
          {
            definite: true,
            end_time: 1200,
            start_time: 0,
            text: '实时转写',
          },
        ],
      },
    })
  );

  assert.deepEqual(receivedSegments, [
    {
      endTimeMs: 1200,
      isFinal: true,
      recordingSessionId: 'recording-1',
      revisionId: 'revision-1',
      startTimeMs: 0,
      text: '实时转写',
    },
  ]);
});

test('reports an unexpected live Doubao ASR close after the stream has started', async () => {
  let socket: MockAsrSocket | null = null;
  const errors: string[] = [];
  const session = createDoubaoStreamingAsrSession({
    apiKey: 'super-secret-runtime-api-key',
    createSocket: ({ headers, url }) => {
      socket = new MockAsrSocket({ headers, url });
      return socket;
    },
    onError: (message) => errors.push(message),
    recordingSessionId: 'recording-1',
    revisionId: 'revision-1',
    uid: 'reo-local-user',
  });

  const start = session.start();
  const activeSocket = requireSocket(socket);
  activeSocket.emit('open');
  await start;

  activeSocket.emit('close');

  assert.equal(errors.length, 1);
  assert.match(errors[0]!, /连接已关闭/);
  assert.doesNotMatch(errors[0]!, /super-secret-runtime-api-key/);
});

test('reports live Doubao ASR errors without leaking runtime credentials', async () => {
  let socket: MockAsrSocket | null = null;
  const terminalErrors: string[] = [];
  const session = createDoubaoStreamingAsrSession({
    apiKey: 'super-secret-runtime-api-key',
    createSocket: ({ headers, url }) => {
      socket = new MockAsrSocket({ headers, url });
      return socket;
    },
    onTerminalError: (message) => terminalErrors.push(message),
    recordingSessionId: 'recording-1',
    revisionId: 'revision-1',
    uid: 'reo-local-user',
  });

  const start = session.start();
  const activeSocket = requireSocket(socket);
  activeSocket.emit('open');
  await start;
  activeSocket.emit(
    'message',
    buildServerErrorFrame({
      message: 'unauthorized super-secret-runtime-api-key',
    })
  );

  assert.equal(terminalErrors.length, 1);
  assert.match(terminalErrors[0]!, /401/);
  assert.doesNotMatch(terminalErrors[0]!, /super-secret-runtime-api-key/);
  assert.equal(activeSocket.closeCalls, 1);

  session.sendAudioChunk(Buffer.from([9]));
  assert.equal(activeSocket.sent.length, 1);
});

test('reports live Doubao ASR transport errors without leaking runtime credentials', async () => {
  let socket: MockAsrSocket | null = null;
  const errors: string[] = [];
  const session = createDoubaoStreamingAsrSession({
    apiKey: 'super-secret-runtime-api-key',
    createSocket: ({ headers, url }) => {
      socket = new MockAsrSocket({ headers, url });
      return socket;
    },
    onError: (message) => errors.push(message),
    recordingSessionId: 'recording-1',
    revisionId: 'revision-1',
    uid: 'reo-local-user',
  });

  const start = session.start();
  const activeSocket = requireSocket(socket);
  activeSocket.emit('error', new Error('network failed super-secret-runtime-api-key'));

  await assert.rejects(start, /豆包流式语音识别连接失败/);
  assert.equal(errors.length, 1);
  assert.match(errors[0]!, /连接失败/);
  assert.doesNotMatch(errors[0]!, /super-secret-runtime-api-key/);
});

test('rejects start when the live Doubao ASR socket closes before opening', async () => {
  let socket: MockAsrSocket | null = null;
  const errors: string[] = [];
  const session = createDoubaoStreamingAsrSession({
    apiKey: 'test-api-key',
    createSocket: ({ headers, url }) => {
      socket = new MockAsrSocket({ headers, url });
      return socket;
    },
    onError: (message) => errors.push(message),
    recordingSessionId: 'recording-1',
    revisionId: 'revision-1',
    uid: 'reo-local-user',
  });

  const start = session.start();
  const activeSocket = requireSocket(socket);
  activeSocket.emit('close');

  assert.match(await settleAfterCurrentTurn(start), /豆包流式语音识别连接已关闭/);
  assert.deepEqual(errors, ['豆包流式语音识别连接已关闭。']);
});

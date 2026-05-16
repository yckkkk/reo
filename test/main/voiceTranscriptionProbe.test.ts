import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import {
  DOUBAO_STREAMING_ASR_ENDPOINT,
  DOUBAO_STREAMING_ASR_RESOURCE_ID,
} from '../../src/main/doubaoStreamingAsr.js';
import {
  runVoiceTranscriptionProbe,
  type CreateVoiceTranscriptionProbeSocketInput,
  type VoiceTranscriptionProbeSocket,
  type VoiceTranscriptionProbeSocketEvent,
} from '../../src/main/voiceTranscriptionProbe.js';

type ProbeListener = (...args: readonly unknown[]) => void;

class FakeProbeSocket implements VoiceTranscriptionProbeSocket {
  closeCalls = 0;
  sentFrames: Buffer[] = [];
  terminateCalls = 0;
  private readonly listeners = new Map<VoiceTranscriptionProbeSocketEvent, ProbeListener[]>();

  close() {
    this.closeCalls += 1;
  }

  emit(event: VoiceTranscriptionProbeSocketEvent, ...args: readonly unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args);
    }
  }

  on(event: VoiceTranscriptionProbeSocketEvent, listener: ProbeListener) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  send(data: Buffer) {
    this.sentFrames.push(data);
  }

  terminate() {
    this.terminateCalls += 1;
  }
}

function buildServerResultFrame(payload: unknown) {
  const encodedPayload = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
  const frame = Buffer.alloc(8 + encodedPayload.byteLength);
  frame[0] = 0x11;
  frame[1] = 0x90;
  frame[2] = 0x11;
  frame[3] = 0x00;
  frame.writeUInt32BE(encodedPayload.byteLength, 4);
  encodedPayload.copy(frame, 8);
  return frame;
}

function buildServerErrorFrame(payload: unknown, code = 401) {
  const encodedPayload = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
  const frame = Buffer.alloc(12 + encodedPayload.byteLength);
  frame[0] = 0x11;
  frame[1] = 0xf0;
  frame[2] = 0x11;
  frame[3] = 0x00;
  frame.writeInt32BE(code, 4);
  frame.writeUInt32BE(encodedPayload.byteLength, 8);
  encodedPayload.copy(frame, 12);
  return frame;
}

function createProbeWithSocket(socket: FakeProbeSocket) {
  const captured: { input?: CreateVoiceTranscriptionProbeSocketInput } = {};
  const promise = runVoiceTranscriptionProbe({
    apiKey: 'fake-api-key-only',
    timeoutMs: 100,
    createSocket: (input) => {
      captured.input = input;
      return socket;
    },
  });

  assert.ok(captured.input);
  return { capturedInput: captured.input, promise };
}

test('voiceTranscriptionProbe: creates a single-header websocket probe and verifies a service frame', async () => {
  const socket = new FakeProbeSocket();
  const { capturedInput, promise } = createProbeWithSocket(socket);

  assert.equal(capturedInput.url, DOUBAO_STREAMING_ASR_ENDPOINT);
  assert.deepEqual(Object.keys(capturedInput.headers).sort(), [
    'X-Api-Connect-Id',
    'X-Api-Key',
    'X-Api-Resource-Id',
  ]);
  assert.equal(capturedInput.headers['X-Api-Key'], 'fake-api-key-only');
  assert.equal(capturedInput.headers['X-Api-Resource-Id'], DOUBAO_STREAMING_ASR_RESOURCE_ID);
  const connectId = capturedInput.headers['X-Api-Connect-Id'];
  if (typeof connectId !== 'string') {
    throw new Error('missing connect id header');
  }
  assert.match(connectId, /^[\da-f-]{36}$/i);
  assert.equal(capturedInput.headers['X-Api-App-Key'], undefined);
  assert.equal(capturedInput.headers['X-Api-Access-Key'], undefined);

  socket.emit('open');
  assert.equal(socket.sentFrames.length, 1);
  socket.emit('message', buildServerResultFrame({ result: { text: '' } }));

  assert.deepEqual(await promise, { ok: true, code: 'ok' });
  assert.equal(socket.closeCalls, 1);
  assert.equal(socket.terminateCalls, 0);
});

test('voiceTranscriptionProbe: service response wins and late socket events do not settle twice', async () => {
  const socket = new FakeProbeSocket();
  const { promise } = createProbeWithSocket(socket);

  socket.emit('open');
  socket.emit('message', buildServerResultFrame({ result: { text: '' } }));
  socket.emit('error', new Error('late network failure'));
  socket.emit('close', 1006);

  assert.deepEqual(await promise, { ok: true, code: 'ok' });
  assert.equal(socket.closeCalls, 1);
  assert.equal(socket.terminateCalls, 0);
});

test('voiceTranscriptionProbe: service error frames return auth', async () => {
  const socket = new FakeProbeSocket();
  const { promise } = createProbeWithSocket(socket);

  socket.emit('open');
  socket.emit('message', buildServerErrorFrame({ message: 'unauthorized fake-api-key-only' }));

  assert.deepEqual(await promise, { ok: false, code: 'auth' });
  assert.equal(socket.closeCalls, 0);
  assert.equal(socket.terminateCalls, 1);
});

test('voiceTranscriptionProbe: HTTP 401 and 403 unexpected-response failures return auth', async () => {
  for (const statusCode of [401, 403]) {
    const socket = new FakeProbeSocket();
    const { promise } = createProbeWithSocket(socket);

    socket.emit('unexpected-response', {}, { statusCode });

    assert.deepEqual(await promise, { ok: false, code: 'auth' });
    assert.equal(socket.closeCalls, 0);
    assert.equal(socket.terminateCalls, 1);
  }
});

test('voiceTranscriptionProbe: non-auth HTTP unexpected-response returns network', async () => {
  const socket = new FakeProbeSocket();
  const { promise } = createProbeWithSocket(socket);

  socket.emit('unexpected-response', {}, { statusCode: 500 });

  assert.equal((await promise).code, 'network');
  assert.equal(socket.terminateCalls, 1);
});

test('voiceTranscriptionProbe: socket error returns network without leaking the API key', async () => {
  const socket = new FakeProbeSocket();
  const { promise } = createProbeWithSocket(socket);

  socket.emit('error', new Error('getaddrinfo ENOTFOUND fake-api-key-only'));

  const result = await promise;
  assert.equal(result.ok, false);
  assert.equal(result.code, 'network');
  assert.equal(result.message?.includes('fake-api-key-only'), false);
  assert.equal(socket.terminateCalls, 1);
});

test('voiceTranscriptionProbe: close before open returns network', async () => {
  const socket = new FakeProbeSocket();
  const { promise } = createProbeWithSocket(socket);

  socket.emit('close', 1006);

  assert.deepEqual(await promise, { ok: false, code: 'network' });
  assert.equal(socket.terminateCalls, 1);
});

test('voiceTranscriptionProbe: timeout returns network and terminates the socket', async () => {
  const socket = new FakeProbeSocket();
  const result = await runVoiceTranscriptionProbe({
    apiKey: 'fake-timeout-key',
    timeoutMs: 10,
    createSocket: () => socket,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'network');
  assert.equal(socket.terminateCalls, 1);
});

test('voiceTranscriptionProbe: default timeout is 1s', async () => {
  const socket = new FakeProbeSocket();
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let observedDelay: number | undefined;

  globalThis.setTimeout = ((callback: () => void, delay?: number) => {
    observedDelay = delay;
    queueMicrotask(callback);
    return 1 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;

  try {
    const result = await runVoiceTranscriptionProbe({
      apiKey: 'fake-default-timeout-key',
      createSocket: () => socket,
    });

    assert.equal(observedDelay, 1000);
    assert.equal(result.code, 'network');
    assert.equal(socket.terminateCalls, 1);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

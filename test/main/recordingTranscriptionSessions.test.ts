import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecordingTranscriptionSessionRegistry } from '../../src/main/recordingTranscriptionSessions.js';
import type {
  DoubaoAsrTranscriptSegment,
  DoubaoStreamingAsrSession,
  DoubaoStreamingAsrSessionInput,
} from '../../src/main/doubaoStreamingAsr.js';

function createFakeLiveSessionStore() {
  const sessions: Array<
    DoubaoStreamingAsrSession & {
      closeCalls: number;
      finishCalls: number;
      readonly input: DoubaoStreamingAsrSessionInput;
      readonly sentAudio: Uint8Array[];
    }
  > = [];
  const createSession = (input: DoubaoStreamingAsrSessionInput): DoubaoStreamingAsrSession => {
    const session = {
      closeCalls: 0,
      finishCalls: 0,
      input,
      sentAudio: [] as Uint8Array[],
      close() {
        this.closeCalls += 1;
      },
      async finish(finalAudio?: Uint8Array) {
        this.finishCalls += 1;
        if (finalAudio && finalAudio.byteLength > 0) {
          this.sentAudio.push(finalAudio);
        }
      },
      sendAudioChunk(audio: Uint8Array) {
        this.sentAudio.push(audio);
      },
      async start() {},
    };
    sessions.push(session);
    return session;
  };
  return { createSession, sessions };
}

function oneSecondPcmChunk(seed: number) {
  return new Uint8Array(32_000).fill(seed);
}

function halfSecondPcmChunk(seed: number) {
  return new Uint8Array(16_000).fill(seed);
}

function makeStartInput(
  overrides: Partial<
    Parameters<ReturnType<typeof createRecordingTranscriptionSessionRegistry>['start']>[0]
  > = {}
) {
  return {
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    senderKey: 'sender-1',
    timeOffsetMs: 0,
    workspaceHandle: 'wh_1',
    ...overrides,
  };
}

function assertControlValue(
  response: Awaited<
    ReturnType<ReturnType<typeof createRecordingTranscriptionSessionRegistry>['start']>
  >
) {
  assert.equal(response.ok, true);
  return response.value as {
    readonly accepted: boolean;
    readonly transcriptionMode?: 'disabled' | 'live';
  };
}

test('recording transcription registry disables transcription quietly when voice settings are off', async () => {
  const live = createFakeLiveSessionStore();
  const events: unknown[] = [];
  const registry = createRecordingTranscriptionSessionRegistry({
    createSession: live.createSession,
    resolveVoiceSettings: () => ({ enabled: false, apiKey: null }),
    sendEvent: (event) => events.push(event),
  });

  const started = await registry.start(makeStartInput());

  assert.deepEqual(assertControlValue(started), {
    accepted: true,
    transcriptionMode: 'disabled',
  });
  assert.equal(live.sessions.length, 0);
  assert.deepEqual(events, []);
  assert.deepEqual(
    registry.sendAudio({
      audio: new Uint8Array([1, 2, 3]),
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      senderKey: 'sender-1',
      workspaceHandle: 'wh_1',
    }),
    { ok: true, value: { accepted: false } }
  );
});

test('recording transcription registry ignores old Doubao env vars when no voice settings resolver is injected', async () => {
  const legacyAppIdName = ['REO', 'DOUBAO', 'ASR', 'APP', 'ID'].join('_');
  const legacyAccessTokenName = ['REO', 'DOUBAO', 'ASR', 'ACCESS', 'TOKEN'].join('_');
  const previousAppId = process.env[legacyAppIdName];
  const previousAccessToken = process.env[legacyAccessTokenName];
  process.env[legacyAppIdName] = 'env-app-id';
  process.env[legacyAccessTokenName] = 'env-access-token';
  try {
    const live = createFakeLiveSessionStore();
    const registry = createRecordingTranscriptionSessionRegistry({
      createSession: live.createSession,
    });

    const started = await registry.start(makeStartInput());

    assert.deepEqual(assertControlValue(started), {
      accepted: true,
      transcriptionMode: 'disabled',
    });
    assert.equal(live.sessions.length, 0);
  } finally {
    if (previousAppId === undefined) {
      delete process.env[legacyAppIdName];
    } else {
      process.env[legacyAppIdName] = previousAppId;
    }
    if (previousAccessToken === undefined) {
      delete process.env[legacyAccessTokenName];
    } else {
      process.env[legacyAccessTokenName] = previousAccessToken;
    }
  }
});

test('recording transcription registry rejects enabled transcription without a configured api key', async () => {
  const live = createFakeLiveSessionStore();
  const registry = createRecordingTranscriptionSessionRegistry({
    createSession: live.createSession,
    resolveVoiceSettings: () => ({ enabled: true, apiKey: null }),
  });

  const response = await registry.start(makeStartInput());

  assert.equal(response.ok, false);
  if (!response.ok) {
    assert.equal(response.error.code, 'ERR_RECORDING_TRANSCRIPTION_UNAVAILABLE');
    assert.equal(response.error.message.includes('api-secret'), false);
    assert.equal(response.error.message.includes('env-access-token'), false);
  }
  assert.equal(live.sessions.length, 0);
});

test('recording transcription registry starts a live session with the start-time api key snapshot', async () => {
  const live = createFakeLiveSessionStore();
  let enabled = true;
  let apiKey: string | null = 'start-key';
  let resolveCalls = 0;
  const registry = createRecordingTranscriptionSessionRegistry({
    createSession: live.createSession,
    resolveVoiceSettings: () => {
      resolveCalls += 1;
      return { enabled, apiKey };
    },
  });

  const started = await registry.start(makeStartInput());

  assert.deepEqual(assertControlValue(started), {
    accepted: true,
    transcriptionMode: 'live',
  });
  assert.equal(live.sessions.length, 1);
  assert.equal(live.sessions[0]?.input.apiKey, 'start-key');

  enabled = false;
  apiKey = null;
  const audio = new Uint8Array([1, 2, 3]);
  assert.deepEqual(
    registry.sendAudio({
      audio,
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      senderKey: 'sender-1',
      workspaceHandle: 'wh_1',
    }),
    { ok: true, value: { accepted: true } }
  );
  assert.deepEqual(live.sessions[0]?.sentAudio, [audio]);

  live.sessions[0]?.input.onError?.('network dropped start-key');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(live.sessions.length, 2);
  assert.equal(live.sessions[1]?.input.apiKey, 'start-key');
  assert.equal(resolveCalls, 1);
});

test('recording transcription registry sends only current revision segments', async () => {
  const live = createFakeLiveSessionStore();
  const events: unknown[] = [];
  const registry = createRecordingTranscriptionSessionRegistry({
    createSession: live.createSession,
    resolveVoiceSettings: () => ({ enabled: true, apiKey: 'api-secret' }),
    sendEvent: (event) => events.push(event),
  });

  const started = await registry.start({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    senderKey: 'sender-1',
    timeOffsetMs: 0,
    workspaceHandle: 'wh_1',
  });
  assert.deepEqual(assertControlValue(started), {
    accepted: true,
    transcriptionMode: 'live',
  });

  live.sessions[0]?.input.onTranscriptSegments?.([
    {
      endTimeMs: 2600,
      isFinal: false,
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      startTimeMs: 2100,
      text: '当前结果',
    },
  ]);
  assert.deepEqual(events, [
    {
      kind: 'segments',
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      segments: [
        {
          endTimeMs: 2600,
          isFinal: false,
          recordingSessionId: 'recording-1',
          revisionId: 'recording-1-revision-0',
          startTimeMs: 2100,
          text: '当前结果',
        },
      ],
    },
  ]);

  await registry.start({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-1',
    senderKey: 'sender-1',
    timeOffsetMs: 4000,
    workspaceHandle: 'wh_1',
  });

  assert.equal(live.sessions[0]?.closeCalls, 1);
  live.sessions[0]?.input.onTranscriptSegments?.([
    {
      endTimeMs: 4600,
      isFinal: true,
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      startTimeMs: 4000,
      text: '旧结果',
    },
  ]);
  assert.equal(events.length, 1);
});

test('recording transcription registry offsets service timestamps without exposing credentials', async () => {
  const live = createFakeLiveSessionStore();
  const events: unknown[] = [];
  const registry = createRecordingTranscriptionSessionRegistry({
    createSession: live.createSession,
    resolveVoiceSettings: () => ({ enabled: true, apiKey: 'api-secret' }),
    sendEvent: (event) => events.push(event),
  });

  await registry.start({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    senderKey: 'sender-1',
    timeOffsetMs: 3000,
    workspaceHandle: 'wh_1',
  });

  live.sessions[0]?.input.onTranscriptSegments?.([
    {
      endTimeMs: 1200,
      isFinal: true,
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      startTimeMs: 200,
      text: '偏移结果',
    } satisfies DoubaoAsrTranscriptSegment,
  ]);

  assert.deepEqual(events, [
    {
      kind: 'segments',
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      segments: [
        {
          endTimeMs: 4200,
          isFinal: true,
          recordingSessionId: 'recording-1',
          revisionId: 'recording-1-revision-0',
          startTimeMs: 3200,
          text: '偏移结果',
        },
      ],
    },
  ]);
});

test('recording transcription registry returns final segments emitted during finish', async () => {
  const events: unknown[] = [];
  let sessionInput: DoubaoStreamingAsrSessionInput | null = null;
  const registry = createRecordingTranscriptionSessionRegistry({
    createSession: (input) => {
      sessionInput = input;
      return {
        close() {},
        async finish() {
          input.onTranscriptSegments?.([
            {
              endTimeMs: 1500,
              isFinal: true,
              recordingSessionId: 'recording-1',
              revisionId: 'recording-1-revision-0',
              startTimeMs: 0,
              text: 'finish returned text',
            },
          ]);
        },
        sendAudioChunk() {},
        async start() {},
      };
    },
    resolveVoiceSettings: () => ({ enabled: true, apiKey: 'api-secret' }),
    sendEvent: (event) => events.push(event),
  });

  await registry.start({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    senderKey: 'sender-1',
    timeOffsetMs: 0,
    workspaceHandle: 'wh_1',
  });
  assert.notEqual(sessionInput, null);

  const finished = await registry.finish({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    senderKey: 'sender-1',
    workspaceHandle: 'wh_1',
  });

  assert.deepEqual(finished, {
    ok: true,
    value: {
      accepted: true,
      segments: [
        {
          endTimeMs: 1500,
          isFinal: true,
          recordingSessionId: 'recording-1',
          revisionId: 'recording-1-revision-0',
          startTimeMs: 0,
          text: 'finish returned text',
        },
      ],
    },
  });
});

test('recording transcription registry returns the cumulative transcript snapshot on finish', async () => {
  const live = createFakeLiveSessionStore();
  const registry = createRecordingTranscriptionSessionRegistry({
    createSession: live.createSession,
    resolveVoiceSettings: () => ({ enabled: true, apiKey: 'api-secret' }),
    sendEvent: () => {},
  });

  await registry.start({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    senderKey: 'sender-1',
    timeOffsetMs: 0,
    workspaceHandle: 'wh_1',
  });
  live.sessions[0]?.input.onTranscriptSegments?.([
    {
      endTimeMs: 1200,
      isFinal: true,
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      startTimeMs: 0,
      text: 'finish 前已经返回的文本',
    },
  ]);

  const finished = await registry.finish({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    senderKey: 'sender-1',
    workspaceHandle: 'wh_1',
  });

  assert.deepEqual(finished, {
    ok: true,
    value: {
      accepted: true,
      segments: [
        {
          endTimeMs: 1200,
          isFinal: true,
          recordingSessionId: 'recording-1',
          revisionId: 'recording-1-revision-0',
          startTimeMs: 0,
          text: 'finish 前已经返回的文本',
        },
      ],
    },
  });
});

test('recording transcription registry rejects missing credentials and ignores stale audio', async () => {
  const live = createFakeLiveSessionStore();
  const registry = createRecordingTranscriptionSessionRegistry({
    createSession: live.createSession,
    resolveVoiceSettings: () => ({ enabled: true, apiKey: null }),
    sendEvent: () => {},
  });

  const missing = await registry.start({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    senderKey: 'sender-1',
    timeOffsetMs: 0,
    workspaceHandle: 'wh_1',
  });

  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.error.code, 'ERR_RECORDING_TRANSCRIPTION_UNAVAILABLE');
    assert.equal(missing.error.message.includes('secret'), false);
  }

  const availableRegistry = createRecordingTranscriptionSessionRegistry({
    createSession: live.createSession,
    resolveVoiceSettings: () => ({ enabled: true, apiKey: 'api-secret' }),
    sendEvent: () => {},
  });
  await availableRegistry.start({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-1',
    senderKey: 'sender-1',
    timeOffsetMs: 0,
    workspaceHandle: 'wh_1',
  });
  assert.deepEqual(
    availableRegistry.sendAudio({
      audio: new Uint8Array([1, 2, 3]),
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      senderKey: 'sender-1',
      workspaceHandle: 'wh_1',
    }),
    { ok: true, value: { accepted: false } }
  );
  assert.deepEqual(live.sessions.at(-1)?.sentAudio, []);
});

test('recording transcription registry returns a safe error when final transcription does not close cleanly', async () => {
  const events: unknown[] = [];
  const session: DoubaoStreamingAsrSession = {
    close() {},
    async finish() {
      throw new Error('timeout api-secret');
    },
    sendAudioChunk() {},
    async start() {},
  };
  const registry = createRecordingTranscriptionSessionRegistry({
    createSession: () => session,
    resolveVoiceSettings: () => ({ enabled: true, apiKey: 'api-secret' }),
    sendEvent: (event) => events.push(event),
  });

  await registry.start({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    senderKey: 'sender-1',
    timeOffsetMs: 0,
    workspaceHandle: 'wh_1',
  });

  const finished = await registry.finish({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    senderKey: 'sender-1',
    workspaceHandle: 'wh_1',
  });

  assert.equal(finished.ok, false);
  if (!finished.ok) {
    assert.equal(finished.error.code, 'ERR_RECORDING_TRANSCRIPTION_FAILED');
    assert.equal(finished.error.message.includes('api-secret'), false);
  }
  assert.deepEqual(events, []);
});

test('recording transcription registry retries the initial live session connection once', async () => {
  const events: unknown[] = [];
  const sessions: Array<
    DoubaoStreamingAsrSession & { closeCalls: number; sentAudio: Uint8Array[] }
  > = [];
  const registry = createRecordingTranscriptionSessionRegistry({
    createSession: () => {
      const sessionIndex = sessions.length;
      const session: DoubaoStreamingAsrSession & {
        closeCalls: number;
        sentAudio: Uint8Array[];
      } = {
        closeCalls: 0,
        sentAudio: [],
        close() {
          this.closeCalls += 1;
        },
        async finish() {},
        sendAudioChunk(audio) {
          this.sentAudio.push(audio);
        },
        async start() {
          if (sessionIndex === 0) {
            throw new Error('temporary network failure api-secret');
          }
        },
      };
      sessions.push(session);
      return session;
    },
    resolveVoiceSettings: () => ({ enabled: true, apiKey: 'api-secret' }),
    sendEvent: (event) => events.push(event),
  });

  const started = await registry.start({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    senderKey: 'sender-1',
    timeOffsetMs: 0,
    workspaceHandle: 'wh_1',
  });

  assert.deepEqual(assertControlValue(started), {
    accepted: true,
    transcriptionMode: 'live',
  });
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0]?.closeCalls, 1);
  assert.deepEqual(events, []);

  const audio = new Uint8Array([1, 2, 3]);
  assert.deepEqual(
    registry.sendAudio({
      audio,
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      senderKey: 'sender-1',
      workspaceHandle: 'wh_1',
    }),
    { ok: true, value: { accepted: true } }
  );
  assert.deepEqual(sessions[0]?.sentAudio, []);
  assert.deepEqual(sessions[1]?.sentAudio, [audio]);
});

test('recording transcription registry closes pending starts when a workspace closes', async () => {
  const resolveStart: { current: (() => void) | null } = { current: null };
  const sessions: Array<DoubaoStreamingAsrSession & { closeCalls: number }> = [];
  const registry = createRecordingTranscriptionSessionRegistry({
    createSession: () => {
      const session: DoubaoStreamingAsrSession & { closeCalls: number } = {
        closeCalls: 0,
        close() {
          this.closeCalls += 1;
        },
        async finish() {},
        sendAudioChunk() {},
        async start() {
          await new Promise<void>((resolve) => {
            resolveStart.current = resolve;
          });
        },
      };
      sessions.push(session);
      return session;
    },
    resolveVoiceSettings: () => ({ enabled: true, apiKey: 'api-secret' }),
    sendEvent: () => {},
  });

  const started = registry.start({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    senderKey: 'sender-1',
    timeOffsetMs: 0,
    workspaceHandle: 'wh_1',
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(sessions.length, 1);
  registry.closeForWorkspaceHandle('wh_1');
  assert.equal(sessions[0]?.closeCalls, 1);
  assert.notEqual(resolveStart.current, null);
  resolveStart.current?.();

  assert.deepEqual(await started, { ok: true, value: { accepted: false } });
  assert.deepEqual(
    registry.sendAudio({
      audio: new Uint8Array([1, 2, 3]),
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      senderKey: 'sender-1',
      workspaceHandle: 'wh_1',
    }),
    { ok: true, value: { accepted: false } }
  );
});

test('recording transcription registry reconnects after a live session drops mid-recording', async () => {
  const live = createFakeLiveSessionStore();
  const events: unknown[] = [];
  const registry = createRecordingTranscriptionSessionRegistry({
    createSession: live.createSession,
    resolveVoiceSettings: () => ({ enabled: true, apiKey: 'api-secret' }),
    sendEvent: (event) => events.push(event),
  });

  await registry.start({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    senderKey: 'sender-1',
    timeOffsetMs: 1000,
    workspaceHandle: 'wh_1',
  });

  const chunks = Array.from({ length: 6 }, (_, index) => oneSecondPcmChunk(index + 1));
  for (const chunk of chunks) {
    registry.sendAudio({
      audio: chunk,
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      senderKey: 'sender-1',
      workspaceHandle: 'wh_1',
    });
  }

  live.sessions[0]?.input.onError?.('network dropped api-secret');
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(live.sessions.length, 2);
  assert.equal(live.sessions[0]?.closeCalls, 1);
  assert.deepEqual(
    live.sessions[1]?.sentAudio.map((chunk) => chunk[0]),
    [2, 3, 4, 5, 6]
  );
  assert.deepEqual(events, []);

  live.sessions[1]?.input.onTranscriptSegments?.([
    {
      endTimeMs: 1000,
      isFinal: false,
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      startTimeMs: 0,
      text: '重连后的结果',
    },
  ]);

  assert.deepEqual(events, [
    {
      kind: 'segments',
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      segments: [
        {
          endTimeMs: 3000,
          isFinal: false,
          recordingSessionId: 'recording-1',
          revisionId: 'recording-1-revision-0',
          startTimeMs: 2000,
          text: '重连后的结果',
        },
      ],
    },
  ]);
});

test('recording transcription registry redacts the original reconnect error when reconnect start has no message', async () => {
  const events: unknown[] = [];
  let firstInput: DoubaoStreamingAsrSessionInput | null = null;
  let startCalls = 0;
  const registry = createRecordingTranscriptionSessionRegistry({
    createSession: (input) => {
      startCalls += 1;
      if (startCalls === 1) {
        firstInput = input;
      }
      return {
        close() {},
        async finish() {},
        sendAudioChunk() {},
        async start() {
          if (startCalls > 1) {
            throw new Error('');
          }
        },
      };
    },
    resolveVoiceSettings: () => ({ enabled: true, apiKey: 'api-secret' }),
    sendEvent: (event) => events.push(event),
    startAttempts: 1,
  });

  await registry.start(makeStartInput());
  const capturedInput = firstInput as DoubaoStreamingAsrSessionInput | null;
  assert.notEqual(capturedInput, null);

  capturedInput?.onError?.('network dropped api-secret');
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(events, [
    {
      kind: 'error',
      recordingFlowSessionId: 'recording-1',
      message: 'network dropped [redacted]',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
    },
  ]);
});

test('recording transcription registry trims replay audio when reconnect starts inside a PCM chunk', async () => {
  const live = createFakeLiveSessionStore();
  const registry = createRecordingTranscriptionSessionRegistry({
    createSession: live.createSession,
    resolveVoiceSettings: () => ({ enabled: true, apiKey: 'api-secret' }),
  });

  await registry.start({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    senderKey: 'sender-1',
    timeOffsetMs: 0,
    workspaceHandle: 'wh_1',
  });

  const chunks = [
    oneSecondPcmChunk(1),
    oneSecondPcmChunk(2),
    oneSecondPcmChunk(3),
    oneSecondPcmChunk(4),
    oneSecondPcmChunk(5),
    oneSecondPcmChunk(6),
    halfSecondPcmChunk(7),
  ];
  for (const chunk of chunks) {
    registry.sendAudio({
      audio: chunk,
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      senderKey: 'sender-1',
      workspaceHandle: 'wh_1',
    });
  }

  live.sessions[0]?.input.onError?.('network dropped');
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(live.sessions.length, 2);
  assert.deepEqual(
    live.sessions[1]?.sentAudio.map((chunk) => ({
      firstByte: chunk[0],
      length: chunk.byteLength,
    })),
    [
      { firstByte: 2, length: 16_000 },
      { firstByte: 3, length: 32_000 },
      { firstByte: 4, length: 32_000 },
      { firstByte: 5, length: 32_000 },
      { firstByte: 6, length: 32_000 },
      { firstByte: 7, length: 16_000 },
    ]
  );
});

test('recording transcription registry closes terminal service errors without reconnecting', async () => {
  const live = createFakeLiveSessionStore();
  const events: unknown[] = [];
  const registry = createRecordingTranscriptionSessionRegistry({
    createSession: live.createSession,
    resolveVoiceSettings: () => ({ enabled: true, apiKey: 'api-secret' }),
    sendEvent: (event) => events.push(event),
  });

  await registry.start({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    senderKey: 'sender-1',
    timeOffsetMs: 0,
    workspaceHandle: 'wh_1',
  });

  live.sessions[0]?.input.onTerminalError?.('server rejected api-secret');
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(live.sessions.length, 1);
  assert.equal(live.sessions[0]?.closeCalls, 1);
  assert.deepEqual(events, [
    {
      kind: 'error',
      recordingFlowSessionId: 'recording-1',
      message: 'server rejected [redacted]',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
    },
  ]);
  assert.deepEqual(
    registry.sendAudio({
      audio: oneSecondPcmChunk(7),
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      senderKey: 'sender-1',
      workspaceHandle: 'wh_1',
    }),
    { ok: true, value: { accepted: false } }
  );
});

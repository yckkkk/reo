import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspaceBridge } from '../../src/preload/workspaceBridge.js';

const workspaceBridgeKeys = [
  'chooseDirectory',
  'listMemorySpaces',
  'initializeWorkspace',
  'openWorkspace',
  'openMemorySpace',
  'removeMemorySpace',
  'closeWorkspace',
  'createMemory',
  'createRecordingDraft',
  'readRecordingDraftAudio',
  'appendRecordingAudioChunk',
  'cloneRecordingDraftPrefix',
  'finalizeRecordingDraft',
  'discardRecordingDraft',
  'updateMemoryTitle',
  'saveTranscript',
  'beginMicrophoneIntent',
  'clearMicrophoneIntent',
  'startRecordingTranscription',
  'sendRecordingTranscriptionAudio',
  'finishRecordingTranscription',
  'closeRecordingTranscription',
  'onRecordingTranscriptionEvent',
] as const;

test('workspace preload bridge exposes explicit methods and no generic ipc methods', async () => {
  const calls: string[] = [];
  const bridge = createWorkspaceBridge({
    invoke: async (channel) => {
      calls.push(channel);
      return { ok: true, value: { status: 'canceled' } };
    },
  });

  assert.deepEqual(Object.keys(bridge), workspaceBridgeKeys);
  assert.equal('invoke' in bridge, false);
  assert.equal('send' in bridge, false);

  assert.deepEqual(await bridge.chooseDirectory(), {
    ok: true,
    value: { status: 'canceled' },
  });
  await bridge.listMemorySpaces();
  await bridge.openMemorySpace({ workspaceId: 'ws_1' });
  await bridge.removeMemorySpace({ workspaceId: 'ws_1' });
  await bridge.createMemory({ workspaceHandle: 'wh_1', title: '产品灵感与思考' });
  await bridge.readRecordingDraftAudio({ workspaceHandle: 'wh_1', segmentId: 'seg_1' });
  await bridge.cloneRecordingDraftPrefix({
    workspaceHandle: 'wh_1',
    sourceSegmentId: 'seg_1',
    targetSegmentId: 'seg_2',
    retainedByteLength: 12,
    nextSequence: 0,
  });
  assert.deepEqual(calls, [
    'workspace:chooseDirectory',
    'workspace:listMemorySpaces',
    'workspace:openMemorySpace',
    'workspace:removeMemorySpace',
    'workspace:createMemory',
    'workspace:readRecordingDraftAudio',
    'workspace:cloneRecordingDraftPrefix',
  ]);
});

test('workspace preload bridge maps memory methods and microphone methods to explicit channels', async () => {
  const calls: Array<{ readonly channel: string; readonly payload?: unknown }> = [];
  const bridge = createWorkspaceBridge({
    invoke: async (channel, payload) => {
      calls.push({ channel, payload });
      return { ok: true, value: {} };
    },
  });

  await bridge.createMemory({ workspaceHandle: 'wh_1', title: '产品灵感与思考' });
  await bridge.updateMemoryTitle({
    workspaceHandle: 'wh_1',
    memoryId: 'mem_1',
    title: '产品灵感与思考',
  });
  await bridge.beginMicrophoneIntent({
    workspaceHandle: 'wh_1',
    recordingFlowSessionId: 'recording_flow_1',
  });
  await bridge.clearMicrophoneIntent({
    workspaceHandle: 'wh_1',
    recordingFlowSessionId: 'recording_flow_1',
  });

  assert.deepEqual(calls, [
    {
      channel: 'workspace:createMemory',
      payload: { workspaceHandle: 'wh_1', title: '产品灵感与思考' },
    },
    {
      channel: 'workspace:updateMemoryTitle',
      payload: { workspaceHandle: 'wh_1', memoryId: 'mem_1', title: '产品灵感与思考' },
    },
    {
      channel: 'workspace:beginMicrophoneIntent',
      payload: { workspaceHandle: 'wh_1', recordingFlowSessionId: 'recording_flow_1' },
    },
    {
      channel: 'workspace:clearMicrophoneIntent',
      payload: { workspaceHandle: 'wh_1', recordingFlowSessionId: 'recording_flow_1' },
    },
  ]);
});

test('workspace preload bridge maps recording transcription methods and strips ipc events', async () => {
  const calls: Array<{ readonly channel: string; readonly payload?: unknown }> = [];
  const subscriptions: Array<{
    readonly channel: string;
    readonly listener: (payload: unknown) => void;
  }> = [];
  let removed = false;
  const bridge = createWorkspaceBridge({
    invoke: async (channel, payload) => {
      calls.push({ channel, payload });
      return { ok: true, value: { accepted: true } };
    },
    on: (channel, listener) => {
      subscriptions.push({ channel, listener });
      return () => {
        removed = true;
      };
    },
  });

  await bridge.startRecordingTranscription({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    timeOffsetMs: 0,
    workspaceHandle: 'wh_1',
  });
  await bridge.sendRecordingTranscriptionAudio({
    chunk: new Uint8Array([1, 2, 3]),
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    workspaceHandle: 'wh_1',
  });
  await bridge.finishRecordingTranscription({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    workspaceHandle: 'wh_1',
  });
  await bridge.closeRecordingTranscription({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    workspaceHandle: 'wh_1',
  });

  const events: unknown[] = [];
  const unsubscribe = bridge.onRecordingTranscriptionEvent((event) => events.push(event));
  subscriptions[0]?.listener({ kind: 'closed', recordingSessionId: 'recording-1' });
  unsubscribe();

  assert.deepEqual(calls, [
    {
      channel: 'workspace:startRecordingTranscription',
      payload: {
        recordingFlowSessionId: 'recording-1',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        timeOffsetMs: 0,
        workspaceHandle: 'wh_1',
      },
    },
    {
      channel: 'workspace:sendRecordingTranscriptionAudio',
      payload: {
        chunk: new Uint8Array([1, 2, 3]),
        recordingFlowSessionId: 'recording-1',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        workspaceHandle: 'wh_1',
      },
    },
    {
      channel: 'workspace:finishRecordingTranscription',
      payload: {
        recordingFlowSessionId: 'recording-1',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        workspaceHandle: 'wh_1',
      },
    },
    {
      channel: 'workspace:closeRecordingTranscription',
      payload: {
        recordingFlowSessionId: 'recording-1',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        workspaceHandle: 'wh_1',
      },
    },
  ]);
  assert.deepEqual(
    subscriptions.map((subscription) => subscription.channel),
    ['workspace:recordingTranscriptionEvent']
  );
  assert.deepEqual(events, [{ kind: 'closed', recordingSessionId: 'recording-1' }]);
  assert.equal(removed, true);
});

test('workspace preload bridge exposes only implemented workspace file methods', async () => {
  const calls: string[] = [];
  const bridge = createWorkspaceBridge({
    invoke: async (channel) => {
      calls.push(channel);
      return { ok: true, value: { status: 'canceled' } };
    },
  });

  assert.deepEqual(Object.keys(bridge), workspaceBridgeKeys);
  assert.equal('invoke' in bridge, false);
  assert.equal('send' in bridge, false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspaceBridge } from '../../src/preload/workspaceBridge.js';

const workspaceBridgeKeys = [
  'chooseDirectory',
  'listWorkspaceProjects',
  'initializeWorkspace',
  'openWorkspace',
  'openWorkspaceProject',
  'removeWorkspaceProject',
  'closeWorkspace',
  'createRecordingDraft',
  'appendRecordingAudioChunk',
  'finalizeRecordingDraft',
  'discardRecordingDraft',
  'getMemoryDetail',
  'getRecordingDetail',
  'readRecordingAudioManifest',
  'readRecordingAudioChunk',
  'saveTranscript',
  'saveReflections',
  'beginMicrophoneIntent',
  'clearMicrophoneIntent',
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
  await bridge.listWorkspaceProjects();
  await bridge.openWorkspaceProject({ workspaceId: 'ws_1' });
  await bridge.removeWorkspaceProject({ workspaceId: 'ws_1' });
  assert.deepEqual(calls, [
    'workspace:chooseDirectory',
    'workspace:listProjects',
    'workspace:openProject',
    'workspace:removeProject',
  ]);
});

test('workspace preload bridge maps memory detail and microphone methods to explicit channels', async () => {
  const calls: Array<{ readonly channel: string; readonly payload?: unknown }> = [];
  const bridge = createWorkspaceBridge({
    invoke: async (channel, payload) => {
      calls.push({ channel, payload });
      return { ok: true, value: {} };
    },
  });

  await bridge.getMemoryDetail({ workspaceHandle: 'wh_1', memoryId: 'mem_1' });
  await bridge.beginMicrophoneIntent({ workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });
  await bridge.clearMicrophoneIntent({ workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

  assert.deepEqual(calls, [
    {
      channel: 'workspace:getMemoryDetail',
      payload: { workspaceHandle: 'wh_1', memoryId: 'mem_1' },
    },
    {
      channel: 'workspace:beginMicrophoneIntent',
      payload: { workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' },
    },
    {
      channel: 'workspace:clearMicrophoneIntent',
      payload: { workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' },
    },
  ]);
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

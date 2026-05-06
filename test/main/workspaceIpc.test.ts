import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  handleChooseWorkspaceDirectory,
  handleInitializeWorkspace,
} from '../../src/main/workspaceIpc.js';
import { createWorkspaceSelectionTokenStore } from '../../src/main/workspaceSelectionTokens.js';
import type {
  TrustedSenderEventAdapter,
  TrustedSenderIdentity,
} from '../../src/main/trustedSender.js';

const expectedSession = { label: 'default-session' };
const sender: TrustedSenderIdentity = {
  processId: 7,
  frameRoutingId: 4,
  origin: 'reo-app://renderer',
  sessionKey: 'default',
};
const event: TrustedSenderEventAdapter = {
  processId: 7,
  sender: { session: expectedSession },
  senderFrame: {
    routingId: 4,
    topRoutingId: 4,
    url: 'reo-app://renderer/index.html',
  },
};

test('initializeWorkspace consumes selection token and never exposes rootPath', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-'));
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-1',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-1',
      title: 'IPC 初始化',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_ipc',
    createHandle: () => 'wh_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      snapshot: {
        workspaceId: 'ws_ipc',
        title: 'IPC 初始化',
        description: '',
        recordings: [],
      },
    });
    assert.equal('rootPath' in result.value, false);
  }

  const replay = await handleInitializeWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-1',
      title: '重放',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_replay',
    createHandle: () => 'wh_replay',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(replay.ok, false);
  if (!replay.ok) {
    assert.equal('rootPath' in replay.error, false);
  }
});

test('chooseDirectory response does not expose rootPath or equivalent absolute displayPath', async () => {
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-display',
    now: () => 1_000,
    ttlMs: 5_000,
  });

  const result = await handleChooseWorkspaceDirectory({
    event,
    input: undefined,
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    showOpenDirectoryDialog: async () => ({
      canceled: false,
      filePaths: ['/Users/example/Voice Notes'],
    }),
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      status: 'selected',
      selectionToken: 'selection-token-display',
      displayPath: 'Voice Notes',
    },
  });
});

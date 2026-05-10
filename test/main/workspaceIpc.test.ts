import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  closeAllWorkspaceHandles,
  handleChooseWorkspaceDirectory,
  handleBeginMicrophoneIntentForTest,
  handleClearMicrophoneIntentForTest,
  handleCloseRecordingTranscriptionForTest,
  handleCloseWorkspaceForTest,
  handleCreateRecordingDraftForTest,
  handleCreateSegmentAttachmentRecordingDraftForTest,
  handleCreateMemoryForTest,
  handleDeleteMemoryForTest,
  handleFinalizeSegmentAttachmentRecordingDraftForTest,
  handleFinishRecordingTranscriptionForTest,
  handleInitializeWorkspace,
  handleInitializeWorkspaceForTest,
  handleListWorkspaceMemorySpacesForTest,
  handleOpenWorkspace,
  handleOpenWorkspaceMemorySpaceForTest,
  handleReadFinalizedAudioSegmentForTest,
  handleReadFinalizedAudioSegmentAttachmentForTest,
  handleReadMemoryDetailForTest,
  handleOpenWorkspaceForTest,
  handleRemoveMemorySpaceForTest,
  handleRestoreDeletedMemoryForTest,
  sendRecordingTranscriptionEventForTest,
  handleUpdateMemoryTitleForTest,
} from '../../src/main/workspaceIpc.js';
import { appendSegmentAttachmentRecordingAudioChunk } from '../../src/main/recordingDrafts.js';
import { createWorkspaceHandleStore } from '../../src/main/workspaceHandles.js';
import { acquireWorkspaceLock } from '../../src/main/workspaceLock.js';
import {
  initializeWorkspaceFiles,
  setBeforeWorkspaceIndexReconciliationPersistForTest,
} from '../../src/main/workspaceFiles.js';
import {
  createMicrophoneIntent,
  decideMediaPermissionRequest,
  resetMicrophoneIntentsForTest,
} from '../../src/main/security.js';
import { setAfterWorkspaceReoDirectoryCheckForTest } from '../../src/main/workspacePaths.js';
import { createWorkspaceSelectionTokenStore } from '../../src/main/workspaceSelectionTokens.js';
import { createWorkspaceMemorySpaceRegistry } from '../../src/main/workspaceMemorySpaceRegistry.js';
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
const microphoneEvent = {
  ...event,
  sender: { ...event.sender, id: 101 },
};

test('recording transcription events keep the Electron sender binding', () => {
  const sent: unknown[] = [];
  const senderWithSend = {
    send(channel: string, payload: unknown) {
      assert.equal(this, senderWithSend);
      sent.push({ channel, payload });
    },
    session: expectedSession,
  };

  sendRecordingTranscriptionEventForTest(
    { ...event, sender: senderWithSend },
    {
      kind: 'error',
      message: '实时转写暂时不可用。',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
    }
  );

  assert.deepEqual(sent, [
    {
      channel: 'workspace:recordingTranscriptionEvent',
      payload: {
        kind: 'error',
        message: '实时转写暂时不可用。',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
      },
    },
  ]);
});

async function assertWorkspaceLockCanBeReacquired(rootPath: string): Promise<void> {
  const lock = await acquireWorkspaceLock({ canonicalRoot: rootPath });
  assert.equal(lock.ok, true);
  if (lock.ok) {
    await lock.lock.release();
  }
}

async function writeFinalizedMemoryRecording({
  root,
  workspaceId,
  memoryId,
  segmentId,
  title,
}: {
  readonly root: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
}): Promise<void> {
  const memoryDirectory = path.join(root, 'memories', memoryId);
  const recordingDirectory = path.join(memoryDirectory, 'segments', segmentId);
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(
    path.join(memoryDirectory, 'memory.json'),
    `${JSON.stringify({
      memoryId,
      title,
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      segmentIds: [segmentId],
    })}\n`
  );
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1, 2, 3]));
  await writeFile(path.join(recordingDirectory, 'transcript.md'), '');
  await writeFile(
    path.join(recordingDirectory, 'segment.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      workspaceId,
      memoryId,
      segmentId,
      type: 'audio',
      status: 'finalized',
      title,
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 3,
      transcriptPath: 'transcript.md',
    })}\n`
  );
}

function createRegisteredHandleStore(
  rootPath: string,
  isUsable: () => boolean = () => true,
  release: () => Promise<void> = async () => {}
) {
  const handleStore = createWorkspaceHandleStore({ createHandle: () => 'wh_ipc' });
  handleStore.register({
    canonicalRoot: rootPath,
    workspaceId: 'ws_ipc',
    sender,
    lock: {
      isHeld: () => true,
      isUsable,
      release,
    },
  });
  return handleStore;
}

test('initializeWorkspace consumes selection token and never exposes rootPath', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-'));
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-1',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspaceForTest({
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
        memories: [],
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

test('initializeWorkspace creates a named workspace directory under the selected parent', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-parent-'));
  const workspaceRoot = path.join(parentPath, '你好');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-named-child',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({
    rootPath: parentPath,
    displayPath: path.basename(parentPath),
    sender,
  });

  const result = await handleInitializeWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-named-child',
      title: '你好',
      description: 'named child workspace',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_named_child',
    createHandle: () => 'wh_named_child',
    now: () => '2026-05-08T13:08:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.deepEqual((await readdir(parentPath)).sort(), ['你好']);
  assert.equal(
    await readFile(path.join(workspaceRoot, 'AGENTS.md'), 'utf8'),
    '# Reo workspace\n\n本文件是 Reo workspace 的 AI 协作入口。\n'
  );
  await assert.rejects(stat(path.join(parentPath, '.reo')));
  await assert.rejects(stat(path.join(parentPath, 'AGENTS.md')));
});

test('initializeWorkspace rejects an existing same-name workspace directory', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-existing-parent-'));
  const workspaceRoot = path.join(parentPath, '你好');
  await mkdir(workspaceRoot);
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-existing-child',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({
    rootPath: parentPath,
    displayPath: path.basename(parentPath),
    sender,
  });

  const result = await handleInitializeWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-existing-child',
      title: '你好',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_existing_child',
    createHandle: () => 'wh_existing_child',
    now: () => '2026-05-08T13:08:00.000Z',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_ALREADY_EXISTS');
    assert.equal(result.error.dataRetention, 'none-written');
  }
  assert.deepEqual(await readdir(parentPath), ['你好']);
  await assert.rejects(stat(path.join(workspaceRoot, '.reo')));
  await assert.rejects(stat(path.join(parentPath, '.reo')));
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

test('beginMicrophoneIntent uses sender id from the IPC event and returns no raw path', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-mic-'));
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'recording_flow_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, { registered: true });
    assert.equal('rootPath' in result.value, false);
    assert.equal('microphoneIntentId' in result.value, false);
  }
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    true
  );
});

test('clearMicrophoneIntent requires the matching workspace handle owner', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-clear-mic-'));
  const handleStore = createRegisteredHandleStore(rootPath);

  await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'recording_flow_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  const result = await handleClearMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'recording_flow_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.deepEqual(result, { ok: true, value: { cleared: true } });
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('clearMicrophoneIntent clears pending intent after workspace lock is lost', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-clear-mic-lock-lost-'));
  let usable = true;
  const handleStore = createRegisteredHandleStore(rootPath, () => usable);

  await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'recording_flow_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  usable = false;
  const result = await handleClearMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'recording_flow_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.deepEqual(result, { ok: true, value: { cleared: true } });
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('closeWorkspace clears pending microphone intent for the closed workspace handle', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-close-mic-'));
  const handleStore = createRegisteredHandleStore(rootPath);

  await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'recording_flow_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  const closed = await handleCloseWorkspaceForTest({
    event,
    input: { workspaceHandle: 'wh_ipc' },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.deepEqual(closed, { ok: true, value: { closed: true } });
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('closeWorkspace closes the injected recording transcription registry for the workspace handle', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-close-asr-'));
  const handleStore = createRegisteredHandleStore(rootPath);
  const closedHandles: string[] = [];
  const recordingTranscriptionSessions = {
    closeForWorkspaceHandle: (workspaceHandle: string) => {
      closedHandles.push(workspaceHandle);
    },
  };

  const closed = await handleCloseWorkspaceForTest({
    event,
    input: { workspaceHandle: 'wh_ipc' },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    recordingTranscriptionSessions: recordingTranscriptionSessions as never,
  });

  assert.deepEqual(closed, { ok: true, value: { closed: true } });
  assert.deepEqual(closedHandles, ['wh_ipc']);
});

test('closeRecordingTranscription clears an active ASR session after workspace lock is lost', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-close-asr-lock-lost-'));
  const handleStore = createRegisteredHandleStore(rootPath, () => false);
  const closedRequests: unknown[] = [];
  const recordingTranscriptionSessions = {
    close: (request: unknown) => {
      closedRequests.push(request);
      return { ok: true as const, value: { accepted: true as const } };
    },
  };

  const closed = await handleCloseRecordingTranscriptionForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'flow_1',
      recordingSessionId: 'recording_1',
      revisionId: 'revision_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    recordingTranscriptionSessions: recordingTranscriptionSessions as never,
  });

  assert.deepEqual(closed, { ok: true, value: { accepted: true } });
  assert.deepEqual(closedRequests, [
    {
      recordingFlowSessionId: 'flow_1',
      recordingSessionId: 'recording_1',
      revisionId: 'revision_1',
      senderKey: 'default:7:4:reo-app://renderer',
      workspaceHandle: 'wh_ipc',
    },
  ]);
});

test('finishRecordingTranscription closes an active ASR session when workspace lock is lost', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-finish-asr-lock-lost-'));
  const handleStore = createRegisteredHandleStore(rootPath, () => false);
  const closedRequests: unknown[] = [];
  const recordingTranscriptionSessions = {
    close: (request: unknown) => {
      closedRequests.push(request);
      return { ok: true as const, value: { accepted: true as const } };
    },
    finish: async () => {
      throw new Error('finish should not run after lock lost');
    },
  };

  const finished = await handleFinishRecordingTranscriptionForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'flow_1',
      recordingSessionId: 'recording_1',
      revisionId: 'revision_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    recordingTranscriptionSessions: recordingTranscriptionSessions as never,
  });

  assert.equal(finished.ok, false);
  if (!finished.ok) {
    assert.equal(finished.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  assert.deepEqual(closedRequests, [
    {
      recordingFlowSessionId: 'flow_1',
      recordingSessionId: 'recording_1',
      revisionId: 'revision_1',
      senderKey: 'default:7:4:reo-app://renderer',
      workspaceHandle: 'wh_ipc',
    },
  ]);
});

test('closeWorkspace clears pending microphone intent after workspace lock is lost', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-close-mic-lock-lost-'));
  let usable = true;
  const handleStore = createRegisteredHandleStore(rootPath, () => usable);

  await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'recording_flow_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  usable = false;
  const closed = await handleCloseWorkspaceForTest({
    event,
    input: { workspaceHandle: 'wh_ipc' },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.deepEqual(closed, { ok: true, value: { closed: true } });
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('closeWorkspace clears pending microphone intent when lock release fails', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-close-mic-release-fails-'));
  const handleStore = createRegisteredHandleStore(
    rootPath,
    () => true,
    async () => {
      throw new Error('release failed');
    }
  );

  await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'recording_flow_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  const closed = await handleCloseWorkspaceForTest({
    event,
    input: { workspaceHandle: 'wh_ipc' },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(closed.ok, false);
  if (!closed.ok) {
    assert.equal(closed.error.code, 'ERR_WORKSPACE_LOCK_FAILED');
  }
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('window teardown clears all pending microphone intents through workspace cleanup', async () => {
  resetMicrophoneIntentsForTest();
  createMicrophoneIntent({
    senderId: 101,
    workspaceHandle: 'wh_teardown',
    recordingFlowSessionId: 'recording_flow_1',
  });

  await closeAllWorkspaceHandles();

  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('createMemory creates an empty Memory container through file truth', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memory-create-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 记忆',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleCreateMemoryForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      title: '产品灵感与思考',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    createMemoryId: () => 'mem_ipc_created',
    now: () => '2026-05-08T14:42:00.000Z',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {
      memoryId: 'mem_ipc_created',
      title: '产品灵感与思考',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      segmentCount: 0,
      durationMs: 0,
      audioByteLength: 0,
      hasTranscript: false,
      attachmentCount: 0,
    });
  }
  assert.deepEqual(
    JSON.parse(
      await readFile(path.join(rootPath, 'memories', 'mem_ipc_created', 'memory.json'), 'utf8')
    ),
    {
      memoryId: 'mem_ipc_created',
      title: '产品灵感与思考',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      segmentIds: [],
    }
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8')).memories,
    [
      {
        memoryId: 'mem_ipc_created',
        title: '产品灵感与思考',
        createdAt: '2026-05-08T14:42:00.000Z',
        updatedAt: '2026-05-08T14:42:00.000Z',
        segmentCount: 0,
        durationMs: 0,
        audioByteLength: 0,
        hasTranscript: false,
        attachmentCount: 0,
      },
    ]
  );
});

test('deleteMemory hides a Memory from the read model and restoreDeletedMemory restores it', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-delete-memory-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 删除',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_delete_me',
    segmentId: 'seg_delete_me',
    title: 'Delete me',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_keep_me',
    segmentId: 'seg_keep_me',
    title: 'Keep me',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const deleted = await handleDeleteMemoryForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      memoryId: 'mem_delete_me',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(deleted.ok, true);
  if (deleted.ok) {
    assert.equal(deleted.value.memoryId, 'mem_delete_me');
    assert.equal(deleted.value.restoreToken, 'mem_delete_me');
    assert.deepEqual(
      deleted.value.memories.map((memory: { readonly memoryId: string }) => memory.memoryId),
      ['mem_keep_me']
    );
    assert.equal('rootPath' in deleted.value, false);
  }

  const readDeleted = await handleReadMemoryDetailForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_delete_me',
      requestId: 'request_deleted',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });
  assert.equal(readDeleted.ok, false);

  const restored = await handleRestoreDeletedMemoryForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      restoreToken: 'mem_delete_me',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(restored.ok, true);
  if (restored.ok) {
    assert.equal(restored.value.memory.memoryId, 'mem_delete_me');
    assert.deepEqual(
      restored.value.memories
        .map((memory: { readonly memoryId: string }) => memory.memoryId)
        .sort(),
      ['mem_delete_me', 'mem_keep_me']
    );
    assert.equal('rootPath' in restored.value, false);
  }

  const readRestored = await handleReadMemoryDetailForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_delete_me',
      requestId: 'request_restored',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });
  assert.equal(readRestored.ok, true);
});

test('readMemoryDetail returns current Memory segments without exposing handle or root path', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memory-detail-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 记忆详情',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_detail',
    segmentId: 'seg_ipc_detail',
    title: '生日录音',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleReadMemoryDetailForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_detail',
      requestId: 'request_mem_ipc_detail',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.requestId, 'request_mem_ipc_detail');
    assert.equal(result.value.detail.workspaceId, 'ws_ipc');
    assert.equal(result.value.detail.memoryId, 'mem_ipc_detail');
    assert.equal(result.value.detail.title, '生日录音');
    assert.equal(result.value.detail.segmentCount, 1);
    assert.deepEqual(result.value.detail.segments, [
      {
        workspaceId: 'ws_ipc',
        memoryId: 'mem_ipc_detail',
        segmentId: 'seg_ipc_detail',
        type: 'audio',
        title: '生日录音',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:09:00.000Z',
        durationMs: 1000,
        audioByteLength: 3,
        transcript: { exists: false },
        attachmentCount: 0,
        attachments: [],
      },
    ]);
    assert.equal('workspaceHandle' in result.value.detail, false);
    assert.equal('rootPath' in result.value.detail, false);
  }
});

test('readFinalizedAudioSegment returns audio bytes and transcript without exposing file paths', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-finalized-audio-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 记忆播放',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    title: '生日录音',
  });
  await writeFile(
    path.join(rootPath, 'memories', 'mem_ipc_audio', 'segments', 'seg_ipc_audio', 'transcript.md'),
    '大家一起唱生日快乐。'
  );
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleReadFinalizedAudioSegmentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_audio',
      segmentId: 'seg_ipc_audio',
      requestId: 'request_seg_ipc_audio',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.requestId, 'request_seg_ipc_audio');
    assert.equal(result.value.workspaceId, 'ws_ipc');
    assert.equal(result.value.memoryId, 'mem_ipc_audio');
    assert.equal(result.value.segmentId, 'seg_ipc_audio');
    assert.deepEqual(Array.from(result.value.audio), [1, 2, 3]);
    assert.equal(result.value.audioByteLength, 3);
    assert.deepEqual(result.value.transcript, {
      exists: true,
      text: '大家一起唱生日快乐。',
    });
    assert.equal('workspaceHandle' in result.value, false);
    assert.equal('rootPath' in result.value, false);
  }
});

test('readFinalizedAudioSegmentAttachment returns parent-scoped audio bytes without transcript text or paths', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-finalized-attachment-audio-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 补充播放',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    title: '生日录音',
  });
  const attachmentDirectory = path.join(
    rootPath,
    'memories',
    'mem_ipc_audio',
    'segments',
    'seg_ipc_audio',
    'attachments',
    'att_ipc_followup'
  );
  await mkdir(attachmentDirectory, { recursive: true });
  await writeFile(path.join(attachmentDirectory, 'audio.webm'), new Uint8Array([4, 5]));
  await writeFile(path.join(attachmentDirectory, 'transcript.md'), '');
  await writeFile(
    path.join(attachmentDirectory, 'attachment.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_audio',
      segmentId: 'seg_ipc_audio',
      attachmentId: 'att_ipc_followup',
      type: 'audio',
      status: 'finalized',
      title: '补充录音',
      createdAt: '2026-05-06T13:10:00.000Z',
      finalizedAt: '2026-05-06T13:11:00.000Z',
      durationMs: 500,
      nextSequence: 1,
      audioByteLength: 2,
      transcriptPath: 'transcript.md',
    })}\n`
  );
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleReadFinalizedAudioSegmentAttachmentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_audio',
      segmentId: 'seg_ipc_audio',
      attachmentId: 'att_ipc_followup',
      requestId: 'request_att_ipc_followup',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.requestId, 'request_att_ipc_followup');
    assert.equal(result.value.workspaceId, 'ws_ipc');
    assert.equal(result.value.memoryId, 'mem_ipc_audio');
    assert.equal(result.value.segmentId, 'seg_ipc_audio');
    assert.equal(result.value.attachmentId, 'att_ipc_followup');
    assert.deepEqual(Array.from(result.value.audio), [4, 5]);
    assert.equal(result.value.audioByteLength, 2);
    assert.equal('transcript' in result.value, false);
    assert.equal('workspaceHandle' in result.value, false);
    assert.equal('rootPath' in result.value, false);
  }
});

test('readFinalizedAudioSegmentAttachment rejects a symlinked attachments parent', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-attachment-parent-symlink-'));
  const outsideRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-attachment-outside-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 补充父目录',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    title: '生日录音',
  });
  const outsideAttachmentDirectory = path.join(outsideRoot, 'att_outside_followup');
  await mkdir(outsideAttachmentDirectory, { recursive: true });
  await writeFile(path.join(outsideAttachmentDirectory, 'audio.webm'), new Uint8Array([4, 5]));
  await writeFile(path.join(outsideAttachmentDirectory, 'transcript.md'), '');
  await writeFile(
    path.join(outsideAttachmentDirectory, 'attachment.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_audio',
      segmentId: 'seg_ipc_audio',
      attachmentId: 'att_outside_followup',
      type: 'audio',
      status: 'finalized',
      title: '补充录音',
      createdAt: '2026-05-06T13:10:00.000Z',
      finalizedAt: '2026-05-06T13:11:00.000Z',
      durationMs: 500,
      nextSequence: 1,
      audioByteLength: 2,
      transcriptPath: 'transcript.md',
    })}\n`
  );
  await symlink(
    outsideRoot,
    path.join(rootPath, 'memories', 'mem_ipc_audio', 'segments', 'seg_ipc_audio', 'attachments')
  );
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleReadFinalizedAudioSegmentAttachmentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_audio',
      segmentId: 'seg_ipc_audio',
      attachmentId: 'att_outside_followup',
      requestId: 'request_att_symlink',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_RECORDING_NOT_FOUND');
  }
});

test('createRecordingDraft returns a flat IPC response value', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-recording-draft-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 录音',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleCreateRecordingDraftForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    createSegmentId: () => 'seg_ipc_draft',
    now: () => '2026-05-08T14:42:00.000Z',
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      segmentId: 'seg_ipc_draft',
      nextSequence: 0,
    },
  });
});

test('segment attachment recording IPC keeps the finalized audio under the parent segment', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-attachment-draft-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 补充录音',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_attachment',
    segmentId: 'seg_ipc_attachment_parent',
    title: '父级录音',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const created = await handleCreateSegmentAttachmentRecordingDraftForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_attachment',
      segmentId: 'seg_ipc_attachment_parent',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    createAttachmentId: () => 'att_ipc_attachment_child',
    now: () => '2026-05-08T14:42:00.000Z',
  });

  assert.deepEqual(created, {
    ok: true,
    value: {
      attachmentId: 'att_ipc_attachment_child',
      nextSequence: 0,
    },
  });
  await appendSegmentAttachmentRecordingAudioChunk({
    rootPath,
    attachmentId: 'att_ipc_attachment_child',
    sequence: 0,
    chunk: new Uint8Array([4, 5]),
  });

  const finalized = await handleFinalizeSegmentAttachmentRecordingDraftForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_attachment',
      segmentId: 'seg_ipc_attachment_parent',
      attachmentId: 'att_ipc_attachment_child',
      title: '补充录音',
      durationMs: 500,
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => '2026-05-08T14:43:00.000Z',
  });

  assert.equal(finalized.ok, true);
  if (finalized.ok) {
    assert.equal(finalized.value.memory.segmentCount, 1);
    assert.equal(finalized.value.memory.attachmentCount, 1);
    assert.equal(finalized.value.segment.segmentId, 'seg_ipc_attachment_parent');
    assert.equal(finalized.value.segment.attachmentCount, 1);
    assert.equal(finalized.value.attachment.attachmentId, 'att_ipc_attachment_child');
    assert.equal(finalized.value.attachment.segmentId, 'seg_ipc_attachment_parent');
    assert.equal(finalized.value.attachment.audioByteLength, 2);
    assert.equal('workspaceHandle' in finalized.value.attachment, false);
    assert.equal('rootPath' in finalized.value.attachment, false);
  }
  await assert.rejects(
    stat(
      path.join(rootPath, 'memories', 'mem_ipc_attachment', 'segments', 'att_ipc_attachment_child')
    )
  );
  assert.equal(
    (
      await stat(
        path.join(
          rootPath,
          'memories',
          'mem_ipc_attachment',
          'segments',
          'seg_ipc_attachment_parent',
          'attachments',
          'att_ipc_attachment_child',
          'audio.webm'
        )
      )
    ).isFile(),
    true
  );
});

test('updateMemoryTitle updates only the memory container through file truth', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memory-title-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 记忆',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc',
    segmentId: 'seg_ipc',
    title: '旧标题',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleUpdateMemoryTitleForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      memoryId: 'mem_ipc',
      title: '产品灵感与思考',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => '2026-05-08T14:42:00.000Z',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.memoryId, 'mem_ipc');
    assert.equal(result.value.title, '产品灵感与思考');
    assert.equal(result.value.segmentCount, 1);
    assert.equal(result.value.updatedAt, '2026-05-08T14:42:00.000Z');
    assert.equal('rootPath' in result.value, false);
    assert.equal('segmentIds' in result.value, false);
  }
  assert.deepEqual(
    JSON.parse(await readFile(path.join(rootPath, 'memories', 'mem_ipc', 'memory.json'), 'utf8')),
    {
      memoryId: 'mem_ipc',
      title: '产品灵感与思考',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      segmentIds: ['seg_ipc'],
    }
  );
  assert.equal(
    JSON.parse(
      await readFile(
        path.join(rootPath, 'memories', 'mem_ipc', 'segments', 'seg_ipc', 'segment.json'),
        'utf8'
      )
    ).title,
    '旧标题'
  );
});

test('initializeWorkspace releases the lock when post-lock file writes throw', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-throw-'));
  const workspaceRoot = path.join(rootPath, '写入失败工作区');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-init-throw',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-init-throw',
      title: '写入失败工作区',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_init_throw',
    createHandle: () => 'wh_init_throw',
    now: () => '2026-05-06T13:08:00.000Z',
    afterWorkspaceLockAcquiredForTest: async () => {
      await mkdir(path.join(workspaceRoot, '.reo', 'workspace.json'), { recursive: true });
    },
  });

  assert.equal(result.ok, false);
  await assertWorkspaceLockCanBeReacquired(workspaceRoot);
});

test('initializeWorkspace rejects lock identity loss before workspace files are written', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-lock-lost-'));
  const workspaceRoot = path.join(rootPath, 'Lock lost');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-init-lock-lost',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-init-lock-lost',
      title: 'Lock lost',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_init_lock_lost',
    createHandle: () => 'wh_init_lock_lost',
    now: () => '2026-05-06T13:08:00.000Z',
    afterWorkspaceLockAcquiredForTest: async () => {
      await rename(path.join(workspaceRoot, '.reo'), path.join(workspaceRoot, '.reo-preserved'));
      await mkdir(path.join(workspaceRoot, '.reo'));
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  await assert.rejects(stat(path.join(workspaceRoot, 'AGENTS.md')));
  await assert.rejects(stat(path.join(workspaceRoot, '.reo', 'workspace.json')));
});

test('initializeWorkspace rejects lock identity loss during managed directory creation', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-mid-lock-lost-'));
  const workspaceRoot = path.join(rootPath, 'Lock lost');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-init-mid-lock-lost',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });
  setAfterWorkspaceReoDirectoryCheckForTest(async () => {
    setAfterWorkspaceReoDirectoryCheckForTest(null);
    await rename(path.join(workspaceRoot, '.reo'), path.join(workspaceRoot, '.reo-preserved'));
    await mkdir(path.join(workspaceRoot, '.reo'));
  });

  try {
    const result = await handleInitializeWorkspaceForTest({
      event,
      input: {
        selectionToken: 'selection-token-init-mid-lock-lost',
        title: 'Lock lost',
        description: '',
      },
      expectedSession,
      expectedSessionKey: 'default',
      isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
      tokenStore,
      createWorkspaceId: () => 'ws_init_mid_lock_lost',
      createHandle: () => 'wh_init_mid_lock_lost',
      now: () => '2026-05-06T13:08:00.000Z',
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
  } finally {
    setAfterWorkspaceReoDirectoryCheckForTest(null);
  }
  await assert.rejects(stat(path.join(workspaceRoot, 'AGENTS.md')));
  await assert.rejects(stat(path.join(workspaceRoot, '.reo', 'drafts')));
  await assert.rejects(stat(path.join(workspaceRoot, '.reo', 'workspace.json')));
});

test('initializeWorkspace releases the lock when handle registration throws', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-handle-throw-'));
  const workspaceRoot = path.join(rootPath, 'handle 注册失败工作区');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-init-handle-throw',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-init-handle-throw',
      title: 'handle 注册失败工作区',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_init_handle_throw',
    createHandle: () => {
      throw new Error('handle boom');
    },
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_INIT_FAILED');
  }
  await assertWorkspaceLockCanBeReacquired(workspaceRoot);
});

test('openWorkspace initializes an empty selected folder as a new workspace', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-empty-'));
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-empty',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-open-empty',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_open_empty',
    createHandle: () => 'wh_open_empty',
    now: () => '2026-05-08T13:09:00.000Z',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.workspaceHandle, 'wh_open_empty');
    assert.equal(result.value.workspaceId, 'ws_open_empty');
    assert.equal(result.value.snapshot.title, path.basename(rootPath));
  }
  assert.equal(
    await readFile(path.join(rootPath, 'AGENTS.md'), 'utf8'),
    '# Reo workspace\n\n本文件是 Reo workspace 的 AI 协作入口。\n'
  );
  await stat(path.join(rootPath, '.reo', 'workspace.json'));
});

test('openWorkspace rejects non-empty non-Reo directories before writing a workspace lock', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-non-empty-'));
  await writeFile(path.join(rootPath, 'notes.md'), 'not a Reo workspace\n');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-non-empty',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-open-non-empty',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_METADATA_INVALID');
    assert.equal(result.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(rootPath, '.reo')));
});

test('openWorkspace rejects a folder that becomes non-empty after the empty check', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-empty-race-'));
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-empty-race',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-open-empty-race',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_open_empty_race',
    createHandle: () => 'wh_open_empty_race',
    now: () => '2026-05-08T13:09:00.000Z',
    afterWorkspaceLockAcquiredForTest: async () => {
      await writeFile(path.join(rootPath, 'notes.md'), 'not a Reo workspace\n');
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_METADATA_INVALID');
    assert.equal(result.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(rootPath, '.reo')));
  await assertWorkspaceLockCanBeReacquired(rootPath);
});

test('openWorkspace registers imported memory spaces and listMemorySpaces never exposes rootPath', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memorySpace-register-'));
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath: path.join(
      await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-registry-')),
      'registry.json'
    ),
    now: () => '2026-05-08T07:48:00.000Z',
  });
  await initializeWorkspaceFiles({
    rootPath,
    title: 'Runtime validated memory',
    description: 'Final runtime validation workspace.',
    createWorkspaceId: () => 'ws_runtime_validated',
    now: () => '2026-05-08T07:47:00.000Z',
  });
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-memory-space-register',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const openResult = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-memory-space-register',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    memorySpaceRegistry,
  });

  assert.equal(openResult.ok, true);
  const listResult = await handleListWorkspaceMemorySpacesForTest({
    event,
    input: undefined,
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    memorySpaceRegistry,
  });

  assert.deepEqual(listResult, {
    ok: true,
    value: {
      memorySpaces: [
        {
          workspaceId: 'ws_runtime_validated',
          title: 'Runtime validated memory',
          description: 'Final runtime validation workspace.',
          addedAt: '2026-05-08T07:48:00.000Z',
          lastOpenedAt: '2026-05-08T07:48:00.000Z',
        },
      ],
    },
  });
  assert.equal(JSON.stringify(listResult).includes(rootPath), false);
});

test('listMemorySpaces returns an error envelope when the memory space registry cannot be read', async () => {
  const result = await handleListWorkspaceMemorySpacesForTest({
    event,
    input: undefined,
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    memorySpaceRegistry: {
      listMemorySpaces: async () => {
        throw new Error('registry unreadable');
      },
      resolveMemorySpaceRoot: async () => null,
      removeMemorySpace: async () => {},
      upsertMemorySpace: async () => {
        throw new Error('unused');
      },
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_READ_FAILED');
  }
});

test('openMemorySpace opens a persisted memory space without a selection token', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memorySpace-open-'));
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-open-registry-')),
    'registry.json'
  );
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:49:00.000Z',
  });
  await initializeWorkspaceFiles({
    rootPath,
    title: 'Runtime validated memory',
    description: 'Final runtime validation workspace.',
    createWorkspaceId: () => 'ws_runtime_validated',
    now: () => '2026-05-08T07:47:00.000Z',
  });
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: rootPath,
    snapshot: {
      workspaceId: 'ws_runtime_validated',
      title: 'Runtime validated memory',
      description: 'Final runtime validation workspace.',
      memories: [],
    },
  });
  const restartedMemorySpacesRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:50:00.000Z',
  });

  const result = await handleOpenWorkspaceMemorySpaceForTest({
    event,
    input: {
      workspaceId: 'ws_runtime_validated',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    createHandle: () => 'wh_memory_space_open',
    memorySpaceRegistry: restartedMemorySpacesRegistry,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {
      workspaceHandle: 'wh_memory_space_open',
      workspaceId: 'ws_runtime_validated',
      snapshot: {
        workspaceId: 'ws_runtime_validated',
        title: 'Runtime validated memory',
        description: 'Final runtime validation workspace.',
        memories: [],
      },
    });
    assert.equal('rootPath' in result.value, false);
  }
});

test('openMemorySpace reports a missing persisted workspace folder', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memorySpace-missing-'));
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-missing-registry-')),
    'registry.json'
  );
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:49:00.000Z',
  });
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: rootPath,
    snapshot: {
      workspaceId: 'ws_deleted',
      title: 'Deleted workspace',
      description: '',
      memories: [],
    },
  });
  await rm(rootPath, { recursive: true, force: true });

  const result = await handleOpenWorkspaceMemorySpaceForTest({
    event,
    input: {
      workspaceId: 'ws_deleted',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    memorySpaceRegistry,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_ROOT_MISSING');
    assert.equal(result.error.dataRetention, 'none-written');
  }
});

test('removeMemorySpace removes a persisted memory space without resolving or deleting its folder', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memorySpace-remove-'));
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-remove-registry-')),
    'registry.json'
  );
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:49:00.000Z',
  });
  await initializeWorkspaceFiles({
    rootPath,
    title: '测试1',
    description: '',
    createWorkspaceId: () => 'ws_test_1',
    now: () => '2026-05-08T07:47:00.000Z',
  });
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: rootPath,
    snapshot: {
      workspaceId: 'ws_test_1',
      title: '测试1',
      description: '',
      memories: [],
    },
  });

  const result = await handleRemoveMemorySpaceForTest({
    event,
    input: {
      workspaceId: 'ws_test_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    memorySpaceRegistry,
  });

  assert.deepEqual(result, { ok: true, value: { removed: true } });
  assert.deepEqual(await memorySpaceRegistry.listMemorySpaces(), []);
  assert.equal((await stat(path.join(rootPath, '.reo'))).isDirectory(), true);
});

test('openWorkspace releases the lock when post-lock recovery or index writes throw', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-throw-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_throw',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await rm(path.join(rootPath, '.reo', 'index.json'), { force: true });
  await mkdir(path.join(rootPath, '.reo', 'index.json'));
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-throw',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-open-throw',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
  });

  assert.equal(result.ok, false);
  await assertWorkspaceLockCanBeReacquired(rootPath);
});

test('openWorkspace rejects lock identity loss before workspace files are opened', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-lock-lost-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_lock_lost',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-lock-lost',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-open-lock-lost',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    afterWorkspaceLockAcquiredForTest: async () => {
      await rename(path.join(rootPath, '.reo'), path.join(rootPath, '.reo-preserved'));
      await mkdir(path.join(rootPath, '.reo'));
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  await assert.rejects(stat(path.join(rootPath, '.reo', 'index.json')));
});

test('openWorkspace rejects lock identity loss during index reconciliation', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-mid-lock-lost-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_mid_lock_lost',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_open_mid_lock_lost',
    memoryId: 'mem_open_mid_lock_lost',
    segmentId: 'seg_open_mid_lock_lost',
    title: 'Open mid lock lost',
  });
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-mid-lock-lost',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });
  setBeforeWorkspaceIndexReconciliationPersistForTest(async () => {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
    await rename(path.join(rootPath, '.reo'), path.join(rootPath, '.reo-preserved'));
    await mkdir(path.join(rootPath, '.reo'));
  });

  try {
    const result = await handleOpenWorkspaceForTest({
      event,
      input: {
        selectionToken: 'selection-token-open-mid-lock-lost',
      },
      expectedSession,
      expectedSessionKey: 'default',
      isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
      tokenStore,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
  } finally {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
  }
  await assert.rejects(stat(path.join(rootPath, '.reo', 'index.json')));
});

test('openWorkspace releases the lock when handle registration throws', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-handle-throw-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_handle_throw',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-handle-throw',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-open-handle-throw',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    handleStore: createWorkspaceHandleStore({
      createHandle: () => {
        throw new Error('handle boom');
      },
    }),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_OPEN_FAILED');
  }
  await assertWorkspaceLockCanBeReacquired(rootPath);
});

test('openWorkspace rejects unsafe child directories before writing a workspace lock', async () => {
  const memoriesRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-memories-link-'));
  await initializeWorkspaceFiles({
    rootPath: memoriesRoot,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_memories_link',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const outsideMemories = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-memories-outside-'));
  await rm(path.join(memoriesRoot, 'memories'), { recursive: true });
  await symlink(outsideMemories, path.join(memoriesRoot, 'memories'));
  const memoriesTokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-memories-link',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  memoriesTokenStore.issueSelection({
    rootPath: memoriesRoot,
    displayPath: path.basename(memoriesRoot),
    sender,
  });

  const memoriesResult = await handleOpenWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-open-memories-link',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore: memoriesTokenStore,
  });

  assert.equal(memoriesResult.ok, false);
  if (!memoriesResult.ok) {
    assert.equal(memoriesResult.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
    assert.equal(memoriesResult.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(memoriesRoot, '.reo', 'workspace.lock')));

  const draftsRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-drafts-link-'));
  await initializeWorkspaceFiles({
    rootPath: draftsRoot,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_drafts_link',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const outsideDrafts = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-drafts-outside-'));
  await rm(path.join(draftsRoot, '.reo', 'drafts'), { recursive: true });
  await symlink(outsideDrafts, path.join(draftsRoot, '.reo', 'drafts'));
  const draftsTokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-drafts-link',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  draftsTokenStore.issueSelection({
    rootPath: draftsRoot,
    displayPath: path.basename(draftsRoot),
    sender,
  });

  const draftsResult = await handleOpenWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-open-drafts-link',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore: draftsTokenStore,
  });

  assert.equal(draftsResult.ok, false);
  if (!draftsResult.ok) {
    assert.equal(draftsResult.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
    assert.equal(draftsResult.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(draftsRoot, '.reo', 'workspace.lock')));
  await assert.rejects(stat(path.join(outsideDrafts, 'segments')));
});

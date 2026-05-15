import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import Module from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createWorkspaceHandleStore } from '../../src/main/workspaceHandles.js';
import type { TrustedSenderEventAdapter } from '../../src/main/trustedSender.js';
import { WORKSPACE_CLOSE_CHANNEL } from '../../src/workspace-contract/workspace-channels.js';

const expectedSession = { label: 'default-session' };
const event: TrustedSenderEventAdapter = {
  processId: 7,
  sender: { session: expectedSession },
  senderFrame: {
    routingId: 4,
    topRoutingId: 4,
    url: 'reo-app://renderer/index.html',
  },
};

test('registered closeWorkspace IPC closes the injected recording transcription registry', async () => {
  const handlers = new Map<string, (event: unknown, input: unknown) => unknown>();
  const electronMock = {
    dialog: {
      showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    },
    ipcMain: {
      handle(channel: string, handler: (event: unknown, input: unknown) => unknown) {
        handlers.set(channel, handler);
      },
    },
  };

  type ModuleWithLoad = typeof Module & {
    _load(request: string, parent: unknown, isMain: boolean): unknown;
  };
  const moduleWithLoad = Module as ModuleWithLoad;
  const originalLoad = moduleWithLoad._load;
  moduleWithLoad._load = function loadMockedElectron(
    request: string,
    parent: unknown,
    isMain: boolean
  ) {
    if (request === 'electron') {
      return electronMock;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const { registerWorkspaceIpc } = await import(
      `../../src/main/workspaceIpc.js?registration=${Date.now()}`
    );
    const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-registered-close-'));
    const handleStore = createWorkspaceHandleStore({ createHandle: () => 'wh_ipc' });
    handleStore.register({
      canonicalRoot: rootPath,
      lock: {
        isHeld: () => true,
        isUsable: () => true,
        relocate: () => ({ ok: true }),
        release: async () => {},
      },
      sender: {
        frameRoutingId: 4,
        origin: 'reo-app://renderer',
        processId: 7,
        sessionKey: 'default',
      },
      workspaceId: 'ws_1',
    });
    const closedHandles: string[] = [];
    const diagnosticEvents: Array<{
      readonly event: string;
      readonly fields: Record<string, unknown>;
    }> = [];

    registerWorkspaceIpc({
      expectedSession,
      expectedSessionKey: 'default',
      handleStore,
      isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
      recordingTranscriptionSessions: {
        closeForWorkspaceHandle(workspaceHandle: string) {
          closedHandles.push(workspaceHandle);
        },
      } as never,
      async withDiagnostics<Result>(
        event: {
          readonly area: string;
          readonly event: string;
          readonly fields?: Record<string, unknown>;
          readonly level?: 'info' | 'warn' | 'error';
        },
        run: () => Promise<Result> | Result
      ): Promise<Result> {
        assert.deepEqual(Object.keys(event.fields ?? {}).sort(), ['channel']);
        diagnosticEvents.push({
          event: `${event.event}.start`,
          fields: event.fields ?? {},
        });
        const result = await run();
        diagnosticEvents.push({
          event: `${event.event}.finish`,
          fields: event.fields ?? {},
        });
        return result;
      },
    });

    const closeHandler = handlers.get(WORKSPACE_CLOSE_CHANNEL);
    assert.ok(closeHandler);
    const response = await closeHandler(event, { workspaceHandle: 'wh_ipc' });

    assert.deepEqual(response, { ok: true, value: { closed: true } });
    assert.deepEqual(closedHandles, ['wh_ipc']);
    assert.deepEqual(diagnosticEvents, [
      { event: 'request.start', fields: { channel: WORKSPACE_CLOSE_CHANNEL } },
      { event: 'request.finish', fields: { channel: WORKSPACE_CLOSE_CHANNEL } },
    ]);
  } finally {
    moduleWithLoad._load = originalLoad;
  }
});

import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import Module from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createWorkspaceHandleStore } from '../../src/main/workspaceHandles.js';
import type { TrustedSenderEventAdapter } from '../../src/main/trustedSender.js';
import {
  WORKSPACE_CLEAR_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
  WORKSPACE_CLOSE_CHANNEL,
  WORKSPACE_INITIALIZE_CHANNEL,
  WORKSPACE_OPEN_MARKDOWN_EXTERNAL_LINK_CHANNEL,
  WORKSPACE_OPEN_VOICE_TRANSCRIPTION_PROVIDER_CONSOLE_CHANNEL,
  WORKSPACE_READ_VOICE_TRANSCRIPTION_SETTINGS_CHANNEL,
  WORKSPACE_SAVE_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
  WORKSPACE_SET_VOICE_TRANSCRIPTION_ENABLED_CHANNEL,
  WORKSPACE_VALIDATE_VOICE_TRANSCRIPTION_CREDENTIALS_CHANNEL,
} from '../../src/workspace-contract/workspace-channels.js';
import { createWorkspaceSelectionTokenStore } from '../../src/main/workspaceSelectionTokens.js';
import { createWorkspaceMemorySpaceRegistry } from '../../src/main/workspaceMemorySpaceRegistry.js';

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
    const canceledBackfillReasons: string[] = [];
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
      backfillRuntime: {
        cancelAll: (reason: string) => {
          canceledBackfillReasons.push(`cancel:${reason}`);
        },
        cancelAllAndDrain: async (reason: string) => {
          canceledBackfillReasons.push(`drain:${reason}`);
        },
        enqueueAutomaticTargets: async () => ({ accepted: 0, capped: 0, duplicates: 0 }),
        enqueueAutomaticWorkspace: async () => ({ accepted: 0, capped: 0, duplicates: 0 }),
        pause: () => {},
        requestSegmentBackfill: async () =>
          ({ error: { code: 'ERR_BACKFILL_UNAVAILABLE', message: 'unused' }, ok: false }) as never,
        requestSupplementBackfill: async () =>
          ({ error: { code: 'ERR_BACKFILL_UNAVAILABLE', message: 'unused' }, ok: false }) as never,
        resume: () => {},
      },
      voiceSettingsStore: {
        read: () => ({
          enabled: false,
          apiKeyConfigured: false,
          apiKeyLastFour: null,
          lastValidatedAt: null,
          lastValidationOk: null,
          lastValidationCode: null,
        }),
        setEnabled: async () => {},
        writeApiKey: async () => {},
        clearApiKey: async () => {},
        recordValidation: async () => {},
        readDecryptedApiKey: () => null,
      },
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

    for (const channel of [
      WORKSPACE_READ_VOICE_TRANSCRIPTION_SETTINGS_CHANNEL,
      WORKSPACE_SET_VOICE_TRANSCRIPTION_ENABLED_CHANNEL,
      WORKSPACE_SAVE_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
      WORKSPACE_CLEAR_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
      WORKSPACE_VALIDATE_VOICE_TRANSCRIPTION_CREDENTIALS_CHANNEL,
      WORKSPACE_OPEN_VOICE_TRANSCRIPTION_PROVIDER_CONSOLE_CHANNEL,
      WORKSPACE_OPEN_MARKDOWN_EXTERNAL_LINK_CHANNEL,
    ]) {
      assert.equal(handlers.has(channel), true, `${channel} should be registered`);
    }

    const closeHandler = handlers.get(WORKSPACE_CLOSE_CHANNEL);
    assert.ok(closeHandler);
    const rejectedResponse = (await closeHandler(event, { workspaceHandle: '' })) as {
      ok: boolean;
    };

    assert.equal(rejectedResponse.ok, false);
    assert.deepEqual(closedHandles, []);
    assert.deepEqual(canceledBackfillReasons, []);

    const response = await closeHandler(event, { workspaceHandle: 'wh_ipc' });

    assert.deepEqual(response, { ok: true, value: { closed: true } });
    assert.deepEqual(closedHandles, ['wh_ipc']);
    assert.deepEqual(canceledBackfillReasons, ['drain:workspace-switch']);
    assert.deepEqual(diagnosticEvents, [
      { event: 'request.start', fields: { channel: WORKSPACE_CLOSE_CHANNEL } },
      { event: 'request.finish', fields: { channel: WORKSPACE_CLOSE_CHANNEL } },
      { event: 'request.start', fields: { channel: WORKSPACE_CLOSE_CHANNEL } },
      { event: 'request.finish', fields: { channel: WORKSPACE_CLOSE_CHANNEL } },
    ]);
  } finally {
    moduleWithLoad._load = originalLoad;
  }
});

test('registered workspace IPC fires automatic backfill on ready and validated settings once per workspace', async () => {
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
      `../../src/main/workspaceIpc.js?registration=${Date.now()}-trigger`
    );
    const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-backfill-ready-'));
    const tokenStore = createWorkspaceSelectionTokenStore({
      createToken: () => 'selection-token-ready',
      now: () => 1_000,
      ttlMs: 5_000,
    });
    tokenStore.issueSelection({
      displayPath: path.basename(rootPath),
      rootPath,
      sender: {
        frameRoutingId: 4,
        origin: 'reo-app://renderer',
        processId: 7,
        sessionKey: 'default',
      },
    });
    const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
      registryPath: path.join(
        await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-backfill-registry-')),
        'registry.json'
      ),
      now: () => '2026-05-17T12:00:00.000Z',
    });
    const automaticBackfills: Array<{
      readonly workspaceHandle: string;
      readonly workspaceId: string;
    }> = [];
    let latestIsCurrent: (() => boolean) | undefined;
    const settings: {
      apiKeyConfigured: boolean;
      apiKeyLastFour: string | null;
      enabled: boolean;
      lastValidatedAt: string | null;
      lastValidationCode: 'ok' | 'auth' | 'network' | null;
      lastValidationOk: boolean | null;
    } = {
      enabled: false,
      apiKeyConfigured: false,
      apiKeyLastFour: null,
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    };

    registerWorkspaceIpc({
      expectedSession,
      expectedSessionKey: 'default',
      handleStore: createWorkspaceHandleStore({ createHandle: () => 'wh_ready' }),
      isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
      memorySpaceRegistry,
      tokenStore,
      backfillRuntime: {
        cancelAll: () => {},
        cancelAllAndDrain: async () => {
          assert.equal(latestIsCurrent?.(), false);
        },
        enqueueAutomaticTargets: async () => ({ accepted: 0, capped: 0, duplicates: 0 }),
        enqueueAutomaticWorkspace: async (input: {
          readonly isCurrent?: () => boolean;
          readonly workspaceHandle: string;
          readonly workspaceId: string;
        }) => {
          latestIsCurrent = input.isCurrent;
          automaticBackfills.push({
            workspaceHandle: input.workspaceHandle,
            workspaceId: input.workspaceId,
          });
          return { accepted: 0, capped: 0, duplicates: 0 };
        },
        pause: () => {},
        requestSegmentBackfill: async () =>
          ({ error: { code: 'ERR_BACKFILL_UNAVAILABLE', message: 'unused' }, ok: false }) as never,
        requestSupplementBackfill: async () =>
          ({ error: { code: 'ERR_BACKFILL_UNAVAILABLE', message: 'unused' }, ok: false }) as never,
        resume: () => {},
      },
      voiceSettingsStore: {
        read: () => settings,
        setEnabled: async (enabled: boolean) => {
          settings.enabled = enabled;
        },
        writeApiKey: async () => {},
        clearApiKey: async () => {},
        recordValidation: async ({ code }: { readonly code: string }) => {
          settings.apiKeyConfigured = true;
          settings.apiKeyLastFour = '1234';
          settings.lastValidationCode = code as never;
          settings.lastValidationOk = code === 'ok';
          settings.lastValidatedAt = '2026-05-17T12:00:00.000Z';
        },
        readDecryptedApiKey: () => 'api-key',
      },
      voiceTranscriptionProbe: async () => ({ code: 'ok', ok: true }),
      async withDiagnostics<Result>(
        _event: {
          readonly area: string;
          readonly event: string;
          readonly fields?: Record<string, unknown>;
          readonly level?: 'info' | 'warn' | 'error';
        },
        run: () => Promise<Result> | Result
      ): Promise<Result> {
        return run();
      },
    });

    const initializeHandler = handlers.get(WORKSPACE_INITIALIZE_CHANNEL);
    const closeHandler = handlers.get(WORKSPACE_CLOSE_CHANNEL);
    const setEnabledHandler = handlers.get(WORKSPACE_SET_VOICE_TRANSCRIPTION_ENABLED_CHANNEL);
    const saveKeyHandler = handlers.get(WORKSPACE_SAVE_VOICE_TRANSCRIPTION_API_KEY_CHANNEL);
    assert.ok(closeHandler);
    assert.ok(initializeHandler);
    assert.ok(setEnabledHandler);
    assert.ok(saveKeyHandler);

    const readyResponse = (await initializeHandler(event, {
      description: '',
      selectionToken: 'selection-token-ready',
      title: 'Ready workspace',
    })) as { ok: boolean; value?: { workspaceHandle: string; workspaceId: string } };
    assert.equal(readyResponse.ok, true);
    assert.deepEqual(automaticBackfills, []);

    await setEnabledHandler(event, { enabled: true });
    assert.deepEqual(automaticBackfills, []);

    await saveKeyHandler(event, { apiKey: 'abcd1234' });
    assert.deepEqual(automaticBackfills, [
      { workspaceHandle: 'wh_ready', workspaceId: readyResponse.value?.workspaceId },
    ]);

    await saveKeyHandler(event, { apiKey: 'abcd1234' });
    assert.deepEqual(automaticBackfills, [
      { workspaceHandle: 'wh_ready', workspaceId: readyResponse.value?.workspaceId },
    ]);

    const closeResponse = (await closeHandler(event, { workspaceHandle: 'wh_ready' })) as {
      ok: boolean;
    };
    assert.equal(closeResponse.ok, true);
  } finally {
    moduleWithLoad._load = originalLoad;
  }
});

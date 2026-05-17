import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackfillTriggerWiring } from '../../src/main/backfillTriggerWiring.js';

function okVoiceSettings() {
  return {
    apiKeyConfigured: true,
    enabled: true,
    lastValidationOk: true,
  };
}

test('backfill trigger fires on voice settings ok rising edge when workspace is ready', async () => {
  const enqueued: unknown[] = [];
  const wiring = createBackfillTriggerWiring({
    enqueueAutoBatch: (targets) => enqueued.push(...targets),
    scan: async () => [
      {
        kind: 'segment',
        memoryId: 'mem_a',
        segmentId: 'seg_a',
        updatedAt: '2026-05-16T10:00:00.000Z',
        workspaceId: 'workspace-a',
      },
    ],
  });

  wiring.workspaceReady({ workspaceId: 'workspace-a' });
  await wiring.voiceSettingsChanged({
    apiKeyConfigured: true,
    enabled: true,
    lastValidationOk: false,
  });
  await wiring.voiceSettingsChanged(okVoiceSettings());

  assert.deepEqual(enqueued, [
    {
      kind: 'segment',
      memoryId: 'mem_a',
      segmentId: 'seg_a',
      updatedAt: '2026-05-16T10:00:00.000Z',
      workspaceId: 'workspace-a',
    },
  ]);
});

test('backfill trigger fires once per workspace ready while voice settings are already ok', async () => {
  let scans = 0;
  const wiring = createBackfillTriggerWiring({
    enqueueAutoBatch: () => {},
    readVoiceSettings: okVoiceSettings,
    scan: async () => {
      scans += 1;
      return [];
    },
  });

  await wiring.workspaceReady({ workspaceId: 'workspace-a' });
  await wiring.workspaceReady({ workspaceId: 'workspace-a' });
  await wiring.workspaceReady({ workspaceId: 'workspace-b' });

  assert.equal(scans, 2);
});

test('backfill trigger cancels on lock lost or workspace switch and pauses during recording', async () => {
  const events: string[] = [];
  const wiring = createBackfillTriggerWiring({
    cancelAll: (reason) => events.push(`cancel:${reason}`),
    enqueueAutoBatch: () => {},
    pauseQueue: () => events.push('pause'),
    resumeQueue: () => events.push('resume'),
    scan: async () => [],
  });

  wiring.recordingOpened();
  wiring.recordingClosed();
  wiring.lockLost();
  wiring.workspaceSwitched();

  assert.deepEqual(events, ['pause', 'resume', 'cancel:lock-lost', 'cancel:workspace-switch']);
});

test('backfill trigger records scan failure diagnostics without throwing', async () => {
  const diagnostics: Array<{
    readonly event: string;
    readonly fields?: Record<string, unknown>;
    readonly level?: string;
  }> = [];
  const wiring = createBackfillTriggerWiring({
    diagnostics: {
      record: (event, fields, level) =>
        diagnostics.push({
          event,
          ...(fields ? { fields } : {}),
          ...(level ? { level } : {}),
        }),
    },
    enqueueAutoBatch: () => assert.fail('failed scan must not enqueue'),
    readVoiceSettings: okVoiceSettings,
    scan: async () => {
      throw new Error('scan failed for /Users/yck/private/workspace');
    },
  });

  await wiring.workspaceReady({ workspaceId: 'workspace-a' });

  assert.deepEqual(diagnostics, [
    { event: 'scan-started', fields: {}, level: 'info' },
    { event: 'scan-failed', fields: { errorCode: 'scan-failed' }, level: 'warn' },
  ]);
  assert.equal(JSON.stringify(diagnostics).includes('/Users/yck/private/workspace'), false);
});

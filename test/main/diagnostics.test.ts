import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import log from 'electron-log/main';
import { initializeElectronDiagnostics } from '../../src/main/electronDiagnostics.js';
import {
  createDiagnosticRecorder,
  recordDiagnosticEvent,
  sanitizeDiagnosticFields,
  type DiagnosticEvent,
} from '../../src/main/diagnostics.js';

test('diagnostic span records start and finish events without raw request payload', async () => {
  const events: DiagnosticEvent[] = [];
  const recorder = createDiagnosticRecorder({
    now: () => '2026-05-15T16:41:00.000Z',
    nowMs: (() => {
      const values = [10, 42];
      return () => values.shift() ?? 42;
    })(),
    sink: {
      write(event) {
        events.push(event);
      },
    },
  });

  const result = await recorder.withSpan(
    {
      area: 'workspace-ipc',
      event: 'request',
      fields: {
        channel: 'workspace:createMemory',
        selectionToken: 'selection_secret',
        title: '用户标题',
        workspaceHandle: 'handle_secret',
      },
    },
    async () => ({ ok: true, value: { memoryId: 'mem_1' } })
  );

  assert.deepEqual(result, { ok: true, value: { memoryId: 'mem_1' } });
  assert.equal(events.length, 2);
  assert.deepEqual(
    events.map((event) => event.event),
    ['request.start', 'request.finish']
  );
  assert.deepEqual(events[0]?.fields, {
    channel: 'workspace:createMemory',
    selectionToken: '[redacted]',
    title: '[redacted]',
    workspaceHandle: '[redacted]',
  });
  assert.deepEqual(events[1]?.fields, {
    channel: 'workspace:createMemory',
    durationMs: 32,
    selectionToken: '[redacted]',
    status: 'ok',
    title: '[redacted]',
    workspaceHandle: '[redacted]',
  });
});

test('diagnostic span records error status and redacts thrown error messages', async () => {
  const events: DiagnosticEvent[] = [];
  const recorder = createDiagnosticRecorder({
    now: () => '2026-05-15T16:41:00.000Z',
    nowMs: (() => {
      const values = [5, 8];
      return () => values.shift() ?? 8;
    })(),
    sink: {
      write(event) {
        events.push(event);
      },
    },
  });

  await assert.rejects(
    recorder.withSpan(
      {
        area: 'workspace-ipc',
        event: 'request',
        fields: {
          channel: 'workspace:open',
          filePath: '/Users/yck/private/Reo Space',
        },
      },
      async () => {
        throw new Error('Raw path /Users/yck/private/Reo Space should not be logged');
      }
    )
  );

  assert.equal(events.length, 2);
  assert.deepEqual(events[1]?.fields, {
    channel: 'workspace:open',
    durationMs: 3,
    errorName: 'Error',
    filePath: '[redacted]',
    status: 'thrown',
  });
});

test('diagnostic field sanitizer bounds primitives and never expands objects', () => {
  assert.deepEqual(
    sanitizeDiagnosticFields({
      channel: 'workspace:readWorkspaceSnapshot',
      count: 2,
      message: '/Users/yck/private/记忆空间/raw payload',
      rawPayload: { nested: 'value' },
      values: ['a', 'b'],
    }),
    {
      channel: 'workspace:readWorkspaceSnapshot',
      count: 2,
      message: '[string:35]',
      rawPayload: '[redacted]',
      values: '[array:2]',
    }
  );
});

test('electron diagnostics writes redacted local JSON and leaves console transport disabled by default', async () => {
  const originalConsoleFlag = process.env['REO_DIAGNOSTICS_CONSOLE'];
  delete process.env['REO_DIAGNOSTICS_CONSOLE'];
  const logsPath = await mkdtemp(path.join(os.tmpdir(), 'reo-diagnostics-'));

  try {
    initializeElectronDiagnostics({
      getPath(name: string) {
        assert.equal(name, 'logs');
        return logsPath;
      },
      setAppLogsPath() {},
    } as never);

    recordDiagnosticEvent({
      area: 'workspace-ipc',
      event: 'request.finish',
      fields: {
        channel: 'workspace:createMemory',
        filePath: '/Users/yck/private/Reo Space/memories/memory.md',
        message: '/Users/yck/private/Reo Space raw payload',
        status: 'ok',
      },
    });

    const contents = await readFile(path.join(logsPath, 'main.log'), 'utf8');
    assert.match(contents, /\[reo-diagnostic\]/);
    assert.match(contents, /"logPath":"\[redacted\]"/);
    assert.match(contents, /"filePath":"\[redacted\]"/);
    assert.match(contents, /"message":"\[string:40\]"/);
    assert.doesNotMatch(contents, /private\/Reo Space/);
    assert.equal(log.transports.console.level, false);
  } finally {
    if (originalConsoleFlag === undefined) {
      delete process.env['REO_DIAGNOSTICS_CONSOLE'];
    } else {
      process.env['REO_DIAGNOSTICS_CONSOLE'] = originalConsoleFlag;
    }
  }
});

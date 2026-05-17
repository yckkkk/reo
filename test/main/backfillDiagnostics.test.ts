import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackfillDiagnostics } from '../../src/main/backfillDiagnostics.js';

test('backfill diagnostics records only allowlisted fields', () => {
  const events: unknown[] = [];
  const diagnostics = createBackfillDiagnostics({
    record: (event) => events.push(event),
  });

  diagnostics.record('task-failed', {
    audioUrl: 'https://bucket/private.ogg?X-Tos-Signature=secret',
    durationMs: 12,
    errorCode: 'ERR_BACKFILL_PROVIDER_FAILED',
    rawPath: '/Users/yck/private/audio.webm',
    taskCount: 3,
    title: 'private title',
    transcript: 'private transcript',
    xApiKey: 'private-key',
  });

  assert.deepEqual(events, [
    {
      area: 'backfill',
      event: 'task-failed',
      fields: {
        durationMs: 12,
        errorCode: 'ERR_BACKFILL_PROVIDER_FAILED',
        taskCount: 3,
      },
      level: 'warn',
    },
  ]);
});

test('backfill diagnostics supports explicit info and error levels', () => {
  const events: unknown[] = [];
  const diagnostics = createBackfillDiagnostics({
    record: (event) => events.push(event),
  });

  diagnostics.record('scan-completed', { taskCount: 2 }, 'info');
  diagnostics.record('queue-canceled', { durationMs: 4 }, 'error');

  assert.deepEqual(events, [
    {
      area: 'backfill',
      event: 'scan-completed',
      fields: { taskCount: 2 },
      level: 'info',
    },
    {
      area: 'backfill',
      event: 'queue-canceled',
      fields: { durationMs: 4 },
      level: 'error',
    },
  ]);
});

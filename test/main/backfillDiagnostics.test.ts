import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackfillDiagnostics } from '../../src/main/backfillDiagnostics.js';

test('backfill diagnostics allow mode and continue redacting transcript internals', () => {
  const records: Array<{
    readonly event: string;
    readonly fields?: Record<string, unknown>;
  }> = [];
  const diagnostics = createBackfillDiagnostics({
    record: (event) => {
      records.push({
        event: event.event,
        ...(event.fields ? { fields: event.fields } : {}),
      });
    },
  });

  diagnostics.record(
    'task-started',
    {
      mode: 'regenerate',
      transcript: '用户正文',
      digest: 'sha256-secret',
      rawPath: '/tmp/private/audio.webm',
      taskCount: 1,
    },
    'info'
  );

  assert.deepEqual(records, [
    {
      event: 'task-started',
      fields: {
        mode: 'regenerate',
        taskCount: 1,
      },
    },
  ]);
});

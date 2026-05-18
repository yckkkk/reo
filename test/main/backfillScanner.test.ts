import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectEligibleBackfillTargets,
  createBackfillTargetSelector,
  addEligibleBackfillTargets,
  normalizeBackfillTargetLimit,
} from '../../src/main/backfillScanner.js';

test('backfill scanner returns failed transcript-missing segments and supplements newest first', () => {
  const targets = collectEligibleBackfillTargets(
    {
      memories: [
        {
          memoryId: 'mem_a',
          segments: [
            {
              audioByteLength: 12,
              lastTranscriptionAttempt: 'failed',
              memoryId: 'mem_a',
              segmentId: 'seg_old',
              transcript: { exists: false },
              updatedAt: '2026-05-16T10:00:00.000Z',
              workspaceId: 'workspace-a',
              supplements: [
                {
                  audioByteLength: 8,
                  lastTranscriptionAttempt: 'failed',
                  memoryId: 'mem_a',
                  segmentId: 'seg_old',
                  supplementId: 'sup_new',
                  transcript: { exists: false },
                  updatedAt: '2026-05-16T12:00:00.000Z',
                  workspaceId: 'workspace-a',
                },
              ],
            },
          ],
        },
      ],
    },
    20
  );

  assert.deepEqual(targets, [
    {
      kind: 'supplement',
      memoryId: 'mem_a',
      segmentId: 'seg_old',
      supplementId: 'sup_new',
      updatedAt: '2026-05-16T12:00:00.000Z',
      workspaceId: 'workspace-a',
    },
    {
      kind: 'segment',
      memoryId: 'mem_a',
      segmentId: 'seg_old',
      updatedAt: '2026-05-16T10:00:00.000Z',
      workspaceId: 'workspace-a',
    },
  ]);
});

test('backfill scanner excludes success, never, existing transcript, and zero-byte audio', () => {
  const targets = collectEligibleBackfillTargets(
    {
      memories: [
        {
          memoryId: 'mem_a',
          segments: [
            {
              audioByteLength: 1,
              lastTranscriptionAttempt: 'success',
              memoryId: 'mem_a',
              segmentId: 'seg_success',
              transcript: { exists: false },
              updatedAt: '2026-05-16T10:00:00.000Z',
              workspaceId: 'workspace-a',
              supplements: [],
            },
            {
              audioByteLength: 1,
              lastTranscriptionAttempt: 'never',
              memoryId: 'mem_a',
              segmentId: 'seg_never',
              transcript: { exists: false },
              updatedAt: '2026-05-16T10:00:00.000Z',
              workspaceId: 'workspace-a',
              supplements: [],
            },
            {
              audioByteLength: 1,
              lastTranscriptionAttempt: 'failed',
              memoryId: 'mem_a',
              segmentId: 'seg_transcript',
              transcript: { exists: true },
              updatedAt: '2026-05-16T10:00:00.000Z',
              workspaceId: 'workspace-a',
              supplements: [],
            },
            {
              audioByteLength: 0,
              lastTranscriptionAttempt: 'failed',
              memoryId: 'mem_a',
              segmentId: 'seg_empty',
              transcript: { exists: false },
              updatedAt: '2026-05-16T10:00:00.000Z',
              workspaceId: 'workspace-a',
              supplements: [],
            },
          ],
        },
      ],
    },
    20
  );

  assert.deepEqual(targets, []);
});

test('backfill scanner normalizes fractional and invalid limits', () => {
  assert.equal(normalizeBackfillTargetLimit(1.9), 1);
  assert.equal(normalizeBackfillTargetLimit(Number.NaN), Number.POSITIVE_INFINITY);
  assert.equal(normalizeBackfillTargetLimit(-1), 0);
});

test('backfill scanner can add a large memory detail directly to a bounded selector', () => {
  const selector = createBackfillTargetSelector(2);
  addEligibleBackfillTargets(
    {
      memories: [
        {
          memoryId: 'mem_a',
          segments: Array.from({ length: 12 }, (_, index) => ({
            audioByteLength: 1,
            lastTranscriptionAttempt: 'failed' as const,
            memoryId: 'mem_a',
            segmentId: `seg_${index}`,
            transcript: { exists: false },
            updatedAt: `2026-05-16T10:${String(index).padStart(2, '0')}:00.000Z`,
            workspaceId: 'workspace-a',
            supplements: [],
          })),
        },
      ],
    },
    selector
  );

  assert.deepEqual(
    selector.toArray().map((target) => (target.kind === 'segment' ? target.segmentId : '')),
    ['seg_11', 'seg_10']
  );
  assert.deepEqual(selector.peekOldestSelected(), {
    kind: 'segment',
    memoryId: 'mem_a',
    segmentId: 'seg_10',
    updatedAt: '2026-05-16T10:10:00.000Z',
    workspaceId: 'workspace-a',
  });
});

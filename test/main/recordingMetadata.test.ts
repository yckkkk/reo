import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizedSegmentMetadataSchema } from '../../src/workspace-contract/workspace-contract.js';

const finalizedSegmentMetadata = {
  schemaVersion: 1,
  workspaceId: 'ws_1',
  memoryId: 'mem_1',
  segmentId: 'seg_1',
  type: 'audio',
  status: 'finalized',
  title: '一段录音',
  createdAt: '2026-05-08T14:40:00.000Z',
  finalizedAt: '2026-05-08T14:42:00.000Z',
  durationMs: 1200,
  nextSequence: 1,
  audioByteLength: 2048,
  transcriptPath: 'transcript.md',
} as const;

test('finalized audio segment metadata accepts the fixed transcript file only', () => {
  assert.deepEqual(finalizedSegmentMetadataSchema.parse(finalizedSegmentMetadata), {
    ...finalizedSegmentMetadata,
  });

  assert.throws(() =>
    finalizedSegmentMetadataSchema.parse({
      ...finalizedSegmentMetadata,
      transcriptPath: 'notes/transcript.md',
    })
  );
  assert.throws(() =>
    finalizedSegmentMetadataSchema.parse({
      ...finalizedSegmentMetadata,
      notesPath: 'notes.md',
    })
  );
});

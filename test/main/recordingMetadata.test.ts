import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizedRecordingMetadataSchema } from '../../src/workspace-contract/workspace-contract.js';

const finalizedRecordingMetadata = {
  schemaVersion: 1,
  workspaceId: 'ws_1',
  memoryId: 'mem_1',
  recordingId: 'rec_1',
  status: 'finalized',
  title: '一段录音',
  createdAt: '2026-05-08T14:40:00.000Z',
  finalizedAt: '2026-05-08T14:42:00.000Z',
  durationMs: 1200,
  nextSequence: 1,
  audioByteLength: 2048,
  transcriptPath: 'transcript.md',
  reflectionsPath: 'reflections.md',
} as const;

test('finalized recording metadata accepts only fixed transcript and reflections file names', () => {
  assert.deepEqual(finalizedRecordingMetadataSchema.parse(finalizedRecordingMetadata), {
    ...finalizedRecordingMetadata,
  });

  assert.throws(() =>
    finalizedRecordingMetadataSchema.parse({
      ...finalizedRecordingMetadata,
      transcriptPath: 'notes/transcript.md',
    })
  );
  assert.throws(() =>
    finalizedRecordingMetadataSchema.parse({
      ...finalizedRecordingMetadata,
      reflectionsPath: 'custom-reflections.md',
    })
  );
});

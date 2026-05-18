import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergeTranscriptSegments,
  type WorkspaceTranscriptSegmentLike,
} from '../../src/workspace-contract/transcript-segments.js';

function segment({
  endTimeMs,
  recordingSessionId = 'recording-1',
  revisionId = 'revision-1',
  startTimeMs,
  text,
}: {
  readonly endTimeMs: number;
  readonly recordingSessionId?: string;
  readonly revisionId?: string;
  readonly startTimeMs: number;
  readonly text: string;
}): WorkspaceTranscriptSegmentLike {
  return {
    endTimeMs,
    isFinal: true,
    recordingSessionId,
    revisionId,
    startTimeMs,
    text,
  };
}

test('transcript merge appends later sorted segments without scanning the full existing transcript', () => {
  let timelineReads = 0;
  const existing = Array.from({ length: 128 }, (_, index) => {
    const start = index * 1000;
    const end = start + 900;
    return {
      get endTimeMs() {
        timelineReads += 1;
        return end;
      },
      isFinal: true,
      recordingSessionId: 'recording-1',
      revisionId: 'revision-1',
      get startTimeMs() {
        timelineReads += 1;
        return start;
      },
      text: `片段 ${index}`,
    };
  });

  const merged = mergeTranscriptSegments(existing, [
    segment({ endTimeMs: 130_900, startTimeMs: 130_000, text: '追加片段' }),
  ]);

  assert.equal(merged.length, 129);
  assert.equal(merged.at(-1)?.text, '追加片段');
  assert.ok(
    timelineReads < 64,
    `Expected logarithmic append path to avoid full transcript scan, read ${timelineReads} timeline fields.`
  );
});

test('transcript merge returns a fresh array when there are no incoming segments', () => {
  const existing = [segment({ endTimeMs: 500, startTimeMs: 0, text: '原始片段' })];
  const merged = mergeTranscriptSegments(existing, []);

  assert.deepEqual(merged, existing);
  assert.notEqual(merged, existing);
});

test('transcript merge removes overlapping older segments while preserving sorted output', () => {
  const merged = mergeTranscriptSegments(
    [
      segment({ endTimeMs: 500, startTimeMs: 0, text: '保留前段' }),
      segment({ endTimeMs: 1200, startTimeMs: 600, text: '被替换一' }),
      segment({ endTimeMs: 2000, startTimeMs: 1300, text: '被替换二' }),
      segment({ endTimeMs: 3000, startTimeMs: 2200, text: '保留后段' }),
    ],
    [segment({ endTimeMs: 2100, startTimeMs: 700, text: '新转写' })]
  );

  assert.deepEqual(
    merged.map((entry) => entry.text),
    ['保留前段', '新转写', '保留后段']
  );
});

test('transcript merge batches sorted incoming segments without rescanning the existing transcript for each item', () => {
  let timelineReads = 0;
  const existing = Array.from({ length: 256 }, (_, index) => {
    const start = index * 1000;
    const end = start + 900;
    return {
      get endTimeMs() {
        timelineReads += 1;
        return end;
      },
      isFinal: true,
      recordingSessionId: 'recording-1',
      revisionId: 'revision-1',
      get startTimeMs() {
        timelineReads += 1;
        return start;
      },
      text: `旧片段 ${index}`,
    };
  });
  const incoming = Array.from({ length: 64 }, (_, index) => {
    const start = 256_000 + index * 1000;
    return segment({
      endTimeMs: start + 900,
      startTimeMs: start,
      text: `新片段 ${index}`,
    });
  });

  const merged = mergeTranscriptSegments(existing, incoming);

  assert.equal(merged.length, 320);
  assert.deepEqual(
    merged.slice(-3).map((entry) => entry.text),
    ['新片段 61', '新片段 62', '新片段 63']
  );
  assert.ok(
    timelineReads < 128,
    `Expected batched append to avoid per-segment binary scans, read ${timelineReads} timeline fields.`
  );
});

import { describe, expect, it } from 'vitest';
import {
  applyTranscriptResult,
  applyTranscriptResults,
  createRecordingTimeline,
  findTranscriptSegmentAtOrBeforeTime,
  findTranscriptSegmentAtTime,
  hasTailAfterCursor,
  startReplacementAtCursor,
} from './recordingTimeline';

describe('recordingTimeline', () => {
  it('drops transcript segments that overlap the replacement cursor without fabricating partial text', () => {
    const timeline = createRecordingTimeline({
      recordingSessionId: 'recording-1',
      revisionId: 'rev-1',
      totalDurationMs: 18_000,
    });
    const withSegments = [
      {
        endTimeMs: 4_000,
        isFinal: true,
        recordingSessionId: 'recording-1',
        revisionId: 'rev-1',
        startTimeMs: 0,
        text: '前半段',
      },
      {
        endTimeMs: 12_000,
        isFinal: true,
        recordingSessionId: 'recording-1',
        revisionId: 'rev-1',
        startTimeMs: 4_000,
        text: '会被替换',
      },
    ].reduce(applyTranscriptResult, timeline);

    const replaced = startReplacementAtCursor(withSegments, {
      cursorTimeMs: 5_000,
      nextRevisionId: 'rev-2',
    });

    expect(replaced.revisionId).toBe('rev-2');
    expect(replaced.totalDurationMs).toBe(5_000);
    expect(replaced.cursorTimeMs).toBe(5_000);
    expect(replaced.transcriptSegments.map((segment) => segment.text)).toEqual(['前半段']);
  });

  it('keeps the transcript before the replacement cursor when new replacement text arrives', () => {
    const timeline = [
      {
        endTimeMs: 4_000,
        isFinal: true,
        recordingSessionId: 'recording-1',
        revisionId: 'rev-1',
        startTimeMs: 0,
        text: '保留的前半段',
      },
      {
        endTimeMs: 12_000,
        isFinal: true,
        recordingSessionId: 'recording-1',
        revisionId: 'rev-1',
        startTimeMs: 4_000,
        text: '被替换的后半段',
      },
    ].reduce(
      applyTranscriptResult,
      createRecordingTimeline({
        recordingSessionId: 'recording-1',
        revisionId: 'rev-1',
        totalDurationMs: 12_000,
      })
    );

    const replaced = startReplacementAtCursor(timeline, {
      cursorTimeMs: 4_000,
      nextRevisionId: 'rev-2',
    });
    const withReplacementText = applyTranscriptResult(
      createRecordingTimeline({
        ...replaced,
        recordingSessionId: 'recording-2',
      }),
      {
        endTimeMs: 7_000,
        isFinal: true,
        recordingSessionId: 'recording-2',
        revisionId: 'rev-2',
        startTimeMs: 4_000,
        text: '重新录制的新内容',
      }
    );

    expect(withReplacementText.transcriptSegments.map((segment) => segment.text)).toEqual([
      '保留的前半段',
      '重新录制的新内容',
    ]);
  });

  it('drops stale transcript results from an older revision or recording session', () => {
    const timeline = startReplacementAtCursor(
      createRecordingTimeline({
        recordingSessionId: 'recording-1',
        revisionId: 'rev-1',
        totalDurationMs: 9_000,
      }),
      { cursorTimeMs: 3_000, nextRevisionId: 'rev-2' }
    );

    const staleRevision = applyTranscriptResult(timeline, {
      endTimeMs: 6_000,
      isFinal: true,
      recordingSessionId: 'recording-1',
      revisionId: 'rev-1',
      startTimeMs: 3_000,
      text: '旧结果',
    });
    const staleSession = applyTranscriptResult(staleRevision, {
      endTimeMs: 6_000,
      isFinal: true,
      recordingSessionId: 'recording-old',
      revisionId: 'rev-2',
      startTimeMs: 3_000,
      text: '旧会话',
    });
    const current = applyTranscriptResult(staleSession, {
      endTimeMs: 6_000,
      isFinal: false,
      recordingSessionId: 'recording-1',
      revisionId: 'rev-2',
      startTimeMs: 3_000,
      text: '新结果',
    });

    expect(current.transcriptSegments.map((segment) => segment.text)).toEqual(['新结果']);
  });

  it('applies a batch of transcript results with the same merge semantics as individual results', () => {
    const existing = Array.from({ length: 1000 }, (_, index) => ({
      endTimeMs: index * 1000 + 900,
      isFinal: true,
      recordingSessionId: 'recording-1',
      revisionId: 'rev-1',
      startTimeMs: index * 1000,
      text: `旧段落${index}`,
    }));
    const incoming = Array.from({ length: 200 }, (_, index) => ({
      endTimeMs: 1_000_000 + index * 1000 + 900,
      isFinal: true,
      recordingSessionId: 'recording-1',
      revisionId: 'rev-1',
      startTimeMs: 1_000_000 + index * 1000,
      text: `新段落${index}`,
    }));
    const timeline = createRecordingTimeline({
      recordingSessionId: 'recording-1',
      revisionId: 'rev-1',
      totalDurationMs: 999_900,
      transcriptSegments: existing,
    });

    const batchApplied = applyTranscriptResults(timeline, incoming);
    const individuallyApplied = incoming.reduce(applyTranscriptResult, timeline);

    expect(batchApplied.transcriptSegments).toEqual(individuallyApplied.transcriptSegments);
    expect(batchApplied.totalDurationMs).toBe(individuallyApplied.totalDurationMs);
  });

  it('replaces growing interim transcript results instead of appending duplicate partials', () => {
    const timeline = createRecordingTimeline({
      recordingSessionId: 'recording-1',
      revisionId: 'rev-1',
    });

    const withFirstPartial = applyTranscriptResult(timeline, {
      endTimeMs: 1_200,
      isFinal: false,
      recordingSessionId: 'recording-1',
      revisionId: 'rev-1',
      startTimeMs: 0,
      text: '今天',
    });
    const withSecondPartial = applyTranscriptResult(withFirstPartial, {
      endTimeMs: 2_400,
      isFinal: false,
      recordingSessionId: 'recording-1',
      revisionId: 'rev-1',
      startTimeMs: 0,
      text: '今天我想记录一次真实验证',
    });
    const withFinal = applyTranscriptResult(withSecondPartial, {
      endTimeMs: 2_800,
      isFinal: true,
      recordingSessionId: 'recording-1',
      revisionId: 'rev-1',
      startTimeMs: 0,
      text: '今天我想记录一次真实验证。',
    });

    expect(withSecondPartial.transcriptSegments.map((segment) => segment.text)).toEqual([
      '今天我想记录一次真实验证',
    ]);
    expect(withFinal.transcriptSegments).toEqual([
      {
        endTimeMs: 2_800,
        isFinal: true,
        recordingSessionId: 'recording-1',
        revisionId: 'rev-1',
        startTimeMs: 0,
        text: '今天我想记录一次真实验证。',
      },
    ]);
  });

  it('maps cursor time to the transcript segment and detects tail content', () => {
    const timeline = [
      {
        endTimeMs: 2_000,
        isFinal: true,
        recordingSessionId: 'recording-1',
        revisionId: 'rev-1',
        startTimeMs: 0,
        text: '开头',
      },
      {
        endTimeMs: 8_000,
        isFinal: true,
        recordingSessionId: 'recording-1',
        revisionId: 'rev-1',
        startTimeMs: 2_000,
        text: '中间',
      },
    ].reduce(
      applyTranscriptResult,
      createRecordingTimeline({
        cursorTimeMs: 4_000,
        recordingSessionId: 'recording-1',
        revisionId: 'rev-1',
        totalDurationMs: 10_000,
      })
    );

    expect(findTranscriptSegmentAtTime(timeline.transcriptSegments, 4_000)?.text).toBe('中间');
    expect(findTranscriptSegmentAtOrBeforeTime(timeline.transcriptSegments, 9_000)?.text).toBe(
      '中间'
    );
    expect(hasTailAfterCursor(timeline)).toBe(true);
    expect(hasTailAfterCursor({ ...timeline, cursorTimeMs: 10_000 })).toBe(false);
  });
});

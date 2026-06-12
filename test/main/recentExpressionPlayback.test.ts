import assert from 'node:assert/strict';
import test from 'node:test';
import {
  recentExpressionSegmentPlayback,
  recentExpressionSupplementPlayback,
} from '../../src/main/recentExpressionPlayback.js';
import { noteContentHash } from '../../src/main/noteSpeechSynthesisProjection.js';

test('recentExpressionSegmentPlayback exposes audio segment duration', async () => {
  assert.deepEqual(
    await recentExpressionSegmentPlayback({
      metadata: {
        kind: 'audio',
        durationMs: 4200,
      },
      objectDirectory: '/workspace/memories/mem/segments/seg_audio',
    }),
    { kind: 'audio', durationMs: 4200 }
  );
});

test('recentExpressionSegmentPlayback omits artifact segments', async () => {
  assert.equal(
    await recentExpressionSegmentPlayback({
      metadata: {
        kind: 'artifact',
      },
      objectDirectory: '/workspace/memories/mem/segments/seg_artifact',
    }),
    undefined
  );
});

test('recentExpressionSegmentPlayback exposes note speech only when ready', async () => {
  const markdownContent = '# 语音笔记\n\n这条笔记已经生成语音。';
  const calls: {
    readonly currentContentHash: string;
    readonly objectDirectory: string;
  }[] = [];

  const playback = await recentExpressionSegmentPlayback({
    metadata: {
      kind: 'note',
      markdownContent,
    },
    objectDirectory: '/workspace/memories/mem/segments/seg_note',
    readSpeechProjection: async ({ currentContentHash, objectDirectory }) => {
      calls.push({ currentContentHash, objectDirectory });
      return { status: 'ready' };
    },
  });

  assert.deepEqual(playback, { kind: 'note-speech' });
  assert.deepEqual(calls, [
    {
      currentContentHash: noteContentHash(markdownContent),
      objectDirectory: '/workspace/memories/mem/segments/seg_note',
    },
  ]);

  for (const status of ['missing', 'stale', 'failed', 'unsupported'] as const) {
    assert.equal(
      await recentExpressionSegmentPlayback({
        metadata: {
          kind: 'note',
          markdownContent,
        },
        objectDirectory: '/workspace/memories/mem/segments/seg_note',
        readSpeechProjection: async () => ({ status }),
      }),
      undefined
    );
  }
});

test('recentExpressionSupplementPlayback exposes only audio supplements', () => {
  assert.deepEqual(
    recentExpressionSupplementPlayback({
      type: 'audio',
      durationMs: 800,
    }),
    { kind: 'audio', durationMs: 800 }
  );
  assert.equal(recentExpressionSupplementPlayback({ type: 'note' }), undefined);
  assert.equal(recentExpressionSupplementPlayback({ type: 'artifact' }), undefined);
});

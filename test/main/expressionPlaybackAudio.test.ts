import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveExpressionPlaybackAudio } from '../../src/main/expressionPlaybackAudio.js';
import { workspaceError } from '../../src/workspace-contract/workspace-contract.js';

const audioRequest = {
  workspaceId: 'ws_1',
  memoryId: 'mem_1',
  segmentId: 'seg_1',
  kind: 'audio',
  requestId: 'req_1',
} as const;

test('resolveExpressionPlaybackAudio reads finalized segment audio by resolved root', async () => {
  const segmentAudioProjectionCalls: unknown[] = [];
  const segmentAudioCalls: unknown[] = [];

  const result = await resolveExpressionPlaybackAudio({
    request: audioRequest,
    rootPath: '/root',
    readSegmentAudioProjection: async (input) => {
      segmentAudioProjectionCalls.push(input);
      return { audioByteLength: 3, audioHash: 'hash_1' };
    },
    readSegmentAudio: async (input) => {
      segmentAudioCalls.push(input);
      return {
        ok: true,
        audio: new Uint8Array([1, 2, 3]),
        audioByteLength: 3,
        audioHash: 'hash_1',
      };
    },
  });

  assert.deepEqual(segmentAudioProjectionCalls, [
    {
      rootPath: '/root',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    },
  ]);
  assert.deepEqual(segmentAudioCalls, [
    {
      rootPath: '/root',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      expectedAudioByteLength: 3,
      expectedAudioHash: 'hash_1',
    },
  ]);
  assert.deepEqual(result, {
    ok: true,
    audio: new Uint8Array([1, 2, 3]),
    mimeType: 'audio/webm',
  });
});

test('resolveExpressionPlaybackAudio reads finalized supplement audio by resolved root', async () => {
  const supplementAudioProjectionCalls: unknown[] = [];
  const supplementAudioCalls: unknown[] = [];

  const result = await resolveExpressionPlaybackAudio({
    request: {
      ...audioRequest,
      supplementId: 'sup_1',
    },
    rootPath: '/root',
    readSupplementAudioProjection: async (input) => {
      supplementAudioProjectionCalls.push(input);
      return { audioByteLength: 4, audioHash: null };
    },
    readSupplementAudio: async (input) => {
      supplementAudioCalls.push(input);
      return {
        ok: true,
        audio: new Uint8Array([4, 5, 6, 7]),
        audioByteLength: 4,
        audioHash: 'hash_2',
      };
    },
  });

  assert.deepEqual(supplementAudioProjectionCalls, [
    {
      rootPath: '/root',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
    },
  ]);
  assert.deepEqual(supplementAudioCalls, [
    {
      rootPath: '/root',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      expectedAudioByteLength: 4,
      expectedAudioHash: null,
    },
  ]);
  assert.deepEqual(result, {
    ok: true,
    audio: new Uint8Array([4, 5, 6, 7]),
    mimeType: 'audio/webm',
  });
});

test('resolveExpressionPlaybackAudio reads ready note speech by resolved root', async () => {
  const noteSpeechCalls: unknown[] = [];

  const result = await resolveExpressionPlaybackAudio({
    request: {
      ...audioRequest,
      kind: 'note-speech',
    },
    rootPath: '/root',
    readSegmentProjection: async () => ({
      type: 'note',
      speechSynthesis: {
        status: 'ready',
        audioByteLength: 5,
        contentHash: 'content_hash_1',
        speaker: 'zh_female_vv_uranus_bigtts',
        updatedAt: '2026-06-06T20:20:00.000-07:00',
      },
    }),
    readNoteSpeech: async (input) => {
      noteSpeechCalls.push(input);
      return {
        ok: true,
        audio: new Uint8Array([8, 9]),
        audioByteLength: 2,
        contentHash: 'content_hash_1',
        mimeType: 'audio/mpeg',
      };
    },
  });

  assert.deepEqual(noteSpeechCalls, [
    {
      rootPath: '/root',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      contentHash: 'content_hash_1',
      audioByteLength: 5,
      speaker: 'zh_female_vv_uranus_bigtts',
      updatedAt: '2026-06-06T20:20:00.000-07:00',
    },
  ]);
  assert.deepEqual(result, {
    ok: true,
    audio: new Uint8Array([8, 9]),
    mimeType: 'audio/mpeg',
  });
});

test('resolveExpressionPlaybackAudio normalizes segment audio projection failures', async () => {
  const result = await resolveExpressionPlaybackAudio({
    request: audioRequest,
    rootPath: '/root',
    readSegmentAudioProjection: async () => {
      throw new Error('stale segment projection');
    },
    readSegmentAudio: async () => {
      throw new Error('readSegmentAudio should not be called');
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_RECORDING_NOT_FOUND');
  }
});

test('resolveExpressionPlaybackAudio normalizes supplement audio projection failures', async () => {
  const result = await resolveExpressionPlaybackAudio({
    request: { ...audioRequest, supplementId: 'sup_1' },
    rootPath: '/root',
    readSupplementAudioProjection: async () => {
      throw new Error('stale supplement projection');
    },
    readSupplementAudio: async () => {
      throw new Error('readSupplementAudio should not be called');
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_RECORDING_NOT_FOUND');
  }
});

test('resolveExpressionPlaybackAudio normalizes note speech projection failures', async () => {
  const result = await resolveExpressionPlaybackAudio({
    request: { ...audioRequest, kind: 'note-speech' },
    rootPath: '/root',
    readSegmentProjection: async () => {
      throw new Error('stale note projection');
    },
    readNoteSpeech: async () => {
      throw new Error('readNoteSpeech should not be called');
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_SPEECH_SYNTHESIS_TARGET_NOT_ELIGIBLE');
  }
});

test('resolveExpressionPlaybackAudio propagates reader errors unchanged', async () => {
  const error = workspaceError('ERR_RECORDING_NOT_FOUND', 'missing audio');
  const result = await resolveExpressionPlaybackAudio({
    request: audioRequest,
    rootPath: '/root',
    readSegmentAudioProjection: async () => ({ audioByteLength: 3, audioHash: null }),
    readSegmentAudio: async () => error,
  });

  assert.deepEqual(result, error);
});

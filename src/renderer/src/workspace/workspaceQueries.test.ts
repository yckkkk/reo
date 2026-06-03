import { describe, expect, it } from 'vitest';
import {
  memoryDetailQueryBelongsToWorkspace,
  memoryDetailQueryOptions,
  memoryDetailQueryKey,
  memorySpacesQueryKey,
  segmentAudioQueryKey,
  segmentAudioQueryOptions,
  segmentSpeechAudioQueryOptions,
  segmentContentQueryOptions,
  segmentContentQueryKey,
  segmentSupplementAudioQueryKey,
  segmentSupplementAudioQueryOptions,
  segmentSupplementSpeechAudioQueryOptions,
  segmentSupplementContentQueryOptions,
  workspaceContentQueryBelongsToWorkspace,
  workspacePlaybackAudioQueryBelongsToEntity,
  workspacePlaybackAudioQueryBelongsToWorkspace,
  workspaceProjectionQueryBelongsToWorkspace,
  workspaceSpeechAudioQueryBelongsToWorkspace,
  workspaceSnapshotQueryKey,
} from './workspaceQueries';

describe('workspace queries', () => {
  it('does not include workspaceHandle in the workspace snapshot query key', () => {
    expect(
      workspaceSnapshotQueryKey({ workspaceId: 'ws_1', workspaceHandle: 'secret-handle' })
    ).toEqual(['workspace', 'snapshot', 'ws_1']);
  });

  it('uses a stable 记忆空间 query key', () => {
    expect(memorySpacesQueryKey()).toEqual(['workspace', 'memory-spaces']);
  });

  it('does not include workspaceHandle in the Memory detail query key', () => {
    expect(
      memoryDetailQueryKey({
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        workspaceHandle: 'secret-handle',
      })
    ).toEqual(['workspace', 'memory-detail', 'ws_1', 'mem_1']);
  });

  it('includes workspaceHandle in handle-scoped Segment content query keys', () => {
    expect(
      segmentContentQueryKey({
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        workspaceHandle: 'secret-handle',
      })
    ).toEqual(['workspace', 'segment-content', 'ws_1', 'secret-handle', 'mem_1', 'seg_1']);
  });

  it('keeps fresh file-backed detail and content cached until explicit invalidation', () => {
    const session = {
      workspaceHandle: 'workspace-handle-1',
      workspaceId: 'ws_1',
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Daily memory',
        description: '',
        memories: [],
      },
    };

    expect(memoryDetailQueryOptions(session, 'mem_1').refetchOnMount).not.toBe('always');
    expect(segmentContentQueryOptions(session, 'mem_1', 'seg_1', 'note').refetchOnMount).not.toBe(
      'always'
    );
    expect(
      segmentSupplementContentQueryOptions(session, 'mem_1', 'seg_1', 'sup_1', 'note')
        .refetchOnMount
    ).not.toBe('always');
    expect(segmentContentQueryOptions(session, 'mem_1', 'seg_1', 'audio').refetchOnMount).not.toBe(
      'always'
    );
    expect(
      segmentSupplementContentQueryOptions(session, 'mem_1', 'seg_1', 'sup_1', 'audio')
        .refetchOnMount
    ).not.toBe('always');
  });

  it('keeps large playback audio caches short-lived without evicting projections too quickly', () => {
    const session = {
      workspaceHandle: 'workspace-handle-1',
      workspaceId: 'ws_1',
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Daily memory',
        description: '',
        memories: [],
      },
    };

    expect(memoryDetailQueryOptions(session, 'mem_1').gcTime).toBe(Infinity);
    expect(segmentContentQueryOptions(session, 'mem_1', 'seg_1', 'note').gcTime).toBe(300000);
    expect(
      segmentSupplementContentQueryOptions(session, 'mem_1', 'seg_1', 'sup_1', 'note').gcTime
    ).toBe(300000);
    expect(
      segmentAudioQueryOptions({
        audioByteLength: 1024,
        audioHash: 'a'.repeat(64),
        audioIdentityVersion: 'segment-content-request-1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        session,
      }).gcTime
    ).toBe(0);
    expect(
      segmentSupplementAudioQueryOptions({
        audioByteLength: 1024,
        audioHash: 'b'.repeat(64),
        audioIdentityVersion: 'supplement-content-request-1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        session,
        supplementId: 'sup_1',
      }).gcTime
    ).toBe(0);
    expect(
      segmentSpeechAudioQueryOptions({
        audioByteLength: 1024,
        contentHash: 'hash_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        session,
        speaker: 'zh_female_vv_uranus_bigtts',
        updatedAt: '2026-06-02T00:00:00.000Z',
      }).gcTime
    ).toBe(0);
    expect(
      segmentSupplementSpeechAudioQueryOptions({
        audioByteLength: 1024,
        contentHash: 'hash_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        session,
        speaker: 'zh_female_vv_uranus_bigtts',
        supplementId: 'sup_1',
        updatedAt: '2026-06-02T00:00:00.000Z',
      }).gcTime
    ).toBe(0);
  });

  it('uses content request identity for hashless recording audio query keys', () => {
    expect(
      segmentAudioQueryKey({
        audioByteLength: 2048,
        audioHash: null,
        audioIdentityVersion: 'segment-content-request-2',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        workspaceId: 'ws_1',
        workspaceHandle: 'handle_1',
      })
    ).toEqual([
      'workspace',
      'segment-audio',
      'ws_1',
      'handle_1',
      'mem_1',
      'seg_1',
      2048,
      'segment-content-request-2',
    ]);
    expect(
      segmentSupplementAudioQueryKey({
        audioByteLength: 4096,
        audioHash: null,
        audioIdentityVersion: 'supplement-content-request-2',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        supplementId: 'sup_1',
        workspaceId: 'ws_1',
        workspaceHandle: 'handle_1',
      })
    ).toEqual([
      'workspace',
      'segment-supplement-audio',
      'ws_1',
      'handle_1',
      'mem_1',
      'seg_1',
      'sup_1',
      4096,
      'supplement-content-request-2',
    ]);
  });

  it('matches workspace projection query keys without matching playback audio bytes', () => {
    expect(
      workspaceProjectionQueryBelongsToWorkspace(
        ['workspace', 'memory-detail', 'ws_1', 'mem_1'],
        'ws_1'
      )
    ).toBe(true);
    expect(
      workspaceProjectionQueryBelongsToWorkspace(
        ['workspace', 'segment-content', 'ws_1', 'mem_1', 'seg_1'],
        'ws_1'
      )
    ).toBe(true);
    expect(
      workspaceProjectionQueryBelongsToWorkspace(
        ['workspace', 'segment-supplement-content', 'ws_1', 'mem_1', 'seg_1', 'sup_1'],
        'ws_1'
      )
    ).toBe(true);
    expect(
      workspaceProjectionQueryBelongsToWorkspace(['workspace', 'snapshot', 'ws_1'], 'ws_1')
    ).toBe(false);
    expect(
      workspaceProjectionQueryBelongsToWorkspace(
        ['workspace', 'memory-detail', 'ws_2', 'mem_1'],
        'ws_1'
      )
    ).toBe(false);
    expect(
      workspaceProjectionQueryBelongsToWorkspace(
        ['workspace', 'segment-speech-audio', 'ws_1', 'handle_1', 'mem_1', 'seg_1'],
        'ws_1'
      )
    ).toBe(false);
    expect(
      workspaceSpeechAudioQueryBelongsToWorkspace(
        ['workspace', 'segment-speech-audio', 'ws_1', 'handle_1', 'mem_1', 'seg_1'],
        'ws_1'
      )
    ).toBe(true);
    expect(
      workspacePlaybackAudioQueryBelongsToWorkspace(
        ['workspace', 'segment-audio', 'ws_1', 'handle_1', 'mem_1', 'seg_1', 3, 'a'.repeat(64)],
        'ws_1'
      )
    ).toBe(true);
    expect(
      workspacePlaybackAudioQueryBelongsToWorkspace(
        [
          'workspace',
          'segment-supplement-audio',
          'ws_1',
          'handle_1',
          'mem_1',
          'seg_1',
          'sup_1',
          3,
          'b'.repeat(64),
        ],
        'ws_1'
      )
    ).toBe(true);
    expect(
      workspacePlaybackAudioQueryBelongsToWorkspace(
        ['workspace', 'segment-audio', 'ws_2', 'handle_1', 'mem_1', 'seg_1', 3, 'a'.repeat(64)],
        'ws_1'
      )
    ).toBe(false);
  });

  it('matches playback audio query keys by deleted entity identity', () => {
    const target = {
      workspaceId: 'ws_1',
      workspaceHandle: 'handle_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
    };

    expect(
      workspacePlaybackAudioQueryBelongsToEntity(
        [
          'workspace',
          'segment-supplement-audio',
          'ws_1',
          'handle_1',
          'mem_1',
          'seg_1',
          'sup_1',
          3,
          'hash_1',
        ],
        target
      )
    ).toBe(true);
    expect(
      workspacePlaybackAudioQueryBelongsToEntity(
        [
          'workspace',
          'segment-supplement-speech-audio',
          'ws_1',
          'handle_1',
          'mem_1',
          'seg_1',
          'sup_1',
          'content_hash',
          3,
          'speaker_1',
          '2026-06-02T00:00:00.000Z',
        ],
        target
      )
    ).toBe(true);
    expect(
      workspacePlaybackAudioQueryBelongsToEntity(
        ['workspace', 'segment-audio', 'ws_1', 'handle_1', 'mem_1', 'seg_1', 3, 'hash_1'],
        target
      )
    ).toBe(false);
    expect(
      workspacePlaybackAudioQueryBelongsToEntity(
        ['workspace', 'segment-speech-audio', 'ws_1', 'handle_1', 'mem_1', 'seg_1', 'hash_1'],
        {
          workspaceId: target.workspaceId,
          workspaceHandle: target.workspaceHandle,
          memoryId: target.memoryId,
          segmentId: target.segmentId,
        }
      )
    ).toBe(true);
    expect(
      workspacePlaybackAudioQueryBelongsToEntity(
        [
          'workspace',
          'segment-supplement-audio',
          'ws_1',
          'handle_1',
          'mem_1',
          'seg_1',
          'sup_1',
          3,
          'hash_1',
        ],
        {
          workspaceId: target.workspaceId,
          workspaceHandle: target.workspaceHandle,
          memoryId: target.memoryId,
        }
      )
    ).toBe(true);
    expect(
      workspacePlaybackAudioQueryBelongsToEntity(
        [
          'workspace',
          'segment-supplement-audio',
          'ws_1',
          'other_handle',
          'mem_1',
          'seg_1',
          'sup_1',
          3,
          'hash_1',
        ],
        target
      )
    ).toBe(false);
  });

  it('splits reusable Memory detail projection from large workspace content caches', () => {
    expect(
      memoryDetailQueryBelongsToWorkspace(['workspace', 'memory-detail', 'ws_1', 'mem_1'], 'ws_1')
    ).toBe(true);
    expect(
      memoryDetailQueryBelongsToWorkspace(
        ['workspace', 'segment-content', 'ws_1', 'mem_1', 'seg_1'],
        'ws_1'
      )
    ).toBe(false);
    expect(
      workspaceContentQueryBelongsToWorkspace(
        ['workspace', 'segment-content', 'ws_1', 'mem_1', 'seg_1'],
        'ws_1'
      )
    ).toBe(true);
    expect(
      workspaceContentQueryBelongsToWorkspace(
        ['workspace', 'segment-supplement-content', 'ws_1', 'mem_1', 'seg_1', 'sup_1'],
        'ws_1'
      )
    ).toBe(true);
    expect(
      workspaceContentQueryBelongsToWorkspace(
        ['workspace', 'memory-detail', 'ws_1', 'mem_1'],
        'ws_1'
      )
    ).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  resolveMemoryCoverImageSource,
  resolveDefaultCoverTemplate,
  resolveNextDefaultCoverTemplateId,
  resolveSegmentCoverImageSource,
} from './memoryCoverSource';
import type {
  WorkspaceMemorySummary,
  WorkspaceSegmentProjection,
} from '../../../../workspace-contract/workspace-contract';

type WorkspaceAudioSegmentProjection = Extract<
  WorkspaceSegmentProjection,
  { readonly type: 'audio' }
>;

function memory(overrides: Partial<WorkspaceMemorySummary>): WorkspaceMemorySummary {
  return {
    audioByteLength: 0,
    audioDurationMs: 0,
    audioSegmentCount: 0,
    cover: { source: 'default' },
    createdAt: '2026-06-01T00:00:00.000Z',
    hasAnyNote: false,
    hasAudioTranscript: false,
    memoryId: 'mem_default_cover',
    noteSegmentCount: 0,
    segmentCount: 0,
    supplementCount: 0,
    title: 'Default cover',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function audioSegment(
  overrides: Partial<WorkspaceAudioSegmentProjection>
): WorkspaceAudioSegmentProjection {
  return {
    audioByteLength: 1024,
    createdAt: '2026-06-01T00:00:00.000Z',
    durationMs: 1000,
    lastTranscriptionAttempt: 'never',
    memoryId: 'mem_default_cover',
    segmentId: 'seg_default_cover',
    supplementCount: 0,
    supplements: [],
    title: 'Default segment cover',
    transcript: { exists: false },
    type: 'audio',
    updatedAt: '2026-06-01T00:00:00.000Z',
    workspaceId: 'ws_1',
    ...overrides,
  };
}

describe('cover image sources', () => {
  it('maps default covers deterministically from memory id without persisting random state', () => {
    const first = resolveDefaultCoverTemplate('mem_same_default');
    const second = resolveDefaultCoverTemplate('mem_same_default');

    expect(first).toBe(second);
    expect(first).toMatch(/cover-(0[1-9]|1[0-3])\.png/);
  });

  it('shares all thirteen default cover templates across Memory and Segment cards', () => {
    const templates = new Set(
      Array.from({ length: 260 }, (_, index) => resolveDefaultCoverTemplate(`seg_pool_${index}`))
    );

    expect(templates.size).toBe(13);
  });

  it('uses persisted default cover template ids before the stable entity fallback', () => {
    const defaultSource = resolveMemoryCoverImageSource({
      memory: memory({
        cover: { source: 'default', templateId: 'cover-05' },
        memoryId: 'mem_selected_cover',
      }),
      workspaceId: 'ws_1',
    });
    const segmentSource = resolveSegmentCoverImageSource({
      segment: audioSegment({
        cover: { source: 'default', templateId: 'cover-09' },
        segmentId: 'seg_selected_cover',
      }),
      workspaceId: 'ws_1',
    });

    expect(defaultSource).toMatch(/cover-05\.png/);
    expect(segmentSource).toMatch(/cover-09\.png/);
  });

  it('selects a different built-in default cover template when switching', () => {
    const current = 'cover-05';
    const next = resolveNextDefaultCoverTemplateId({
      currentTemplateId: current,
      entityId: 'mem_switch_cover',
      random: () => 0,
    });

    expect(next).not.toBe(current);
    expect(next).toMatch(/^cover-(0[1-9]|1[0-3])$/);
  });

  it('builds a safe custom cover protocol URL with encoded filename and version', () => {
    expect(
      resolveMemoryCoverImageSource({
        memory: memory({
          cover: {
            source: 'custom',
            filename: 'garden bloom#1.webp',
            version: '177-42',
          },
          memoryId: 'mem_custom_cover',
        }),
        workspaceId: 'ws_1',
      })
    ).toBe(
      'reo-attachment://ws_1/memories/mem_custom_cover/cover/garden%20bloom%231.webp?v=177-42'
    );
  });

  it('builds a safe custom Segment cover protocol URL with encoded filename and version', () => {
    expect(
      resolveSegmentCoverImageSource({
        segment: audioSegment({
          cover: {
            source: 'custom',
            filename: 'session poster#1.webp',
            version: '177-42',
          },
          segmentId: 'seg_custom_cover',
        }),
        workspaceId: 'ws_1',
      })
    ).toBe(
      'reo-attachment://ws_1/segments/seg_custom_cover/cover/session%20poster%231.webp?v=177-42'
    );
  });
});

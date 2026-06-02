import { describe, expect, it } from 'vitest';
import { resolveMemoryCoverImageSource, resolveDefaultCoverTemplate } from './memoryCoverSource';
import type { WorkspaceMemorySummary } from '../../../../workspace-contract/workspace-contract';

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

describe('memory cover image sources', () => {
  it('maps default covers deterministically from memory id without persisting random state', () => {
    const first = resolveDefaultCoverTemplate('mem_same_default');
    const second = resolveDefaultCoverTemplate('mem_same_default');

    expect(first).toBe(second);
    expect(first).toMatch(/cover-0[1-6]\.png/);
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
});

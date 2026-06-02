import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceMemoryDetail } from './workspaceApi';
import {
  MemoryStudioSegmentCard,
  MemoryStudioSegmentCardActionButton,
} from './MemoryStudioSegmentCard';

type MemorySegment = WorkspaceMemoryDetail['segments'][number];

function audioSegment(overrides: Partial<MemorySegment> = {}): MemorySegment {
  return {
    audioByteLength: 1024,
    cover: {
      source: 'custom',
      filename: 'session poster#1.webp',
      version: '177-42',
    },
    createdAt: '2026-06-01T09:00:00.000Z',
    durationMs: 206000,
    lastTranscriptionAttempt: 'never',
    memoryId: 'mem_1',
    segmentId: 'seg_custom_cover',
    supplementCount: 0,
    supplements: [],
    title: 'E2E 自动记录',
    transcript: { exists: false },
    type: 'audio',
    updatedAt: '2026-06-01T09:00:00.000Z',
    workspaceId: 'ws_1',
    ...overrides,
  } as MemorySegment;
}

describe('MemoryStudioSegmentCard', () => {
  it('renders the approved poster cover structure without the old gray-card styling', () => {
    render(
      <MemoryStudioSegmentCard
        actionMenu={<MemoryStudioSegmentCardActionButton segmentTitle="E2E 自动记录" />}
        onSelect={vi.fn()}
        segment={audioSegment()}
        selected={false}
        workspaceId="ws_1"
      />
    );

    const card = document.querySelector('[data-slot="memory-studio-segment-card"]');
    expect(card).toBeInstanceOf(HTMLElement);
    if (!(card instanceof HTMLElement)) {
      throw new Error('segment card should render');
    }
    expect(card.className).not.toMatch(/\bbg-card\b|\bbg-secondary\b|shadow|border/);
    expect(card.querySelector('[data-slot="memory-studio-segment-card-cover"]')).toHaveAttribute(
      'src',
      'reo-attachment://ws_1/segments/seg_custom_cover/cover/session%20poster%231.webp?v=177-42'
    );
    expect(card.querySelector('[data-slot="memory-studio-segment-card-cover"]')).toHaveAttribute(
      'crossorigin',
      'anonymous'
    );
    expect(card).toHaveClass(
      'dark:[--cover-brightness:0.92]',
      'dark:[--top-scrim-start:0.34]',
      'dark:[--bottom-scrim-start:0.38]',
      'group-hover/segment-card:[--top-state-start:0.16]',
      'group-hover/segment-card:[--top-state-mid:0.07]'
    );
    const toneScrim = card.querySelector('[data-slot="memory-studio-segment-card-tone-scrim"]');
    expect(toneScrim).toBeTruthy();
    expect((toneScrim as HTMLElement).style.background).toContain('var(--top-state-start)');
    expect(card.querySelector('[data-slot="memory-studio-segment-card-waveform"]')).toBeTruthy();
    expect(card.querySelector('[data-slot="memory-studio-segment-card-duration"]')).toHaveClass(
      'text-[13px]',
      'font-[700]'
    );
    const moreButton = document.querySelector('[aria-label="片段 E2E 自动记录 更多操作"]');
    expect(moreButton).toBeInstanceOf(HTMLButtonElement);
    expect(moreButton).toHaveClass(
      'hover:bg-[rgb(var(--cover-title-r)_var(--cover-title-g)_var(--cover-title-b)/0.14)]',
      'data-[state=open]:bg-[rgb(var(--cover-title-r)_var(--cover-title-g)_var(--cover-title-b)/0.18)]'
    );
    expect((moreButton as HTMLButtonElement).className).not.toContain('hover:bg-white');
  });
});

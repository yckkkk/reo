import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceMemoryDetail } from './workspaceApi';
import {
  MemoryStudioSegmentCard,
  MemoryStudioSegmentCardActionButton,
} from './MemoryStudioSegmentCard';

type MemorySegment = WorkspaceMemoryDetail['segments'][number];
type NoteSegment = Extract<MemorySegment, { readonly type: 'note' }>;

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

function noteSegment(overrides: Partial<NoteSegment> = {}): NoteSegment {
  return {
    bodyByteLength: 32,
    cover: {
      source: 'default',
      templateId: 'cover-01',
    },
    createdAt: '2026-06-01T09:00:00.000Z',
    memoryId: 'mem_1',
    segmentId: 'seg_note',
    speechSynthesis: {
      status: 'ready',
      audioByteLength: 2048,
      contentHash: 'f'.repeat(64),
      format: 'mp3',
      lastSynthesisAttempt: 'success',
      mimeType: 'audio/mpeg',
      model: 'seed-tts-2.0-expressive',
      reason: null,
      resourceId: 'seed-tts-2.0',
      sampleRate: 24000,
      speaker: 'zh_female_vv_uranus_bigtts',
      updatedAt: '2026-06-01T09:10:00.000Z',
    },
    supplementCount: 0,
    supplements: [],
    title: 'Spoken note',
    type: 'note',
    updatedAt: '2026-06-01T09:00:00.000Z',
    workspaceId: 'ws_1',
    ...overrides,
  };
}

describe('MemoryStudioSegmentCard', () => {
  it('renders the approved poster cover structure without the old gray-card styling', () => {
    render(
      <MemoryStudioSegmentCard
        actionMenu={<MemoryStudioSegmentCardActionButton segmentTitle="E2E 自动记录" />}
        onSelect={vi.fn()}
        segment={audioSegment()}
        selectionPlacement="after"
        workspaceId="ws_1"
      />
    );

    const card = document.querySelector('[data-slot="memory-studio-segment-card"]');
    expect(card).toBeInstanceOf(HTMLElement);
    if (!(card instanceof HTMLElement)) {
      throw new Error('segment card should render');
    }
    expect(card.className).not.toMatch(/\bbg-card\b|\bbg-secondary\b|shadow|border/);
    expect(card).toHaveClass('reo-segment-card-squircle');
    const coverClip = card.querySelector('[data-slot="memory-studio-segment-card-cover-clip"]');
    expect(coverClip).toBeInstanceOf(HTMLElement);
    expect(coverClip).toHaveClass(
      'inset-px',
      'overflow-hidden',
      'reo-segment-card-squircle',
      '[transform:translateZ(0)]'
    );
    expect(coverClip).not.toHaveClass('inset-[-1px]');
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
      '[--top-scrim-start:0.11]',
      '[--bottom-scrim-start:0.12]',
      'dark:[--top-scrim-start:0.15]',
      'dark:[--bottom-scrim-start:0.16]',
      'group-hover/segment-card:[--top-state-start:0.06]',
      'group-hover/segment-card:[--top-state-mid:0.025]'
    );
    expect(card.className).not.toContain('[--top-scrim-start:0.22]');
    expect(card.className).not.toContain('[--bottom-scrim-start:0.24]');
    expect(card.className).not.toContain('dark:[--top-scrim-start:0.34]');
    expect(card.className).not.toContain('dark:[--bottom-scrim-start:0.38]');
    const toneScrim = card.querySelector('[data-slot="memory-studio-segment-card-tone-scrim"]');
    expect(toneScrim).toBeTruthy();
    expect((toneScrim as HTMLElement).style.background).toContain('var(--top-state-start)');
    const waveform = card.querySelector('[data-slot="memory-studio-segment-card-waveform"]');
    expect(waveform).toBeTruthy();
    expect(waveform).toHaveClass(
      'h-[32px]',
      'w-[52px]',
      'gap-[2px]',
      'text-[rgb(var(--cover-bottom-r)_var(--cover-bottom-g)_var(--cover-bottom-b)/0.92)]'
    );
    expect(waveform?.querySelector('span')).toHaveClass('block', 'size-[4px]');
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

  it('keeps note cards on the note icon and size treatment even when speech exists', () => {
    render(
      <MemoryStudioSegmentCard
        actionMenu={<MemoryStudioSegmentCardActionButton segmentTitle="Spoken note" />}
        onSelect={vi.fn()}
        segment={noteSegment()}
        selectionPlacement="after"
        workspaceId="ws_1"
      />
    );

    const card = document.querySelector('[data-slot="memory-studio-segment-card"]');
    expect(card).toBeInstanceOf(HTMLElement);
    if (!(card instanceof HTMLElement)) {
      throw new Error('segment card should render');
    }
    expect(card.querySelector('[data-slot="memory-studio-segment-card-waveform"]')).toBeNull();
    expect(card.querySelector('[data-slot="memory-studio-segment-card-speech-label"]')).toBeNull();
    expect(card.querySelector('[data-slot="memory-studio-segment-card-note-icon"]')).toBeInstanceOf(
      SVGElement
    );
    expect(
      card.querySelector('[data-slot="memory-studio-segment-card-note-size"]')
    ).toHaveTextContent('32 字节');
  });

  it('keeps selected and menu-open states from amplifying the cover protection scrim', () => {
    render(
      <MemoryStudioSegmentCard
        actionMenu={<MemoryStudioSegmentCardActionButton segmentTitle="Spoken note" />}
        menuOpen
        onSelect={vi.fn()}
        segment={noteSegment()}
        selectionPlacement="selected"
        workspaceId="ws_1"
      />
    );

    const card = document.querySelector('[data-slot="memory-studio-segment-card"]');
    expect(card).toBeInstanceOf(HTMLElement);
    if (!(card instanceof HTMLElement)) {
      throw new Error('segment card should render');
    }

    expect(card.className).not.toContain('[--bottom-scrim-start:0.7]');
    expect(card.className).not.toContain('[--bottom-scrim-start:0.68]');
    expect(card.className).not.toContain('[--top-scrim-start:0.64]');
    expect(card.className).not.toContain('[--top-scrim-start:0.62]');
    expect(card.className).not.toContain('[--top-state-start:0.2]');
    expect(card).toHaveClass('transition-[filter]', 'duration-150', 'ease-out');
    expect(card).not.toHaveClass(
      '-translate-y-5',
      'scale-[1.035]',
      'transition-[filter,transform]'
    );
    const item = document.querySelector('[data-slot="memory-studio-segment-item"]');
    expect(item).toHaveAttribute('data-selected', 'true');
    expect(item).toHaveAttribute('data-selection-placement', 'selected');
    expect(item).toHaveAttribute(
      'style',
      expect.stringContaining('width: var(--memory-studio-segment-card-size)')
    );
    expect(item).toHaveAttribute(
      'style',
      expect.stringContaining('--memory-studio-segment-selection-x: 0px')
    );
    expect(item).toHaveAttribute(
      'style',
      expect.stringContaining(
        '--memory-studio-segment-card-scale: var(--memory-studio-segment-selected-scale)'
      )
    );
    const cluster = document.querySelector('[data-slot="memory-studio-segment-card-cluster"]');
    expect(cluster).toBeInstanceOf(HTMLElement);
    expect(cluster).toHaveClass(
      'transition-transform',
      '[content-visibility:auto]',
      '[contain-intrinsic-size:var(--memory-studio-segment-card-size)_var(--memory-studio-segment-card-size)]'
    );
    expect(cluster).not.toHaveClass('transition-[width,transform]');
    expect(cluster).toHaveAttribute(
      'style',
      expect.stringContaining(
        'translateX(calc(-50% + var(--memory-studio-segment-selection-x))) translateY(var(--memory-studio-segment-card-y)) scale(var(--memory-studio-segment-card-scale))'
      )
    );
    const moreButton = document.querySelector('[aria-label="片段 Spoken note 更多操作"]');
    expect(cluster).toContainElement(moreButton as HTMLElement);
    expect(
      document.querySelector('[data-slot="memory-studio-segment-timeline-marker"]')
    ).not.toHaveAttribute('style');
    expect(document.querySelector('[data-slot="memory-studio-segment-timeline-dot"]')).toHaveClass(
      'transition-transform',
      'duration-200'
    );
    expect(
      document.querySelector('[data-slot="memory-studio-segment-timeline-dot"]')
    ).toHaveAttribute(
      'style',
      expect.stringContaining('translateX(var(--memory-studio-segment-selection-x))')
    );
    expect(
      document.querySelector('[data-slot="memory-studio-segment-timeline-time"]')
    ).not.toHaveAttribute('style');
    expect(document.querySelector('[data-slot="memory-studio-segment-timeline-anchor"]')).toBe(
      item?.querySelector('[data-slot="memory-studio-segment-timeline-anchor"]')
    );
    expect(document.querySelector('[data-slot="memory-studio-segment-timeline-anchor"]')).not.toBe(
      cluster?.querySelector('[data-slot="memory-studio-segment-timeline-anchor"]')
    );
  });
});

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
        selected={false}
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
});

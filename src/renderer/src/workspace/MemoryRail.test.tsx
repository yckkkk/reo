import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRail } from './MemoryRail';
import type { WorkspaceSession } from './workspaceApi';

type WorkspaceMemory = WorkspaceSession['snapshot']['memories'][number];

function memory(overrides: Partial<WorkspaceMemory>): WorkspaceMemory {
  return {
    audioByteLength: 0,
    createdAt: '2026-05-06T13:00:00.000Z',
    audioDurationMs: 0,
    hasAudioTranscript: false,
    memoryId: 'mem_default',
    segmentCount: 0,
    noteSegmentCount: 0,
    audioSegmentCount: 0,
    cover: { source: 'default' },
    hasAnyNote: false,
    supplementCount: 0,
    title: 'Default memory',
    updatedAt: '2026-05-06T13:00:00.000Z',
    ...overrides,
  };
}

describe('MemoryRail', () => {
  it('renders the empty state through the rail card surface', () => {
    render(
      <MemoryRail
        memories={[]}
        onDeleteMemory={vi.fn()}
        onRenameMemory={vi.fn()}
        onResetMemoryCover={vi.fn()}
        onSelectMemory={vi.fn()}
        workspaceHandle="workspace-handle-secret"
        workspaceId="ws_1"
      />
    );

    const emptyCard = screen
      .getByText('还没有记忆')
      .closest('[data-slot="memory-rail-empty-card"]');

    expect(emptyCard).toBeTruthy();
    expect(emptyCard).toHaveClass('reo-squircle', 'rounded-xl', 'bg-card');
  });

  it('renders memories in upstream snapshot order without resorting in render', () => {
    render(
      <MemoryRail
        memories={[
          memory({
            memoryId: 'mem_older',
            title: 'Older first from snapshot',
            updatedAt: '2026-05-06T13:00:00.000Z',
          }),
          memory({
            memoryId: 'mem_newer',
            title: 'Newer second from snapshot',
            updatedAt: '2026-05-06T14:00:00.000Z',
          }),
        ]}
        onDeleteMemory={vi.fn()}
        onRenameMemory={vi.fn()}
        onResetMemoryCover={vi.fn()}
        onSelectMemory={vi.fn()}
        workspaceHandle="workspace-handle-secret"
        workspaceId="ws_1"
      />
    );

    expect(
      screen
        .getAllByRole('button', { name: /^选择记忆/ })
        .map((button) => button.getAttribute('aria-label')?.replace('选择记忆 ', ''))
    ).toEqual(['Older first from snapshot', 'Newer second from snapshot']);
  });

  it('uses the approved 240px rail compact geometry', () => {
    render(
      <MemoryRail
        memories={[memory({ memoryId: 'mem_compact', title: 'Compact memory' })]}
        onDeleteMemory={vi.fn()}
        onRenameMemory={vi.fn()}
        onResetMemoryCover={vi.fn()}
        onSelectMemory={vi.fn()}
        workspaceHandle="workspace-handle-secret"
        workspaceId="ws_1"
      />
    );

    const button = screen.getByRole('button', { name: '选择记忆 Compact memory' });
    const card = button.closest('[data-slot="memory-rail-card"]');
    const cover = screen
      .getByRole('img', { name: 'Compact memory 封面' })
      .closest('[data-slot="memory-rail-card-cover"]');

    expect(card).toHaveClass('h-[80px]', 'rounded-[14px]');
    expect(button).toHaveClass('grid', 'h-[80px]', 'grid-cols-[80px_minmax(0,1fr)]');
    expect(button).not.toHaveClass('p-8', 'gap-12', 'min-h-[96px]');
    expect(cover).toHaveClass('h-full', 'w-full');
    expect(cover).not.toHaveClass('aspect-square', 'rounded-lg');
  });

  it('keeps compact selected and meta states within the approved rail geometry', () => {
    render(
      <MemoryRail
        activeMemoryId="mem_selected"
        memories={[
          memory({
            memoryId: 'mem_selected',
            segmentCount: 12,
            title: 'Selected compact memory',
            updatedAt: '2026-05-26T18:59:00.000',
          }),
        ]}
        onDeleteMemory={vi.fn()}
        onRenameMemory={vi.fn()}
        onResetMemoryCover={vi.fn()}
        onSelectMemory={vi.fn()}
        workspaceHandle="workspace-handle-secret"
        workspaceId="ws_1"
      />
    );

    const title = screen.getByText('Selected compact memory');
    const meta = document.querySelector('[data-slot="memory-rail-card-meta"]');
    const updatedAt = document.querySelector('[data-slot="memory-rail-card-updated-at"]');
    const segmentCount = document.querySelector('[data-slot="memory-rail-card-segment-count"]');
    const moreTrigger = screen.getByRole('button', {
      name: 'Selected compact memory 更多操作',
    });

    expect(document.querySelector('[data-slot="memory-rail-card-active-dot"]')).toBeNull();
    expect(title).toHaveClass('truncate', 'text-[13px]', 'font-[700]', 'leading-[1.14]');
    expect(title).not.toHaveClass('text-body', 'leading-body');
    expect(meta).toHaveClass('mt-[5px]', 'flex', 'flex-col', 'text-[11px]', 'leading-[1.15]');
    expect(meta).not.toHaveClass('text-ui-sm', 'leading-ui-sm');
    expect(updatedAt).toHaveTextContent('05/26 18:59');
    expect(segmentCount).toHaveTextContent('12 个片段');
    expect(meta?.textContent).not.toContain('·');
    expect(moreTrigger).toHaveClass(
      'absolute',
      'right-[7px]',
      'top-[7px]',
      'size-[30px]',
      'rounded-[8px]'
    );
  });

  it('renders a custom Memory cover through the safe attachment protocol', () => {
    render(
      <MemoryRail
        memories={[
          memory({
            cover: { source: 'custom', filename: 'garden bloom.webp', version: '177-42' },
            memoryId: 'mem_cover_custom',
            title: 'Custom covered',
          }),
        ]}
        onDeleteMemory={vi.fn()}
        onRenameMemory={vi.fn()}
        onResetMemoryCover={vi.fn()}
        onSelectMemory={vi.fn()}
        workspaceHandle="workspace-handle-secret"
        workspaceId="ws_cover"
      />
    );

    const cover = screen.getByRole('img', { name: 'Custom covered 封面' });

    expect(cover).toHaveAttribute(
      'src',
      'reo-attachment://ws_cover/memories/mem_cover_custom/cover/garden%20bloom.webp?v=177-42'
    );
    expect(cover).toHaveAttribute('loading', 'lazy');
    expect(screen.queryByText(/录音/)).not.toBeInTheDocument();
    expect(screen.queryByText(/笔记/)).not.toBeInTheDocument();
    expect(screen.queryByText(/补充/)).not.toBeInTheDocument();
  });

  it('shows Memory cover reset as a disabled default-state menu item', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRail
        memories={[memory({ memoryId: 'mem_cover_default', title: 'Default covered' })]}
        onDeleteMemory={vi.fn()}
        onRenameMemory={vi.fn()}
        onResetMemoryCover={vi.fn()}
        onSelectMemory={vi.fn()}
        workspaceHandle="workspace-handle-secret"
        workspaceId="ws_cover"
      />
    );

    await user.click(screen.getByRole('button', { name: 'Default covered 更多操作' }));

    expect(await screen.findByRole('menuitem', { name: '恢复随机默认图片' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('invokes Memory cover reset for custom covers', async () => {
    const user = userEvent.setup();
    const onResetMemoryCover = vi.fn();
    const coveredMemory = memory({
      cover: { source: 'custom', filename: 'garden.webp', version: '177-42' },
      memoryId: 'mem_cover_reset',
      title: 'Reset covered',
    });
    render(
      <MemoryRail
        memories={[coveredMemory]}
        onDeleteMemory={vi.fn()}
        onRenameMemory={vi.fn()}
        onResetMemoryCover={onResetMemoryCover}
        onSelectMemory={vi.fn()}
        workspaceHandle="workspace-handle-secret"
        workspaceId="ws_cover"
      />
    );

    await user.click(screen.getByRole('button', { name: 'Reset covered 更多操作' }));
    await user.click(await screen.findByRole('menuitem', { name: '恢复随机默认图片' }));

    expect(onResetMemoryCover).toHaveBeenCalledWith(coveredMemory);
  });
});

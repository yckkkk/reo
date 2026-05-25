import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WorkspaceTitlebar } from './WorkspaceTitlebar';
import type { WorkspaceMemorySummary } from './workspaceApi';

const currentMemory: WorkspaceMemorySummary = {
  audioByteLength: 0,
  audioDurationMs: 0,
  audioSegmentCount: 0,
  createdAt: '2026-05-23T10:00:00.000Z',
  hasAnyNote: true,
  hasAudioTranscript: false,
  memoryId: 'mem_1',
  noteSegmentCount: 1,
  segmentCount: 1,
  supplementCount: 0,
  title: '碎片记录',
  updatedAt: '2026-05-23T10:00:00.000Z',
};

function renderWorkspaceTitlebar({
  memory,
  onStartNote = vi.fn(),
  onStartRecording = vi.fn(),
}: {
  readonly memory: WorkspaceMemorySummary | null;
  readonly onStartNote?: () => void;
  readonly onStartRecording?: () => void;
}) {
  return render(
    <TooltipProvider>
      <WorkspaceTitlebar
        currentMemory={memory}
        memoryRailOpen
        onCreateMemory={vi.fn()}
        onDeleteMemory={vi.fn()}
        onRenameMemory={vi.fn()}
        onRenameMemorySpace={vi.fn()}
        onRemoveMemorySpace={vi.fn()}
        onStartNote={onStartNote}
        onStartRecording={onStartRecording}
        onToggleMemoryRail={vi.fn()}
        title="测试"
        workspaceHandle="workspace-handle-secret"
        workspaceId="ws_1"
      />
    </TooltipProvider>
  );
}

describe('WorkspaceTitlebar', () => {
  it('shows the global new-memory action at the memory-space level and the new-segment action beside the MemoryRail toggle inside a memory', () => {
    const onStartNote = vi.fn();
    const onStartRecording = vi.fn();
    const { rerender } = renderWorkspaceTitlebar({
      memory: null,
      onStartNote,
      onStartRecording,
    });

    const memorySpaceActions = document.querySelector('[data-slot="workspace-titlebar-actions"]');
    expect(memorySpaceActions).toBeInstanceOf(HTMLElement);
    expect(
      within(memorySpaceActions as HTMLElement).getByRole('button', { name: '新建记忆' })
    ).toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <WorkspaceTitlebar
          currentMemory={currentMemory}
          memoryRailOpen
          onCreateMemory={vi.fn()}
          onDeleteMemory={vi.fn()}
          onRenameMemory={vi.fn()}
          onRenameMemorySpace={vi.fn()}
          onRemoveMemorySpace={vi.fn()}
          onStartNote={onStartNote}
          onStartRecording={onStartRecording}
          onToggleMemoryRail={vi.fn()}
          title="测试"
          workspaceHandle="workspace-handle-secret"
          workspaceId="ws_1"
        />
      </TooltipProvider>
    );

    const currentMemoryActions = document.querySelector('[data-slot="workspace-titlebar-actions"]');
    expect(currentMemoryActions).toBeInstanceOf(HTMLElement);
    expect(
      within(currentMemoryActions as HTMLElement).queryByRole('button', { name: '新建记忆' })
    ).not.toBeInTheDocument();
    const segmentButton = within(currentMemoryActions as HTMLElement).getByRole('button', {
      name: '打开新片段菜单',
    });
    const railButton = within(currentMemoryActions as HTMLElement).getByRole('button', {
      name: '折叠记忆列表',
    });
    expect(segmentButton).toHaveTextContent('新片段');
    expect(segmentButton.nextElementSibling).toBe(railButton);
    expect(screen.getByRole('button', { name: '碎片记录 记忆操作' })).toBeInTheDocument();
  });
});

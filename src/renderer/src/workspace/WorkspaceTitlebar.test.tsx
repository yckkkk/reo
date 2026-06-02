import { fireEvent, render, screen, within } from '@testing-library/react';
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
  onCreateMemory = vi.fn(),
}: {
  readonly memory: WorkspaceMemorySummary | null;
  readonly onCreateMemory?: () => void;
}) {
  return render(
    <TooltipProvider>
      <WorkspaceTitlebar
        currentMemory={memory}
        memoryRailOpen
        onCreateMemory={onCreateMemory}
        onDeleteMemory={vi.fn()}
        onRenameMemory={vi.fn()}
        onResetMemoryCover={vi.fn()}
        onSwitchMemoryDefaultCover={vi.fn()}
        onRenameMemorySpace={vi.fn()}
        onRemoveMemorySpace={vi.fn()}
        onToggleMemoryRail={vi.fn()}
        title="测试"
        workspaceHandle="workspace-handle-secret"
        workspaceId="ws_1"
      />
    </TooltipProvider>
  );
}

describe('WorkspaceTitlebar', () => {
  it('shows the global new-memory action beside the MemoryRail toggle across workspace-stage states', () => {
    const onCreateMemory = vi.fn();
    const { rerender } = renderWorkspaceTitlebar({
      memory: null,
      onCreateMemory,
    });

    const memorySpaceActions = document.querySelector('[data-slot="workspace-titlebar-actions"]');
    expect(memorySpaceActions).toBeInstanceOf(HTMLElement);
    const stageMemoryButton = within(memorySpaceActions as HTMLElement).getByRole('button', {
      name: '新建记忆',
    });
    expect(stageMemoryButton).toHaveTextContent('新记忆');
    fireEvent.click(stageMemoryButton);
    expect(onCreateMemory).toHaveBeenCalledOnce();

    rerender(
      <TooltipProvider>
        <WorkspaceTitlebar
          currentMemory={currentMemory}
          memoryRailOpen
          onCreateMemory={onCreateMemory}
          onDeleteMemory={vi.fn()}
          onRenameMemory={vi.fn()}
          onResetMemoryCover={vi.fn()}
          onSwitchMemoryDefaultCover={vi.fn()}
          onRenameMemorySpace={vi.fn()}
          onRemoveMemorySpace={vi.fn()}
          onToggleMemoryRail={vi.fn()}
          title="测试"
          workspaceHandle="workspace-handle-secret"
          workspaceId="ws_1"
        />
      </TooltipProvider>
    );

    const currentMemoryActions = document.querySelector('[data-slot="workspace-titlebar-actions"]');
    expect(currentMemoryActions).toBeInstanceOf(HTMLElement);
    const memoryButton = within(currentMemoryActions as HTMLElement).getByRole('button', {
      name: '新建记忆',
    });
    const railButton = within(currentMemoryActions as HTMLElement).getByRole('button', {
      name: '折叠记忆列表',
    });
    expect(memoryButton).toHaveTextContent('新记忆');
    expect(
      within(currentMemoryActions as HTMLElement).queryByText('新片段')
    ).not.toBeInTheDocument();
    expect(
      within(currentMemoryActions as HTMLElement).queryByRole('button', {
        name: '打开新片段菜单',
      })
    ).not.toBeInTheDocument();
    expect(memoryButton.nextElementSibling).toBe(railButton);
    fireEvent.click(memoryButton);
    expect(onCreateMemory).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: '碎片记录 记忆操作' })).toBeInTheDocument();
  });
});

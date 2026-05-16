import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '@/components/ui/toaster';
import {
  expectNoRenderedRawPath,
  installWorkspaceBridgeForEntityActionTests,
  openEntityActionMenu,
} from './entityActionMenuTestHelpers';
import { MemorySpaceActionsMenu } from './MemorySpaceActionsMenu';

vi.mock('@/components/ui/toaster', () => {
  const toast = Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  });

  return { toast };
});

const reoWorkspace = {
  copyMemorySpaceAbsolutePath: vi.fn(),
  openMemorySpaceAgentsFile: vi.fn(),
  revealMemorySpaceInFinder: vi.fn(),
};

describe('MemorySpaceActionsMenu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installWorkspaceBridgeForEntityActionTests(reoWorkspace);
    reoWorkspace.copyMemorySpaceAbsolutePath.mockResolvedValue({ ok: true });
    reoWorkspace.openMemorySpaceAgentsFile.mockResolvedValue({ ok: true });
    reoWorkspace.revealMemorySpaceInFinder.mockResolvedValue({ ok: true });
  });

  it('supports controlled open state and reports trigger-driven open changes', async () => {
    const onOpenChange = vi.fn();

    function ControlledHarness() {
      const [open, setOpen] = useState(true);

      return (
        <MemorySpaceActionsMenu
          actionIdentity={{ workspaceId: 'wsp-1' }}
          memorySpaceTitle="My Space"
          onOpenChange={(nextOpen) => {
            onOpenChange(nextOpen);
            setOpen(nextOpen);
          }}
          onRemove={vi.fn()}
          onRename={vi.fn()}
          open={open}
        />
      );
    }

    render(<ControlledHarness />);

    expect(screen.getByRole('menu', { name: 'My Space 更多操作' })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'My Space 更多操作' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() =>
      expect(screen.queryByRole('menu', { name: 'My Space 更多操作' })).not.toBeInTheDocument()
    );
  });

  it('applies triggerClassName to the trigger button', () => {
    render(
      <MemorySpaceActionsMenu
        actionIdentity={{ workspaceId: 'wsp-1' }}
        memorySpaceTitle="My Space"
        onRemove={vi.fn()}
        onRename={vi.fn()}
        triggerClassName="opacity-0 pointer-events-none group-hover:opacity-100"
      />
    );

    expect(screen.getByRole('button', { name: 'My Space 更多操作' })).toHaveClass(
      'opacity-0',
      'pointer-events-none',
      'group-hover:opacity-100'
    );
  });

  it('opens the memory space AGENTS file without showing a success toast', async () => {
    render(
      <MemorySpaceActionsMenu
        actionIdentity={{ workspaceId: 'wsp-1' }}
        memorySpaceTitle="My Space"
        onRemove={vi.fn()}
        onRename={vi.fn()}
      />
    );

    const { user } = await openEntityActionMenu('My Space 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '用默认应用打开' }));

    expect(reoWorkspace.openMemorySpaceAgentsFile).toHaveBeenCalledWith({ workspaceId: 'wsp-1' });
    await waitFor(() => expect(toast.success).not.toHaveBeenCalled());
  });

  it('shows an error toast when reveal in Finder fails', async () => {
    reoWorkspace.revealMemorySpaceInFinder.mockResolvedValueOnce({
      error: { code: 'ERR_WORKSPACE_ROOT_MISSING', message: '根目录不存在' },
      ok: false,
    });
    render(
      <MemorySpaceActionsMenu
        actionIdentity={{ workspaceId: 'wsp-1' }}
        memorySpaceTitle="My Space"
        onRemove={vi.fn()}
        onRename={vi.fn()}
      />
    );

    const { user } = await openEntityActionMenu('My Space 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '在访达中显示' }));

    expect(reoWorkspace.revealMemorySpaceInFinder).toHaveBeenCalledWith({ workspaceId: 'wsp-1' });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('记忆空间文件夹已不存在。'));
  });

  it('copies the absolute path with a success toast and does not render raw paths', async () => {
    render(
      <MemorySpaceActionsMenu
        actionIdentity={{ workspaceId: 'wsp-1' }}
        memorySpaceTitle="My Space"
        onRemove={vi.fn()}
        onRename={vi.fn()}
      />
    );

    const { user } = await openEntityActionMenu('My Space 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '复制绝对路径' }));

    expect(reoWorkspace.copyMemorySpaceAbsolutePath).toHaveBeenCalledWith({ workspaceId: 'wsp-1' });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('已复制路径'));
    expectNoRenderedRawPath();
  });

  it('invokes rename and remove callbacks', async () => {
    const onRemove = vi.fn();
    const onRename = vi.fn();
    render(
      <MemorySpaceActionsMenu
        actionIdentity={{ workspaceId: 'wsp-1' }}
        memorySpaceTitle="My Space"
        onRemove={onRemove}
        onRename={onRename}
      />
    );

    const { user } = await openEntityActionMenu('My Space 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '重命名' }));
    expect(onRename).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'My Space 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '移除' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '@/components/ui/toaster';
import {
  expectNoRenderedRawPath,
  installWorkspaceBridgeForEntityActionTests,
  openEntityActionMenu,
} from './entityActionMenuTestHelpers';
import { MemoryActionsMenu } from './MemoryActionsMenu';

vi.mock('@/components/ui/toaster', () => {
  const toast = Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  });

  const showReoToast = (input: {
    readonly type?: string;
    readonly title: string;
    readonly description?: string;
  }) => {
    const fn =
      input.type === 'success' ? toast.success : input.type === 'error' ? toast.error : toast;
    return input.description === undefined
      ? fn(input.title)
      : fn(input.title, { description: input.description });
  };

  return { toast, showReoToast, ReoToaster: () => null };
});

const reoWorkspace = {
  copyMemoryAbsolutePath: vi.fn(),
  copyMemoryRelativePath: vi.fn(),
  openMemoryDocument: vi.fn(),
  revealMemoryInFinder: vi.fn(),
};

const memoryActionPayload = {
  memoryId: 'mem-1',
  workspaceHandle: 'handle-1',
  workspaceId: 'wsp-1',
};

function renderMenu(props: { onDelete?: () => void; onRename?: () => void } = {}) {
  render(
    <MemoryActionsMenu
      actionIdentity={memoryActionPayload}
      memoryTitle="My Memory"
      onDelete={props.onDelete ?? vi.fn()}
      onRename={props.onRename ?? vi.fn()}
    />
  );
}

describe('MemoryActionsMenu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installWorkspaceBridgeForEntityActionTests(reoWorkspace);
    reoWorkspace.copyMemoryAbsolutePath.mockResolvedValue({ ok: true });
    reoWorkspace.copyMemoryRelativePath.mockResolvedValue({ ok: true });
    reoWorkspace.openMemoryDocument.mockResolvedValue({ ok: true });
    reoWorkspace.revealMemoryInFinder.mockResolvedValue({ ok: true });
  });

  it('supports a custom trigger and content alignment without changing menu actions', async () => {
    const user = userEvent.setup();
    render(
      <MemoryActionsMenu
        actionIdentity={memoryActionPayload}
        contentAlign="start"
        memoryTitle="My Memory"
        onDelete={vi.fn()}
        onRename={vi.fn()}
        trigger={
          <button type="button" aria-label="My Memory 记忆操作" className="custom-trigger-shape">
            <span>My Memory</span>
          </button>
        }
        triggerLabel="My Memory 记忆操作"
      />
    );

    const trigger = screen.getByRole('button', { name: 'My Memory 记忆操作' });
    expect(trigger).toHaveClass('custom-trigger-shape');
    expect(trigger).toHaveTextContent('My Memory');
    expect(trigger.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('button', { name: 'My Memory 更多操作' })).not.toBeInTheDocument();

    await user.click(trigger);

    expect(await screen.findByRole('menu', { name: 'My Memory 记忆操作' })).toBeInTheDocument();
  });

  it('opens the memory document without showing a success toast', async () => {
    renderMenu();

    const { user } = await openEntityActionMenu('My Memory 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '用默认应用打开' }));

    expect(reoWorkspace.openMemoryDocument).toHaveBeenCalledWith(memoryActionPayload);
    await waitFor(() => expect(toast.success).not.toHaveBeenCalled());
  });

  it('shows an error toast when reveal in Finder fails', async () => {
    reoWorkspace.revealMemoryInFinder.mockResolvedValueOnce({
      error: { code: 'ERR_WORKSPACE_MEMORY_NOT_FOUND', message: '记忆不存在' },
      ok: false,
    });
    renderMenu();

    const { user } = await openEntityActionMenu('My Memory 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '在访达中显示' }));

    expect(reoWorkspace.revealMemoryInFinder).toHaveBeenCalledWith(memoryActionPayload);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('找不到这条记忆。'));
  });

  it('copies the relative path with a success toast', async () => {
    renderMenu();

    const { user } = await openEntityActionMenu('My Memory 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '复制相对路径' }));

    expect(reoWorkspace.copyMemoryRelativePath).toHaveBeenCalledWith(memoryActionPayload);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('已复制路径'));
    expectNoRenderedRawPath();
  });

  it('copies the absolute path with a success toast without rendering the raw path', async () => {
    renderMenu();

    const { user } = await openEntityActionMenu('My Memory 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '复制绝对路径' }));

    expect(reoWorkspace.copyMemoryAbsolutePath).toHaveBeenCalledWith(memoryActionPayload);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('已复制路径'));
    expectNoRenderedRawPath();
  });

  it('invokes rename and delete callbacks', async () => {
    const onDelete = vi.fn();
    const onRename = vi.fn();
    renderMenu({ onDelete, onRename });

    const { user } = await openEntityActionMenu('My Memory 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '重命名' }));
    expect(onRename).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'My Memory 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

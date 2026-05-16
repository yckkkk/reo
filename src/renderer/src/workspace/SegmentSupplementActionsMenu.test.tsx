import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '@/components/ui/toaster';
import {
  expectNoRenderedRawPath,
  installWorkspaceBridgeForEntityActionTests,
  openEntityActionMenu,
} from './entityActionMenuTestHelpers';
import { SegmentSupplementActionsMenu } from './SegmentSupplementActionsMenu';

vi.mock('@/components/ui/toaster', () => {
  const toast = Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  });

  return { toast };
});

const reoWorkspace = {
  copySegmentSupplementAbsolutePath: vi.fn(),
  copySegmentSupplementRelativePath: vi.fn(),
  openSegmentSupplementDocument: vi.fn(),
  revealSegmentSupplementInFinder: vi.fn(),
};

const segmentSupplementActionPayload = {
  memoryId: 'mem-1',
  segmentId: 'seg-1',
  supplementId: 'sup-1',
  workspaceHandle: 'handle-1',
  workspaceId: 'wsp-1',
};

function renderMenu(props: { onDelete?: () => void; onRename?: () => void } = {}) {
  render(
    <SegmentSupplementActionsMenu
      actionIdentity={segmentSupplementActionPayload}
      onDelete={props.onDelete ?? vi.fn()}
      onRename={props.onRename ?? vi.fn()}
      supplementTitle="My Supplement"
    />
  );
}

describe('SegmentSupplementActionsMenu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installWorkspaceBridgeForEntityActionTests(reoWorkspace);
    reoWorkspace.copySegmentSupplementAbsolutePath.mockResolvedValue({ ok: true });
    reoWorkspace.copySegmentSupplementRelativePath.mockResolvedValue({ ok: true });
    reoWorkspace.openSegmentSupplementDocument.mockResolvedValue({ ok: true });
    reoWorkspace.revealSegmentSupplementInFinder.mockResolvedValue({ ok: true });
  });

  it('supports a custom controlled trigger without changing menu actions', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onOpenChange = vi.fn();
    const onRename = vi.fn();
    const { rerender } = render(
      <SegmentSupplementActionsMenu
        actionIdentity={segmentSupplementActionPayload}
        contentAlign="center"
        onDelete={onDelete}
        onOpenChange={onOpenChange}
        onRename={onRename}
        open={false}
        supplementTitle="My Supplement"
        trigger={
          <button type="button" aria-label="My Supplement tab actions" className="custom-trigger">
            <span>More</span>
          </button>
        }
        triggerLabel="My Supplement tab actions"
      />
    );

    const trigger = screen.getByRole('button', { name: 'My Supplement tab actions' });
    expect(trigger).toHaveClass('custom-trigger');
    expect(trigger).toHaveTextContent('More');
    expect(trigger.querySelector('svg')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'My Supplement 更多操作' })
    ).not.toBeInTheDocument();

    await user.click(trigger);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    rerender(
      <SegmentSupplementActionsMenu
        actionIdentity={segmentSupplementActionPayload}
        contentAlign="center"
        onDelete={onDelete}
        onOpenChange={onOpenChange}
        onRename={onRename}
        open
        supplementTitle="My Supplement"
        trigger={
          <button type="button" aria-label="My Supplement tab actions" className="custom-trigger">
            <span>More</span>
          </button>
        }
        triggerLabel="My Supplement tab actions"
      />
    );

    expect(
      await screen.findByRole('menu', { name: 'My Supplement tab actions' })
    ).toBeInTheDocument();
  });

  it('opens the segment supplement document without showing a success toast', async () => {
    renderMenu();

    const { user } = await openEntityActionMenu('My Supplement 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '用默认应用打开' }));

    expect(reoWorkspace.openSegmentSupplementDocument).toHaveBeenCalledWith(
      segmentSupplementActionPayload
    );
    await waitFor(() => expect(toast.success).not.toHaveBeenCalled());
  });

  it('shows an error toast when reveal in Finder fails', async () => {
    reoWorkspace.revealSegmentSupplementInFinder.mockResolvedValueOnce({
      error: { code: 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND', message: '补充不存在' },
      ok: false,
    });
    renderMenu();

    const { user } = await openEntityActionMenu('My Supplement 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '在访达中显示' }));

    expect(reoWorkspace.revealSegmentSupplementInFinder).toHaveBeenCalledWith(
      segmentSupplementActionPayload
    );
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('找不到这个补充内容。'));
  });

  it('copies the relative path with a success toast', async () => {
    renderMenu();

    const { user } = await openEntityActionMenu('My Supplement 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '复制相对路径' }));

    expect(reoWorkspace.copySegmentSupplementRelativePath).toHaveBeenCalledWith(
      segmentSupplementActionPayload
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('已复制路径'));
    expectNoRenderedRawPath();
  });

  it('copies the absolute path with a success toast without rendering the raw path', async () => {
    renderMenu();

    const { user } = await openEntityActionMenu('My Supplement 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '复制绝对路径' }));

    expect(reoWorkspace.copySegmentSupplementAbsolutePath).toHaveBeenCalledWith(
      segmentSupplementActionPayload
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('已复制路径'));
    expectNoRenderedRawPath();
  });

  it('invokes rename and delete callbacks', async () => {
    const onDelete = vi.fn();
    const onRename = vi.fn();
    renderMenu({ onDelete, onRename });

    const { user } = await openEntityActionMenu('My Supplement 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '重命名' }));
    expect(onRename).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'My Supplement 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

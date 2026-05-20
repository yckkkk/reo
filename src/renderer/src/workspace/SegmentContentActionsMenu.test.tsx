import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installWorkspaceBridgeForEntityActionTests,
  openEntityActionMenu,
} from './entityActionMenuTestHelpers';
import { SegmentContentActionsMenu } from './SegmentContentActionsMenu';

const reoWorkspace = {
  copySegmentAbsolutePath: vi.fn(),
  copySegmentRelativePath: vi.fn(),
  openSegmentDocument: vi.fn(),
  revealSegmentInFinder: vi.fn(),
};

const segmentActionPayload = {
  memoryId: 'mem-1',
  segmentId: 'seg-1',
  workspaceHandle: 'handle-1',
  workspaceId: 'wsp-1',
};

function renderMenu(
  props: {
    contentKind?: 'body' | 'transcript';
    clearDisabled?: boolean;
    editDisabled?: boolean;
    onClear?: () => void;
    onEdit?: () => void;
    onRename?: () => void;
  } = {}
) {
  render(
    <SegmentContentActionsMenu
      actionIdentity={segmentActionPayload}
      {...(props.clearDisabled === undefined ? {} : { clearDisabled: props.clearDisabled })}
      contentKind={props.contentKind ?? 'transcript'}
      {...(props.editDisabled === undefined ? {} : { editDisabled: props.editDisabled })}
      menuLabel="转录 更多操作"
      onClear={props.onClear ?? vi.fn()}
      onEdit={props.onEdit ?? vi.fn()}
      onRename={props.onRename ?? vi.fn()}
    />
  );
}

describe('SegmentContentActionsMenu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installWorkspaceBridgeForEntityActionTests(reoWorkspace);
    reoWorkspace.copySegmentAbsolutePath.mockResolvedValue({ ok: true });
    reoWorkspace.copySegmentRelativePath.mockResolvedValue({ ok: true });
    reoWorkspace.openSegmentDocument.mockResolvedValue({ ok: true });
    reoWorkspace.revealSegmentInFinder.mockResolvedValue({ ok: true });
  });

  it('shows only transcript slot actions for a primary transcript tab', async () => {
    const onClear = vi.fn();
    const onEdit = vi.fn();
    const onRename = vi.fn();
    renderMenu({ onClear, onEdit, onRename });

    const { user } = await openEntityActionMenu('转录 更多操作');
    screen.getByRole('menu', { name: '转录 更多操作' });

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      '用默认应用打开',
      '在访达中显示',
      '复制相对路径',
      '复制绝对路径',
      '编辑转录',
      '重命名',
      '清空转录',
    ]);
    expect(screen.queryByRole('menuitem', { name: '生成转录' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '重新生成转录' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '删除' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: '编辑转录' }));
    expect(onEdit).toHaveBeenCalledOnce();

    await openEntityActionMenu('转录 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '重命名' }));
    expect(onRename).toHaveBeenCalledOnce();

    await openEntityActionMenu('转录 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '清空转录' }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('uses body copy for a primary body tab', async () => {
    renderMenu({ contentKind: 'body' });

    await openEntityActionMenu('转录 更多操作');

    expect(screen.getByRole('menuitem', { name: '编辑正文' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '清空正文' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '编辑转录' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '清空转录' })).not.toBeInTheDocument();
  });

  it('disables edit and clear while the primary content has not loaded', async () => {
    const onClear = vi.fn();
    const onEdit = vi.fn();
    const onRename = vi.fn();
    renderMenu({ clearDisabled: true, editDisabled: true, onClear, onEdit, onRename });

    const { user } = await openEntityActionMenu('转录 更多操作');

    const editItem = screen.getByRole('menuitem', { name: '编辑转录' });
    const clearItem = screen.getByRole('menuitem', { name: '清空转录' });
    expect(editItem).toHaveAttribute('data-disabled');
    expect(clearItem).toHaveAttribute('data-disabled');

    await user.click(editItem);
    await user.click(clearItem);
    expect(onEdit).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();

    await user.click(screen.getByRole('menuitem', { name: '重命名' }));
    expect(onRename).toHaveBeenCalledOnce();
  });
});

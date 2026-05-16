import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '@/components/ui/toaster';
import { EntityActionMenu } from './entityActionMenu';
import {
  expectEntityActionMenuChrome,
  expectEntityActionMenuItems,
  expectNoRenderedRawPath,
  openEntityActionMenu,
} from './entityActionMenuTestHelpers';

vi.mock('@/components/ui/toaster', () => {
  const toast = Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  });

  return { toast };
});

const okResponse = { ok: true } as const;

function renderMenu(
  overrides: Partial<Parameters<typeof EntityActionMenu>[0]> = {},
  menuLabel = 'Entity 更多操作'
) {
  const props = {
    menuLabel,
    onCopyAbsolutePath: vi.fn().mockResolvedValue(okResponse),
    onCopyRelativePath: vi.fn().mockResolvedValue(okResponse),
    onDelete: vi.fn(),
    onOpenDefault: vi.fn().mockResolvedValue(okResponse),
    onRename: vi.fn(),
    onRevealInFinder: vi.fn().mockResolvedValue(okResponse),
    ...overrides,
  };

  render(<EntityActionMenu {...props} />);

  return props;
}

describe('EntityActionMenu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders iconized actions in the shared grouped order', async () => {
    renderMenu();

    expect(
      screen.getByRole('button', { name: 'Entity 更多操作' }).querySelector('svg')
    ).toBeInTheDocument();

    const { menu } = await openEntityActionMenu('Entity 更多操作');

    expectEntityActionMenuItems(menu, [
      '用默认应用打开',
      '在访达中显示',
      '复制相对路径',
      '复制绝对路径',
      '重命名',
      '删除',
    ]);
    expectEntityActionMenuChrome(menu);
    expectNoRenderedRawPath();
  });

  it('supports entities without a relative path action and with remove copy', async () => {
    renderMenu(
      {
        deleteLabel: '移除',
        onCopyRelativePath: undefined,
      },
      'Memory Space 更多操作'
    );

    const { menu } = await openEntityActionMenu('Memory Space 更多操作');

    expectEntityActionMenuItems(menu, [
      '用默认应用打开',
      '在访达中显示',
      '复制绝对路径',
      '重命名',
      '移除',
    ]);
    expect(within(menu).queryByText('复制相对路径')).not.toBeInTheDocument();
    expectEntityActionMenuChrome(menu);
  });

  it('shows success only for successful copy actions', async () => {
    const onCopyAbsolutePath = vi.fn().mockResolvedValue(okResponse);
    renderMenu({ onCopyAbsolutePath });

    const { user } = await openEntityActionMenu('Entity 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '复制绝对路径' }));

    expect(onCopyAbsolutePath).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('已复制路径'));
  });

  it('maps typed action errors through workspace display copy', async () => {
    const onRevealInFinder = vi.fn().mockResolvedValue({
      error: { code: 'ERR_WORKSPACE_MEMORY_NOT_FOUND', message: '记忆不存在' },
      ok: false,
    });
    renderMenu({ onRevealInFinder });

    const { user } = await openEntityActionMenu('Entity 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '在访达中显示' }));

    expect(onRevealInFinder).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('找不到这条记忆。'));
  });

  it('shows the generic fallback when a bridge promise rejects', async () => {
    const onCopyAbsolutePath = vi.fn().mockRejectedValue(new Error('clipboard failed'));
    renderMenu({ onCopyAbsolutePath });

    const { user } = await openEntityActionMenu('Entity 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '复制绝对路径' }));

    expect(onCopyAbsolutePath).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('操作失败，请重试。'));
    expect(toast.success).not.toHaveBeenCalledWith('已复制路径');
  });

  it('invokes rename and delete callbacks directly', async () => {
    const onDelete = vi.fn();
    const onRename = vi.fn();
    renderMenu({ onDelete, onRename });

    const { user } = await openEntityActionMenu('Entity 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '重命名' }));
    expect(onRename).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Entity 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

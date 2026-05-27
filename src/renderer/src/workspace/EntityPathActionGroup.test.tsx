import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '@/components/ui/toaster';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EntityPathActionGroup } from './EntityPathActionGroup';
import { expectNoRenderedRawPath } from './entityActionMenuTestHelpers';

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

const okResponse = { ok: true } as const;

function renderPathMenu(
  overrides: Partial<Parameters<typeof EntityPathActionGroup>[0]> = {},
  menuLabel = 'Entity path actions'
) {
  const props = {
    onCopyAbsolutePath: vi.fn().mockResolvedValue(okResponse),
    onCopyRelativePath: vi.fn().mockResolvedValue(okResponse),
    onOpenDefault: vi.fn().mockResolvedValue(okResponse),
    onRevealInFinder: vi.fn().mockResolvedValue(okResponse),
    ...overrides,
  };

  render(
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button">Open path menu</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label={menuLabel} aria-labelledby={undefined}>
        <EntityPathActionGroup {...props} />
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return props;
}

async function openPathMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Open path menu' }));

  return {
    menu: await screen.findByRole('menu', { name: 'Entity path actions' }),
    user,
  };
}

describe('EntityPathActionGroup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders iconized open, reveal, and copy path actions in stable order', async () => {
    renderPathMenu();

    const { menu } = await openPathMenu();

    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['用默认应用打开', '在访达中显示', '复制相对路径', '复制绝对路径']);
    expect(within(menu).getAllByRole('group')).toHaveLength(2);
    expect(within(menu).getAllByRole('separator')).toHaveLength(1);
    for (const item of within(menu).getAllByRole('menuitem')) {
      expect(item.querySelector('svg')).toBeInTheDocument();
    }
    expectNoRenderedRawPath();
  });

  it('omits the relative path item when the entity has no relative path action', async () => {
    renderPathMenu({ onCopyRelativePath: undefined });

    const { menu } = await openPathMenu();

    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['用默认应用打开', '在访达中显示', '复制绝对路径']);
    expect(within(menu).queryByText('复制相对路径')).not.toBeInTheDocument();
  });

  it('shows success only for successful copy actions', async () => {
    const onCopyAbsolutePath = vi.fn().mockResolvedValue(okResponse);
    renderPathMenu({ onCopyAbsolutePath });

    const { user } = await openPathMenu();
    await user.click(screen.getByRole('menuitem', { name: '复制绝对路径' }));

    expect(onCopyAbsolutePath).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('已复制路径'));
  });

  it('does not show success toast for successful open or reveal actions', async () => {
    const onOpenDefault = vi.fn().mockResolvedValue(okResponse);
    const onRevealInFinder = vi.fn().mockResolvedValue(okResponse);
    renderPathMenu({ onOpenDefault, onRevealInFinder });

    const { user } = await openPathMenu();
    await user.click(screen.getByRole('menuitem', { name: '用默认应用打开' }));
    expect(onOpenDefault).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Open path menu' }));
    await user.click(screen.getByRole('menuitem', { name: '在访达中显示' }));
    expect(onRevealInFinder).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(toast.success).not.toHaveBeenCalled());
  });

  it('maps typed action errors through workspace display copy', async () => {
    const onRevealInFinder = vi.fn().mockResolvedValue({
      error: { code: 'ERR_WORKSPACE_SEGMENT_NOT_FOUND', message: '片段不存在' },
      ok: false,
    });
    renderPathMenu({ onRevealInFinder });

    const { user } = await openPathMenu();
    await user.click(screen.getByRole('menuitem', { name: '在访达中显示' }));

    expect(onRevealInFinder).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('找不到这个片段。'));
  });

  it('shows the generic fallback when a bridge promise rejects', async () => {
    const onCopyAbsolutePath = vi.fn().mockRejectedValue(new Error('clipboard failed'));
    renderPathMenu({ onCopyAbsolutePath });

    const { user } = await openPathMenu();
    await user.click(screen.getByRole('menuitem', { name: '复制绝对路径' }));

    expect(onCopyAbsolutePath).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('操作失败，请重试。'));
    expect(toast.success).not.toHaveBeenCalledWith('已复制路径');
  });
});

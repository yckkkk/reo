import { FolderPlus } from 'lucide-react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MenuItemButton, MenuSurface } from './menu';

describe('Menu primitives', () => {
  it('renders a compact tokenized action menu', () => {
    const onSelect = vi.fn();

    render(
      <MenuSurface aria-label="添加记忆空间菜单">
        <MenuItemButton
          icon={<FolderPlus className="size-14" aria-hidden="true" />}
          onClick={onSelect}
        >
          创建本地记忆空间
        </MenuItemButton>
      </MenuSurface>
    );

    const menu = screen.getByRole('menu', { name: '添加记忆空间菜单' });
    const item = screen.getByRole('menuitem', { name: '创建本地记忆空间' });
    expect(menu).toHaveClass('rounded-xl', 'border-chalk', 'bg-card-white');
    expect(item).toHaveClass('min-h-32', 'text-ui-xs', 'font-regular');
  });
});

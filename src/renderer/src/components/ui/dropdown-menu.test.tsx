import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

describe('DropdownMenu primitive', () => {
  it('uses the Reo compact menu surface and item density', () => {
    render(
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger>更多</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>重命名记忆</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    expect(screen.getByRole('menu')).toHaveClass(
      'reo-float-motion',
      'reo-squircle',
      'rounded-[18px]',
      'border-0',
      'bg-popover',
      'text-popover-foreground',
      'shadow-float',
      'p-[6px]'
    );
    expect(screen.getByRole('menu')).not.toHaveClass('border-border', 'bg-card');
    expect(screen.getByRole('menuitem', { name: '重命名记忆' })).toHaveClass(
      'min-h-32',
      'reo-squircle',
      'rounded-md',
      'px-8',
      'text-ui-md',
      'font-medium',
      'leading-[1.15]',
      'data-[highlighted]:bg-accent',
      'data-[highlighted]:text-accent-foreground',
      'focus:bg-accent',
      'focus:text-accent-foreground'
    );
  });

  it('supports grouped compact menu items separated by a soft Reo divider', () => {
    render(
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger>更多</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuItem>重命名片段</DropdownMenuItem>
            <DropdownMenuItem>删除片段</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>恢复片段</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    expect(screen.getByRole('separator')).toHaveAttribute('data-slot', 'dropdown-menu-separator');
    expect(screen.getByRole('separator')).toHaveClass('my-4', 'h-px', 'bg-border/60');
    expect(screen.getByRole('separator')).not.toHaveClass('border', 'border-border');
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
    expect(screen.getByRole('menuitem', { name: '重命名片段' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '删除片段' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '恢复片段' })).toBeInTheDocument();
  });
});

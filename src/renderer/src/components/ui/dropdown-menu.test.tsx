import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
      'rounded-xl',
      'border-glass-border',
      'bg-card-glass',
      'backdrop-blur-glass-md',
      'p-4'
    );
    expect(screen.getByRole('menuitem', { name: '重命名记忆' })).toHaveClass(
      'min-h-32',
      'rounded-lg',
      'px-8',
      'text-ui-xs',
      'font-regular'
    );
  });
});

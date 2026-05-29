import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button primitive', () => {
  it('has a role, accessible name, focus-visible styling, and click behavior', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>记录记忆</Button>);

    const button = screen.getByRole('button', { name: '记录记忆' });
    button.focus();

    expect(button).toHaveClass('reo-squircle', 'rounded-md', 'font-medium', 'min-h-40');
    expect(button).not.toHaveClass('rounded-full');
    expect(button).not.toHaveClass('font-bold');
    expect(button.className).toContain('focus-visible');
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('supports the disabled state', () => {
    render(<Button disabled>记录记忆</Button>);

    expect(screen.getByRole('button', { name: '记录记忆' })).toBeDisabled();
  });

  it('supports compact square-rounded action density', () => {
    render(
      <Button size="compact" variant="secondary">
        浏览
      </Button>
    );

    const button = screen.getByRole('button', { name: '浏览' });
    expect(button).toHaveClass('reo-squircle');
    expect(button).toHaveClass('min-h-32', 'rounded-md', 'px-12', 'text-ui-sm');
    expect(button).toHaveClass('bg-card', 'hover:bg-accent', 'hover:text-accent-foreground');
    expect(button).not.toHaveClass('hover:bg-secondary');
    expect(button).not.toHaveClass('rounded-full', 'rounded-lg');
  });

  it('supports destructive action semantics without component-local styling', () => {
    render(<Button variant="destructive">删除</Button>);

    expect(screen.getByRole('button', { name: '删除' })).toHaveClass(
      'bg-destructive',
      'text-destructive-foreground',
      'hover:bg-destructive-hover'
    );
    expect(screen.getByRole('button', { name: '删除' })).not.toHaveClass('hover:bg-destructive/90');
    expect(screen.getByRole('button', { name: '删除' })).not.toHaveClass('hover:bg-destructive');
  });

  it('keeps large icon actions square-rounded by default', () => {
    render(
      <Button size="iconLarge" aria-label="创建记忆空间">
        +
      </Button>
    );

    const button = screen.getByRole('button', { name: '创建记忆空间' });
    expect(button).toHaveClass(
      'size-56',
      'rounded-lg',
      'border-0',
      'bg-primary',
      'hover:bg-primary-hover',
      'shadow-none'
    );
    expect(button).not.toHaveClass('rounded-full');
  });

  it('supports naked icon controls without raw button styling', () => {
    render(
      <Button variant="ghostIcon" size="icon" aria-label="隐藏侧边栏">
        H
      </Button>
    );

    const button = screen.getByRole('button', { name: '隐藏侧边栏' });
    expect(button).toHaveClass('reo-squircle');
    expect(button).toHaveClass('size-32', 'rounded-sm', 'border-0', 'bg-transparent');
    expect(button).toHaveClass('hover:bg-accent', 'hover:text-accent-foreground');
    expect(button).not.toHaveClass('rounded-full', 'rounded-lg', 'rounded-md');
    expect(button).not.toHaveClass('border-transparent', 'shadow-float');
  });

  it('keeps 40px icon controls square-rounded rather than circular', () => {
    render(
      <Button variant="ghostIcon" size="iconMedium" aria-label="返回">
        R
      </Button>
    );

    const button = screen.getByRole('button', { name: '返回' });
    expect(button).toHaveClass('size-40', 'rounded-md');
    expect(button).not.toHaveClass('rounded-full', 'rounded-lg');
  });
});

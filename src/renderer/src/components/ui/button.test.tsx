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

    expect(button).toHaveClass('rounded-buttons', 'font-medium', 'min-h-40');
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
    expect(button).toHaveClass('min-h-32', 'rounded-buttons', 'px-12', 'text-ui-sm');
  });

  it('supports the accent icon action shape', () => {
    render(
      <Button variant="accentCircle" size="iconLarge" aria-label="创建工作区">
        +
      </Button>
    );

    const button = screen.getByRole('button', { name: '创建工作区' });
    expect(button).toHaveClass('size-56', 'rounded-full', 'bg-signal-blue', 'hover:bg-obsidian');
  });

  it('supports naked icon controls without raw button styling', () => {
    render(
      <Button variant="ghostIcon" size="icon" aria-label="隐藏侧边栏">
        H
      </Button>
    );

    const button = screen.getByRole('button', { name: '隐藏侧边栏' });
    expect(button).toHaveClass('size-32', 'border-transparent', 'bg-transparent');
  });
});

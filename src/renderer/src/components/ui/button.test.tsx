import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button primitive', () => {
  it('has a role, accessible name, focus-visible styling, and click behavior', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Record memory</Button>);

    const button = screen.getByRole('button', { name: 'Record memory' });
    button.focus();

    expect(button.className).toContain('focus-visible');
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('supports the disabled state', () => {
    render(<Button disabled>Record memory</Button>);

    expect(screen.getByRole('button', { name: 'Record memory' })).toBeDisabled();
  });

  it('supports the accent icon action shape', () => {
    render(
      <Button variant="accentCircle" size="iconLarge" aria-label="Create workspace">
        +
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Create workspace' });
    expect(button).toHaveClass('size-56', 'rounded-full', 'bg-signal-blue', 'hover:bg-obsidian');
  });

  it('supports naked icon controls without raw button styling', () => {
    render(
      <Button variant="ghostIcon" size="icon" aria-label="Hide sidebar">
        H
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Hide sidebar' });
    expect(button).toHaveClass('size-32', 'border-transparent', 'bg-transparent');
  });
});

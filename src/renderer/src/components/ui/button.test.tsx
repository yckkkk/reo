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
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from './switch';

describe('Switch primitive', () => {
  it('renders unchecked by default with switch semantics', () => {
    render(<Switch aria-label="语音识别" />);

    const toggle = screen.getByRole('switch', { name: '语音识别' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('fires onCheckedChange when clicked', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();

    render(<Switch aria-label="语音识别" onCheckedChange={onCheckedChange} />);

    await user.click(screen.getByRole('switch', { name: '语音识别' }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('toggles through keyboard interaction when controlled', async () => {
    const user = userEvent.setup();

    function ControlledSwitch() {
      const [checked, setChecked] = React.useState(false);
      return <Switch aria-label="语音识别" checked={checked} onCheckedChange={setChecked} />;
    }

    render(<ControlledSwitch />);

    const toggle = screen.getByRole('switch', { name: '语音识别' });
    toggle.focus();
    await user.keyboard('[Space]');

    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('honors disabled state', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();

    render(<Switch aria-label="语音识别" disabled onCheckedChange={onCheckedChange} />);

    const toggle = screen.getByRole('switch', { name: '语音识别' });
    expect(toggle).toBeDisabled();

    await user.click(toggle);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('uses Reo switch tokens without shadows or borders', () => {
    render(<Switch aria-label="语音识别" />);

    const toggle = screen.getByRole('switch', { name: '语音识别' });
    expect(toggle).toHaveClass(
      'bg-secondary',
      'data-[state=checked]:bg-primary',
      'shadow-none',
      'border-0'
    );
    expect(toggle).not.toHaveClass('shadow-sm', 'border-input');
  });
});

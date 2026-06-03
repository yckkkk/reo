import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

describe('Select primitive', () => {
  it('uses Radix Select mechanics with Reo compact input and menu styling', () => {
    render(
      <Select open value="vivi">
        <SelectTrigger id="voice" aria-label="语音音色">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="vivi">Vivi</SelectItem>
          <SelectItem value="xiaohe">小荷</SelectItem>
        </SelectContent>
      </Select>
    );

    const trigger = document.querySelector('[data-slot="select-trigger"]');
    const content = document.querySelector('[data-slot="select-content"]');
    const items = document.querySelectorAll('[data-slot="select-item"]');

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    if (!trigger) {
      throw new Error('Select trigger was not rendered');
    }
    expect(trigger).toHaveAttribute('role', 'combobox');
    expect(trigger).toHaveAttribute('aria-label', '语音音色');
    expect(trigger).toHaveClass(
      'min-h-40',
      'rounded-lg',
      'border-0',
      'bg-input',
      'px-12',
      'text-ui-md',
      'focus-visible:ring-2'
    );
    expect(trigger.querySelector('svg')).toHaveClass('size-16');
    expect(content).toHaveClass(
      'reo-float-motion',
      'reo-squircle',
      'rounded-[18px]',
      'bg-popover',
      'p-[6px]',
      'shadow-float'
    );
    expect(items[0]).toHaveClass('min-h-32', 'rounded-md', 'pl-28', 'pr-8', 'text-ui-md');
    expect(items[0]?.querySelector('[data-slot="select-item-indicator"] svg')).toHaveClass(
      'size-[14px]'
    );
    expect(items[1]).toHaveTextContent('小荷');
  });
});

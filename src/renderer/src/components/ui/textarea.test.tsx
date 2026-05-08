import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Textarea } from './textarea';

describe('Textarea', () => {
  it('uses Reo input tokens for compact multiline fields', () => {
    render(<Textarea aria-label="描述" placeholder="补充这个工作区的用途" />);

    const textarea = screen.getByRole('textbox', { name: '描述' });
    expect(textarea).toHaveClass(
      'min-h-72',
      'rounded-inputs',
      'border-chalk',
      'text-ui-sm',
      'leading-ui-sm',
      'placeholder:text-slate',
      'focus:border-signal-blue',
      'aria-invalid:border-ember'
    );
  });
});

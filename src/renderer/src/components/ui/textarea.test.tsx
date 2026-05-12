import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Textarea } from './textarea';

describe('Textarea', () => {
  it('uses Reo input tokens for compact multiline fields', () => {
    render(<Textarea aria-label="描述" placeholder="补充这个记忆空间的用途" />);

    const textarea = screen.getByRole('textbox', { name: '描述' });
    expect(textarea).toHaveClass(
      'min-h-72',
      'rounded-lg',
      'border-0',
      'bg-input',
      'text-ui-sm',
      'leading-ui-sm',
      'placeholder:text-muted-foreground',
      'focus-visible:ring-2',
      'focus-visible:ring-ring',
      'aria-invalid:ring-2',
      'aria-invalid:ring-destructive'
    );
    expect(textarea).toHaveClass('shadow-none');
    expect(textarea).not.toHaveClass('border-border', 'bg-card', 'focus:border-primary');
  });
});

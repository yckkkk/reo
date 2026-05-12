import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './input';

describe('Input primitive', () => {
  it('uses Reo rounded input tokens and default UI density', () => {
    render(<Input aria-label="记忆空间名称" placeholder="记忆空间名称" />);

    const input = screen.getByLabelText('记忆空间名称');
    expect(input).toHaveClass('rounded-lg', 'min-h-40', 'text-ui-md');
    expect(input).not.toHaveClass('text-body-lg');
  });

  it('supports compact form rows without ad hoc class overrides', () => {
    render(<Input aria-label="记忆空间名称" size="compact" />);

    expect(screen.getByLabelText('记忆空间名称')).toHaveClass('min-h-32', 'px-12', 'text-ui-sm');
  });
});

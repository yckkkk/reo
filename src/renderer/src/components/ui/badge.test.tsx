import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';

describe('Badge primitive', () => {
  it('renders compact status metadata without button semantics or elevation', () => {
    render(<Badge variant="secondary">已允许</Badge>);

    const badge = screen.getByText('已允许');
    expect(badge).toHaveAttribute('data-slot', 'badge');
    expect(badge).toHaveClass('reo-squircle', 'rounded-sm', 'text-ui-xs');
    expect(badge).toHaveClass('bg-secondary', 'text-secondary-foreground');
    expect(badge).not.toHaveClass('shadow-float', 'shadow-modal');
    expect(screen.queryByRole('button', { name: '已允许' })).not.toBeInTheDocument();
  });
});

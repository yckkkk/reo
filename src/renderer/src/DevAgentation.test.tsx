import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DevAgentation } from './DevAgentation';

vi.mock('agentation', () => ({
  Agentation: ({
    copyToClipboard,
    endpoint,
  }: {
    readonly copyToClipboard?: boolean;
    readonly endpoint?: string;
  }) => (
    <div
      data-copy-to-clipboard={String(copyToClipboard)}
      data-endpoint={endpoint}
      data-testid="agentation-toolbar"
    />
  ),
}));

describe('DevAgentation', () => {
  it('mounts Agentation with MCP sync and clipboard output enabled when explicitly enabled', async () => {
    render(<DevAgentation enabled />);

    const toolbar = await screen.findByTestId('agentation-toolbar');
    expect(toolbar).toHaveAttribute('data-endpoint', 'http://localhost:4747');
    expect(toolbar).toHaveAttribute('data-copy-to-clipboard', 'true');
  });

  it('does not mount Agentation when disabled', () => {
    render(<DevAgentation enabled={false} />);

    expect(screen.queryByTestId('agentation-toolbar')).not.toBeInTheDocument();
  });
});

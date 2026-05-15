import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DevAgentation, copyAgentationOutput, syncAgentationLayoutNotes } from './DevAgentation';

vi.mock('agentation', () => ({
  Agentation: ({
    copyToClipboard,
    endpoint,
    onCopy,
  }: {
    readonly copyToClipboard?: boolean;
    readonly endpoint?: string;
    readonly onCopy?: (output: string) => void;
  }) => (
    <button
      data-copy-to-clipboard={String(copyToClipboard)}
      data-endpoint={endpoint}
      data-testid="agentation-toolbar"
      onClick={() => onCopy?.('agentation feedback')}
      type="button"
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

  it('copies Agentation output from the onCopy fallback when the toolbar reports copied output', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText,
      },
    });

    render(<DevAgentation enabled />);
    await user.click(screen.getByTestId('agentation-toolbar'));

    expect(writeText).toHaveBeenCalledWith('agentation feedback');
  });

  it('includes Layout Mode notes stored by Agentation when copying feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText,
      },
    });
    localStorage.setItem(
      'agentation-rearrange-/',
      JSON.stringify({
        detectedAt: Date.now(),
        originalOrder: ['header'],
        sections: [
          {
            id: 'header',
            label: 'Header',
            selector: 'header',
            tagName: 'HEADER',
            note: 'hi',
            originalRect: { x: 100, y: 20, width: 320, height: 120 },
            currentRect: { x: 100, y: 20, width: 320, height: 120 },
          },
        ],
      })
    );

    await copyAgentationOutput('## Page Feedback: /');

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('- Note for **Header**: hi'));
  });

  it('syncs Layout Mode note-only feedback to the Agentation MCP session', async () => {
    localStorage.setItem('agentation-session-/', 'session-1');
    localStorage.setItem(
      'agentation-rearrange-/',
      JSON.stringify({
        detectedAt: Date.now(),
        originalOrder: ['header'],
        sections: [
          {
            id: 'header',
            label: 'Header',
            selector: 'header',
            tagName: 'HEADER',
            note: 'hi',
            originalRect: { x: 100, y: 20, width: 320, height: 120 },
            currentRect: { x: 100, y: 20, width: 320, height: 120 },
          },
        ],
      })
    );
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'header' }),
      });
    vi.stubGlobal('fetch', fetch);

    await syncAgentationLayoutNotes('http://localhost:4747');

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:4747/annotations/header',
      expect.objectContaining({
        method: 'PATCH',
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:4747/sessions/session-1/annotations',
      expect.objectContaining({
        body: expect.stringContaining('"comment":"Note for Header section (HEADER) - hi"'),
        method: 'POST',
      })
    );
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import { RecordAudioDrawer } from './RecordAudioDrawer';

describe('RecordAudioDrawer', () => {
  it('renders a labelled bottom drawer and prevents accidental close while recording', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <RecordAudioDrawer
        closeBlocked
        description="Record local audio."
        error={null}
        footer={<Button type="button">Close recording panel</Button>}
        onOpenChange={onOpenChange}
        open
        title="Record memory"
      >
        <p>Recording</p>
      </RecordAudioDrawer>
    );

    expect(screen.getByRole('dialog', { name: 'Record memory' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.getByText('Recording')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('renders child controls and a visible close command when idle', () => {
    render(
      <RecordAudioDrawer
        closeBlocked={false}
        description="Record local audio."
        error={null}
        footer={
          <Button type="button" variant="secondary">
            Close recording panel
          </Button>
        }
        onOpenChange={vi.fn()}
        open
        title="Record memory"
      >
        <Button type="button">Start recording</Button>
      </RecordAudioDrawer>
    );

    expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close recording panel' })).toBeEnabled();
  });

  it('renders errors without agent runtime copy', () => {
    render(
      <RecordAudioDrawer
        closeBlocked={false}
        description="Record local audio."
        error="Microphone unavailable"
        footer={<Button type="button">Close recording panel</Button>}
        onOpenChange={vi.fn()}
        open
        title="Record memory"
      >
        <p>Local audio only</p>
      </RecordAudioDrawer>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Microphone unavailable');
    expect(screen.queryByText(/agent|cloud|api key|model/i)).not.toBeInTheDocument();
  });
});

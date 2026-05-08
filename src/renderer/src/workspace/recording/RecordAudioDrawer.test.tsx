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
        description="录制本地音频。"
        error={null}
        footer={<Button type="button">关闭录音面板</Button>}
        onOpenChange={onOpenChange}
        open
        title="记录记忆"
      >
        <p>录音</p>
      </RecordAudioDrawer>
    );

    expect(screen.getByRole('dialog', { name: '记录记忆' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.getByText('录音')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('renders child controls and a visible close command when idle', () => {
    render(
      <RecordAudioDrawer
        closeBlocked={false}
        description="录制本地音频。"
        error={null}
        footer={
          <Button type="button" variant="secondary">
            关闭录音面板
          </Button>
        }
        onOpenChange={vi.fn()}
        open
        title="记录记忆"
      >
        <Button type="button">开始录音</Button>
      </RecordAudioDrawer>
    );

    expect(screen.getByRole('button', { name: '开始录音' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭录音面板' })).toBeEnabled();
  });

  it('renders errors without agent runtime copy', () => {
    render(
      <RecordAudioDrawer
        closeBlocked={false}
        description="录制本地音频。"
        error="无法使用麦克风"
        footer={<Button type="button">关闭录音面板</Button>}
        onOpenChange={vi.fn()}
        open
        title="记录记忆"
      >
        <p>仅使用本地音频</p>
      </RecordAudioDrawer>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('无法使用麦克风');
    expect(screen.queryByText(/agent|cloud|api key|model/i)).not.toBeInTheDocument();
  });
});

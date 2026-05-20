import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import { ImmersiveWorkspaceSurface } from './ImmersiveWorkspaceSurface';

describe('ImmersiveWorkspaceSurface', () => {
  it('renders a labelled workspace surface and prevents accidental close while busy', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ImmersiveWorkspaceSurface
        closeBlocked
        description="录制本地音频。"
        footer={<Button type="button">关闭录音</Button>}
        onOpenChange={onOpenChange}
        open
        title="记录记忆"
      >
        <p>录音</p>
      </ImmersiveWorkspaceSurface>
    );

    expect(screen.getByRole('dialog', { name: '记录记忆' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.getByText('录音')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('renders child controls and a visible close command when idle', () => {
    render(
      <ImmersiveWorkspaceSurface
        closeBlocked={false}
        description="录制本地音频。"
        footer={
          <Button type="button" variant="secondary">
            关闭录音
          </Button>
        }
        onOpenChange={vi.fn()}
        open
        title="记录记忆"
      >
        <Button type="button">开始录音</Button>
      </ImmersiveWorkspaceSurface>
    );

    expect(screen.getByRole('button', { name: '开始录音' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭录音' })).toBeEnabled();
  });

  it('does not reserve inline error space inside the workspace surface', () => {
    render(
      <ImmersiveWorkspaceSurface
        closeBlocked={false}
        description="录制本地音频。"
        footer={<Button type="button">关闭录音</Button>}
        onOpenChange={vi.fn()}
        open
        title="记录记忆"
      >
        <p>仅使用本地音频</p>
      </ImmersiveWorkspaceSurface>
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/agent|cloud|api key|model/i)).not.toBeInTheDocument();
  });

  it('uses an opaque semantic background for the immersive workspace surface', () => {
    render(
      <ImmersiveWorkspaceSurface
        closeBlocked={false}
        description="录制本地音频。"
        immersive
        onOpenChange={vi.fn()}
        open
        title="记录记忆"
      >
        <Button type="button">开始录音</Button>
      </ImmersiveWorkspaceSurface>
    );

    expect(document.querySelector('[data-slot="drawer-overlay"]')).toHaveClass('bg-background');
    expect(document.querySelector('[data-slot="drawer-overlay"]')).not.toHaveClass(
      'bg-background/95'
    );
  });
});

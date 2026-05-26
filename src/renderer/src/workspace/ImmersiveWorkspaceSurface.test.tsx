import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImmersiveWorkspaceSurface } from './ImmersiveWorkspaceSurface';
import {
  IMMERSIVE_WORKSPACE_SURFACE_CONTENT_Z_CLASS,
  IMMERSIVE_WORKSPACE_SURFACE_OVERLAY_Z_CLASS,
} from './immersiveWorkspaceLayers';

describe('ImmersiveWorkspaceSurface', () => {
  it('places immersive editor surfaces above development feedback overlays', () => {
    render(
      <ImmersiveWorkspaceSurface
        closeBlocked={false}
        description="补充笔记1"
        immersive
        onOpenChange={() => {}}
        open
        title="笔记"
      >
        <section aria-label="笔记编辑器">正文</section>
      </ImmersiveWorkspaceSurface>
    );

    expect(screen.getByRole('dialog', { name: '笔记' })).toHaveClass(
      'reo-immersive-workspace-surface-motion',
      IMMERSIVE_WORKSPACE_SURFACE_CONTENT_Z_CLASS
    );
    expect(document.querySelector('[data-slot="drawer-overlay"]')).toHaveClass(
      IMMERSIVE_WORKSPACE_SURFACE_OVERLAY_Z_CLASS
    );
  });

  it('reports the immersive surface exit after its closing animation settles', async () => {
    const onExitAnimationEnd = vi.fn();
    vi.useFakeTimers();

    try {
      const { rerender } = render(
        <ImmersiveWorkspaceSurface
          closeBlocked={false}
          description="补充笔记1"
          immersive
          onExitAnimationEnd={onExitAnimationEnd}
          onOpenChange={() => {}}
          open
          title="笔记"
        >
          <section aria-label="笔记编辑器">正文</section>
        </ImmersiveWorkspaceSurface>
      );

      rerender(
        <ImmersiveWorkspaceSurface
          closeBlocked={false}
          description="补充笔记1"
          immersive
          onExitAnimationEnd={onExitAnimationEnd}
          onOpenChange={() => {}}
          open={false}
          title="笔记"
        >
          <section aria-label="笔记编辑器">正文</section>
        </ImmersiveWorkspaceSurface>
      );

      act(() => {
        vi.advanceTimersByTime(280);
      });

      expect(onExitAnimationEnd).toHaveBeenCalledTimes(1);

      fireEvent.animationEnd(screen.getByRole('dialog', { name: '笔记' }));

      expect(onExitAnimationEnd).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

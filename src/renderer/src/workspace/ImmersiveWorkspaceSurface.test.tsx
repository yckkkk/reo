import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
      IMMERSIVE_WORKSPACE_SURFACE_CONTENT_Z_CLASS
    );
    expect(document.querySelector('[data-slot="drawer-overlay"]')).toHaveClass(
      IMMERSIVE_WORKSPACE_SURFACE_OVERLAY_Z_CLASS
    );
  });
});

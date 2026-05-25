import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  IMMERSIVE_WORKSPACE_ALERT_CONTENT_Z_CLASS,
  IMMERSIVE_WORKSPACE_ALERT_OVERLAY_Z_CLASS,
  IMMERSIVE_WORKSPACE_SURFACE_CONTENT_Z_CLASS,
  IMMERSIVE_WORKSPACE_SURFACE_OVERLAY_Z_CLASS,
} from './immersiveWorkspaceLayers';
import { WorkspaceDangerConfirmDialog } from './WorkspaceDangerConfirmDialog';

function zIndexNumber(zClassName: string) {
  return Number(zClassName.match(/z-\[(\d+)]/)?.[1] ?? Number.NaN);
}

describe('WorkspaceDangerConfirmDialog', () => {
  it('uses a compact danger confirmation surface with explicit destructive action semantics', () => {
    render(
      <WorkspaceDangerConfirmDialog
        confirmLabel="清空正文"
        description="清空后会把正文保存为空，不会删除文件或附件。确认后需要手动重新输入内容。"
        onConfirm={() => {}}
        onOpenChange={() => {}}
        open
        title="清空正文？"
      />
    );

    const dialog = screen.getByRole('alertdialog', { name: '清空正文？' });
    expect(dialog).toHaveClass('sm:w-[min(420px,calc(100vw-40px))]', 'sm:px-24', 'sm:py-24');
    expect(within(dialog).getByRole('button', { name: '清空正文' })).toHaveClass(
      'bg-destructive',
      'text-destructive-foreground'
    );
  });

  it('can render above immersive workspace surfaces', () => {
    expect(zIndexNumber(IMMERSIVE_WORKSPACE_ALERT_OVERLAY_Z_CLASS)).toBeGreaterThan(
      zIndexNumber(IMMERSIVE_WORKSPACE_SURFACE_CONTENT_Z_CLASS)
    );
    expect(zIndexNumber(IMMERSIVE_WORKSPACE_ALERT_CONTENT_Z_CLASS)).toBeGreaterThan(
      zIndexNumber(IMMERSIVE_WORKSPACE_ALERT_OVERLAY_Z_CLASS)
    );
    expect(zIndexNumber(IMMERSIVE_WORKSPACE_SURFACE_CONTENT_Z_CLASS)).toBeGreaterThan(
      zIndexNumber(IMMERSIVE_WORKSPACE_SURFACE_OVERLAY_Z_CLASS)
    );

    render(
      <WorkspaceDangerConfirmDialog
        confirmLabel="放弃"
        description="未保存的笔记正文会被丢弃。"
        modalLayer="immersive"
        onConfirm={() => {}}
        onOpenChange={() => {}}
        open
        title="放弃未保存的笔记？"
      />
    );

    expect(screen.getByRole('alertdialog', { name: '放弃未保存的笔记？' })).toHaveClass(
      IMMERSIVE_WORKSPACE_ALERT_CONTENT_Z_CLASS
    );
    expect(document.querySelector('[data-slot="alert-dialog-overlay"]')).toHaveClass(
      IMMERSIVE_WORKSPACE_ALERT_OVERLAY_Z_CLASS
    );
  });
});

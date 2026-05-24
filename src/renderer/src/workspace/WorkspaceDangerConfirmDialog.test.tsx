import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkspaceDangerConfirmDialog } from './WorkspaceDangerConfirmDialog';

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
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';

describe('Dialog primitive', () => {
  it('uses centering-safe fade motion for modal overlay and content', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>创建记忆空间</DialogTitle>
          <DialogDescription>选择一个本地文件夹作为记忆空间。</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    const dialog = screen.getByRole('dialog', { name: '创建记忆空间' });

    expect(overlay).toHaveClass('reo-fade-motion', 'bg-scrim');
    expect(dialog).toHaveClass(
      'reo-fade-motion',
      'shadow-modal',
      'sm:-translate-x-1/2',
      'sm:-translate-y-1/2'
    );
    expect(dialog).not.toHaveClass('reo-float-motion');
  });
});

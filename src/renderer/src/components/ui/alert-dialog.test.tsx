import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from './alert-dialog';

describe('AlertDialog primitive', () => {
  it('uses centering-safe fade motion for modal overlay and content', () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>删除这条记忆？</AlertDialogTitle>
          <AlertDialogDescription>删除后会移除当前记忆及其片段。</AlertDialogDescription>
          <AlertDialogCancel>取消</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    );

    const overlay = document.querySelector('[data-slot="alert-dialog-overlay"]');
    const dialog = screen.getByRole('alertdialog', { name: '删除这条记忆？' });

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

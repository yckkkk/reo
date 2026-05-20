import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createReoQueryClient } from '../queryClient';
import { NoteEditorOverlay } from './NoteEditorOverlay';
import type { WorkspaceSession } from './workspaceApi';

const workspaceSession: WorkspaceSession = {
  workspaceHandle: 'workspace-handle-secret',
  workspaceId: 'ws_1',
  snapshot: {
    workspaceId: 'ws_1',
    title: 'Daily memory',
    description: '',
    memories: [],
  },
};

function renderNoteEditorOverlay(onOpenChange = vi.fn()) {
  const queryClient = createReoQueryClient();

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return {
    onOpenChange,
    ...render(
      <NoteEditorOverlay
        onNoteSegmentContentSaved={() => {}}
        onNoteSegmentFinalized={() => {}}
        onNoteSegmentSupplementContentSaved={() => {}}
        onOpenChange={onOpenChange}
        onSegmentSupplementNoteFinalized={() => {}}
        open
        target={null}
        workspaceSession={workspaceSession}
      />,
      { wrapper: Wrapper }
    ),
  };
}

describe('NoteEditorOverlay', () => {
  it('places the return button on the shared titlebar control grid', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    renderNoteEditorOverlay(onOpenChange);

    const returnButton = screen.getByRole('button', { name: '返回' });
    expect(returnButton).toHaveStyle({ left: '80px', top: '2px' });
    expect(returnButton).toHaveClass('absolute', 'size-32', 'rounded-sm');
    expect(returnButton).not.toHaveClass('size-40', 'rounded-md');

    await user.click(returnButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('places the title and save action in the window titlebar', () => {
    renderNoteEditorOverlay();

    const titlebarTitle = screen.getByTestId('note-editor-titlebar-title');
    expect(titlebarTitle).toHaveStyle({ left: '116px', top: '2px' });
    expect(titlebarTitle).toHaveClass('h-32', 'text-body', 'font-regular', 'leading-body');
    expect(within(titlebarTitle).getByRole('heading', { name: '正文' })).toBeInTheDocument();

    const titlebarActions = screen.getByTestId('note-editor-titlebar-actions');
    expect(titlebarActions).toHaveStyle({ right: '12px', top: '2px' });
    expect(titlebarActions).toHaveClass('pointer-events-auto', 'items-center', 'gap-8');
    expect(within(titlebarActions).getByRole('button', { name: '保存笔记' })).toHaveClass(
      'min-h-32',
      'rounded-md',
      'px-12'
    );

    const editorStage = screen.getByTestId('note-editor-surface-stage');
    expect(within(editorStage).queryByRole('heading', { name: '正文' })).toBeNull();
    expect(within(editorStage).queryByRole('button', { name: '保存笔记' })).toBeNull();
  });
});

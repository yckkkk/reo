import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createReoQueryClient } from '../queryClient';
import { NoteEditorOverlay } from './NoteEditorOverlay';
import type { NoteEditorTarget } from './noteEditorModel';
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

function renderNoteEditorOverlay({
  onOpenChange = vi.fn() as (open: boolean) => void,
  target = null,
}: {
  readonly onOpenChange?: (open: boolean) => void;
  readonly target?: NoteEditorTarget | null;
} = {}) {
  const queryClient = createReoQueryClient();

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return {
    onOpenChange,
    ...render(
      <NoteEditorOverlay
        onNoteSegmentFinalized={() => {}}
        onOpenChange={onOpenChange}
        onSegmentSupplementNoteFinalized={() => {}}
        open
        target={target}
        workspaceSession={workspaceSession}
      />,
      { wrapper: Wrapper }
    ),
  };
}

describe('NoteEditorOverlay', () => {
  it('places the return button on the shared titlebar control grid', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn<(open: boolean) => void>();

    renderNoteEditorOverlay({ onOpenChange });

    const returnButton = screen.getByRole('button', { name: '返回' });
    expect(returnButton).toHaveStyle({ left: '80px', top: '2px' });
    expect(returnButton).toHaveClass('absolute', 'size-32', 'rounded-sm');
    expect(returnButton).not.toHaveClass('size-40', 'rounded-md');

    await user.click(returnButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps the window titlebar for navigation and saves from the editor header', async () => {
    renderNoteEditorOverlay();

    const titlebarTitle = screen.getByTestId('note-editor-titlebar-title');
    expect(titlebarTitle).toHaveStyle({ left: '116px', top: '2px' });
    expect(titlebarTitle).toHaveClass('h-32', 'text-body', 'font-regular', 'leading-body');
    expect(within(titlebarTitle).getByRole('heading', { name: '正文' })).toBeInTheDocument();
    expect(screen.queryByTestId('note-editor-titlebar-actions')).not.toBeInTheDocument();

    const editorStage = screen.getByTestId('note-editor-surface-stage');
    expect(editorStage).toHaveClass('max-w-[760px]');
    expect(within(editorStage).queryByRole('heading', { name: '正文' })).toBeNull();
    const editorSurface = screen.getByTestId('note-editor-textarea-surface');
    expect(editorSurface.firstElementChild).toHaveClass('min-h-[44px]');
    expect(editorSurface.firstElementChild).not.toHaveClass('min-h-44');
    expect(within(editorSurface).getByText('Markdown 笔记')).toBeInTheDocument();
    expect(within(editorStage).getByRole('button', { name: '保存笔记' })).toHaveClass(
      'min-h-32',
      'rounded-md',
      'px-12'
    );
    await waitFor(() => expect(screen.getByLabelText('笔记正文')).toHaveFocus());
  });

  it('labels an empty supplement editor as a supplement writing surface', async () => {
    renderNoteEditorOverlay({
      target: {
        kind: 'segment-supplement',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        title: '补充笔记1',
      },
    });

    const textarea = screen.getByLabelText('笔记正文');
    expect(textarea).toHaveValue('');
    expect(textarea).toHaveAttribute('placeholder', '写下补充笔记...');
    expect(textarea).toHaveClass('p-0', 'placeholder:text-muted-foreground');
    expect(textarea).toHaveClass('focus-visible:!ring-0', 'transition-none', '!bg-transparent');
    await waitFor(() => expect(textarea).toHaveFocus());
    expect(screen.getByTestId('note-editor-textarea-surface')).toHaveClass('border-ring');
    expect(screen.getByTestId('note-editor-titlebar-title')).toHaveTextContent('补充笔记1');
  });

  it('applies lightweight Markdown toolbar commands to the textarea selection', async () => {
    const user = userEvent.setup();

    renderNoteEditorOverlay({
      target: {
        kind: 'segment',
        memoryId: 'memory_1',
        title: '新笔记',
      },
    });

    const textarea = screen.getByLabelText('笔记正文') as HTMLTextAreaElement;
    await user.type(textarea, 'hello');
    textarea.setSelectionRange(0, 5);

    await user.click(screen.getByRole('button', { name: '粗体' }));

    expect(textarea.value).toBe('**hello**');
    await waitFor(() => expect(textarea.selectionStart).toBe(2));
    expect(textarea.selectionEnd).toBe(7);
    expect(screen.getByRole('toolbar', { name: 'Markdown 格式工具栏' })).toBeVisible();
  });
});

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReoQueryClient } from '../queryClient';
import { NoteEditorOverlay } from './NoteEditorOverlay';
import type { NoteEditorTarget } from './noteEditorModel';
import type { FinalizedNoteSegment, WorkspaceSession } from './workspaceApi';

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
  onNoteSegmentFinalized = vi.fn() as (finalized: FinalizedNoteSegment) => void,
  onOpenChange = vi.fn() as (open: boolean) => void,
  target = null,
}: {
  readonly onNoteSegmentFinalized?: (finalized: FinalizedNoteSegment) => void;
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
        onNoteSegmentFinalized={onNoteSegmentFinalized}
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

function installWorkspaceBridge(overrides: Partial<Window['reoWorkspace']> = {}) {
  const bridge = {
    createNoteSegmentDraft: vi.fn(async () => ({
      ok: true as const,
      value: { segmentId: 'seg_note_1', revision: 0 },
    })),
    createSegmentSupplementNoteDraft: vi.fn(),
    writeNoteSegmentDraftBody: vi.fn(async () => ({
      ok: true as const,
      value: { bodyByteLength: 15, revision: 1 },
    })),
    writeSegmentSupplementNoteDraftBody: vi.fn(),
    finalizeNoteSegmentDraft: vi.fn(async () => ({
      ok: true as const,
      value: {
        memory: {
          audioByteLength: 0,
          audioDurationMs: 0,
          audioSegmentCount: 0,
          createdAt: '2026-05-19T12:00:00.000Z',
          hasAnyNote: true,
          hasAudioTranscript: false,
          memoryId: 'memory_1',
          noteSegmentCount: 1,
          segmentCount: 1,
          supplementCount: 0,
          title: 'Memory',
          updatedAt: '2026-05-19T12:00:00.000Z',
        },
        segment: {
          bodyByteLength: 15,
          createdAt: '2026-05-19T12:00:00.000Z',
          memoryId: 'memory_1',
          segmentId: 'seg_note_1',
          supplementCount: 0,
          supplements: [],
          title: '新笔记',
          type: 'note',
          updatedAt: '2026-05-19T12:00:00.000Z',
          workspaceId: 'ws_1',
        },
      },
    })),
    finalizeSegmentSupplementNoteDraft: vi.fn(),
    ...overrides,
  };
  Object.defineProperty(window, 'reoWorkspace', {
    configurable: true,
    value: bridge as unknown as Window['reoWorkspace'],
  });
  return bridge;
}

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it('keeps the window titlebar for navigation and saves from the titlebar action', async () => {
    renderNoteEditorOverlay();

    const titlebarTitle = screen.getByTestId('note-editor-titlebar-title');
    expect(titlebarTitle).toHaveStyle({ left: '116px', top: '2px' });
    expect(titlebarTitle).toHaveClass('h-32', 'text-body', 'font-regular', 'leading-body');
    expect(within(titlebarTitle).getByRole('heading', { name: '正文' })).toBeInTheDocument();

    const titlebarActions = screen.getByTestId('note-editor-titlebar-actions');
    expect(titlebarActions).toHaveStyle({ right: '12px', top: '0px' });
    expect(titlebarActions).toHaveClass('flex', 'h-48', 'items-center');
    expect(within(titlebarActions).getByRole('button', { name: '保存笔记' })).toBeInTheDocument();

    const editorStage = screen.getByTestId('note-editor-surface-stage');
    expect(editorStage).toHaveClass('flex-1', 'min-h-0', 'w-full');
    expect(editorStage).not.toHaveClass('max-w-[760px]');
    expect(within(editorStage).queryByRole('heading', { name: '正文' })).toBeNull();
    const editorSurface = screen.getByTestId('note-editor-text-surface');
    expect(editorSurface).not.toHaveClass('border');
    expect(editorSurface.firstElementChild).toHaveClass('min-h-[44px]');
    expect(editorSurface.firstElementChild).not.toHaveClass('min-h-44');
    expect(within(editorSurface).getByText('Markdown 笔记')).toBeInTheDocument();
    expect(within(editorStage).queryByRole('button', { name: '保存笔记' })).toBeNull();
    await waitFor(() => expect(screen.getByRole('textbox', { name: '笔记正文' })).toHaveFocus());
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

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    expect(editor).toHaveAttribute('contenteditable', 'true');
    expect(editor).toHaveTextContent('');
    expect(screen.getByText('写下补充笔记...')).toBeInTheDocument();
    expect(editor).toHaveClass('simple-editor', 'reo-lightweight-markdown-editor', 'ProseMirror');
    await waitFor(() => expect(editor).toHaveFocus());
    expect(screen.getByTestId('note-editor-text-surface')).not.toHaveClass('border', 'border-ring');
    expect(screen.getByTestId('note-editor-titlebar-title')).toHaveTextContent('补充笔记1');
  });

  it('exposes the Simple Editor toolbar without draft-only attachment upload', async () => {
    const user = userEvent.setup();

    renderNoteEditorOverlay({
      target: {
        kind: 'segment',
        memoryId: 'memory_1',
        title: '新笔记',
      },
    });

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    await user.click(editor);

    expect(screen.getByRole('button', { name: '粗体' })).toBeVisible();
    expect(screen.getByRole('button', { name: '斜体' })).toBeVisible();
    expect(screen.getByRole('button', { name: '标题' })).toBeVisible();
    expect(screen.getByRole('button', { name: '列表' })).toBeVisible();
    expect(screen.getByRole('button', { name: '链接' })).toBeVisible();
    expect(screen.getByRole('button', { name: '左对齐' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '列表' }));
    expect(await screen.findByRole('menuitem', { name: /项目符号列表/ })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: /编号列表/ })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: /待办列表/ })).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: '格式' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '添加图片' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('图片附件')).not.toBeInTheDocument();
    expect(screen.queryByRole('menu', { name: '格式' })).not.toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: '文本编辑工具栏' })).toBeVisible();
    expect(screen.queryByRole('toolbar', { name: 'Markdown 格式工具栏' })).not.toBeInTheDocument();
  });

  it('saves a new note segment with the Tiptap JSON produced by the editor', async () => {
    const user = userEvent.setup();
    const bridge = installWorkspaceBridge();
    const onNoteSegmentFinalized = vi.fn<(finalized: FinalizedNoteSegment) => void>();

    renderNoteEditorOverlay({
      onNoteSegmentFinalized,
      target: {
        kind: 'segment',
        memoryId: 'memory_1',
        title: '新笔记',
      },
    });

    await user.type(screen.getByRole('textbox', { name: '笔记正文' }), 'Codex highlight');
    await user.click(screen.getByRole('button', { name: '保存笔记' }));

    await waitFor(() => expect(bridge.writeNoteSegmentDraftBody).toHaveBeenCalled());
    expect(bridge.writeNoteSegmentDraftBody).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyMarkdown: expect.stringContaining('Codex highlight'),
        bodyTiptapJson: expect.objectContaining({ type: 'doc' }),
      })
    );
    expect(onNoteSegmentFinalized).toHaveBeenCalledOnce();
  });
});

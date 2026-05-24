import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { saveTranscript } from './workspaceApi';
import { TranscriptEditorOverlay, type TranscriptEditorTarget } from './TranscriptEditorOverlay';
import type { WorkspaceSession } from './workspaceApi';

vi.mock('./workspaceApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./workspaceApi')>();
  return {
    ...actual,
    saveTranscript: vi.fn(),
  };
});

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

const target: TranscriptEditorTarget = {
  baselineTranscriptHash: 'a'.repeat(64),
  memoryId: 'mem_1',
  segmentId: 'seg_1',
  title: '转录',
  transcriptText: '旧转录',
};

describe('TranscriptEditorOverlay', () => {
  it('saves transcript edits with the entry baseline hash', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    vi.mocked(saveTranscript).mockResolvedValue({
      ok: true,
      value: {
        saved: true,
        memory: {
          memoryId: 'mem_1',
          title: 'Memory',
          createdAt: '2026-05-20T12:00:00.000Z',
          updatedAt: '2026-05-20T12:00:00.000Z',
          segmentCount: 1,
          audioSegmentCount: 1,
          noteSegmentCount: 0,
          audioDurationMs: 1000,
          audioByteLength: 3,
          hasAudioTranscript: true,
          hasAnyNote: false,
          supplementCount: 0,
        },
      },
    });

    render(
      <TranscriptEditorOverlay
        onOpenChange={() => {}}
        onSaved={onSaved}
        open
        target={target}
        workspaceSession={workspaceSession}
      />
    );

    await user.clear(screen.getByLabelText('转录正文'));
    await user.type(screen.getByLabelText('转录正文'), '新转录');
    await user.click(screen.getByRole('button', { name: '保存转录' }));

    expect(saveTranscript).toHaveBeenCalledWith({
      workspaceHandle: 'workspace-handle-secret',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      markdown: '新转录',
      baselineTranscriptHash: 'a'.repeat(64),
    });
    expect(onSaved).toHaveBeenCalledWith({
      expectedSession: workspaceSession,
      memory: expect.objectContaining({ memoryId: 'mem_1' }),
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    });
  });

  it('edits transcript text with the same lightweight Markdown controls as notes', async () => {
    const user = userEvent.setup();
    render(
      <TranscriptEditorOverlay
        onOpenChange={() => {}}
        onSaved={() => {}}
        open
        target={target}
        workspaceSession={workspaceSession}
      />
    );

    const textarea = screen.getByLabelText('转录正文') as HTMLTextAreaElement;
    expect(screen.getByRole('toolbar', { name: 'Markdown 格式工具栏' })).toBeVisible();
    expect(screen.getByRole('button', { name: '图片' })).toBeInTheDocument();
    expect(screen.queryByTestId('transcript-editor-titlebar-actions')).not.toBeInTheDocument();
    expect(screen.getByTestId('transcript-editor-surface-stage')).toHaveClass('max-w-[760px]');
    const header = screen.getByText('Markdown 转录').parentElement?.parentElement;
    expect(header).toHaveClass('min-h-[44px]');
    expect(header).not.toHaveClass('min-h-44');
    expect(
      within(screen.getByTestId('transcript-editor-textarea-surface')).getByRole('button', {
        name: '保存转录',
      })
    ).toHaveClass('min-h-32', 'rounded-md', 'px-12');
    expect(screen.getByText('Markdown 转录')).toBeInTheDocument();
    expect(textarea).toHaveAttribute('placeholder', '整理或修正转录文本...');
    expect(textarea).toHaveClass('py-16', 'placeholder:text-muted-foreground');
    expect(textarea).not.toHaveClass('focus-visible:ring-2');
    expect(screen.getByTestId('transcript-editor-textarea-surface')).toHaveClass(
      'focus-within:ring-1',
      'focus-within:ring-border'
    );
    expect(textarea).toHaveFocus();

    await user.clear(textarea);
    await user.type(textarea, '片段转录');
    textarea.setSelectionRange(0, 2);

    await user.click(screen.getByRole('button', { name: '粗体' }));

    expect(textarea.value).toBe('**片段**转录');
  });

  it('asks before closing dirty transcript edits', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <TranscriptEditorOverlay
        onOpenChange={onOpenChange}
        onSaved={() => {}}
        open
        target={target}
        workspaceSession={workspaceSession}
      />
    );

    await user.type(screen.getByLabelText('转录正文'), '追加');
    await user.click(screen.getByRole('button', { name: '返回' }));

    expect(screen.getByRole('alertdialog', { name: '放弃未保存的转录？' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '放弃' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps edits open when saving meets a stale transcript baseline', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();
    vi.mocked(saveTranscript).mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_BACKFILL_TRANSCRIPT_CHANGED',
        message: 'Transcript changed during backfill',
      },
    });

    render(
      <TranscriptEditorOverlay
        onOpenChange={onOpenChange}
        onSaved={onSaved}
        open
        target={target}
        workspaceSession={workspaceSession}
      />
    );

    await user.clear(screen.getByLabelText('转录正文'));
    await user.type(screen.getByLabelText('转录正文'), '我还要保留的修改');
    await user.click(screen.getByRole('button', { name: '保存转录' }));

    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText('转录正文')).toHaveValue('我还要保留的修改');
    expect(screen.getByRole('button', { name: '保存转录' })).toBeEnabled();
    expect(
      await screen.findByText('转录已在生成期间发生变化，已保留当前内容。请确认后重新生成。')
    ).toBeInTheDocument();
  });
});

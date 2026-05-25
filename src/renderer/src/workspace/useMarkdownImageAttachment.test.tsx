import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type {
  LightweightMarkdownEditorHandle,
  LightweightMarkdownEditorSelection,
} from './LightweightMarkdownEditorSurface';
import {
  useMarkdownImageAttachment,
  type MarkdownImageAttachmentTarget,
} from './useMarkdownImageAttachment';
import { saveSegmentAttachment, type WorkspaceSession } from './workspaceApi';

vi.mock('./workspaceApi', () => ({
  saveSegmentAttachment: vi.fn(),
  saveSegmentSupplementAttachment: vi.fn(),
}));

const workspaceSession: WorkspaceSession = {
  workspaceHandle: 'workspace-handle-1',
  workspaceId: 'ws_1',
  snapshot: {
    workspaceId: 'ws_1',
    title: 'Daily memory',
    description: '',
    memories: [],
  },
};

const segmentTarget: MarkdownImageAttachmentTarget = {
  kind: 'segment',
  memoryId: 'mem_1',
  segmentId: 'seg_1',
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function createEditorHandle(selection: LightweightMarkdownEditorSelection) {
  return {
    blur: vi.fn(),
    captureSelection: vi.fn(() => selection),
    focus: vi.fn(),
    getMarkdown: vi.fn(() => ''),
    insertMarkdown: vi.fn(),
  } satisfies LightweightMarkdownEditorHandle;
}

function filesClipboardData(files: readonly File[]) {
  return {
    files,
    getData: () => '',
    items: [],
    setData: () => undefined,
    types: ['Files'],
  };
}

function Harness({
  editorHandle,
  onError,
  target,
}: {
  readonly editorHandle: LightweightMarkdownEditorHandle;
  readonly onError: (message: string | null) => void;
  readonly target: MarkdownImageAttachmentTarget | null;
}) {
  const editorHandleRef = useRef<LightweightMarkdownEditorHandle | null>(editorHandle);
  editorHandleRef.current = editorHandle;
  const imageAttachment = useMarkdownImageAttachment({
    disabled: false,
    editorHandleRef,
    onError,
    target,
    workspaceSession,
  });
  return (
    <div
      aria-label="笔记正文"
      data-pending={imageAttachment.pending ? 'true' : 'false'}
      onPaste={imageAttachment.handlePaste}
    />
  );
}

describe('useMarkdownImageAttachment', () => {
  it('does not insert a saved attachment when the editor target changes while saving', async () => {
    const save = createDeferred<Awaited<ReturnType<typeof saveSegmentAttachment>>>();
    vi.mocked(saveSegmentAttachment).mockReturnValue(save.promise);
    const onError = vi.fn();
    const firstEditorHandle = createEditorHandle({ from: 1, to: 1 });
    const secondEditorHandle = createEditorHandle({ from: 2, to: 2 });

    const { rerender } = render(
      <Harness editorHandle={firstEditorHandle} onError={onError} target={segmentTarget} />
    );
    fireEvent.paste(screen.getByLabelText('笔记正文'), {
      clipboardData: filesClipboardData([
        new File([new Uint8Array([1, 2, 3])], 'Cake.png', { type: 'image/png' }),
      ]),
    });

    await waitFor(() => expect(saveSegmentAttachment).toHaveBeenCalledTimes(1));
    rerender(<Harness editorHandle={secondEditorHandle} onError={onError} target={null} />);
    save.resolve({ ok: true, value: { relativePath: 'attachments/cake.png' } });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('当前编辑区域已切换，图片未插入。');
    });
    expect(firstEditorHandle.insertMarkdown).not.toHaveBeenCalled();
    expect(secondEditorHandle.insertMarkdown).not.toHaveBeenCalled();
  });
});

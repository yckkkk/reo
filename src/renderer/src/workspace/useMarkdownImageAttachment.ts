import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type RefObject,
} from 'react';
import {
  attachmentAltFromFilename,
  attachmentOriginalFilename,
  NOTE_ATTACHMENT_MAX_BYTES,
  readDroppedImageFile,
  readPastedImageFile,
} from './noteEditorModel';
import type { LightweightMarkdownEditorHandle } from './LightweightMarkdownEditorSurface';
import {
  saveSegmentAttachment,
  saveSegmentSupplementAttachment,
  type WorkspaceSession,
} from './workspaceApi';
import { workspaceErrorDisplayMessage } from './workspaceErrorMessages';

export type MarkdownImageAttachmentTarget =
  | {
      readonly kind: 'segment';
      readonly memoryId: string;
      readonly segmentId: string;
    }
  | {
      readonly kind: 'segment-supplement';
      readonly memoryId: string;
      readonly segmentId: string;
      readonly supplementId: string;
    };

function imageAttachmentTargetKey({
  disabled,
  target,
  workspaceSession,
}: {
  readonly disabled: boolean;
  readonly target: MarkdownImageAttachmentTarget | null;
  readonly workspaceSession: WorkspaceSession;
}): string | null {
  if (disabled || !target) {
    return null;
  }
  const baseKey = `${workspaceSession.workspaceHandle}\0${workspaceSession.workspaceId}\0${target.memoryId}\0${target.segmentId}`;
  return target.kind === 'segment'
    ? `${baseKey}\0segment`
    : `${baseKey}\0segment-supplement\0${target.supplementId}`;
}

export function useMarkdownImageAttachment({
  disabled,
  onError,
  editorHandleRef,
  target,
  workspaceSession,
}: {
  readonly disabled: boolean;
  readonly editorHandleRef: RefObject<LightweightMarkdownEditorHandle | null>;
  readonly onError: (message: string | null) => void;
  readonly target: MarkdownImageAttachmentTarget | null;
  readonly workspaceSession: WorkspaceSession;
}) {
  const [pendingCount, setPendingCount] = useState(0);
  const pendingCountRef = useRef(0);
  const mountedRef = useRef(true);
  const currentTargetKey = imageAttachmentTargetKey({ disabled, target, workspaceSession });
  const currentTargetKeyRef = useRef(currentTargetKey);
  currentTargetKeyRef.current = currentTargetKey;
  const active = target !== null && !disabled;
  const pending = pendingCount > 0;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function beginPending() {
    pendingCountRef.current += 1;
    if (mountedRef.current) {
      setPendingCount(pendingCountRef.current);
    }
  }

  function endPending() {
    pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
    if (mountedRef.current) {
      setPendingCount(pendingCountRef.current);
    }
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (!active) {
      return;
    }
    if (readDroppedImageFile(event.dataTransfer)) {
      event.preventDefault();
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    if (!active) {
      return;
    }
    const file = readDroppedImageFile(event.dataTransfer);
    if (!file) {
      return;
    }
    event.preventDefault();
    void insertImageAttachment(file, 'dropped-image');
  }

  function handlePaste(event: ClipboardEvent<HTMLElement>) {
    if (!active) {
      return;
    }
    const file = readPastedImageFile(event.clipboardData);
    if (!file) {
      return;
    }
    event.preventDefault();
    void insertImageAttachment(file, 'pasted-image');
  }

  function insertFile(file: File) {
    if (!active) {
      return;
    }
    void insertImageAttachment(file, 'selected-image');
  }

  async function uploadFile(file: File, signal?: AbortSignal, fallbackStem = 'selected-image') {
    const insertionTargetKey = currentTargetKey;
    const uploadTarget = target;
    if (!uploadTarget || disabled || !insertionTargetKey || signal?.aborted) {
      return null;
    }

    onError(null);
    if (file.size > NOTE_ATTACHMENT_MAX_BYTES) {
      onError('无法插入图片附件。');
      return null;
    }

    beginPending();
    let payload: Uint8Array;
    try {
      payload = new Uint8Array(await file.arrayBuffer());
    } catch {
      onError('无法插入图片附件。');
      endPending();
      return null;
    }
    if (signal?.aborted) {
      endPending();
      return null;
    }
    if (currentTargetKeyRef.current !== insertionTargetKey) {
      onError('当前编辑区域已切换，图片未插入。');
      endPending();
      return null;
    }

    const basePayload = {
      workspaceHandle: workspaceSession.workspaceHandle,
      workspaceId: workspaceSession.workspaceId,
      memoryId: uploadTarget.memoryId,
      segmentId: uploadTarget.segmentId,
      originalFilename: attachmentOriginalFilename(file, fallbackStem),
      mimeType: file.type || 'application/octet-stream',
      payload,
    };
    const response = await (async () => {
      try {
        return uploadTarget.kind === 'segment'
          ? await saveSegmentAttachment(basePayload)
          : await saveSegmentSupplementAttachment({
              ...basePayload,
              supplementId: uploadTarget.supplementId,
            });
      } catch {
        return {
          ok: false,
          error: { code: 'ERR_ATTACHMENT_WRITE_FAILED', message: 'Attachment write failed.' },
        } as const;
      }
    })();

    if (signal?.aborted) {
      endPending();
      return null;
    }
    if (!response.ok) {
      onError(workspaceErrorDisplayMessage(response.error, '无法插入图片附件。'));
      endPending();
      return null;
    }
    if (currentTargetKeyRef.current !== insertionTargetKey) {
      onError('当前编辑区域已切换，图片未插入。');
      endPending();
      return null;
    }

    endPending();
    return response.value.relativePath;
  }

  async function insertImageAttachment(file: File, fallbackStem: string) {
    const editorHandle = editorHandleRef.current;
    if (!editorHandle) {
      return;
    }

    const insertionSelection = editorHandle.captureSelection();
    const relativePath = await uploadFile(file, undefined, fallbackStem);
    if (!relativePath) {
      return;
    }
    if (editorHandleRef.current !== editorHandle) {
      onError('当前编辑区域已切换，图片未插入。');
      return;
    }
    const alt = attachmentAltFromFilename(attachmentOriginalFilename(file, fallbackStem));
    const attachmentMarkdown = `![${alt}](${relativePath})`;
    editorHandle.insertMarkdown(attachmentMarkdown, insertionSelection);
  }

  return {
    handleDragOver,
    handleDrop,
    handlePaste,
    insertFile,
    pending,
    uploadFile,
  };
}

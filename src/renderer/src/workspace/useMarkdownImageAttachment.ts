import { useState, type ClipboardEvent, type DragEvent, type RefObject } from 'react';
import {
  attachmentAltFromFilename,
  attachmentOriginalFilename,
  insertMarkdownAtSelection,
  NOTE_ATTACHMENT_MAX_BYTES,
  readDroppedImageFile,
  readPastedImageFile,
} from './noteEditorModel';
import {
  saveSegmentAttachment,
  saveSegmentSupplementAttachment,
  type WorkspaceSession,
} from './workspaceApi';
import { restoreTextareaSelection } from './textareaSelection';
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

export function useMarkdownImageAttachment({
  disabled,
  onChange,
  onError,
  target,
  textareaRef,
  value,
  workspaceSession,
}: {
  readonly disabled: boolean;
  readonly onChange: (nextMarkdown: string) => void;
  readonly onError: (message: string | null) => void;
  readonly target: MarkdownImageAttachmentTarget | null;
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
  readonly value: string;
  readonly workspaceSession: WorkspaceSession;
}) {
  const [pending, setPending] = useState(false);
  const active = target !== null && !disabled && !pending;

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

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
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

  async function insertImageAttachment(file: File, fallbackStem: string) {
    if (!target || disabled || pending) {
      return;
    }

    onError(null);
    if (file.size > NOTE_ATTACHMENT_MAX_BYTES) {
      onError('无法插入图片附件。');
      return;
    }

    setPending(true);
    let payload: Uint8Array;
    try {
      payload = new Uint8Array(await file.arrayBuffer());
    } catch {
      onError('无法插入图片附件。');
      setPending(false);
      return;
    }

    const basePayload = {
      workspaceHandle: workspaceSession.workspaceHandle,
      workspaceId: workspaceSession.workspaceId,
      memoryId: target.memoryId,
      segmentId: target.segmentId,
      originalFilename: attachmentOriginalFilename(file, fallbackStem),
      mimeType: file.type || 'application/octet-stream',
      payload,
    };
    const response = await (async () => {
      try {
        return target.kind === 'segment'
          ? await saveSegmentAttachment(basePayload)
          : await saveSegmentSupplementAttachment({
              ...basePayload,
              supplementId: target.supplementId,
            });
      } catch {
        return {
          ok: false,
          error: { code: 'ERR_ATTACHMENT_WRITE_FAILED', message: 'Attachment write failed.' },
        } as const;
      }
    })();

    if (!response.ok) {
      onError(workspaceErrorDisplayMessage(response.error, '无法插入图片附件。'));
      setPending(false);
      return;
    }

    const alt = attachmentAltFromFilename(basePayload.originalFilename);
    const attachmentMarkdown = `![${alt}](${response.value.relativePath})`;
    const insertion = insertMarkdownAtSelection(value, attachmentMarkdown, textareaRef.current);
    onChange(insertion.markdown);
    setPending(false);
    restoreTextareaSelection(textareaRef, insertion.cursor, insertion.cursor);
  }

  return {
    handleDragOver,
    handleDrop,
    handlePaste,
    pending,
  };
}

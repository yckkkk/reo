import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  TITLEBAR_ACTION_RIGHT,
  TITLEBAR_CONTROL_GAP,
  TITLEBAR_CONTROL_LEFT,
  TITLEBAR_CONTROL_SIZE,
  TITLEBAR_CONTROL_TOP,
} from '../app-shell/appShellGeometry';
import {
  createNoteSegmentDraft,
  createSegmentSupplementNoteDraft,
  writeSegmentSupplementContent,
  finalizeNoteSegmentDraft,
  finalizeSegmentSupplementNoteDraft,
  saveSegmentAttachment,
  saveSegmentSupplementAttachment,
  writeSegmentContent,
  writeNoteSegmentDraftBody,
  writeSegmentSupplementNoteDraftBody,
  type FinalizedNoteSegment,
  type FinalizedSegmentSupplementNote,
  type WorkspaceNoteSegmentContent,
  type WorkspaceNoteSegmentSupplementContent,
  type WorkspaceSession,
} from './workspaceApi';
import { ImmersiveWorkspaceSurface } from './ImmersiveWorkspaceSurface';
import {
  attachmentAltFromFilename,
  attachmentOriginalFilename,
  createNoteContentCachePatch,
  insertMarkdownAtSelection,
  NOTE_ATTACHMENT_MAX_BYTES,
  noteEditorDisplayTitle,
  patchSegmentNoteContentCache,
  patchSegmentSupplementNoteContentCache,
  readDroppedImageFile,
  readLatestNoteEditorContent,
  readPastedImageFile,
  readStaleNoteContentConflict,
  targetIdentity,
  type NoteContentConflict,
  type NoteEditorTarget,
} from './noteEditorModel';
import { WorkspaceDangerConfirmDialog } from './WorkspaceDangerConfirmDialog';
import {
  segmentContentQueryKey,
  segmentContentQueryOptions,
  segmentSupplementContentQueryKey,
  segmentSupplementContentQueryOptions,
} from './workspaceQueries';
import { unknownErrorDisplayMessage, workspaceErrorDisplayMessage } from './workspaceErrorMessages';

type NoteDraftState =
  | {
      readonly kind: 'segment';
      readonly revision: number;
      readonly segmentId: string;
    }
  | {
      readonly kind: 'segment-supplement';
      readonly revision: number;
      readonly supplementId: string;
    };

type NoteEditorOverlayProps = {
  readonly onNoteSegmentContentSaved: (saved: {
    readonly bodyByteLength: number;
    readonly bodyMarkdown: string;
    readonly baselineContentHash: string;
    readonly memoryId: string;
    readonly segmentId: string;
    readonly title: string;
  }) => void;
  readonly onNoteSegmentSupplementContentSaved: (saved: {
    readonly bodyByteLength: number;
    readonly bodyMarkdown: string;
    readonly baselineContentHash: string;
    readonly memoryId: string;
    readonly segmentId: string;
    readonly supplementId: string;
    readonly title: string;
  }) => void;
  readonly onNoteSegmentFinalized: (finalized: FinalizedNoteSegment) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSegmentSupplementNoteFinalized: (finalized: FinalizedSegmentSupplementNote) => void;
  readonly open: boolean;
  readonly target: NoteEditorTarget | null;
  readonly workspaceSession: WorkspaceSession;
};

const NOTE_EDITOR_TITLEBAR_TITLE_LEFT =
  TITLEBAR_CONTROL_LEFT + TITLEBAR_CONTROL_SIZE + TITLEBAR_CONTROL_GAP;

export function NoteEditorOverlay({
  onNoteSegmentContentSaved,
  onNoteSegmentSupplementContentSaved,
  onNoteSegmentFinalized,
  onOpenChange,
  onSegmentSupplementNoteFinalized,
  open,
  target,
  workspaceSession,
}: NoteEditorOverlayProps) {
  const [bodyMarkdown, setBodyMarkdown] = useState('');
  const [draft, setDraft] = useState<NoteDraftState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [initialBodyMarkdown, setInitialBodyMarkdown] = useState('');
  const [baselineContentHash, setBaselineContentHash] = useState('');
  const [conflict, setConflict] = useState<NoteContentConflict | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [attachmentPending, setAttachmentPending] = useState(false);
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const activeTargetIdentity = useMemo(() => targetIdentity(target), [target]);
  const displayTitle = noteEditorDisplayTitle(target);
  const dirty = bodyMarkdown !== initialBodyMarkdown;
  const canAttachImage =
    target?.kind === 'edit-segment' || target?.kind === 'edit-segment-supplement';
  const segmentEditTarget = target?.kind === 'edit-segment' ? target : null;
  const supplementEditTarget = target?.kind === 'edit-segment-supplement' ? target : null;
  const segmentEditContentQuery = useQuery({
    ...segmentContentQueryOptions(
      workspaceSession,
      segmentEditTarget?.memoryId ?? '',
      segmentEditTarget?.segmentId ?? '',
      'note'
    ),
    enabled: open && segmentEditTarget !== null,
  });
  const supplementEditContentQuery = useQuery({
    ...segmentSupplementContentQueryOptions(
      workspaceSession,
      supplementEditTarget?.memoryId ?? '',
      supplementEditTarget?.segmentId ?? '',
      supplementEditTarget?.supplementId ?? '',
      'note'
    ),
    enabled: open && supplementEditTarget !== null,
  });
  const latestEditContent = readLatestNoteEditorContent(
    segmentEditTarget ? segmentEditContentQuery.data : supplementEditContentQuery.data
  );
  const [diskChangeNoticeVisible, setDiskChangeNoticeVisible] = useState(false);

  useEffect(() => {
    const nextBodyMarkdown =
      target?.kind === 'edit-segment' || target?.kind === 'edit-segment-supplement'
        ? target.bodyMarkdown
        : '';
    const nextBaselineContentHash =
      target?.kind === 'edit-segment' || target?.kind === 'edit-segment-supplement'
        ? target.baselineContentHash
        : '';
    setBodyMarkdown(nextBodyMarkdown);
    setInitialBodyMarkdown(nextBodyMarkdown);
    setBaselineContentHash(nextBaselineContentHash);
    setDraft(null);
    setDiscardConfirmOpen(false);
    setConflict(null);
    setErrorMessage(null);
    setAttachmentPending(false);
    setDiskChangeNoticeVisible(false);
  }, [activeTargetIdentity, target]);

  useEffect(() => {
    if (
      !target ||
      (target.kind !== 'edit-segment' && target.kind !== 'edit-segment-supplement') ||
      !latestEditContent
    ) {
      return;
    }

    if (latestEditContent.baselineContentHash === baselineContentHash) {
      setDiskChangeNoticeVisible(false);
      return;
    }

    if (dirty) {
      setDiskChangeNoticeVisible(true);
      return;
    }

    setBodyMarkdown(latestEditContent.bodyMarkdown);
    setInitialBodyMarkdown(latestEditContent.bodyMarkdown);
    setBaselineContentHash(latestEditContent.baselineContentHash);
    setDiskChangeNoticeVisible(false);
  }, [baselineContentHash, dirty, latestEditContent, target]);

  function cacheConflictDiskContent(nextBodyMarkdown: string, nextBaselineContentHash: string) {
    if (!target || (target.kind !== 'edit-segment' && target.kind !== 'edit-segment-supplement')) {
      return;
    }

    const cachePatch = createNoteContentCachePatch({
      baselineContentHash: nextBaselineContentHash,
      bodyMarkdown: nextBodyMarkdown,
      memoryId: target.memoryId,
      segmentId: target.segmentId,
      title: target.title,
      workspaceId: workspaceSession.workspaceId,
    });

    if (target.kind === 'edit-segment') {
      queryClient.setQueryData<WorkspaceNoteSegmentContent>(
        segmentContentQueryKey({
          workspaceId: workspaceSession.workspaceId,
          memoryId: target.memoryId,
          segmentId: target.segmentId,
        }),
        (current) =>
          patchSegmentNoteContentCache({
            cachePatch,
            current,
            segmentId: target.segmentId,
          })
      );
      return;
    }

    queryClient.setQueryData<WorkspaceNoteSegmentSupplementContent>(
      segmentSupplementContentQueryKey({
        workspaceId: workspaceSession.workspaceId,
        memoryId: target.memoryId,
        segmentId: target.segmentId,
        supplementId: target.supplementId,
      }),
      (current) =>
        patchSegmentSupplementNoteContentCache({
          cachePatch,
          current,
          supplementId: target.supplementId,
        })
    );
  }

  function requestClose() {
    if (pending || attachmentPending) {
      return;
    }
    if (dirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    onOpenChange(false);
  }

  function handleImmersiveWorkspaceSurfaceOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    requestClose();
  }

  function handleEditorDragOver(event: DragEvent<HTMLElement>) {
    if (!canAttachImage || pending || attachmentPending) {
      return;
    }
    if (readDroppedImageFile(event.dataTransfer)) {
      event.preventDefault();
    }
  }

  function handleEditorDrop(event: DragEvent<HTMLElement>) {
    if (!canAttachImage || pending || attachmentPending) {
      return;
    }
    const file = readDroppedImageFile(event.dataTransfer);
    if (!file) {
      return;
    }
    event.preventDefault();
    void insertImageAttachment(file, 'dropped-image');
  }

  function handleEditorPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (!canAttachImage || pending || attachmentPending) {
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
    if (!target || !canAttachImage) {
      return;
    }

    setErrorMessage(null);
    if (file.size > NOTE_ATTACHMENT_MAX_BYTES) {
      setErrorMessage('无法插入图片附件。');
      return;
    }

    setAttachmentPending(true);
    let payload: Uint8Array;
    try {
      payload = new Uint8Array(await file.arrayBuffer());
    } catch {
      setErrorMessage('无法插入图片附件。');
      setAttachmentPending(false);
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
        return target.kind === 'edit-segment'
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
      setErrorMessage(workspaceErrorDisplayMessage(response.error, '无法插入图片附件。'));
      setAttachmentPending(false);
      return;
    }

    const alt = attachmentAltFromFilename(basePayload.originalFilename);
    const attachmentMarkdown = `![${alt}](${response.value.relativePath})`;
    const insertion = insertMarkdownAtSelection(
      bodyMarkdown,
      attachmentMarkdown,
      textareaRef.current
    );
    setBodyMarkdown(insertion.markdown);
    setAttachmentPending(false);

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(insertion.cursor, insertion.cursor);
    });
  }

  async function saveNote(options: { readonly baselineContentHash?: string } = {}) {
    if (!target) {
      return;
    }

    try {
      if (target.kind === 'edit-segment') {
        setPending(true);
        setErrorMessage(null);
        const response = await writeSegmentContent({
          workspaceHandle: workspaceSession.workspaceHandle,
          workspaceId: workspaceSession.workspaceId,
          memoryId: target.memoryId,
          segmentId: target.segmentId,
          bodyMarkdown,
          baselineContentHash: options.baselineContentHash ?? baselineContentHash,
        });
        if (!response.ok) {
          const staleConflict = readStaleNoteContentConflict(response.error);
          if (staleConflict) {
            setConflict(staleConflict);
            setPending(false);
            return;
          }
          setErrorMessage(workspaceErrorDisplayMessage(response.error, '无法保存笔记正文。'));
          setPending(false);
          return;
        }
        onNoteSegmentContentSaved({
          memoryId: target.memoryId,
          segmentId: target.segmentId,
          title: target.title,
          bodyMarkdown,
          baselineContentHash: response.value.baselineContentHash,
          bodyByteLength: response.value.bodyByteLength,
        });
        setBaselineContentHash(response.value.baselineContentHash);
        setInitialBodyMarkdown(bodyMarkdown);
        onOpenChange(false);
        setPending(false);
        return;
      }

      if (target.kind === 'edit-segment-supplement') {
        setPending(true);
        setErrorMessage(null);
        const response = await writeSegmentSupplementContent({
          workspaceHandle: workspaceSession.workspaceHandle,
          workspaceId: workspaceSession.workspaceId,
          memoryId: target.memoryId,
          segmentId: target.segmentId,
          supplementId: target.supplementId,
          bodyMarkdown,
          baselineContentHash: options.baselineContentHash ?? baselineContentHash,
        });
        if (!response.ok) {
          const staleConflict = readStaleNoteContentConflict(response.error);
          if (staleConflict) {
            setConflict(staleConflict);
            setPending(false);
            return;
          }
          setErrorMessage(workspaceErrorDisplayMessage(response.error, '无法保存补充笔记正文。'));
          setPending(false);
          return;
        }
        onNoteSegmentSupplementContentSaved({
          memoryId: target.memoryId,
          segmentId: target.segmentId,
          supplementId: target.supplementId,
          title: target.title,
          bodyMarkdown,
          baselineContentHash: response.value.baselineContentHash,
          bodyByteLength: response.value.bodyByteLength,
        });
        setBaselineContentHash(response.value.baselineContentHash);
        setInitialBodyMarkdown(bodyMarkdown);
        onOpenChange(false);
        setPending(false);
        return;
      }

      setPending(true);
      setErrorMessage(null);

      let activeDraft = draft;

      if (!activeDraft) {
        if (target.kind === 'segment') {
          const createResponse = await createNoteSegmentDraft({
            workspaceHandle: workspaceSession.workspaceHandle,
            workspaceId: workspaceSession.workspaceId,
            memoryId: target.memoryId,
            title: target.title,
          });
          if (!createResponse.ok) {
            setErrorMessage(
              workspaceErrorDisplayMessage(createResponse.error, '无法创建笔记草稿。')
            );
            setPending(false);
            return;
          }
          activeDraft = {
            kind: 'segment',
            segmentId: createResponse.value.segmentId,
            revision: createResponse.value.revision,
          };
          setDraft(activeDraft);
        } else {
          const createResponse = await createSegmentSupplementNoteDraft({
            workspaceHandle: workspaceSession.workspaceHandle,
            workspaceId: workspaceSession.workspaceId,
            memoryId: target.memoryId,
            segmentId: target.segmentId,
            title: target.title,
          });
          if (!createResponse.ok) {
            setErrorMessage(
              workspaceErrorDisplayMessage(createResponse.error, '无法创建笔记草稿。')
            );
            setPending(false);
            return;
          }
          activeDraft = {
            kind: 'segment-supplement',
            supplementId: createResponse.value.supplementId,
            revision: createResponse.value.revision,
          };
          setDraft(activeDraft);
        }
      }

      if (target.kind === 'segment' && activeDraft.kind === 'segment') {
        const writeResponse = await writeNoteSegmentDraftBody({
          workspaceHandle: workspaceSession.workspaceHandle,
          segmentId: activeDraft.segmentId,
          bodyMarkdown,
          revision: activeDraft.revision,
        });
        if (!writeResponse.ok) {
          setErrorMessage(workspaceErrorDisplayMessage(writeResponse.error, '无法保存笔记正文。'));
          setPending(false);
          return;
        }
        activeDraft = {
          ...activeDraft,
          revision: writeResponse.value.revision,
        };
        setDraft(activeDraft);
        const finalizeResponse = await finalizeNoteSegmentDraft({
          workspaceHandle: workspaceSession.workspaceHandle,
          workspaceId: workspaceSession.workspaceId,
          memoryId: target.memoryId,
          segmentId: activeDraft.segmentId,
          title: target.title,
        });
        if (!finalizeResponse.ok) {
          setErrorMessage(
            workspaceErrorDisplayMessage(finalizeResponse.error, '无法完成笔记保存。')
          );
          setPending(false);
          return;
        }
        onNoteSegmentFinalized(finalizeResponse.value);
        setInitialBodyMarkdown(bodyMarkdown);
        onOpenChange(false);
        setPending(false);
        return;
      }

      if (target.kind === 'segment-supplement' && activeDraft.kind === 'segment-supplement') {
        const writeResponse = await writeSegmentSupplementNoteDraftBody({
          workspaceHandle: workspaceSession.workspaceHandle,
          supplementId: activeDraft.supplementId,
          bodyMarkdown,
          revision: activeDraft.revision,
        });
        if (!writeResponse.ok) {
          setErrorMessage(
            workspaceErrorDisplayMessage(writeResponse.error, '无法保存补充笔记正文。')
          );
          setPending(false);
          return;
        }
        activeDraft = {
          ...activeDraft,
          revision: writeResponse.value.revision,
        };
        setDraft(activeDraft);
        const finalizeResponse = await finalizeSegmentSupplementNoteDraft({
          workspaceHandle: workspaceSession.workspaceHandle,
          workspaceId: workspaceSession.workspaceId,
          memoryId: target.memoryId,
          segmentId: target.segmentId,
          supplementId: activeDraft.supplementId,
          title: target.title,
        });
        if (!finalizeResponse.ok) {
          setErrorMessage(
            workspaceErrorDisplayMessage(finalizeResponse.error, '无法完成补充笔记保存。')
          );
          setPending(false);
          return;
        }
        onSegmentSupplementNoteFinalized(finalizeResponse.value);
        setInitialBodyMarkdown(bodyMarkdown);
        onOpenChange(false);
        setPending(false);
      }
    } catch (error) {
      setErrorMessage(unknownErrorDisplayMessage(error, '无法保存笔记正文。'));
      setPending(false);
    }
  }

  return (
    <ImmersiveWorkspaceSurface
      closeBlocked={pending || attachmentPending}
      description={displayTitle}
      immersive
      onOpenChange={handleImmersiveWorkspaceSurfaceOpenChange}
      open={open}
      title="笔记"
    >
      <Button
        aria-label="返回"
        className="absolute z-10 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-100"
        data-vaul-no-drag
        disabled={pending}
        onClick={requestClose}
        size="icon"
        style={{ left: TITLEBAR_CONTROL_LEFT, top: TITLEBAR_CONTROL_TOP }}
        type="button"
        variant="ghostIcon"
      >
        <ChevronLeft aria-hidden="true" className="size-16" />
      </Button>
      <div
        className="absolute z-10 flex h-32 max-w-[calc(100vw-280px)] items-center text-body font-regular leading-body text-foreground"
        data-testid="note-editor-titlebar-title"
        style={{ left: NOTE_EDITOR_TITLEBAR_TITLE_LEFT, top: TITLEBAR_CONTROL_TOP }}
      >
        <h1 className="min-w-0 truncate">{displayTitle}</h1>
      </div>
      <div
        className="pointer-events-auto absolute z-10 flex items-center gap-8 [-webkit-app-region:no-drag]"
        data-testid="note-editor-titlebar-actions"
        data-vaul-no-drag
        style={{ right: TITLEBAR_ACTION_RIGHT, top: TITLEBAR_CONTROL_TOP }}
      >
        <Button
          type="button"
          size="compact"
          disabled={pending || attachmentPending || !target}
          onClick={() => void saveNote()}
        >
          保存笔记
        </Button>
      </div>

      <section
        aria-label="笔记编辑器"
        className="mx-auto grid h-[min(680px,calc(100dvh-104px))] w-full max-w-[960px] grid-rows-[minmax(0,1fr)_auto] gap-16 text-left"
        data-testid="note-editor-surface-stage"
      >
        <div
          className="min-h-0 overflow-hidden rounded-md bg-card"
          onDragOver={handleEditorDragOver}
          onDrop={handleEditorDrop}
        >
          {diskChangeNoticeVisible ? (
            <p
              role="status"
              className="border-b border-secondary px-20 py-10 text-ui-sm leading-ui-sm text-muted-foreground"
            >
              磁盘内容已变化。保存时将进行冲突检查。
            </p>
          ) : null}
          <Label htmlFor="note-editor-body" className="sr-only">
            笔记正文
          </Label>
          <Textarea
            ref={textareaRef}
            id="note-editor-body"
            className="h-full min-h-0 resize-none rounded-none border-0 bg-transparent px-20 py-4 font-mono text-body leading-[1.65] text-foreground shadow-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            disabled={pending || attachmentPending}
            onPaste={handleEditorPaste}
            value={bodyMarkdown}
            onChange={(event) => setBodyMarkdown(event.currentTarget.value)}
          />
        </div>

        <footer className="min-h-24">
          {errorMessage ? (
            <p role="status" className="text-ui-sm leading-ui-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
        </footer>
      </section>
      <WorkspaceDangerConfirmDialog
        confirmLabel="放弃"
        description="未保存的笔记正文会被丢弃。"
        disabled={pending || attachmentPending}
        onConfirm={() => {
          setDiscardConfirmOpen(false);
          onOpenChange(false);
        }}
        onOpenChange={setDiscardConfirmOpen}
        open={discardConfirmOpen}
        title="放弃未保存的笔记？"
      />
      <AlertDialog
        open={conflict !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setConflict(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>外部修改已检测</AlertDialogTitle>
            <AlertDialogDescription>
              磁盘内容已变化。请选择保留当前编辑，或使用磁盘版本。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending || !conflict}
              onClick={() => {
                if (!conflict) {
                  return;
                }
                cacheConflictDiskContent(
                  conflict.currentBodyMarkdown,
                  conflict.currentBaselineContentHash
                );
                setBodyMarkdown(conflict.currentBodyMarkdown);
                setInitialBodyMarkdown(conflict.currentBodyMarkdown);
                setBaselineContentHash(conflict.currentBaselineContentHash);
                setDiskChangeNoticeVisible(false);
                setErrorMessage(null);
                setConflict(null);
              }}
            >
              使用磁盘版本
            </AlertDialogAction>
            <AlertDialogAction
              disabled={pending || !conflict}
              onClick={() => {
                if (!conflict) {
                  return;
                }
                const nextBaselineContentHash = conflict.currentBaselineContentHash;
                cacheConflictDiskContent(conflict.currentBodyMarkdown, nextBaselineContentHash);
                setBaselineContentHash(nextBaselineContentHash);
                setConflict(null);
                void saveNote({ baselineContentHash: nextBaselineContentHash });
              }}
            >
              保留我的修改
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ImmersiveWorkspaceSurface>
  );
}

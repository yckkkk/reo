import { ChevronLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  TITLEBAR_CONTROL_GAP,
  TITLEBAR_CONTROL_LEFT,
  TITLEBAR_CONTROL_SIZE,
  TITLEBAR_CONTROL_TOP,
} from '../app-shell/appShellGeometry';
import {
  createNoteSegmentDraft,
  createSegmentSupplementNoteDraft,
  finalizeNoteSegmentDraft,
  finalizeSegmentSupplementNoteDraft,
  writeNoteSegmentDraftBody,
  writeSegmentSupplementNoteDraftBody,
  type FinalizedNoteSegment,
  type FinalizedSegmentSupplementNote,
  type WorkspaceSession,
} from './workspaceApi';
import { ImmersiveWorkspaceSurface } from './ImmersiveWorkspaceSurface';
import { LightweightMarkdownEditorSurface } from './LightweightMarkdownEditorSurface';
import { noteEditorDisplayTitle, targetIdentity, type NoteEditorTarget } from './noteEditorModel';
import { useLightweightMarkdownFormatting } from './useLightweightMarkdownFormatting';
import { WorkspaceDangerConfirmDialog } from './WorkspaceDangerConfirmDialog';
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
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const activeTargetIdentity = useMemo(() => targetIdentity(target), [target]);
  const displayTitle = noteEditorDisplayTitle(target);
  const bodyPlaceholder = target?.kind === 'segment-supplement' ? '写下补充笔记...' : '写下正文...';
  const dirty = bodyMarkdown !== initialBodyMarkdown;
  const applyMarkdownFormat = useLightweightMarkdownFormatting({
    disabled: pending,
    onChange: setBodyMarkdown,
    textareaRef,
    value: bodyMarkdown,
  });

  useEffect(() => {
    setBodyMarkdown('');
    setInitialBodyMarkdown('');
    setDraft(null);
    setDiscardConfirmOpen(false);
    setErrorMessage(null);
  }, [activeTargetIdentity]);

  useEffect(() => {
    if (!open || pending) {
      return;
    }

    const focusTimer = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [activeTargetIdentity, open, pending]);

  function requestClose() {
    if (pending) {
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

  async function saveNote() {
    if (!target) {
      return;
    }

    try {
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
      closeBlocked={pending}
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

      <section
        aria-label="笔记编辑器"
        className="mx-auto grid h-[min(680px,calc(100dvh-104px))] w-full max-w-[760px] grid-rows-[minmax(0,1fr)_auto] gap-16 text-left"
        data-testid="note-editor-surface-stage"
      >
        <LightweightMarkdownEditorSurface
          disabled={pending}
          headerLabel="Markdown 笔记"
          onChange={setBodyMarkdown}
          onFormat={applyMarkdownFormat}
          onSave={() => void saveNote()}
          placeholder={bodyPlaceholder}
          saveDisabled={pending || !target}
          saveLabel="保存笔记"
          surfaceTestId="note-editor-textarea-surface"
          textareaId="note-editor-body"
          textareaLabel="笔记正文"
          textareaRef={textareaRef}
          toolbarDisabled={pending}
          value={bodyMarkdown}
        />

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
        disabled={pending}
        onConfirm={() => {
          setDiscardConfirmOpen(false);
          onOpenChange(false);
        }}
        onOpenChange={setDiscardConfirmOpen}
        open={discardConfirmOpen}
        title="放弃未保存的笔记？"
      />
    </ImmersiveWorkspaceSurface>
  );
}

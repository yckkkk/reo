import { useEffect, useMemo, useRef, useState } from 'react';
import type { WorkspaceTiptapJsonContent } from '../../../workspace-contract/workspace-contract';
import { Button } from '@/components/ui/button';
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
import { ImmersiveWorkspaceTitlebar } from './ImmersiveWorkspaceTitlebar';
import {
  LightweightMarkdownEditorSurface,
  type LightweightMarkdownEditorHandle,
} from './LightweightMarkdownEditorSurface';
import { noteEditorDisplayTitle, targetIdentity, type NoteEditorTarget } from './noteEditorModel';
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
  readonly onExitAnimationEnd?: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSegmentSupplementNoteFinalized: (finalized: FinalizedSegmentSupplementNote) => void;
  readonly open: boolean;
  readonly target: NoteEditorTarget | null;
  readonly workspaceSession: WorkspaceSession;
};

function noteDraftBodyTiptapJsonKey(content: WorkspaceTiptapJsonContent | null): string {
  return content === null ? 'null' : JSON.stringify(content);
}

export function NoteEditorOverlay({
  onNoteSegmentFinalized,
  onExitAnimationEnd,
  onOpenChange,
  onSegmentSupplementNoteFinalized,
  open,
  target,
  workspaceSession,
}: NoteEditorOverlayProps) {
  const [bodyMarkdown, setBodyMarkdown] = useState('');
  const [bodyTiptapJson, setBodyTiptapJson] = useState<WorkspaceTiptapJsonContent | null>(null);
  const [draft, setDraft] = useState<NoteDraftState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [initialBodyMarkdown, setInitialBodyMarkdown] = useState('');
  const [initialBodyTiptapJsonKey, setInitialBodyTiptapJsonKey] = useState(
    noteDraftBodyTiptapJsonKey(null)
  );
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const editorHandleRef = useRef<LightweightMarkdownEditorHandle | null>(null);
  const activeTargetIdentity = useMemo(() => targetIdentity(target), [target]);
  const displayTitle = noteEditorDisplayTitle(target);
  const bodyPlaceholder = target?.kind === 'segment-supplement' ? '写下补充笔记...' : '写下正文...';
  const bodyTiptapJsonKey = useMemo(
    () => noteDraftBodyTiptapJsonKey(bodyTiptapJson),
    [bodyTiptapJson]
  );
  const dirty =
    bodyMarkdown !== initialBodyMarkdown || bodyTiptapJsonKey !== initialBodyTiptapJsonKey;

  useEffect(() => {
    setBodyMarkdown('');
    setBodyTiptapJson(null);
    setInitialBodyMarkdown('');
    setInitialBodyTiptapJsonKey(noteDraftBodyTiptapJsonKey(null));
    setDraft(null);
    setDiscardConfirmOpen(false);
    setErrorMessage(null);
  }, [activeTargetIdentity]);

  useEffect(() => {
    if (!open || pending) {
      return;
    }

    const focusTimer = window.setTimeout(() => editorHandleRef.current?.focus(), 0);
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
          ...(bodyTiptapJson ? { bodyTiptapJson } : {}),
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
        setInitialBodyTiptapJsonKey(bodyTiptapJsonKey);
        onOpenChange(false);
        setPending(false);
        return;
      }

      if (target.kind === 'segment-supplement' && activeDraft.kind === 'segment-supplement') {
        const writeResponse = await writeSegmentSupplementNoteDraftBody({
          workspaceHandle: workspaceSession.workspaceHandle,
          supplementId: activeDraft.supplementId,
          bodyMarkdown,
          ...(bodyTiptapJson ? { bodyTiptapJson } : {}),
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
        setInitialBodyTiptapJsonKey(bodyTiptapJsonKey);
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
      fill
      immersive
      onOpenChange={handleImmersiveWorkspaceSurfaceOpenChange}
      open={open}
      title="笔记"
      {...(onExitAnimationEnd ? { onExitAnimationEnd } : {})}
    >
      <ImmersiveWorkspaceTitlebar
        actions={
          <Button
            type="button"
            size="compact"
            disabled={pending || !target}
            onClick={() => void saveNote()}
          >
            保存笔记
          </Button>
        }
        actionsTestId="note-editor-titlebar-actions"
        onReturn={requestClose}
        returnDisabled={pending}
        title={displayTitle}
        titleAs="h1"
        titleTestId="note-editor-titlebar-title"
      />

      <section
        aria-label="笔记编辑器"
        className="grid min-h-0 w-full flex-1 grid-rows-[minmax(0,1fr)_auto] text-left"
        data-testid="note-editor-surface-stage"
      >
        <LightweightMarkdownEditorSurface
          bordered={false}
          disabled={pending}
          editorId="note-editor-body"
          editorLabel="笔记正文"
          editorHandleRef={editorHandleRef}
          headerLabel="Markdown 笔记"
          onChange={setBodyMarkdown}
          onRichChange={({ markdown, tiptapJson }) => {
            setBodyMarkdown(markdown);
            setBodyTiptapJson(tiptapJson);
          }}
          placeholder={bodyPlaceholder}
          readableWidth
          surfaceTestId="note-editor-text-surface"
          toolbarDisabled={pending}
          value={bodyMarkdown}
        />

        <footer>
          {errorMessage ? (
            <p role="status" className="px-24 py-8 text-ui-sm leading-ui-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
        </footer>
      </section>
      <WorkspaceDangerConfirmDialog
        confirmLabel="放弃"
        description="未保存的笔记正文会被丢弃。"
        disabled={pending}
        modalLayer="immersive"
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

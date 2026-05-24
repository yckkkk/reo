import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  TITLEBAR_CONTROL_GAP,
  TITLEBAR_CONTROL_LEFT,
  TITLEBAR_CONTROL_SIZE,
  TITLEBAR_CONTROL_TOP,
} from '../app-shell/appShellGeometry';
import { ImmersiveWorkspaceSurface } from './ImmersiveWorkspaceSurface';
import { LightweightMarkdownEditorSurface } from './LightweightMarkdownEditorSurface';
import type { SegmentTranscriptEditTarget } from './segmentActionTargets';
import { useLightweightMarkdownFormatting } from './useLightweightMarkdownFormatting';
import { WorkspaceDangerConfirmDialog } from './WorkspaceDangerConfirmDialog';
import { saveTranscript, type WorkspaceMemorySummary, type WorkspaceSession } from './workspaceApi';
import { unknownErrorDisplayMessage, workspaceErrorDisplayMessage } from './workspaceErrorMessages';

export type TranscriptEditorTarget = SegmentTranscriptEditTarget;

type TranscriptEditorOverlayProps = {
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: (saved: {
    readonly expectedSession: WorkspaceSession;
    readonly memory: WorkspaceMemorySummary;
    readonly memoryId: string;
    readonly segmentId: string;
  }) => void;
  readonly open: boolean;
  readonly target: TranscriptEditorTarget | null;
  readonly workspaceSession: WorkspaceSession;
};

const TRANSCRIPT_EDITOR_TITLEBAR_TITLE_LEFT =
  TITLEBAR_CONTROL_LEFT + TITLEBAR_CONTROL_SIZE + TITLEBAR_CONTROL_GAP;

export function TranscriptEditorOverlay({
  onOpenChange,
  onSaved,
  open,
  target,
  workspaceSession,
}: TranscriptEditorOverlayProps) {
  const [transcriptText, setTranscriptText] = useState('');
  const [initialTranscriptText, setInitialTranscriptText] = useState('');
  const [baselineTranscriptHash, setBaselineTranscriptHash] = useState('');
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dirty = transcriptText !== initialTranscriptText;
  const displayTitle = target?.title ?? '转录';
  const applyMarkdownFormat = useLightweightMarkdownFormatting({
    disabled: pending,
    onChange: setTranscriptText,
    textareaRef,
    value: transcriptText,
  });

  useEffect(() => {
    setTranscriptText(target?.transcriptText ?? '');
    setInitialTranscriptText(target?.transcriptText ?? '');
    setBaselineTranscriptHash(target?.baselineTranscriptHash ?? '');
    setDiscardConfirmOpen(false);
    setErrorMessage(null);
    setPending(false);
  }, [target]);

  useEffect(() => {
    if (!open || pending) {
      return;
    }

    const focusTimer = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open, pending, target]);

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

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    requestClose();
  }

  async function saveTranscriptEdit() {
    if (!target) {
      return;
    }
    setPending(true);
    setErrorMessage(null);
    try {
      const response = await saveTranscript({
        workspaceHandle: workspaceSession.workspaceHandle,
        memoryId: target.memoryId,
        segmentId: target.segmentId,
        markdown: transcriptText,
        baselineTranscriptHash,
      });
      if (!response.ok) {
        setErrorMessage(workspaceErrorDisplayMessage(response.error, '无法保存转录。'));
        setPending(false);
        return;
      }
      onSaved({
        expectedSession: workspaceSession,
        memory: response.value.memory,
        memoryId: target.memoryId,
        segmentId: target.segmentId,
      });
      setInitialTranscriptText(transcriptText);
      onOpenChange(false);
      setPending(false);
    } catch (error) {
      setErrorMessage(unknownErrorDisplayMessage(error, '无法保存转录。'));
      setPending(false);
    }
  }

  return (
    <ImmersiveWorkspaceSurface
      closeBlocked={pending}
      description={displayTitle}
      immersive
      onOpenChange={handleOpenChange}
      open={open}
      title="转录"
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
        data-testid="transcript-editor-titlebar-title"
        style={{ left: TRANSCRIPT_EDITOR_TITLEBAR_TITLE_LEFT, top: TITLEBAR_CONTROL_TOP }}
      >
        <h1 className="min-w-0 truncate">{displayTitle}</h1>
      </div>

      <section
        aria-label="转录编辑器"
        className="mx-auto grid h-[min(680px,calc(100dvh-104px))] w-full max-w-[760px] grid-rows-[minmax(0,1fr)_auto] gap-16 text-left"
        data-testid="transcript-editor-surface-stage"
      >
        <LightweightMarkdownEditorSurface
          disabled={pending}
          headerLabel="Markdown 转录"
          onChange={setTranscriptText}
          onFormat={applyMarkdownFormat}
          onSave={saveTranscriptEdit}
          placeholder="整理或修正转录文本..."
          saveDisabled={pending || !target}
          saveLabel="保存转录"
          surfaceTestId="transcript-editor-textarea-surface"
          textareaId="transcript-editor-body"
          textareaLabel="转录正文"
          textareaRef={textareaRef}
          toolbarDisabled={pending}
          value={transcriptText}
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
        description="未保存的转录正文会被丢弃。"
        disabled={pending}
        onConfirm={() => {
          setDiscardConfirmOpen(false);
          onOpenChange(false);
        }}
        onOpenChange={setDiscardConfirmOpen}
        open={discardConfirmOpen}
        title="放弃未保存的转录？"
      />
    </ImmersiveWorkspaceSurface>
  );
}

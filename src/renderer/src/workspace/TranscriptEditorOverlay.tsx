import { ChevronLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { ImmersiveWorkspaceSurface } from './ImmersiveWorkspaceSurface';
import type { SegmentTranscriptEditTarget } from './segmentActionTargets';
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
  const dirty = transcriptText !== initialTranscriptText;
  const displayTitle = target?.title ?? '转录';

  useEffect(() => {
    setTranscriptText(target?.transcriptText ?? '');
    setInitialTranscriptText(target?.transcriptText ?? '');
    setBaselineTranscriptHash(target?.baselineTranscriptHash ?? '');
    setDiscardConfirmOpen(false);
    setErrorMessage(null);
    setPending(false);
  }, [target]);

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
      <div
        className="pointer-events-auto absolute z-10 flex items-center gap-8 [-webkit-app-region:no-drag]"
        data-testid="transcript-editor-titlebar-actions"
        data-vaul-no-drag
        style={{ right: TITLEBAR_ACTION_RIGHT, top: TITLEBAR_CONTROL_TOP }}
      >
        <Button
          type="button"
          size="compact"
          disabled={pending || !target}
          onClick={saveTranscriptEdit}
        >
          保存转录
        </Button>
      </div>

      <section
        aria-label="转录编辑器"
        className="mx-auto grid h-[min(680px,calc(100dvh-104px))] w-full max-w-[960px] grid-rows-[minmax(0,1fr)_auto] gap-16 text-left"
        data-testid="transcript-editor-surface-stage"
      >
        <div className="min-h-0 overflow-hidden rounded-md bg-card">
          <Label htmlFor="transcript-editor-body" className="sr-only">
            转录正文
          </Label>
          <Textarea
            id="transcript-editor-body"
            className="h-full min-h-0 resize-none rounded-none border-0 bg-transparent px-20 py-4 font-mono text-body leading-[1.65] text-foreground shadow-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            disabled={pending}
            value={transcriptText}
            onChange={(event) => setTranscriptText(event.currentTarget.value)}
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

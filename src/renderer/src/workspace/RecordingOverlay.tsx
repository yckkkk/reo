import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  appendRecordingAudioChunk,
  createRecordingDraft,
  discardRecordingDraft,
  finalizeRecordingDraft,
  readRecordingAudioChunk,
  readRecordingAudioManifest,
  saveReflections,
  saveTranscript,
} from './workspaceApi';
import type { WorkspaceSession } from './workspaceApi';
import {
  createBrowserMediaRecorderAdapter,
  type RecordingMediaAdapter,
  type RecordingMediaController,
} from './mediaRecorderAdapter';
import {
  createInitialRecordingState,
  transitionRecordingState,
  type RecordingState,
} from './recordingMachine';

type FinalizedRecording = WorkspaceSession['snapshot']['recordings'][number];

type RecordingOverlayProps = {
  readonly mediaAdapter?: RecordingMediaAdapter;
  readonly onOpenChange: (open: boolean) => void;
  readonly onRecordingFinalized: (recording: FinalizedRecording) => void;
  readonly open: boolean;
  readonly workspaceSession: WorkspaceSession;
};

const AUTOSAVE_DELAY_MS = 300;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isBusy(state: RecordingState) {
  return (
    state.status === 'acquiring' ||
    state.status === 'recording' ||
    state.status === 'paused' ||
    state.status === 'stopping'
  );
}

function titleForRecording(workspaceTitle: string) {
  return `${workspaceTitle} recording`;
}

export function RecordingOverlay({
  mediaAdapter,
  onOpenChange,
  onRecordingFinalized,
  open,
  workspaceSession,
}: RecordingOverlayProps) {
  const [state, setState] = useState<RecordingState>(() => createInitialRecordingState());
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [transcriptDraft, setTranscriptDraft] = useState('');
  const [reflectionsDraft, setReflectionsDraft] = useState('');
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const appendQueueRef = useRef<Promise<void>>(Promise.resolve());
  const controllerRef = useRef<RecordingMediaController | null>(null);
  const activeDraftRef = useRef<{
    readonly recordingId: string;
    readonly recordingSession: number;
  } | null>(null);
  const lastSavedTranscriptRef = useRef('');
  const lastSavedReflectionsRef = useRef('');
  const appendFailureRef = useRef<string | null>(null);
  const recordingSessionRef = useRef(0);
  const sequenceRef = useRef(0);

  useEffect(() => {
    if (state.status !== 'recording') {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => {
        const next = current + 1;
        setTranscriptDraft((draft) => {
          const line = `Mock transcript ${next}s`;
          return draft ? `${draft}\n${line}` : line;
        });
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [state.status]);

  useEffect(() => {
    if (state.status !== 'editing' || transcriptDraft === lastSavedTranscriptRef.current) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      void saveTranscript({
        markdown: transcriptDraft,
        recordingId: state.recordingId,
        workspaceHandle: workspaceSession.workspaceHandle,
      }).then((response) => {
        if (response.ok) {
          lastSavedTranscriptRef.current = transcriptDraft;
          setError(null);
        } else {
          setError(response.error.message);
        }
      });
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [state, transcriptDraft, workspaceSession.workspaceHandle]);

  useEffect(() => {
    if (state.status !== 'editing' || reflectionsDraft === lastSavedReflectionsRef.current) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      void saveReflections({
        markdown: reflectionsDraft,
        recordingId: state.recordingId,
        workspaceHandle: workspaceSession.workspaceHandle,
      }).then((response) => {
        if (response.ok) {
          lastSavedReflectionsRef.current = reflectionsDraft;
          setError(null);
        } else {
          setError(response.error.message);
        }
      });
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [reflectionsDraft, state, workspaceSession.workspaceHandle]);

  useEffect(() => {
    return () => {
      if (playbackUrl) {
        URL.revokeObjectURL(playbackUrl);
      }
    };
  }, [playbackUrl]);

  function discardActiveDraft(recordingSession: number) {
    const activeDraft = activeDraftRef.current;
    if (!activeDraft || activeDraft.recordingSession !== recordingSession) {
      return;
    }
    activeDraftRef.current = null;
    void Promise.resolve(
      discardRecordingDraft({
        recordingId: activeDraft.recordingId,
        workspaceHandle: workspaceSession.workspaceHandle,
      })
    ).catch(() => {});
  }

  function failActiveRecording(
    message: string,
    recordingSession: number,
    { discardDraft = false }: { readonly discardDraft?: boolean } = {}
  ) {
    if (recordingSessionRef.current !== recordingSession) {
      return;
    }
    recordingSessionRef.current += 1;
    appendFailureRef.current = message;
    const controller = controllerRef.current;
    controllerRef.current = null;
    void controller?.stop().catch(() => {});
    if (discardDraft) {
      discardActiveDraft(recordingSession);
    }
    setState({ message, status: 'failed' });
    setError(message);
  }

  function appendChunk(recordingId: string, recordingSession: number, chunk: Uint8Array) {
    if (recordingSessionRef.current !== recordingSession) {
      return;
    }
    appendQueueRef.current = appendQueueRef.current.then(async () => {
      try {
        if (recordingSessionRef.current !== recordingSession) {
          return;
        }
        const response = await appendRecordingAudioChunk({
          chunk,
          recordingId,
          sequence: sequenceRef.current,
          workspaceHandle: workspaceSession.workspaceHandle,
        });
        if (recordingSessionRef.current !== recordingSession) {
          return;
        }
        if (!response.ok) {
          appendFailureRef.current = response.error.message;
          failActiveRecording(response.error.message, recordingSession, { discardDraft: true });
          throw new Error(response.error.message);
        }
        sequenceRef.current = response.value.nextSequence;
      } catch (appendError) {
        if (recordingSessionRef.current !== recordingSession) {
          return;
        }
        const message =
          appendFailureRef.current ?? errorMessage(appendError, 'Audio append failed');
        appendFailureRef.current = message;
        failActiveRecording(message, recordingSession, { discardDraft: true });
        throw appendError;
      }
    });
    // Keep the queue rejected for handleStop while preventing an unhandled rejection.
    void appendQueueRef.current.catch(() => {});
  }

  async function handleStart() {
    setError(null);
    appendFailureRef.current = null;
    appendQueueRef.current = Promise.resolve();
    controllerRef.current = null;
    setElapsedSeconds(0);
    setTranscriptDraft('');
    setReflectionsDraft('');
    lastSavedTranscriptRef.current = '';
    lastSavedReflectionsRef.current = '';
    const recordingSession = recordingSessionRef.current + 1;
    recordingSessionRef.current = recordingSession;
    setState((current) => transitionRecordingState(current, { type: 'start-requested' }));

    const draft = await createRecordingDraft({
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    if (!draft.ok) {
      failActiveRecording(draft.error.message, recordingSession);
      return;
    }

    sequenceRef.current = draft.value.nextSequence;
    const nextRecordingId = draft.value.recordingId;
    activeDraftRef.current = { recordingId: nextRecordingId, recordingSession };

    try {
      const activeMediaAdapter = mediaAdapter ?? createBrowserMediaRecorderAdapter();
      const controller = await activeMediaAdapter.start({
        onChunk: (chunk) => appendChunk(nextRecordingId, recordingSession, chunk),
        onError: (message) => {
          failActiveRecording(message, recordingSession, { discardDraft: true });
        },
        onStop: () => {},
      });
      if (recordingSessionRef.current !== recordingSession) {
        await controller.stop().catch(() => {});
        return;
      }
      controllerRef.current = controller;
      setState((current) =>
        transitionRecordingState(current, { recordingId: nextRecordingId, type: 'draft-ready' })
      );
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : 'Microphone unavailable';
      failActiveRecording(message, recordingSession, { discardDraft: true });
    }
  }

  function handlePause() {
    controllerRef.current?.pause();
    setState((current) => transitionRecordingState(current, { type: 'pause-requested' }));
  }

  function handleResume() {
    controllerRef.current?.resume();
    setState((current) => transitionRecordingState(current, { type: 'resume-requested' }));
  }

  async function handleStop() {
    if (state.status !== 'recording' && state.status !== 'paused') {
      return;
    }

    const recordingId = state.recordingId;
    const recordingSession = recordingSessionRef.current;
    const controller = controllerRef.current;
    if (!controller || appendFailureRef.current) {
      return;
    }
    setState((current) => transitionRecordingState(current, { type: 'stop-requested' }));
    try {
      await controller.stop();
      await appendQueueRef.current;
    } catch (stopError) {
      const message =
        appendFailureRef.current ?? errorMessage(stopError, 'Recording audio could not be saved');
      failActiveRecording(message, recordingSession, { discardDraft: true });
      return;
    }
    if (recordingSessionRef.current !== recordingSession) {
      return;
    }

    const title = titleForRecording(workspaceSession.snapshot.title);
    let finalized: Awaited<ReturnType<typeof finalizeRecordingDraft>>;
    try {
      finalized = await finalizeRecordingDraft({
        recordingId,
        title,
        workspaceHandle: workspaceSession.workspaceHandle,
      });
    } catch (finalizeError) {
      const message = errorMessage(finalizeError, 'Recording draft could not be finalized');
      failActiveRecording(message, recordingSession);
      return;
    }
    if (!finalized.ok) {
      failActiveRecording(finalized.error.message, recordingSession);
      return;
    }

    recordingSessionRef.current += 1;
    controllerRef.current = null;
    activeDraftRef.current = null;
    const nextTranscript = transcriptDraft.trim()
      ? transcriptDraft
      : 'Local mock transcript. Replace this draft with your own notes.';
    setTranscriptDraft(nextTranscript);
    lastSavedTranscriptRef.current = nextTranscript;
    lastSavedReflectionsRef.current = '';
    setState((current) =>
      transitionRecordingState(current, {
        recordingId,
        title: finalized.value.title,
        type: 'finalized',
      })
    );
    onRecordingFinalized(finalized.value);
  }

  async function handlePlay() {
    if (state.status !== 'editing') {
      return;
    }

    setError(null);
    if (playbackUrl) {
      URL.revokeObjectURL(playbackUrl);
      setPlaybackUrl(null);
    }

    const manifest = await readRecordingAudioManifest({
      recordingId: state.recordingId,
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    if (!manifest.ok) {
      setError(manifest.error.message);
      return;
    }

    const chunks: Uint8Array[] = [];
    for (let offset = 0; offset < manifest.value.byteLength; ) {
      const length = Math.min(manifest.value.maxChunkBytes, manifest.value.byteLength - offset);
      const response = await readRecordingAudioChunk({
        length,
        offset,
        recordingId: state.recordingId,
        workspaceHandle: workspaceSession.workspaceHandle,
      });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      chunks.push(response.value.chunk);
      offset += length;
    }

    const blobParts = chunks.map((chunk): BlobPart => {
      const copy = new Uint8Array(chunk.byteLength);
      copy.set(chunk);
      return copy.buffer as ArrayBuffer;
    });
    setPlaybackUrl(URL.createObjectURL(new Blob(blobParts, { type: 'audio/webm' })));
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isBusy(state)) {
      return;
    }
    onOpenChange(nextOpen);
  }

  const canClose = !isBusy(state);
  const isEditing = state.status === 'editing';
  const latestTranscript = transcriptDraft.split('\n').filter(Boolean).at(-1);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby="recording-description">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit recording' : 'Recording'}</DialogTitle>
          <DialogDescription id="recording-description">
            Record local audio, then edit the local transcript and reflections draft.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-24 flex flex-col gap-20">
          {error ? (
            <p role="alert" className="text-body leading-body text-ember">
              {error}
            </p>
          ) : null}

          {!isEditing ? (
            <div className="flex flex-col gap-16">
              <p className="text-body leading-body text-gravel">
                Status: {state.status}. Elapsed: {elapsedSeconds}s.
              </p>
              {latestTranscript ? (
                <p className="border border-chalk bg-card-white px-16 py-12 text-body leading-body text-cinder">
                  {latestTranscript}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-12">
                {state.status === 'idle' || state.status === 'failed' ? (
                  <Button type="button" variant="primary" onClick={handleStart}>
                    Start recording
                  </Button>
                ) : null}
                {state.status === 'recording' ? (
                  <Button type="button" variant="secondary" onClick={handlePause}>
                    Pause recording
                  </Button>
                ) : null}
                {state.status === 'paused' ? (
                  <Button type="button" variant="secondary" onClick={handleResume}>
                    Resume recording
                  </Button>
                ) : null}
                {state.status === 'recording' || state.status === 'paused' ? (
                  <Button type="button" variant="default" onClick={handleStop}>
                    Stop recording
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-16">
              <div className="flex flex-col gap-8">
                <Label htmlFor="recording-transcript">Transcript</Label>
                <Textarea
                  id="recording-transcript"
                  value={transcriptDraft}
                  onChange={(event) => setTranscriptDraft(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-8">
                <Label htmlFor="recording-reflections">Reflections</Label>
                <Textarea
                  id="recording-reflections"
                  value={reflectionsDraft}
                  onChange={(event) => setReflectionsDraft(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-12">
                <Button type="button" variant="secondary" onClick={handlePlay}>
                  Play recording
                </Button>
                {playbackUrl ? (
                  <audio aria-label="Recording playback" controls src={playbackUrl} />
                ) : null}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <DialogClose asChild disabled={!canClose}>
              <Button type="button" variant="secondary" disabled={!canClose}>
                Close recording panel
              </Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

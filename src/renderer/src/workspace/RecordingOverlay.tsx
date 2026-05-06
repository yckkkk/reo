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
  const lastSavedTranscriptRef = useRef('');
  const lastSavedReflectionsRef = useRef('');
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

  function appendChunk(recordingId: string, chunk: Uint8Array) {
    appendQueueRef.current = appendQueueRef.current.then(async () => {
      const response = await appendRecordingAudioChunk({
        chunk,
        recordingId,
        sequence: sequenceRef.current,
        workspaceHandle: workspaceSession.workspaceHandle,
      });
      if (response.ok) {
        sequenceRef.current = response.value.nextSequence;
      } else {
        setError(response.error.message);
      }
    });
  }

  async function handleStart() {
    setError(null);
    setState((current) => transitionRecordingState(current, { type: 'start-requested' }));

    const draft = await createRecordingDraft({
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    if (!draft.ok) {
      setState({ message: draft.error.message, status: 'failed' });
      setError(draft.error.message);
      return;
    }

    sequenceRef.current = draft.value.nextSequence;
    const nextRecordingId = draft.value.recordingId;
    setState((current) =>
      transitionRecordingState(current, { recordingId: nextRecordingId, type: 'draft-ready' })
    );

    try {
      const activeMediaAdapter = mediaAdapter ?? createBrowserMediaRecorderAdapter();
      controllerRef.current = await activeMediaAdapter.start({
        onChunk: (chunk) => appendChunk(nextRecordingId, chunk),
        onError: (message) => {
          setState({ message, status: 'failed' });
          setError(message);
        },
        onStop: () => {},
      });
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : 'Microphone unavailable';
      setState({ message, status: 'failed' });
      setError(message);
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
    setState((current) => transitionRecordingState(current, { type: 'stop-requested' }));
    await controllerRef.current?.stop();
    await appendQueueRef.current;

    const title = titleForRecording(workspaceSession.snapshot.title);
    const finalized = await finalizeRecordingDraft({
      recordingId,
      title,
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    if (!finalized.ok) {
      setState({ message: finalized.error.message, status: 'failed' });
      setError(finalized.error.message);
      return;
    }

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

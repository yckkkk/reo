import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  appendRecordingAudioChunk,
  beginMicrophoneIntent,
  clearMicrophoneIntent,
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
import { RecordAudioDrawer } from './recording/RecordAudioDrawer';
import { RecordingPlayback } from './recording/RecordingPlayback';
import { RecordingControls } from './recording/RecordingControls';
import { RecordingWaveform } from './recording/RecordingWaveform';
import { TranscriptReflectionsEditor } from './recording/TranscriptReflectionsEditor';
import {
  createInitialRecordingState,
  isRecordingCloseBlocked,
  transitionRecordingState,
  type RecordingState,
} from './recordingMachine';
import { unknownErrorDisplayMessage, workspaceErrorDisplayMessage } from './workspaceErrorMessages';

type FinalizedRecording = Extract<
  Awaited<ReturnType<typeof finalizeRecordingDraft>>,
  { readonly ok: true }
>['value'];

type RecordingOverlayProps = {
  readonly mediaAdapter?: RecordingMediaAdapter;
  readonly onOpenChange: (open: boolean) => void;
  readonly onRecordingFinalized: (recording: FinalizedRecording) => void;
  readonly open: boolean;
  readonly recordingTarget: RecordingTarget;
  readonly workspaceSession: WorkspaceSession;
};

export type RecordingTarget =
  | { readonly kind: 'new-memory' }
  | { readonly kind: 'existing-memory'; readonly memoryId: string };

const AUTOSAVE_DELAY_MS = 300;
const PLAYBACK_CHUNK_CONCURRENCY = 4;

function errorMessage(error: unknown, fallback: string) {
  return unknownErrorDisplayMessage(error, fallback);
}

function titleForRecording(workspaceTitle: string) {
  return `${workspaceTitle} 录音`;
}

const RECORDING_STATUS_TEXT = {
  'acquiring-permission': '正在准备麦克风权限。',
  editing: '录音已保存。关闭前可以编辑草稿。',
  failed: '录音没有保存。',
  finalizing: '正在保存本地音频。',
  idle: '可以开始录制本地音频。',
  paused: '录音已暂停。',
  recording: '正在录制本地音频。',
} satisfies Record<RecordingState['status'], string>;

function statusTextFor(state: RecordingState): string {
  return RECORDING_STATUS_TEXT[state.status];
}

export function RecordingOverlay({
  mediaAdapter,
  onOpenChange,
  onRecordingFinalized,
  open,
  recordingTarget,
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
  const pendingMicrophoneIntentRef = useRef<{
    readonly drawerSessionId: string;
    readonly recordingSession: number;
    readonly workspaceHandle: string;
  } | null>(null);
  const playbackSessionRef = useRef(0);
  const lastSavedTranscriptRef = useRef('');
  const lastSavedReflectionsRef = useRef('');
  const appendFailureRef = useRef<string | null>(null);
  const recordingDurationRef = useRef<{
    accumulatedMs: number;
    startedAtMs: number | null;
  }>({ accumulatedMs: 0, startedAtMs: null });
  const recordingSessionRef = useRef(0);
  const sequenceRef = useRef(0);

  useEffect(() => {
    if (state.status !== 'recording') {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [state.status]);

  useEffect(() => {
    if (state.status !== 'editing' || transcriptDraft === lastSavedTranscriptRef.current) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      const saveSession = recordingSessionRef.current;
      void saveTranscript({
        markdown: transcriptDraft,
        memoryId: state.memoryId,
        recordingId: state.recordingId,
        workspaceHandle: workspaceSession.workspaceHandle,
      }).then((response) => {
        if (recordingSessionRef.current !== saveSession) {
          return;
        }
        if (response.ok) {
          lastSavedTranscriptRef.current = transcriptDraft;
          setError(null);
        } else {
          setError(workspaceErrorDisplayMessage(response.error, '无法保存转写。'));
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
      const saveSession = recordingSessionRef.current;
      void saveReflections({
        markdown: reflectionsDraft,
        memoryId: state.memoryId,
        recordingId: state.recordingId,
        workspaceHandle: workspaceSession.workspaceHandle,
      }).then((response) => {
        if (recordingSessionRef.current !== saveSession) {
          return;
        }
        if (response.ok) {
          lastSavedReflectionsRef.current = reflectionsDraft;
          setError(null);
        } else {
          setError(workspaceErrorDisplayMessage(response.error, '无法保存反思。'));
        }
      });
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [reflectionsDraft, state, workspaceSession.workspaceHandle]);

  useEffect(() => {
    return () => {
      playbackSessionRef.current += 1;
      recordingSessionRef.current += 1;
      const pendingMicrophoneIntent = pendingMicrophoneIntentRef.current;
      pendingMicrophoneIntentRef.current = null;
      if (pendingMicrophoneIntent) {
        void clearMicrophoneIntent({
          drawerSessionId: pendingMicrophoneIntent.drawerSessionId,
          workspaceHandle: pendingMicrophoneIntent.workspaceHandle,
        });
      }
      const controller = controllerRef.current;
      controllerRef.current = null;
      if (controller) {
        void Promise.resolve(controller.stop()).catch(() => {});
      }
      const activeDraft = activeDraftRef.current;
      activeDraftRef.current = null;
      if (activeDraft) {
        void discardRecordingDraft({
          recordingId: activeDraft.recordingId,
          workspaceHandle: workspaceSession.workspaceHandle,
        });
      }
    };
  }, [workspaceSession.workspaceHandle]);

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

  function clearPendingMicrophoneIntent(recordingSession: number) {
    const pendingMicrophoneIntent = pendingMicrophoneIntentRef.current;
    if (!pendingMicrophoneIntent || pendingMicrophoneIntent.recordingSession !== recordingSession) {
      return;
    }
    pendingMicrophoneIntentRef.current = null;
    void clearMicrophoneIntent({
      drawerSessionId: pendingMicrophoneIntent.drawerSessionId,
      workspaceHandle: pendingMicrophoneIntent.workspaceHandle,
    });
  }

  function forgetPendingMicrophoneIntent(recordingSession: number) {
    if (pendingMicrophoneIntentRef.current?.recordingSession === recordingSession) {
      pendingMicrophoneIntentRef.current = null;
    }
  }

  function resetRecordingDurationClock(startedAtMs: number | null = null) {
    recordingDurationRef.current = { accumulatedMs: 0, startedAtMs };
  }

  function pauseRecordingDurationClock() {
    const clock = recordingDurationRef.current;
    if (clock.startedAtMs === null) {
      return;
    }
    recordingDurationRef.current = {
      accumulatedMs: clock.accumulatedMs + Math.max(0, performance.now() - clock.startedAtMs),
      startedAtMs: null,
    };
  }

  function resumeRecordingDurationClock() {
    const clock = recordingDurationRef.current;
    if (clock.startedAtMs !== null) {
      return;
    }
    recordingDurationRef.current = {
      accumulatedMs: clock.accumulatedMs,
      startedAtMs: performance.now(),
    };
  }

  function readRecordingDurationMs() {
    const clock = recordingDurationRef.current;
    const activeMs =
      clock.startedAtMs === null ? 0 : Math.max(0, performance.now() - clock.startedAtMs);
    return Math.round(clock.accumulatedMs + activeMs);
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
    setState((current) => transitionRecordingState(current, { type: 'failed' }));
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
          const message = workspaceErrorDisplayMessage(response.error, '音频写入失败。');
          appendFailureRef.current = message;
          failActiveRecording(message, recordingSession, { discardDraft: true });
          throw new Error(message);
        }
        sequenceRef.current = response.value.nextSequence;
      } catch (appendError) {
        if (recordingSessionRef.current !== recordingSession) {
          return;
        }
        const message = appendFailureRef.current ?? errorMessage(appendError, '音频写入失败。');
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
    resetRecordingDurationClock();
    const recordingSession = recordingSessionRef.current + 1;
    const drawerSessionId = `recording-${recordingSession}`;
    recordingSessionRef.current = recordingSession;
    setState((current) =>
      transitionRecordingState(current, {
        type: 'start-requested',
      })
    );

    const microphoneIntent = await beginMicrophoneIntent({
      drawerSessionId,
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    if (!microphoneIntent.ok) {
      failActiveRecording(
        workspaceErrorDisplayMessage(microphoneIntent.error, '无法使用麦克风。'),
        recordingSession
      );
      return;
    }
    if (recordingSessionRef.current !== recordingSession) {
      void clearMicrophoneIntent({
        drawerSessionId,
        workspaceHandle: workspaceSession.workspaceHandle,
      });
      return;
    }
    pendingMicrophoneIntentRef.current = {
      drawerSessionId,
      recordingSession,
      workspaceHandle: workspaceSession.workspaceHandle,
    };

    const draft = await createRecordingDraft({
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    if (!draft.ok) {
      clearPendingMicrophoneIntent(recordingSession);
      failActiveRecording(
        workspaceErrorDisplayMessage(draft.error, '无法创建录音。'),
        recordingSession
      );
      return;
    }

    sequenceRef.current = draft.value.nextSequence;
    const nextRecordingId = draft.value.recordingId;
    if (recordingSessionRef.current !== recordingSession) {
      clearPendingMicrophoneIntent(recordingSession);
      void discardRecordingDraft({
        recordingId: nextRecordingId,
        workspaceHandle: workspaceSession.workspaceHandle,
      });
      return;
    }
    activeDraftRef.current = { recordingId: nextRecordingId, recordingSession };

    try {
      const activeMediaAdapter = mediaAdapter ?? createBrowserMediaRecorderAdapter();
      const controller = await activeMediaAdapter.start({
        onChunk: (chunk) => appendChunk(nextRecordingId, recordingSession, chunk),
        onError: (message) => {
          failActiveRecording(
            workspaceErrorDisplayMessage({ message }, '无法使用麦克风。'),
            recordingSession,
            { discardDraft: true }
          );
        },
        onStop: () => {},
      });
      if (recordingSessionRef.current !== recordingSession) {
        clearPendingMicrophoneIntent(recordingSession);
        await controller.stop().catch(() => {});
        return;
      }
      forgetPendingMicrophoneIntent(recordingSession);
      resetRecordingDurationClock(performance.now());
      controllerRef.current = controller;
      setState((current) =>
        transitionRecordingState(current, { recordingId: nextRecordingId, type: 'draft-ready' })
      );
    } catch (startError) {
      clearPendingMicrophoneIntent(recordingSession);
      const message = errorMessage(startError, '无法使用麦克风。');
      failActiveRecording(message, recordingSession, { discardDraft: true });
    }
  }

  function handlePause() {
    pauseRecordingDurationClock();
    controllerRef.current?.pause();
    setState((current) => transitionRecordingState(current, { type: 'pause-requested' }));
  }

  function handleResume() {
    resumeRecordingDurationClock();
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
    const durationMs = readRecordingDurationMs();
    pauseRecordingDurationClock();
    setState((current) => transitionRecordingState(current, { type: 'stop-requested' }));
    try {
      await controller.stop();
      await appendQueueRef.current;
    } catch (stopError) {
      const message = appendFailureRef.current ?? errorMessage(stopError, '录音音频无法保存。');
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
        durationMs,
        ...(recordingTarget.kind === 'existing-memory'
          ? { memoryId: recordingTarget.memoryId }
          : {}),
        recordingId,
        title,
        workspaceHandle: workspaceSession.workspaceHandle,
      });
    } catch (finalizeError) {
      const message = errorMessage(finalizeError, '录音草稿无法完成保存。');
      failActiveRecording(message, recordingSession);
      return;
    }
    if (!finalized.ok) {
      failActiveRecording(
        workspaceErrorDisplayMessage(finalized.error, '无法完成录音保存。'),
        recordingSession
      );
      return;
    }

    recordingSessionRef.current += 1;
    controllerRef.current = null;
    activeDraftRef.current = null;
    lastSavedTranscriptRef.current = transcriptDraft;
    lastSavedReflectionsRef.current = reflectionsDraft;
    setState((current) =>
      transitionRecordingState(current, {
        memoryId: finalized.value.recording.memoryId,
        recordingId,
        title: finalized.value.recording.title,
        type: 'finalized',
      })
    );
    onRecordingFinalized(finalized.value);
  }

  const handleLoadPlayback = useCallback(async () => {
    if (state.status !== 'editing') {
      return;
    }

    const playbackSession = playbackSessionRef.current + 1;
    playbackSessionRef.current = playbackSession;
    setError(null);
    setPlaybackUrl(null);

    const manifest = await readRecordingAudioManifest({
      memoryId: state.memoryId,
      recordingId: state.recordingId,
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    if (playbackSessionRef.current !== playbackSession) {
      return;
    }
    if (!manifest.ok) {
      setError(workspaceErrorDisplayMessage(manifest.error, '无法加载录音音频。'));
      return;
    }

    const recordingId = state.recordingId;
    const memoryId = state.memoryId;
    const { byteLength, maxChunkBytes } = manifest.value;
    const chunkCount = Math.ceil(byteLength / maxChunkBytes);
    const chunks = new Array<Uint8Array>(chunkCount);
    let nextChunkIndex = 0;
    let playbackFailed = false;

    async function readNextChunk() {
      while (nextChunkIndex < chunkCount && !playbackFailed) {
        if (playbackSessionRef.current !== playbackSession) {
          return;
        }
        const chunkIndex = nextChunkIndex;
        nextChunkIndex += 1;
        const offset = chunkIndex * maxChunkBytes;
        const length = Math.min(maxChunkBytes, byteLength - offset);
        const response = await readRecordingAudioChunk({
          length,
          memoryId,
          offset,
          recordingId,
          workspaceHandle: workspaceSession.workspaceHandle,
        });
        if (playbackFailed) {
          return;
        }
        if (!response.ok) {
          playbackFailed = true;
          throw new Error(workspaceErrorDisplayMessage(response.error, '无法加载录音音频。'));
        }
        if (playbackSessionRef.current !== playbackSession) {
          return;
        }
        chunks[chunkIndex] = response.value.chunk;
      }
    }

    try {
      await Promise.all(
        Array.from({ length: Math.min(PLAYBACK_CHUNK_CONCURRENCY, chunkCount) }, readNextChunk)
      );
    } catch (playbackError) {
      if (playbackSessionRef.current !== playbackSession) {
        return;
      }
      setError(errorMessage(playbackError, '无法加载录音音频。'));
      return;
    }

    if (playbackSessionRef.current !== playbackSession) {
      return;
    }
    setPlaybackUrl(URL.createObjectURL(new Blob(chunks as BlobPart[], { type: 'audio/webm' })));
  }, [state, workspaceSession.workspaceHandle]);

  function resetClosedDrawerState() {
    recordingSessionRef.current += 1;
    appendFailureRef.current = null;
    appendQueueRef.current = Promise.resolve();
    lastSavedTranscriptRef.current = '';
    lastSavedReflectionsRef.current = '';
    playbackSessionRef.current += 1;
    resetRecordingDurationClock();
    setElapsedSeconds(0);
    setError(null);
    setPlaybackUrl(null);
    setReflectionsDraft('');
    setState(createInitialRecordingState());
    setTranscriptDraft('');
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isRecordingCloseBlocked(state)) {
      return;
    }
    if (!nextOpen) {
      resetClosedDrawerState();
    }
    onOpenChange(nextOpen);
  }

  const canClose = !isRecordingCloseBlocked(state);
  const isEditing = state.status === 'editing';
  const statusText = statusTextFor(state);

  return (
    <RecordAudioDrawer
      description="录制本地音频，然后编辑本地转写和反思草稿。"
      closeBlocked={!canClose}
      error={error}
      footer={
        <Button
          type="button"
          variant="secondary"
          disabled={!canClose}
          onClick={() => handleOpenChange(false)}
        >
          关闭录音面板
        </Button>
      }
      onOpenChange={handleOpenChange}
      open={open}
      title={isEditing ? '编辑录音' : '录音'}
    >
      {!isEditing ? (
        <div className="flex flex-col gap-16">
          <p className="text-body leading-body text-gravel">
            {statusText} 已录制：{elapsedSeconds} 秒。
          </p>
          <RecordingWaveform state={state} />
          <RecordingControls
            onPause={handlePause}
            onResume={handleResume}
            onStart={handleStart}
            onStop={handleStop}
            state={state}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-16">
          <TranscriptReflectionsEditor
            reflections={reflectionsDraft}
            transcript={transcriptDraft}
            onReflectionsChange={setReflectionsDraft}
            onTranscriptChange={setTranscriptDraft}
          />
          <RecordingPlayback playbackUrl={playbackUrl} onLoad={handleLoadPlayback} />
        </div>
      )}
    </RecordAudioDrawer>
  );
}

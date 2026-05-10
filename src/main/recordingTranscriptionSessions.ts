import {
  createDoubaoStreamingAsrSession,
  redactSecrets,
  type DoubaoAsrTranscriptSegment,
  type DoubaoStreamingAsrSession,
  type DoubaoStreamingAsrSessionInput,
} from './doubaoStreamingAsr.js';
import {
  workspaceError,
  type WorkspaceRecordingTranscriptionControlResponse,
  type WorkspaceRecordingTranscriptionEvent,
} from '../workspace-contract/workspace-contract.js';
import {
  pcmByteLengthToDurationMs,
  trimPcmChunkStart,
} from '../workspace-contract/recording-audio.js';
import { mergeTranscriptSegments } from '../workspace-contract/transcript-segments.js';

type DoubaoCredentials = {
  readonly accessKey: string;
  readonly appKey: string;
};

type RecordingTranscriptionSessionIdentity = {
  readonly recordingFlowSessionId: string;
  readonly recordingSessionId: string;
  readonly revisionId: string;
  readonly senderKey: string;
  readonly workspaceHandle: string;
};

type RecordingTranscriptionStartInput = RecordingTranscriptionSessionIdentity & {
  readonly sendEvent?: (event: WorkspaceRecordingTranscriptionEvent) => void;
  readonly timeOffsetMs: number;
};

type RecordingTranscriptionAudioInput = RecordingTranscriptionSessionIdentity & {
  readonly audio: Uint8Array;
};

type RecordingTranscriptionCloseInput = RecordingTranscriptionSessionIdentity;

type BufferedTranscriptionAudio = {
  readonly audio: Uint8Array;
  readonly endTimeMs: number;
  readonly startTimeMs: number;
};

type RecordingTranscriptionSessionEntry = RecordingTranscriptionSessionIdentity & {
  bufferedAudio: BufferedTranscriptionAudio[];
  closing: boolean;
  readonly credentials: DoubaoCredentials;
  readonly entryRef: { current: RecordingTranscriptionSessionEntry | null };
  finishing: boolean;
  readonly key: string;
  pcmDurationMs: number;
  reconnectPromise: Promise<void> | null;
  readonly sendEvent: (event: WorkspaceRecordingTranscriptionEvent) => void;
  session: DoubaoStreamingAsrSession;
  readonly timeOffsetMs: number;
  transcriptSegments: DoubaoAsrTranscriptSegment[];
};

type PendingRecordingTranscriptionStart = RecordingTranscriptionSessionIdentity & {
  closed: boolean;
  readonly key: string;
  readonly sessions: Set<DoubaoStreamingAsrSession>;
};

type CreateRecordingTranscriptionSessionRegistryOptions = {
  readonly createSession?: (input: DoubaoStreamingAsrSessionInput) => DoubaoStreamingAsrSession;
  readonly resolveCredentials?: () => DoubaoCredentials | null;
  readonly sendEvent?: (event: WorkspaceRecordingTranscriptionEvent) => void;
  readonly startAttempts?: number;
};

const DEFAULT_START_ATTEMPTS = 2;
const RECONNECT_REPLAY_BUFFER_MS = 5000;

class RecordingTranscriptionStartClosedError extends Error {
  constructor() {
    super('Recording transcription start was closed.');
  }
}

function accepted(
  acceptedValue: boolean,
  segments?: readonly DoubaoAsrTranscriptSegment[]
): WorkspaceRecordingTranscriptionControlResponse {
  return {
    ok: true,
    value: {
      accepted: acceptedValue,
      ...(segments && segments.length > 0 ? { segments: [...segments] } : {}),
    },
  };
}

function finalTranscriptionError() {
  return workspaceError(
    'ERR_RECORDING_TRANSCRIPTION_FAILED',
    '最终转写未返回，录音会继续保存。',
    'none-written'
  );
}

function activeKey({
  recordingFlowSessionId,
  recordingSessionId,
  senderKey,
  workspaceHandle,
}: Omit<RecordingTranscriptionSessionIdentity, 'revisionId'>) {
  return `${senderKey}:${workspaceHandle}:${recordingFlowSessionId}:${recordingSessionId}`;
}

function hasSameRevision(
  entry: RecordingTranscriptionSessionIdentity | undefined,
  identity: RecordingTranscriptionSessionIdentity
) {
  return (
    entry?.recordingFlowSessionId === identity.recordingFlowSessionId &&
    entry.recordingSessionId === identity.recordingSessionId &&
    entry.revisionId === identity.revisionId &&
    entry.senderKey === identity.senderKey &&
    entry.workspaceHandle === identity.workspaceHandle
  );
}

function offsetSegments(
  segments: readonly DoubaoAsrTranscriptSegment[],
  timeOffsetMs: number
): DoubaoAsrTranscriptSegment[] {
  if (timeOffsetMs <= 0) {
    return [...segments];
  }
  return segments.map((segment) => ({
    ...segment,
    endTimeMs: segment.endTimeMs + timeOffsetMs,
    startTimeMs: segment.startTimeMs + timeOffsetMs,
  }));
}

function resolveDefaultDoubaoCredentials(): DoubaoCredentials | null {
  const appKey = process.env['REO_DOUBAO_ASR_APP_ID']?.trim();
  const accessKey = process.env['REO_DOUBAO_ASR_ACCESS_TOKEN']?.trim();
  return appKey && accessKey ? { accessKey, appKey } : null;
}

function redactCredentialText(message: string, credentials: DoubaoCredentials) {
  return redactSecrets(message, [credentials.accessKey, credentials.appKey]);
}

function startFailureMessage(error: unknown, credentials: DoubaoCredentials) {
  const message = error instanceof Error ? error.message : '豆包流式语音识别连接失败。';
  return redactCredentialText(message, credentials);
}

function pcmChunkDurationMs(audio: Uint8Array) {
  return pcmByteLengthToDurationMs(audio.byteLength);
}

function trimReconnectBuffer(entry: RecordingTranscriptionSessionEntry) {
  const minimumStartMs = Math.max(0, entry.pcmDurationMs - RECONNECT_REPLAY_BUFFER_MS);
  entry.bufferedAudio = entry.bufferedAudio.filter((chunk) => chunk.endTimeMs > minimumStartMs);
}

export function createRecordingTranscriptionSessionRegistry({
  createSession = createDoubaoStreamingAsrSession,
  resolveCredentials = resolveDefaultDoubaoCredentials,
  sendEvent: defaultSendEvent = () => {},
  startAttempts = DEFAULT_START_ATTEMPTS,
}: CreateRecordingTranscriptionSessionRegistryOptions = {}) {
  const sessions = new Map<string, RecordingTranscriptionSessionEntry>();
  const pendingStarts = new Map<string, PendingRecordingTranscriptionStart>();
  const safeStartAttempts = Math.max(1, Math.trunc(startAttempts));

  function closeEntry(entry: RecordingTranscriptionSessionEntry | undefined) {
    if (!entry) {
      return;
    }
    entry.closing = true;
    entry.entryRef.current = null;
    entry.session.close();
    sessions.delete(entry.key);
  }

  function closePendingStart(pending: PendingRecordingTranscriptionStart | undefined) {
    if (!pending) {
      return;
    }
    pending.closed = true;
    pendingStarts.delete(pending.key);
    for (const session of pending.sessions) {
      session.close();
    }
    pending.sessions.clear();
  }

  function currentEntry(identity: RecordingTranscriptionSessionIdentity) {
    return sessions.get(activeKey(identity));
  }

  function emitTranscriptSegments({
    entry,
    segmentOffsetMs,
    segments,
  }: {
    readonly entry: RecordingTranscriptionSessionEntry;
    readonly segmentOffsetMs: number;
    readonly segments: readonly DoubaoAsrTranscriptSegment[];
  }) {
    const currentSegments = offsetSegments(segments, segmentOffsetMs).filter(
      (segment) =>
        segment.recordingSessionId === entry.recordingSessionId &&
        segment.revisionId === entry.revisionId
    );
    if (currentSegments.length === 0) {
      return;
    }
    entry.transcriptSegments = mergeTranscriptSegments(entry.transcriptSegments, currentSegments);
    entry.sendEvent({
      kind: 'segments',
      recordingSessionId: entry.recordingSessionId,
      revisionId: entry.revisionId,
      segments: currentSegments,
    });
  }

  function createLiveSession({
    credentials,
    entryRef,
    identity,
    segmentOffsetMs,
  }: {
    readonly credentials: DoubaoCredentials;
    readonly entryRef: { current: RecordingTranscriptionSessionEntry | null };
    readonly identity: RecordingTranscriptionSessionIdentity;
    readonly segmentOffsetMs: number;
  }) {
    let liveSession: DoubaoStreamingAsrSession | null = null;
    liveSession = createSession({
      accessKey: credentials.accessKey,
      appKey: credentials.appKey,
      onError: (message) => {
        const entry = entryRef.current;
        if (
          !entry ||
          sessions.get(entry.key) !== entry ||
          entry.session !== liveSession ||
          entry.closing ||
          entry.finishing
        ) {
          return;
        }
        reconnectEntry(entry, message);
      },
      onTerminalError: (message) => {
        const entry = entryRef.current;
        if (
          !entry ||
          sessions.get(entry.key) !== entry ||
          entry.session !== liveSession ||
          entry.closing
        ) {
          return;
        }
        closeEntry(entry);
        entry.sendEvent({
          kind: 'error',
          message: redactCredentialText(message, entry.credentials),
          recordingSessionId: entry.recordingSessionId,
          revisionId: entry.revisionId,
        });
      },
      onTranscriptSegments: (segments) => {
        const entry = entryRef.current;
        if (!entry || sessions.get(entry.key) !== entry || entry.session !== liveSession) {
          return;
        }
        emitTranscriptSegments({ entry, segmentOffsetMs, segments });
      },
      recordingSessionId: identity.recordingSessionId,
      revisionId: identity.revisionId,
      uid: identity.recordingSessionId,
    });
    return liveSession;
  }

  async function startLiveSession({
    credentials,
    entryRef,
    identity,
    pendingStart,
    segmentOffsetMs,
  }: {
    readonly credentials: DoubaoCredentials;
    readonly entryRef: { current: RecordingTranscriptionSessionEntry | null };
    readonly identity: RecordingTranscriptionSessionIdentity;
    readonly pendingStart?: PendingRecordingTranscriptionStart;
    readonly segmentOffsetMs: number;
  }) {
    let lastFailureMessage = '豆包流式语音识别连接失败。';
    for (let attempt = 0; attempt < safeStartAttempts; attempt += 1) {
      const session = createLiveSession({ credentials, entryRef, identity, segmentOffsetMs });
      if (pendingStart?.closed) {
        session.close();
        throw new RecordingTranscriptionStartClosedError();
      }
      pendingStart?.sessions.add(session);
      try {
        await session.start();
        pendingStart?.sessions.delete(session);
        if (pendingStart?.closed) {
          throw new RecordingTranscriptionStartClosedError();
        }
        return session;
      } catch (error) {
        pendingStart?.sessions.delete(session);
        if (error instanceof RecordingTranscriptionStartClosedError || pendingStart?.closed) {
          throw new RecordingTranscriptionStartClosedError();
        }
        lastFailureMessage = startFailureMessage(error, credentials);
        session.close();
      }
    }
    throw new Error(lastFailureMessage);
  }

  function replayBufferedAudio(entry: RecordingTranscriptionSessionEntry, replayStartMs: number) {
    trimReconnectBuffer(entry);
    for (const buffered of entry.bufferedAudio) {
      if (buffered.endTimeMs <= replayStartMs) {
        continue;
      }
      const audio =
        buffered.startTimeMs < replayStartMs
          ? trimPcmChunkStart(buffered.audio, replayStartMs - buffered.startTimeMs)
          : buffered.audio;
      if (audio) {
        entry.session.sendAudioChunk(audio);
      }
    }
  }

  function reconnectEntry(entry: RecordingTranscriptionSessionEntry, message: string) {
    if (entry.reconnectPromise || entry.closing || entry.finishing) {
      return;
    }

    entry.reconnectPromise = (async () => {
      const replayStartMs = Math.max(0, entry.pcmDurationMs - RECONNECT_REPLAY_BUFFER_MS);
      const segmentOffsetMs = entry.timeOffsetMs + replayStartMs;
      entry.session.close();

      try {
        const nextSession = await startLiveSession({
          credentials: entry.credentials,
          entryRef: entry.entryRef,
          identity: entry,
          segmentOffsetMs,
        });
        if (sessions.get(entry.key) !== entry || entry.closing) {
          nextSession.close();
          return;
        }
        entry.session = nextSession;
        replayBufferedAudio(entry, replayStartMs);
      } catch (error) {
        if (sessions.get(entry.key) !== entry) {
          return;
        }
        const safeMessage = startFailureMessage(error, entry.credentials);
        closeEntry(entry);
        entry.sendEvent({
          kind: 'error',
          message: safeMessage || message,
          recordingSessionId: entry.recordingSessionId,
          revisionId: entry.revisionId,
        });
      } finally {
        if (sessions.get(entry.key) === entry) {
          entry.reconnectPromise = null;
        }
      }
    })();

    void entry.reconnectPromise.catch(() => {});
  }

  function bufferTranscriptionAudio(entry: RecordingTranscriptionSessionEntry, audio: Uint8Array) {
    const durationMs = pcmChunkDurationMs(audio);
    if (durationMs <= 0) {
      return audio;
    }
    const startTimeMs = entry.pcmDurationMs;
    const endTimeMs = startTimeMs + durationMs;
    const bufferedAudio = new Uint8Array(audio);
    entry.pcmDurationMs = endTimeMs;
    entry.bufferedAudio = [
      ...entry.bufferedAudio,
      {
        audio: bufferedAudio,
        endTimeMs,
        startTimeMs,
      },
    ];
    trimReconnectBuffer(entry);
    return audio;
  }

  return {
    async start(
      input: RecordingTranscriptionStartInput
    ): Promise<WorkspaceRecordingTranscriptionControlResponse> {
      const key = activeKey(input);
      closeEntry(sessions.get(key));
      closePendingStart(pendingStarts.get(key));

      const credentials = resolveCredentials();
      if (!credentials) {
        return workspaceError(
          'ERR_RECORDING_TRANSCRIPTION_UNAVAILABLE',
          '豆包流式语音识别暂时不可用，录音会继续保存。',
          'none-written'
        );
      }

      const sendEvent = input.sendEvent ?? defaultSendEvent;
      const entryRef: { current: RecordingTranscriptionSessionEntry | null } = {
        current: null,
      };
      const pendingStart: PendingRecordingTranscriptionStart = {
        ...input,
        closed: false,
        key,
        sessions: new Set(),
      };
      pendingStarts.set(key, pendingStart);

      try {
        const session = await startLiveSession({
          credentials,
          entryRef,
          identity: input,
          pendingStart,
          segmentOffsetMs: input.timeOffsetMs,
        });
        if (pendingStart.closed || pendingStarts.get(key) !== pendingStart) {
          session.close();
          return accepted(false);
        }
        pendingStarts.delete(key);
        const entry: RecordingTranscriptionSessionEntry = {
          bufferedAudio: [],
          closing: false,
          credentials,
          recordingFlowSessionId: input.recordingFlowSessionId,
          entryRef,
          finishing: false,
          key,
          pcmDurationMs: 0,
          recordingSessionId: input.recordingSessionId,
          reconnectPromise: null,
          revisionId: input.revisionId,
          sendEvent,
          senderKey: input.senderKey,
          session,
          timeOffsetMs: input.timeOffsetMs,
          transcriptSegments: [],
          workspaceHandle: input.workspaceHandle,
        };
        entryRef.current = entry;
        sessions.set(key, entry);
        return accepted(true);
      } catch (error) {
        if (pendingStarts.get(key) === pendingStart) {
          pendingStarts.delete(key);
        }
        if (error instanceof RecordingTranscriptionStartClosedError || pendingStart.closed) {
          return accepted(false);
        }
        return workspaceError(
          'ERR_RECORDING_TRANSCRIPTION_FAILED',
          startFailureMessage(error, credentials),
          'none-written'
        );
      }
    },
    sendAudio(
      input: RecordingTranscriptionAudioInput
    ): WorkspaceRecordingTranscriptionControlResponse {
      const entry = currentEntry(input);
      if (!entry || !hasSameRevision(entry, input)) {
        return accepted(false);
      }
      const audio = bufferTranscriptionAudio(entry, input.audio);
      if (entry.reconnectPromise) {
        return accepted(true);
      }
      try {
        entry.session.sendAudioChunk(audio);
      } catch (error) {
        reconnectEntry(entry, startFailureMessage(error, entry.credentials));
      }
      return accepted(true);
    },
    async finish(
      input: RecordingTranscriptionCloseInput
    ): Promise<WorkspaceRecordingTranscriptionControlResponse> {
      const entry = currentEntry(input);
      if (!entry || !hasSameRevision(entry, input)) {
        return accepted(false);
      }
      entry.finishing = true;
      if (entry.reconnectPromise) {
        await entry.reconnectPromise.catch(() => {});
      }
      if (sessions.get(entry.key) !== entry) {
        return finalTranscriptionError();
      }
      try {
        await entry.session.finish();
      } catch {
        closeEntry(entry);
        return finalTranscriptionError();
      }
      sessions.delete(entry.key);
      entry.sendEvent({
        kind: 'closed',
        recordingSessionId: entry.recordingSessionId,
        revisionId: entry.revisionId,
      });
      return accepted(true, entry.transcriptSegments);
    },
    close(input: RecordingTranscriptionCloseInput): WorkspaceRecordingTranscriptionControlResponse {
      const entry = currentEntry(input);
      if (!entry || !hasSameRevision(entry, input)) {
        const pendingStart = pendingStarts.get(activeKey(input));
        if (pendingStart && hasSameRevision(pendingStart, input)) {
          closePendingStart(pendingStart);
          return accepted(true);
        }
        return accepted(false);
      }
      closeEntry(entry);
      entry.sendEvent({
        kind: 'closed',
        recordingSessionId: entry.recordingSessionId,
        revisionId: entry.revisionId,
      });
      return accepted(true);
    },
    closeForWorkspaceHandle(workspaceHandle: string) {
      for (const pendingStart of [...pendingStarts.values()]) {
        if (pendingStart.workspaceHandle === workspaceHandle) {
          closePendingStart(pendingStart);
        }
      }
      for (const entry of [...sessions.values()]) {
        if (entry.workspaceHandle === workspaceHandle) {
          closeEntry(entry);
        }
      }
    },
    closeAll() {
      for (const pendingStart of [...pendingStarts.values()]) {
        closePendingStart(pendingStart);
      }
      for (const entry of [...sessions.values()]) {
        closeEntry(entry);
      }
    },
  };
}

export type RecordingTranscriptionSessionRegistry = ReturnType<
  typeof createRecordingTranscriptionSessionRegistry
>;

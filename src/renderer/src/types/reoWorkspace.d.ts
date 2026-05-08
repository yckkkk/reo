export {};

type WorkspaceChooseDirectoryResult =
  | {
      readonly status: 'selected';
      readonly selectionToken: string;
      readonly displayPath: string;
    }
  | {
      readonly status: 'canceled';
    };

type WorkspaceErrorEnvelope = {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly dataRetention?:
      | 'none-written'
      | 'previous-file-preserved'
      | 'draft-preserved'
      | 'durable-marker-recovery-required'
      | 'file-written-index-stale'
      | 'unknown';
  };
};

type WorkspaceResponse<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | WorkspaceErrorEnvelope;

type WorkspaceMemorySummary = {
  readonly memoryId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly recordingCount: number;
  readonly durationMs: number;
  readonly audioByteLength: number;
  readonly hasTranscript: boolean;
  readonly hasReflections: boolean;
};

type WorkspaceMemoryDetail = {
  readonly memoryId: string;
  readonly title: string;
  readonly sourceKind: 'recording';
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly recordingIds: ReadonlyArray<string>;
  readonly recordingCount: number;
  readonly recordingsTruncated: boolean;
  readonly hasTranscript: boolean;
  readonly hasReflections: boolean;
  readonly recordings: ReadonlyArray<{
    readonly recordingId: string;
    readonly title: string;
    readonly durationMs: number;
    readonly audioByteLength: number;
  }>;
};

type WorkspaceRecordingSummary = {
  readonly recordingId: string;
  readonly title: string;
  readonly audioByteLength: number;
};

type WorkspaceSnapshot = {
  readonly workspaceId: string;
  readonly title: string;
  readonly description: string;
  readonly memories: ReadonlyArray<WorkspaceMemorySummary>;
  readonly recordings: ReadonlyArray<WorkspaceRecordingSummary>;
};

type WorkspaceMemorySpace = {
  readonly workspaceId: string;
  readonly title: string;
  readonly description: string;
  readonly addedAt: string;
  readonly lastOpenedAt: string;
};

type WorkspaceHandleRequest = {
  readonly workspaceHandle: string;
};

type RecordingHandleRequest = WorkspaceHandleRequest & {
  readonly recordingId: string;
};

type FinalizedRecordingHandleRequest = RecordingHandleRequest & {
  readonly memoryId: string;
};

type ReoWorkspaceBridge = {
  readonly chooseDirectory: () => Promise<
    WorkspaceResponse<WorkspaceChooseDirectoryResult> | WorkspaceErrorEnvelope
  >;
  readonly listMemorySpaces: () => Promise<
    WorkspaceResponse<{ readonly memorySpaces: ReadonlyArray<WorkspaceMemorySpace> }>
  >;
  readonly initializeWorkspace: (payload: {
    readonly selectionToken: string;
    readonly title: string;
    readonly description: string;
  }) => Promise<
    WorkspaceResponse<{
      readonly workspaceHandle: string;
      readonly workspaceId: string;
      readonly snapshot: WorkspaceSnapshot;
    }>
  >;
  readonly openWorkspace: (payload: { readonly selectionToken: string }) => Promise<
    WorkspaceResponse<{
      readonly workspaceHandle: string;
      readonly workspaceId: string;
      readonly snapshot: WorkspaceSnapshot;
    }>
  >;
  readonly openMemorySpace: (payload: { readonly workspaceId: string }) => Promise<
    WorkspaceResponse<{
      readonly workspaceHandle: string;
      readonly workspaceId: string;
      readonly snapshot: WorkspaceSnapshot;
    }>
  >;
  readonly removeMemorySpace: (payload: {
    readonly workspaceId: string;
  }) => Promise<WorkspaceResponse<{ readonly removed: true }>>;
  readonly closeWorkspace: (
    payload: WorkspaceHandleRequest
  ) => Promise<WorkspaceResponse<{ readonly closed: true }>>;
  readonly createRecordingDraft: (
    payload: WorkspaceHandleRequest
  ) => Promise<WorkspaceResponse<{ readonly recordingId: string; readonly nextSequence: number }>>;
  readonly appendRecordingAudioChunk: (
    payload: RecordingHandleRequest & {
      readonly sequence: number;
      readonly chunk: Uint8Array;
    }
  ) => Promise<WorkspaceResponse<{ readonly nextSequence: number }>>;
  readonly finalizeRecordingDraft: (
    payload: RecordingHandleRequest & {
      readonly memoryId?: string;
      readonly title: string;
      readonly durationMs: number;
    }
  ) => Promise<
    WorkspaceResponse<{
      readonly memory: WorkspaceMemorySummary;
      readonly recording: WorkspaceRecordingSummary & {
        readonly memoryId: string;
        readonly durationMs: number;
      };
    }>
  >;
  readonly discardRecordingDraft: (
    payload: RecordingHandleRequest
  ) => Promise<WorkspaceResponse<{ readonly discarded: true }>>;
  readonly getMemoryDetail: (
    payload: WorkspaceHandleRequest & { readonly memoryId: string }
  ) => Promise<WorkspaceResponse<WorkspaceMemoryDetail>>;
  readonly getRecordingDetail: (
    payload: FinalizedRecordingHandleRequest
  ) => Promise<WorkspaceResponse<unknown>>;
  readonly readRecordingAudioManifest: (payload: FinalizedRecordingHandleRequest) => Promise<
    WorkspaceResponse<{
      readonly recordingId: string;
      readonly byteLength: number;
      readonly maxChunkBytes: number;
    }>
  >;
  readonly readRecordingAudioChunk: (
    payload: FinalizedRecordingHandleRequest & {
      readonly offset: number;
      readonly length: number;
    }
  ) => Promise<WorkspaceResponse<{ readonly chunk: Uint8Array }>>;
  readonly saveTranscript: (
    payload: FinalizedRecordingHandleRequest & { readonly markdown: string }
  ) => Promise<WorkspaceResponse<{ readonly saved: true }>>;
  readonly saveReflections: (
    payload: FinalizedRecordingHandleRequest & { readonly markdown: string }
  ) => Promise<WorkspaceResponse<{ readonly saved: true }>>;
  readonly beginMicrophoneIntent: (
    payload: WorkspaceHandleRequest & { readonly drawerSessionId: string }
  ) => Promise<WorkspaceResponse<{ readonly registered: true }>>;
  readonly clearMicrophoneIntent: (
    payload: WorkspaceHandleRequest & { readonly drawerSessionId: string }
  ) => Promise<WorkspaceResponse<{ readonly cleared: true }>>;
};

declare global {
  interface Window {
    readonly reoWorkspace: ReoWorkspaceBridge;
  }
}

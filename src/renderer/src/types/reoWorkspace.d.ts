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
  };
};

type WorkspaceResponse<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | WorkspaceErrorEnvelope;

type WorkspaceSnapshot = {
  readonly workspaceId: string;
  readonly title: string;
  readonly description: string;
  readonly recordings: ReadonlyArray<{
    readonly recordingId: string;
    readonly title: string;
    readonly audioByteLength: number;
  }>;
};

type WorkspaceHandleRequest = {
  readonly workspaceHandle: string;
};

type RecordingHandleRequest = WorkspaceHandleRequest & {
  readonly recordingId: string;
};

type ReoWorkspaceBridge = {
  readonly chooseDirectory: () => Promise<
    WorkspaceResponse<WorkspaceChooseDirectoryResult> | WorkspaceErrorEnvelope
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
      readonly title: string;
    }
  ) => Promise<
    WorkspaceResponse<{
      readonly recordingId: string;
      readonly title: string;
      readonly audioByteLength: number;
    }>
  >;
  readonly discardRecordingDraft: (
    payload: RecordingHandleRequest
  ) => Promise<WorkspaceResponse<{ readonly discarded: true }>>;
  readonly getRecordingDetail: (
    payload: RecordingHandleRequest
  ) => Promise<WorkspaceResponse<unknown>>;
  readonly readRecordingAudioManifest: (payload: RecordingHandleRequest) => Promise<
    WorkspaceResponse<{
      readonly recordingId: string;
      readonly byteLength: number;
      readonly maxChunkBytes: number;
    }>
  >;
  readonly readRecordingAudioChunk: (
    payload: RecordingHandleRequest & {
      readonly offset: number;
      readonly length: number;
    }
  ) => Promise<WorkspaceResponse<{ readonly chunk: Uint8Array }>>;
  readonly saveTranscript: (
    payload: RecordingHandleRequest & { readonly markdown: string }
  ) => Promise<WorkspaceResponse<{ readonly saved: true }>>;
  readonly saveReflections: (
    payload: RecordingHandleRequest & { readonly markdown: string }
  ) => Promise<WorkspaceResponse<{ readonly saved: true }>>;
};

declare global {
  interface Window {
    readonly reoWorkspace: ReoWorkspaceBridge;
  }
}

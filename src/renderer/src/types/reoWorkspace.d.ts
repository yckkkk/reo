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
    readonly code:
      | 'ERR_WORKSPACE_INVALID_REQUEST'
      | 'ERR_WORKSPACE_UNTRUSTED_SENDER'
      | 'ERR_WORKSPACE_SELECTION_NOT_FOUND'
      | 'ERR_WORKSPACE_SELECTION_EXPIRED'
      | 'ERR_WORKSPACE_SELECTION_SENDER_MISMATCH'
      | 'ERR_WORKSPACE_CHOOSE_FAILED';
    readonly message: string;
  };
};

type WorkspaceChooseDirectoryResponse =
  | {
      readonly ok: true;
      readonly value: WorkspaceChooseDirectoryResult;
    }
  | WorkspaceErrorEnvelope;

type ReoWorkspaceBridge = {
  readonly chooseDirectory: () => Promise<WorkspaceChooseDirectoryResponse>;
};

declare global {
  interface Window {
    readonly reoWorkspace: ReoWorkspaceBridge;
  }
}

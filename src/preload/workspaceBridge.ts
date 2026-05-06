import { WORKSPACE_CHOOSE_DIRECTORY_CHANNEL } from '../main/workspaceChannels.js';

export type WorkspaceChooseDirectoryResponse =
  | {
      readonly ok: true;
      readonly value:
        | {
            readonly status: 'selected';
            readonly selectionToken: string;
            readonly displayPath: string;
          }
        | {
            readonly status: 'canceled';
          };
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly message: string;
      };
    };

export interface WorkspaceBridgeInvoker {
  readonly invoke: (channel: typeof WORKSPACE_CHOOSE_DIRECTORY_CHANNEL) => Promise<unknown>;
}

export interface ReoWorkspaceBridge {
  readonly chooseDirectory: () => Promise<WorkspaceChooseDirectoryResponse>;
}

export function createWorkspaceBridge(invoker: WorkspaceBridgeInvoker): ReoWorkspaceBridge {
  return Object.freeze({
    async chooseDirectory() {
      return (await invoker.invoke(
        WORKSPACE_CHOOSE_DIRECTORY_CHANNEL
      )) as WorkspaceChooseDirectoryResponse;
    },
  });
}

import type { ReoWorkspaceBridge } from '../../../workspace-contract/reo-workspace-bridge';

declare global {
  interface Window {
    readonly reoWorkspace: ReoWorkspaceBridge;
  }
}

import type { BackfillEligibleTarget } from './backfillScanner.js';
import type { WorkspaceErrorEnvelope } from '../workspace-contract/workspace-contract.js';
import { createBackfillDiagnostics, type BackfillDiagnostics } from './backfillDiagnostics.js';

type BackfillTriggerVoiceSettings = {
  readonly apiKeyConfigured: boolean;
  readonly enabled: boolean;
  readonly lastValidationOk: boolean | null;
};

type BackfillReadyWorkspace = {
  readonly assertWorkspaceUsable?:
    | (() => { readonly ok: true } | WorkspaceErrorEnvelope)
    | undefined;
  readonly rootPath?: string | undefined;
  readonly workspaceHandle?: string | undefined;
  readonly workspaceId: string;
};

type BackfillTriggerCancelReason = 'lock-lost' | 'workspace-switch';

type CreateBackfillTriggerWiringInput = {
  readonly cancelAll?: (reason: BackfillTriggerCancelReason) => void;
  readonly diagnostics?: BackfillDiagnostics;
  readonly enqueueAutoBatch: (
    targets: readonly BackfillEligibleTarget[],
    workspace: BackfillReadyWorkspace
  ) => void;
  readonly pauseQueue?: () => void;
  readonly readVoiceSettings?: () => BackfillTriggerVoiceSettings;
  readonly resumeQueue?: () => void;
  readonly scan: (workspace: BackfillReadyWorkspace) => Promise<readonly BackfillEligibleTarget[]>;
};

function voiceSettingsReady(settings: BackfillTriggerVoiceSettings) {
  return settings.enabled && settings.apiKeyConfigured && settings.lastValidationOk === true;
}

export function createBackfillTriggerWiring({
  cancelAll = () => {},
  diagnostics = createBackfillDiagnostics(),
  enqueueAutoBatch,
  pauseQueue = () => {},
  readVoiceSettings = () => ({ apiKeyConfigured: false, enabled: false, lastValidationOk: null }),
  resumeQueue = () => {},
  scan,
}: CreateBackfillTriggerWiringInput) {
  let lastVoiceSettingsReady = voiceSettingsReady(readVoiceSettings());
  let readyWorkspace: BackfillReadyWorkspace | null = null;
  const firedReadyKeys = new Set<string>();

  function readyKey(workspace: BackfillReadyWorkspace): string {
    return `${workspace.workspaceId}:${workspace.workspaceHandle ?? workspace.workspaceId}`;
  }

  async function fire(workspace: BackfillReadyWorkspace) {
    const key = readyKey(workspace);
    if (firedReadyKeys.has(key)) {
      return;
    }
    firedReadyKeys.add(key);
    diagnostics.record('scan-started', {}, 'info');
    try {
      const targets = await scan(workspace);
      diagnostics.record('scan-completed', { taskCount: targets.length }, 'info');
      enqueueAutoBatch(targets, workspace);
    } catch {
      diagnostics.record('scan-failed', { errorCode: 'scan-failed' }, 'warn');
    }
  }

  return {
    async voiceSettingsChanged(settings: BackfillTriggerVoiceSettings): Promise<void> {
      const nextReady = voiceSettingsReady(settings);
      const isRisingEdge = !lastVoiceSettingsReady && nextReady;
      lastVoiceSettingsReady = nextReady;
      if (isRisingEdge && readyWorkspace) {
        await fire(readyWorkspace);
      }
    },

    async workspaceReady(workspace: BackfillReadyWorkspace): Promise<void> {
      readyWorkspace = workspace;
      if (!voiceSettingsReady(readVoiceSettings())) {
        return;
      }
      await fire(workspace);
    },

    lockLost(): void {
      cancelAll('lock-lost');
    },

    recordingClosed(): void {
      resumeQueue();
    },

    recordingOpened(): void {
      pauseQueue();
    },

    workspaceSwitched(): void {
      readyWorkspace = null;
      firedReadyKeys.clear();
      cancelAll('workspace-switch');
    },
  };
}

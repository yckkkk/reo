import { vi } from 'vitest';
import type { VoiceTranscriptionSettings } from '../workspace/workspaceApi';

export type VoiceSettingsSnapshotOptions = {
  readonly enabled?: boolean;
  readonly lastValidationCode?: VoiceTranscriptionSettings['lastValidationCode'];
};

export function createVoiceSettingsSnapshot({
  enabled = true,
  lastValidationCode = 'ok',
}: VoiceSettingsSnapshotOptions = {}): VoiceTranscriptionSettings {
  return {
    enabled,
    apiKeyConfigured: true,
    apiKeyLastFour: '1234',
    lastValidatedAt: lastValidationCode === null ? null : '2026-05-16T09:00:00.000Z',
    lastValidationOk:
      lastValidationCode === 'ok' ? true : lastValidationCode === null ? null : false,
    lastValidationCode,
  };
}

export function installPendingVoiceSettingsReadBridge() {
  const pendingVoiceSettingsResponse: ReturnType<
    Window['reoWorkspace']['readVoiceTranscriptionSettings']
  > = new Promise(() => {});

  Object.defineProperty(window, 'reoWorkspace', {
    configurable: true,
    value: {
      readVoiceTranscriptionSettings: vi.fn(() => pendingVoiceSettingsResponse),
    } satisfies Partial<Window['reoWorkspace']>,
  });
}

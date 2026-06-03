import { vi } from 'vitest';
import type { VoiceTranscriptionSettings } from '../workspace/workspaceApi';

export type VoiceSettingsSnapshotOptions = {
  readonly enabled?: boolean;
  readonly lastSpeechSynthesisValidationCode?: VoiceTranscriptionSettings['lastSpeechSynthesisValidationCode'];
  readonly lastValidationCode?: VoiceTranscriptionSettings['lastTranscriptionValidationCode'];
};

export function createVoiceSettingsSnapshot({
  enabled = true,
  lastSpeechSynthesisValidationCode,
  lastValidationCode = 'ok',
}: VoiceSettingsSnapshotOptions = {}): VoiceTranscriptionSettings {
  const speechSynthesisValidationCode = lastSpeechSynthesisValidationCode ?? lastValidationCode;
  return {
    enabled,
    apiKeyConfigured: true,
    apiKeyLastFour: '1234',
    speechSynthesisSpeaker: 'zh_female_vv_uranus_bigtts',
    lastTranscriptionValidatedAt: lastValidationCode === null ? null : '2026-05-16T09:00:00.000Z',
    lastTranscriptionValidationOk:
      lastValidationCode === 'ok' ? true : lastValidationCode === null ? null : false,
    lastTranscriptionValidationCode: lastValidationCode,
    lastSpeechSynthesisValidatedAt:
      speechSynthesisValidationCode === null ? null : '2026-05-16T09:00:00.000Z',
    lastSpeechSynthesisValidationOk:
      speechSynthesisValidationCode === 'ok'
        ? true
        : speechSynthesisValidationCode === null
          ? null
          : false,
    lastSpeechSynthesisValidationCode: speechSynthesisValidationCode,
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

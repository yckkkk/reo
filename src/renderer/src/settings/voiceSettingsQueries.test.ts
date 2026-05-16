import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearVoiceTranscriptionApiKeyMutationOptions,
  invalidateVoiceSettings,
  saveVoiceTranscriptionApiKeyMutationOptions,
  setVoiceTranscriptionEnabledMutationOptions,
  validateVoiceTranscriptionCredentialsMutationOptions,
  voiceSettingsQueryKey,
  voiceSettingsQueryOptions,
} from './voiceSettingsQueries';

type VoiceSettingsBridge = Pick<
  Window['reoWorkspace'],
  | 'clearVoiceTranscriptionApiKey'
  | 'readVoiceTranscriptionSettings'
  | 'saveVoiceTranscriptionApiKey'
  | 'setVoiceTranscriptionEnabled'
  | 'validateVoiceTranscriptionCredentials'
>;

const settingsProjection = {
  enabled: true,
  apiKeyConfigured: true,
  apiKeyLastFour: '1234',
  lastValidatedAt: '2026-05-16T13:00:00.000Z',
  lastValidationOk: true,
  lastValidationCode: 'ok' as const,
};

function installVoiceSettingsBridge(overrides: Partial<VoiceSettingsBridge> = {}) {
  const bridge: VoiceSettingsBridge = {
    readVoiceTranscriptionSettings: vi.fn(async () => ({
      ok: true as const,
      value: { settings: settingsProjection },
    })),
    setVoiceTranscriptionEnabled: vi.fn(async () => ({
      ok: true as const,
      value: { settings: { ...settingsProjection, enabled: false } },
    })),
    saveVoiceTranscriptionApiKey: vi.fn(async () => ({
      ok: true as const,
      value: { settings: settingsProjection },
    })),
    clearVoiceTranscriptionApiKey: vi.fn(async () => ({
      ok: true as const,
      value: {
        settings: {
          ...settingsProjection,
          apiKeyConfigured: false,
          apiKeyLastFour: null,
        },
      },
    })),
    validateVoiceTranscriptionCredentials: vi.fn(async () => ({
      ok: true as const,
      value: { code: 'ok' as const },
    })),
    ...overrides,
  };

  Object.defineProperty(window, 'reoWorkspace', {
    configurable: true,
    value: bridge,
  });

  return bridge;
}

describe('voice settings queries', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installVoiceSettingsBridge();
  });

  it('uses the stable application-scoped voice settings query key', () => {
    expect(voiceSettingsQueryKey()).toEqual(['settings', 'voice']);
  });

  it('fetches only the projection settings through the workspace facade', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const data = await queryClient.fetchQuery(voiceSettingsQueryOptions());

    expect(window.reoWorkspace.readVoiceTranscriptionSettings).toHaveBeenCalledWith(undefined);
    expect(data).toEqual(settingsProjection);
    expect(data).not.toHaveProperty('apiKey');
    expect(data).not.toHaveProperty('apiKeyCiphertext');
  });

  it('throws a safe message for workspace error envelopes', async () => {
    installVoiceSettingsBridge({
      readVoiceTranscriptionSettings: vi.fn(async () => ({
        ok: false as const,
        error: {
          code: 'ERR_VOICE_SETTINGS_WRITE_FAILED' as const,
          message: 'decrypt failed for ciphertext',
          dataRetention: 'previous-file-preserved' as const,
        },
      })),
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await expect(queryClient.fetchQuery(voiceSettingsQueryOptions())).rejects.toThrow(
      '语音设置无法写入本地配置。'
    );
  });

  it('invalidates the exact voice settings key', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await invalidateVoiceSettings(queryClient);

    expect(invalidateSpy).toHaveBeenCalledWith({
      exact: true,
      queryKey: ['settings', 'voice'],
    });
  });

  it('seeds successful settings writes and only invalidates after validate', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await new MutationObserver(
      queryClient,
      setVoiceTranscriptionEnabledMutationOptions(queryClient)
    ).mutate({ enabled: false });
    expect(queryClient.getQueryData(voiceSettingsQueryKey())).toEqual({
      ...settingsProjection,
      enabled: false,
    });

    await new MutationObserver(
      queryClient,
      saveVoiceTranscriptionApiKeyMutationOptions(queryClient)
    ).mutate({ apiKey: 'abcd1234' });
    expect(queryClient.getQueryData(voiceSettingsQueryKey())).toEqual(settingsProjection);

    await new MutationObserver(
      queryClient,
      clearVoiceTranscriptionApiKeyMutationOptions(queryClient)
    ).mutate(undefined);
    expect(queryClient.getQueryData(voiceSettingsQueryKey())).toEqual({
      ...settingsProjection,
      apiKeyConfigured: false,
      apiKeyLastFour: null,
    });

    await new MutationObserver(
      queryClient,
      validateVoiceTranscriptionCredentialsMutationOptions(queryClient)
    ).mutate(undefined);

    expect(invalidateSpy).toHaveBeenCalledOnce();
    expect(invalidateSpy).toHaveBeenCalledWith({
      exact: true,
      queryKey: ['settings', 'voice'],
    });
  });
});

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
      value: {
        settings: {
          ...settingsProjection,
          apiKey: 'full-secret-key',
          apiKeyCiphertext: 'ciphertext',
        },
      },
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
      '无法加载语音设置。'
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

  it('invalidates the exact voice settings key after successful settings writes', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await new MutationObserver(
      queryClient,
      setVoiceTranscriptionEnabledMutationOptions(queryClient)
    ).mutate({ enabled: false });
    await new MutationObserver(
      queryClient,
      saveVoiceTranscriptionApiKeyMutationOptions(queryClient)
    ).mutate({ apiKey: 'abcd1234' });
    await new MutationObserver(
      queryClient,
      clearVoiceTranscriptionApiKeyMutationOptions(queryClient)
    ).mutate(undefined);
    await new MutationObserver(
      queryClient,
      validateVoiceTranscriptionCredentialsMutationOptions(queryClient)
    ).mutate(undefined);

    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, {
      exact: true,
      queryKey: ['settings', 'voice'],
    });
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, {
      exact: true,
      queryKey: ['settings', 'voice'],
    });
    expect(invalidateSpy).toHaveBeenNthCalledWith(3, {
      exact: true,
      queryKey: ['settings', 'voice'],
    });
    expect(invalidateSpy).toHaveBeenNthCalledWith(4, {
      exact: true,
      queryKey: ['settings', 'voice'],
    });
  });
});

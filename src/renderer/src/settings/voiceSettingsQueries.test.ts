import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearVoiceTranscriptionApiKeyMutationOptions,
  invalidateVoiceSettings,
  regenerateImportedSpeechSynthesisMutationOptions,
  saveVoiceTranscriptionApiKeyMutationOptions,
  setVoiceSpeechSynthesisSpeakerMutationOptions,
  setVoiceTranscriptionEnabledMutationOptions,
  validateVoiceTranscriptionCredentialsMutationOptions,
  voiceSettingsQueryKey,
  voiceSettingsQueryOptions,
} from './voiceSettingsQueries';

type VoiceSettingsBridge = Pick<
  Window['reoWorkspace'],
  | 'clearVoiceTranscriptionApiKey'
  | 'readVoiceTranscriptionSettings'
  | 'regenerateImportedSpeechSynthesis'
  | 'saveVoiceTranscriptionApiKey'
  | 'setVoiceSpeechSynthesisSpeaker'
  | 'setVoiceTranscriptionEnabled'
  | 'validateVoiceTranscriptionCredentials'
>;

const settingsProjection = {
  enabled: true,
  apiKeyConfigured: true,
  apiKeyLastFour: '1234',
  speechSynthesisSpeaker: 'zh_female_vv_uranus_bigtts' as const,
  lastTranscriptionValidatedAt: '2026-05-16T13:00:00.000Z',
  lastTranscriptionValidationOk: true,
  lastTranscriptionValidationCode: 'ok' as const,
  lastSpeechSynthesisValidatedAt: '2026-05-16T13:01:00.000Z',
  lastSpeechSynthesisValidationOk: true,
  lastSpeechSynthesisValidationCode: 'ok' as const,
};

function installVoiceSettingsBridge(overrides: Partial<VoiceSettingsBridge> = {}) {
  const bridge: VoiceSettingsBridge = {
    readVoiceTranscriptionSettings: vi.fn(async () => ({
      ok: true as const,
      value: { settings: settingsProjection },
    })),
    regenerateImportedSpeechSynthesis: vi.fn(async () => ({
      ok: true as const,
      value: {
        failed: 0,
        failedTargets: [],
        generated: 1,
        skipped: 0,
        speaker: 'zh_female_vv_uranus_bigtts' as const,
        total: 1,
      },
    })),
    setVoiceTranscriptionEnabled: vi.fn(async () => ({
      ok: true as const,
      value: { settings: { ...settingsProjection, enabled: false } },
    })),
    setVoiceSpeechSynthesisSpeaker: vi.fn(async () => ({
      ok: true as const,
      value: {
        settings: {
          ...settingsProjection,
          speechSynthesisSpeaker: 'zh_male_m191_uranus_bigtts' as const,
          lastSpeechSynthesisValidatedAt: '2026-05-16T13:02:00.000Z',
        },
      },
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
      setVoiceSpeechSynthesisSpeakerMutationOptions(queryClient)
    ).mutate({ speaker: 'zh_male_m191_uranus_bigtts' });
    expect(queryClient.getQueryData(voiceSettingsQueryKey())).toEqual({
      ...settingsProjection,
      speechSynthesisSpeaker: 'zh_male_m191_uranus_bigtts',
      lastSpeechSynthesisValidatedAt: '2026-05-16T13:02:00.000Z',
    });

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

  it('invalidates settings before reporting a save failure after the key file was written', async () => {
    installVoiceSettingsBridge({
      saveVoiceTranscriptionApiKey: vi.fn(async () => ({
        ok: false as const,
        error: {
          code: 'ERR_VOICE_SETTINGS_WRITE_FAILED' as const,
          dataRetention: 'file-written-index-stale' as const,
          message: 'validation state write failed',
        },
      })),
    });
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await expect(
      new MutationObserver(
        queryClient,
        saveVoiceTranscriptionApiKeyMutationOptions(queryClient)
      ).mutate({ apiKey: 'abcd1234' })
    ).rejects.toMatchObject({
      dataRetention: 'file-written-index-stale',
      message: '语音设置无法写入本地配置。',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      exact: true,
      queryKey: ['settings', 'voice'],
    });
  });

  it('regenerates imported speech and invalidates workspace content projections', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const removeSpy = vi.spyOn(queryClient, 'removeQueries');

    const result = await new MutationObserver(
      queryClient,
      regenerateImportedSpeechSynthesisMutationOptions(queryClient)
    ).mutate({
      activeWorkspace: { workspaceHandle: 'wh_1', workspaceId: 'ws_1' },
      mode: 'all',
      speaker: 'zh_female_vv_uranus_bigtts',
    });

    expect(window.reoWorkspace.regenerateImportedSpeechSynthesis).toHaveBeenCalledWith({
      activeWorkspace: { workspaceHandle: 'wh_1', workspaceId: 'ws_1' },
      mode: 'all',
      speaker: 'zh_female_vv_uranus_bigtts',
    });
    expect(result.generated).toBe(1);
    expect(removeSpy).toHaveBeenCalledWith({ predicate: expect.any(Function) });
    const removePredicate = removeSpy.mock.calls.at(-1)?.[0]?.predicate;
    expect(
      removePredicate?.({ queryKey: ['workspace', 'segment-speech-audio', 'ws_2'] } as never)
    ).toBe(true);
    expect(removePredicate?.({ queryKey: ['settings', 'voice'] } as never)).toBe(false);
    expect(invalidateSpy).toHaveBeenCalledWith({ predicate: expect.any(Function) });
    const predicate = invalidateSpy.mock.calls.at(-1)?.[0]?.predicate;
    expect(predicate?.({ queryKey: ['workspace', 'segment-content', 'ws_1'] } as never)).toBe(true);
    expect(predicate?.({ queryKey: ['workspace', 'segment-content', 'ws_2'] } as never)).toBe(true);
    expect(predicate?.({ queryKey: ['settings', 'voice'] } as never)).toBe(false);
  });
});

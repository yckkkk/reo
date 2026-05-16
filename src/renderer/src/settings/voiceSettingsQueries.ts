import { mutationOptions, queryOptions, type QueryClient } from '@tanstack/react-query';
import {
  clearVoiceTranscriptionApiKey,
  readVoiceTranscriptionSettings,
  saveVoiceTranscriptionApiKey,
  setVoiceTranscriptionEnabled,
  validateVoiceTranscriptionCredentials,
  type VoiceTranscriptionCredentialsValidation,
  type VoiceTranscriptionSettings,
  type VoiceTranscriptionSettingsResponseValue,
} from '../workspace/workspaceApi';
import { workspaceErrorDisplayMessage } from '../workspace/workspaceErrorMessages';

export function voiceSettingsQueryKey() {
  return ['settings', 'voice'] as const;
}

function voiceSettingsErrorMessage(
  error: { readonly message?: string },
  fallback = '无法加载语音设置。'
) {
  return workspaceErrorDisplayMessage(error, fallback);
}

function toVoiceSettingsProjection(
  settings: VoiceTranscriptionSettings
): VoiceTranscriptionSettings {
  return {
    enabled: settings.enabled,
    apiKeyConfigured: settings.apiKeyConfigured,
    apiKeyLastFour: settings.apiKeyLastFour,
    lastValidatedAt: settings.lastValidatedAt,
    lastValidationOk: settings.lastValidationOk,
    lastValidationCode: settings.lastValidationCode,
  };
}

function toVoiceSettingsResponseValue(
  value: VoiceTranscriptionSettingsResponseValue
): VoiceTranscriptionSettingsResponseValue {
  return {
    settings: toVoiceSettingsProjection(value.settings),
  };
}

export function voiceSettingsQueryOptions() {
  return queryOptions({
    queryKey: voiceSettingsQueryKey(),
    queryFn: async (): Promise<VoiceTranscriptionSettings> => {
      const response = await readVoiceTranscriptionSettings();

      if (!response.ok) {
        throw new Error(voiceSettingsErrorMessage(response.error));
      }

      return toVoiceSettingsProjection(response.value.settings);
    },
    retry: false,
    staleTime: 60_000,
  });
}

export function invalidateVoiceSettings(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ exact: true, queryKey: voiceSettingsQueryKey() });
}

function seedVoiceSettings(queryClient: QueryClient, value: VoiceTranscriptionSettingsResponseValue) {
  queryClient.setQueryData(voiceSettingsQueryKey(), toVoiceSettingsProjection(value.settings));
}

export function setVoiceTranscriptionEnabledMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (
      payload: Parameters<typeof setVoiceTranscriptionEnabled>[0]
    ): Promise<VoiceTranscriptionSettingsResponseValue> => {
      const response = await setVoiceTranscriptionEnabled(payload);

      if (!response.ok) {
        throw new Error(voiceSettingsErrorMessage(response.error, '无法更新语音设置。'));
      }

      return toVoiceSettingsResponseValue(response.value);
    },
    onSuccess: (value) => seedVoiceSettings(queryClient, value),
  });
}

export function saveVoiceTranscriptionApiKeyMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (
      payload: Parameters<typeof saveVoiceTranscriptionApiKey>[0]
    ): Promise<VoiceTranscriptionSettingsResponseValue> => {
      const response = await saveVoiceTranscriptionApiKey(payload);

      if (!response.ok) {
        throw new Error(voiceSettingsErrorMessage(response.error, '无法保存语音识别密钥。'));
      }

      return toVoiceSettingsResponseValue(response.value);
    },
    onSuccess: (value) => seedVoiceSettings(queryClient, value),
  });
}

export function clearVoiceTranscriptionApiKeyMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (): Promise<VoiceTranscriptionSettingsResponseValue> => {
      const response = await clearVoiceTranscriptionApiKey();

      if (!response.ok) {
        throw new Error(voiceSettingsErrorMessage(response.error, '无法清除语音识别密钥。'));
      }

      return toVoiceSettingsResponseValue(response.value);
    },
    onSuccess: (value) => seedVoiceSettings(queryClient, value),
  });
}

export function validateVoiceTranscriptionCredentialsMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (): Promise<VoiceTranscriptionCredentialsValidation> => {
      const response = await validateVoiceTranscriptionCredentials();

      if (!response.ok) {
        throw new Error(voiceSettingsErrorMessage(response.error, '无法验证语音识别密钥。'));
      }

      return response.value;
    },
    onSuccess: () => invalidateVoiceSettings(queryClient),
  });
}

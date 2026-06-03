import { mutationOptions, queryOptions, type QueryClient } from '@tanstack/react-query';
import {
  clearVoiceTranscriptionApiKey,
  readVoiceTranscriptionSettings,
  regenerateImportedSpeechSynthesis,
  saveVoiceTranscriptionApiKey,
  setVoiceSpeechSynthesisSpeaker,
  setVoiceTranscriptionEnabled,
  validateVoiceTranscriptionCredentials,
  type VoiceTranscriptionCredentialsValidation,
  type VoiceTranscriptionSettings,
  type VoiceTranscriptionSettingsResponseValue,
  type ImportedSpeechSynthesisRegenerationResult,
  type WorkspaceError,
} from '../workspace/workspaceApi';
import { workspaceErrorDisplayMessage } from '../workspace/workspaceErrorMessages';
import {
  workspaceProjectionQueryBelongsToWorkspace,
  workspaceSpeechAudioQueryBelongsToWorkspace,
} from '../workspace/workspaceQueries';

type VoiceSettingsErrorLike = {
  readonly code?: string;
  readonly dataRetention?: WorkspaceError['dataRetention'];
  readonly message?: string;
};

export class VoiceSettingsMutationError extends Error {
  readonly dataRetention: WorkspaceError['dataRetention'];

  constructor(message: string, dataRetention?: WorkspaceError['dataRetention']) {
    super(message);
    this.name = 'VoiceSettingsMutationError';
    this.dataRetention = dataRetention;
  }
}

export function voiceSettingsQueryKey() {
  return ['settings', 'voice'] as const;
}

function voiceSettingsErrorMessage(error: VoiceSettingsErrorLike, fallback = '无法加载语音设置。') {
  return workspaceErrorDisplayMessage(error, fallback);
}

function voiceSettingsMutationError(error: VoiceSettingsErrorLike, fallback: string) {
  return new VoiceSettingsMutationError(
    voiceSettingsErrorMessage(error, fallback),
    error.dataRetention
  );
}

function toVoiceSettingsProjection(
  settings: VoiceTranscriptionSettings
): VoiceTranscriptionSettings {
  return {
    enabled: settings.enabled,
    apiKeyConfigured: settings.apiKeyConfigured,
    apiKeyLastFour: settings.apiKeyLastFour,
    speechSynthesisSpeaker: settings.speechSynthesisSpeaker,
    lastTranscriptionValidatedAt: settings.lastTranscriptionValidatedAt,
    lastTranscriptionValidationOk: settings.lastTranscriptionValidationOk,
    lastTranscriptionValidationCode: settings.lastTranscriptionValidationCode,
    lastSpeechSynthesisValidatedAt: settings.lastSpeechSynthesisValidatedAt,
    lastSpeechSynthesisValidationOk: settings.lastSpeechSynthesisValidationOk,
    lastSpeechSynthesisValidationCode: settings.lastSpeechSynthesisValidationCode,
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

function seedVoiceSettings(
  queryClient: QueryClient,
  value: VoiceTranscriptionSettingsResponseValue
) {
  queryClient.setQueryData(voiceSettingsQueryKey(), toVoiceSettingsProjection(value.settings));
}

export function setVoiceTranscriptionEnabledMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (
      payload: Parameters<typeof setVoiceTranscriptionEnabled>[0]
    ): Promise<VoiceTranscriptionSettingsResponseValue> => {
      const response = await setVoiceTranscriptionEnabled(payload);

      if (!response.ok) {
        throw voiceSettingsMutationError(response.error, '无法更新语音设置。');
      }

      return toVoiceSettingsResponseValue(response.value);
    },
    onSuccess: (value) => seedVoiceSettings(queryClient, value),
  });
}

export function setVoiceSpeechSynthesisSpeakerMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (
      payload: Parameters<typeof setVoiceSpeechSynthesisSpeaker>[0]
    ): Promise<VoiceTranscriptionSettingsResponseValue> => {
      const response = await setVoiceSpeechSynthesisSpeaker(payload);

      if (!response.ok) {
        throw voiceSettingsMutationError(response.error, '无法更新语音设置。');
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
        if (response.error.dataRetention === 'file-written-index-stale') {
          await invalidateVoiceSettings(queryClient);
        }
        throw voiceSettingsMutationError(response.error, '无法保存豆包语音密钥。');
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
        throw voiceSettingsMutationError(response.error, '无法清除豆包语音密钥。');
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
        throw voiceSettingsMutationError(response.error, '无法验证豆包语音密钥。');
      }

      return response.value;
    },
    onSuccess: () => invalidateVoiceSettings(queryClient),
  });
}

function invalidateWorkspaceSpeechSynthesisContent(queryClient: QueryClient, workspaceId?: string) {
  queryClient.removeQueries({
    predicate: (query) => workspaceSpeechAudioQueryBelongsToWorkspace(query.queryKey, workspaceId),
  });
  return queryClient.invalidateQueries({
    predicate: (query) => workspaceProjectionQueryBelongsToWorkspace(query.queryKey, workspaceId),
  });
}

export function regenerateImportedSpeechSynthesisMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (
      payload: Parameters<typeof regenerateImportedSpeechSynthesis>[0]
    ): Promise<ImportedSpeechSynthesisRegenerationResult> => {
      const response = await regenerateImportedSpeechSynthesis(payload);

      if (!response.ok) {
        throw voiceSettingsMutationError(response.error, '无法重新生成笔记语音。');
      }

      return response.value;
    },
    onSuccess: () => invalidateWorkspaceSpeechSynthesisContent(queryClient),
  });
}

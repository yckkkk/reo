import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ExternalLink, Eye, EyeOff, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldControl, FieldError, FieldGroup, FieldHint, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { showReoToast } from '@/components/ui/toaster';
import { WorkspaceDangerConfirmDialog } from '../workspace/WorkspaceDangerConfirmDialog';
import {
  openVoiceTranscriptionProviderConsole,
  type ImportedSpeechSynthesisRegenerationResult,
  type VoiceTranscriptionSettings,
} from '../workspace/workspaceApi';
import {
  unknownErrorDisplayMessage,
  workspaceErrorDisplayMessage,
} from '../workspace/workspaceErrorMessages';
import {
  clearVoiceTranscriptionApiKeyMutationOptions,
  regenerateImportedSpeechSynthesisMutationOptions,
  saveVoiceTranscriptionApiKeyMutationOptions,
  setVoiceSpeechSynthesisSpeakerMutationOptions,
  setVoiceTranscriptionEnabledMutationOptions,
  validateVoiceTranscriptionCredentialsMutationOptions,
  VoiceSettingsMutationError,
  voiceSettingsQueryOptions,
} from './voiceSettingsQueries';
import {
  SPEECH_SYNTHESIS_SPEAKER_OPTIONS,
  type VoiceSpeechSynthesisSpeaker,
} from '../voiceSpeechSynthesisSpeakers';

const API_KEY_INPUT_ID = 'voice-transcription-api-key';
const SPEECH_SYNTHESIS_SPEAKER_SELECT_ID = 'voice-speech-synthesis-speaker';
const STALE_VALIDATION_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function formatValidationTime(isoTimestamp: string) {
  return format(new Date(isoTimestamp), 'yyyy-MM-dd HH:mm');
}

function VoiceValidationStatus({
  tone,
  children,
}: {
  readonly children: ReactNode;
  readonly tone: 'auth' | 'network' | 'ok' | 'stale';
}) {
  const dotClassName = {
    auth: 'bg-destructive',
    network: 'bg-accent',
    ok: 'bg-primary',
    stale: 'bg-muted-foreground',
  }[tone];
  const textClassName = tone === 'auth' ? 'text-destructive' : 'text-foreground';

  return (
    <p
      role="status"
      className={`mt-4 flex items-center gap-8 text-ui-xs leading-ui-xs ${textClassName}`}
    >
      <span aria-hidden="true" className={`size-8 rounded-full ${dotClassName}`} />
      {children}
    </p>
  );
}

function CapabilityVerifiedStatus({
  label,
  timestamp,
}: {
  readonly label: string;
  readonly timestamp: string;
}) {
  return (
    <VoiceValidationStatus tone="ok">
      {label}：已验证 · {formatValidationTime(timestamp)}
    </VoiceValidationStatus>
  );
}

function staleValidationLabel(isoTimestamp: string) {
  const elapsedMs = Math.max(0, Date.now() - new Date(isoTimestamp).getTime());
  const elapsedDays = Math.max(1, Math.floor(elapsedMs / STALE_VALIDATION_THRESHOLD_MS));

  return `上次验证 ${elapsedDays} 天前`;
}

export type VoiceSettingsPanelProps = {
  readonly activeWorkspace?:
    | {
        readonly workspaceHandle: string;
        readonly workspaceId: string;
      }
    | undefined;
  readonly onBusyChange?: (busy: boolean) => void;
};

export function VoiceSettingsPanel({
  activeWorkspace,
  onBusyChange,
}: VoiceSettingsPanelProps = {}) {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery(voiceSettingsQueryOptions());
  const [draftApiKey, setDraftApiKey] = useState('');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [speechRegenerationSummary, setSpeechRegenerationSummary] =
    useState<ImportedSpeechSynthesisRegenerationResult | null>(null);
  const setEnabledMutation = useMutation(setVoiceTranscriptionEnabledMutationOptions(queryClient));
  const setSpeakerMutation = useMutation(
    setVoiceSpeechSynthesisSpeakerMutationOptions(queryClient)
  );
  const saveApiKeyMutation = useMutation(saveVoiceTranscriptionApiKeyMutationOptions(queryClient));
  const validateCredentialsMutation = useMutation(
    validateVoiceTranscriptionCredentialsMutationOptions(queryClient)
  );
  const clearApiKeyMutation = useMutation(
    clearVoiceTranscriptionApiKeyMutationOptions(queryClient)
  );
  const regenerateSpeechMutation = useMutation(
    regenerateImportedSpeechSynthesisMutationOptions(queryClient)
  );
  const settingsBlockingBusy =
    setEnabledMutation.isPending ||
    setSpeakerMutation.isPending ||
    saveApiKeyMutation.isPending ||
    validateCredentialsMutation.isPending ||
    clearApiKeyMutation.isPending;
  const isBusy = settingsBlockingBusy || regenerateSpeechMutation.isPending;

  useEffect(() => {
    onBusyChange?.(settingsBlockingBusy);
  }, [settingsBlockingBusy, onBusyChange]);

  if (isLoading || !settings) {
    return <p className="text-ui-sm leading-ui-sm text-muted-foreground">正在载入语音设置。</p>;
  }

  const keyInputDisabled = !settings.enabled || isBusy;
  const showRequiredHint =
    settings.enabled && !settings.apiKeyConfigured && draftApiKey.length === 0;
  const trimmedDraftApiKey = draftApiKey.trim();
  const needsConfiguredKeyValidation =
    settings.lastTranscriptionValidationOk !== true ||
    settings.lastSpeechSynthesisValidationOk !== true;
  const isValidationFailed =
    settings.lastTranscriptionValidationCode === 'auth' ||
    settings.lastTranscriptionValidationCode === 'network' ||
    settings.lastSpeechSynthesisValidationCode === 'auth' ||
    settings.lastSpeechSynthesisValidationCode === 'network';
  const canValidateConfiguredKey =
    settings.enabled &&
    settings.apiKeyConfigured &&
    needsConfiguredKeyValidation &&
    trimmedDraftApiKey.length === 0;
  const saveDisabled =
    keyInputDisabled || (trimmedDraftApiKey.length === 0 && !canValidateConfiguredKey);
  const showConfiguredHint =
    settings.apiKeyConfigured && settings.apiKeyLastFour !== null && draftApiKey.length === 0;
  const transcriptionValidationStale =
    settings.enabled &&
    settings.apiKeyConfigured &&
    settings.lastTranscriptionValidationCode === 'ok' &&
    settings.lastTranscriptionValidationOk === true &&
    settings.lastTranscriptionValidatedAt !== null &&
    Date.now() - new Date(settings.lastTranscriptionValidatedAt).getTime() >
      STALE_VALIDATION_THRESHOLD_MS;
  const speechSynthesisValidationStale =
    settings.enabled &&
    settings.apiKeyConfigured &&
    settings.lastSpeechSynthesisValidationCode === 'ok' &&
    settings.lastSpeechSynthesisValidationOk === true &&
    settings.lastSpeechSynthesisValidatedAt !== null &&
    Date.now() - new Date(settings.lastSpeechSynthesisValidatedAt).getTime() >
      STALE_VALIDATION_THRESHOLD_MS;
  const isValidationStale = transcriptionValidationStale || speechSynthesisValidationStale;
  const configuredPlaceholder = settings.apiKeyConfigured
    ? '输入新的 X-Api-Key 以替换当前密钥'
    : '请输入火山引擎 X-Api-Key';
  const saveButtonLabel = saveApiKeyMutation.isPending
    ? '验证中'
    : settings.enabled && isValidationFailed
      ? '重试'
      : canValidateConfiguredKey
        ? '验证'
        : '保存';
  const apiKeyVisibilityLabel = apiKeyVisible ? '隐藏 X-Api-Key' : '显示 X-Api-Key';
  const ApiKeyVisibilityIcon = apiKeyVisible ? EyeOff : Eye;
  const showApiKeyVisibilityToggle = draftApiKey.length > 0;
  const mutationErrorMessage =
    [
      setEnabledMutation.error,
      setSpeakerMutation.error,
      saveApiKeyMutation.error,
      validateCredentialsMutation.error,
      clearApiKeyMutation.error,
      regenerateSpeechMutation.error,
    ].find((error): error is Error => error instanceof Error)?.message ?? null;

  function handleSave() {
    if (saveDisabled) return;

    if (canValidateConfiguredKey) {
      validateCredentialsMutation.mutate();
      return;
    }

    saveApiKeyMutation.mutate(
      { apiKey: trimmedDraftApiKey },
      {
        onError: (error) => {
          if (
            error instanceof VoiceSettingsMutationError &&
            error.dataRetention === 'file-written-index-stale'
          ) {
            setDraftApiKey('');
            setApiKeyVisible(false);
          }
        },
        onSuccess: () => {
          setDraftApiKey('');
          setApiKeyVisible(false);
        },
      }
    );
  }

  function handleClear() {
    clearApiKeyMutation.mutate(undefined, {
      onSuccess: () => {
        setApiKeyVisible(false);
        setClearDialogOpen(false);
      },
    });
  }

  async function handleOpenVolcengineConsole() {
    try {
      const response = await openVoiceTranscriptionProviderConsole();
      if (!response.ok) {
        showReoToast({
          type: 'error',
          title: workspaceErrorDisplayMessage(response.error, '外部链接无法打开。'),
        });
      }
    } catch (error) {
      showReoToast({
        type: 'error',
        title: unknownErrorDisplayMessage(error, '外部链接无法打开。'),
      });
    }
  }

  function regenerateImportedSpeech(mode: 'all'): void;
  function regenerateImportedSpeech(
    mode: 'retry',
    summary: ImportedSpeechSynthesisRegenerationResult
  ): void;
  function regenerateImportedSpeech(
    mode: 'all' | 'retry',
    summary?: ImportedSpeechSynthesisRegenerationResult
  ) {
    if (mode === 'retry') {
      if (!summary) {
        return;
      }
      regenerateSpeechMutation.mutate(
        {
          ...(activeWorkspace ? { activeWorkspace } : {}),
          mode: 'retry',
          speaker: summary.speaker,
          targets: summary.failedTargets,
        },
        {
          onSuccess: (result) => setSpeechRegenerationSummary(result),
        }
      );
      return;
    }

    if (!settings) {
      return;
    }
    regenerateSpeechMutation.mutate(
      {
        ...(activeWorkspace ? { activeWorkspace } : {}),
        mode: 'all',
        speaker: settings.speechSynthesisSpeaker as VoiceSpeechSynthesisSpeaker,
      },
      {
        onSuccess: (result) => setSpeechRegenerationSummary(result),
      }
    );
  }

  const speechRegenerationUnavailableReason = !settings.enabled
    ? '启用豆包语音后才能重新生成笔记语音。'
    : !settings.apiKeyConfigured
      ? '配置 X-Api-Key 后才能重新生成笔记语音。'
      : settings.lastSpeechSynthesisValidationCode === 'auth'
        ? '语音生成验证失败，请更新 X-Api-Key 后重试。'
        : null;
  const speechRegenerationDisabled =
    speechRegenerationUnavailableReason !== null || isBusy || regenerateSpeechMutation.isPending;

  return (
    <div className="flex max-w-[720px] flex-col gap-24">
      <section aria-label="豆包语音" className="flex items-start justify-between gap-24">
        <div className="min-w-0">
          <h2 className="text-heading-xs font-medium leading-heading-xs">豆包语音</h2>
          <p className="mt-6 text-ui-sm leading-ui-sm text-muted-foreground">
            同一个 X-Api-Key 用于录音实时转写、录音文件转录和笔记语音生成。
          </p>
        </div>
        <Switch
          aria-label="启用豆包语音"
          checked={settings.enabled}
          disabled={isBusy}
          onCheckedChange={(enabled) => setEnabledMutation.mutate({ enabled })}
        />
      </section>

      <FieldGroup>
        <FieldLabel htmlFor={API_KEY_INPUT_ID}>X-Api-Key</FieldLabel>
        <FieldControl>
          <div className="relative">
            <Input
              id={API_KEY_INPUT_ID}
              type={apiKeyVisible && showApiKeyVisibilityToggle ? 'text' : 'password'}
              value={draftApiKey}
              disabled={keyInputDisabled}
              maxLength={1024}
              autoComplete="off"
              placeholder={configuredPlaceholder}
              className={showApiKeyVisibilityToggle ? 'pr-[44px]' : undefined}
              onChange={(event) => {
                const nextValue = event.target.value;
                setDraftApiKey(nextValue);
                if (nextValue.length === 0) {
                  setApiKeyVisible(false);
                }
              }}
            />
            {showApiKeyVisibilityToggle ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghostIcon"
                      size="icon"
                      aria-label={apiKeyVisibilityLabel}
                      className="absolute right-4 top-1/2 size-32 -translate-y-1/2"
                      disabled={keyInputDisabled}
                      onClick={() => setApiKeyVisible((current) => !current)}
                    >
                      <ApiKeyVisibilityIcon className="size-16" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{apiKeyVisibilityLabel}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
        </FieldControl>
        {showRequiredHint ? (
          <FieldError className="text-destructive">
            启用后需要 X-Api-Key 才能进行语音识别、录音转录和笔记语音生成
          </FieldError>
        ) : showConfiguredHint ? (
          <FieldHint>
            已配置 · 末 4 位 {settings.apiKeyLastFour}
            。此密钥同时用于流式语音识别、录音文件转录和笔记语音生成；输入新 X-Api-Key
            可替换当前密钥。
          </FieldHint>
        ) : (
          <FieldHint>保存的录音和笔记正文会发送到火山引擎用于语音处理。</FieldHint>
        )}
        <Button
          type="button"
          variant="ghostIcon"
          size="compact"
          className="mt-8 w-fit px-8 text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={() => {
            void handleOpenVolcengineConsole();
          }}
        >
          <ExternalLink className="size-16" aria-hidden="true" />
          打开火山引擎控制台
        </Button>
        {mutationErrorMessage ? (
          <FieldError className="text-destructive">{mutationErrorMessage}</FieldError>
        ) : null}
        {saveApiKeyMutation.isPending ? (
          <p role="status" className="mt-4 text-ui-xs leading-ui-xs text-muted-foreground">
            正在验证 X-Api-Key
          </p>
        ) : null}
        {settings.enabled && !isBusy && settings.lastTranscriptionValidationCode === 'auth' ? (
          <VoiceValidationStatus tone="auth">
            语音识别：X-Api-Key 验证失败，请确认密钥后重试。
          </VoiceValidationStatus>
        ) : null}
        {settings.enabled && !isBusy && settings.lastTranscriptionValidationCode === 'network' ? (
          <VoiceValidationStatus tone="network">
            语音识别：暂时无法连接豆包服务，请稍后重试。
          </VoiceValidationStatus>
        ) : null}
        {settings.enabled && !isBusy && settings.lastSpeechSynthesisValidationCode === 'auth' ? (
          <VoiceValidationStatus tone="auth">
            语音生成：X-Api-Key 验证失败，请确认密钥后重试。
          </VoiceValidationStatus>
        ) : null}
        {settings.enabled && !isBusy && settings.lastSpeechSynthesisValidationCode === 'network' ? (
          <VoiceValidationStatus tone="network">
            语音生成：暂时无法连接豆包服务，请稍后重试。
          </VoiceValidationStatus>
        ) : null}
        {!isBusy &&
        transcriptionValidationStale &&
        settings.lastTranscriptionValidatedAt !== null ? (
          <VoiceValidationStatus tone="stale">
            语音识别：{staleValidationLabel(settings.lastTranscriptionValidatedAt)}
          </VoiceValidationStatus>
        ) : null}
        {!isBusy &&
        speechSynthesisValidationStale &&
        settings.lastSpeechSynthesisValidatedAt !== null ? (
          <VoiceValidationStatus tone="stale">
            语音生成：{staleValidationLabel(settings.lastSpeechSynthesisValidatedAt)}
          </VoiceValidationStatus>
        ) : null}
        {settings.enabled &&
        !isBusy &&
        !transcriptionValidationStale &&
        settings.lastTranscriptionValidationCode === 'ok' &&
        settings.lastTranscriptionValidationOk === true &&
        settings.lastTranscriptionValidatedAt !== null ? (
          <CapabilityVerifiedStatus
            label="语音识别"
            timestamp={settings.lastTranscriptionValidatedAt}
          />
        ) : null}
        {settings.enabled &&
        !isBusy &&
        !speechSynthesisValidationStale &&
        settings.lastSpeechSynthesisValidationCode === 'ok' &&
        settings.lastSpeechSynthesisValidationOk === true &&
        settings.lastSpeechSynthesisValidatedAt !== null ? (
          <CapabilityVerifiedStatus
            label="语音生成"
            timestamp={settings.lastSpeechSynthesisValidatedAt}
          />
        ) : null}
      </FieldGroup>

      <FieldGroup>
        <FieldLabel htmlFor={SPEECH_SYNTHESIS_SPEAKER_SELECT_ID}>语音音色</FieldLabel>
        <FieldControl>
          <Select
            value={settings.speechSynthesisSpeaker}
            disabled={isBusy}
            onValueChange={(value) => {
              const speaker = value as VoiceTranscriptionSettings['speechSynthesisSpeaker'];
              if (speaker !== settings.speechSynthesisSpeaker) {
                setSpeakerMutation.mutate({ speaker });
              }
            }}
          >
            <SelectTrigger id={SPEECH_SYNTHESIS_SPEAKER_SELECT_ID} aria-label="语音音色">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPEECH_SYNTHESIS_SPEAKER_OPTIONS.map((speaker) => (
                <SelectItem key={speaker.value} value={speaker.value}>
                  {speaker.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldControl>
        <FieldHint>笔记正文和补充笔记生成语音时使用此音色。</FieldHint>
      </FieldGroup>

      <FieldGroup>
        <FieldLabel>批量笔记语音</FieldLabel>
        <FieldHint>
          使用当前音色重新生成并替换所有已导入记忆空间里的笔记正文和补充笔记语音。
        </FieldHint>
        <div className="flex flex-wrap items-center gap-8">
          <Button
            type="button"
            variant="secondary"
            disabled={speechRegenerationDisabled}
            onClick={() => regenerateImportedSpeech('all')}
          >
            <RotateCcw
              className={
                regenerateSpeechMutation.isPending ? 'size-16 motion-safe:animate-spin' : 'size-16'
              }
              aria-hidden="true"
            />
            {regenerateSpeechMutation.isPending ? '重新生成中' : '重新生成全部笔记语音'}
          </Button>
          {speechRegenerationSummary && speechRegenerationSummary.failedTargets.length > 0 ? (
            <Button
              type="button"
              variant="secondary"
              disabled={
                regenerateSpeechMutation.isPending ||
                speechRegenerationUnavailableReason !== null ||
                isBusy
              }
              onClick={() => regenerateImportedSpeech('retry', speechRegenerationSummary)}
            >
              重试失败项
            </Button>
          ) : null}
        </div>
        {speechRegenerationUnavailableReason ? (
          <FieldHint>{speechRegenerationUnavailableReason}</FieldHint>
        ) : null}
        {regenerateSpeechMutation.isPending ? (
          <p role="status" className="text-ui-xs leading-ui-xs text-muted-foreground">
            正在重新生成笔记语音
          </p>
        ) : speechRegenerationSummary ? (
          <p role="status" className="text-ui-xs leading-ui-xs text-muted-foreground">
            已生成 {speechRegenerationSummary.generated} 项，失败 {speechRegenerationSummary.failed}{' '}
            项，跳过 {speechRegenerationSummary.skipped} 项。
          </p>
        ) : null}
      </FieldGroup>

      <div className="flex flex-wrap gap-8">
        <Button type="button" disabled={saveDisabled} onClick={handleSave}>
          {saveButtonLabel}
        </Button>
        {isValidationStale ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isBusy}
            onClick={() => validateCredentialsMutation.mutate()}
          >
            {validateCredentialsMutation.isPending ? '验证中' : '重新验证'}
          </Button>
        ) : null}
        {settings.apiKeyConfigured ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isBusy}
            onClick={() => setClearDialogOpen(true)}
          >
            清除 X-Api-Key
          </Button>
        ) : null}
      </div>

      <WorkspaceDangerConfirmDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        title="清除 X-Api-Key？"
        description="清除后，录音实时转写、录音文件转录和笔记语音生成都不会再使用这枚密钥。"
        confirmLabel={clearApiKeyMutation.isPending ? '清除中' : '清除'}
        disabled={clearApiKeyMutation.isPending}
        onConfirm={handleClear}
      />
    </div>
  );
}

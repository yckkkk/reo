import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ExternalLink, Eye, EyeOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldControl, FieldError, FieldGroup, FieldHint, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/components/ui/toaster';
import { WorkspaceDangerConfirmDialog } from '../workspace/WorkspaceDangerConfirmDialog';
import { openExternalUrl } from '../workspace/workspaceApi';
import {
  unknownErrorDisplayMessage,
  workspaceErrorDisplayMessage,
} from '../workspace/workspaceErrorMessages';
import {
  clearVoiceTranscriptionApiKeyMutationOptions,
  saveVoiceTranscriptionApiKeyMutationOptions,
  setVoiceTranscriptionEnabledMutationOptions,
  validateVoiceTranscriptionCredentialsMutationOptions,
  voiceSettingsQueryOptions,
} from './voiceSettingsQueries';

const API_KEY_INPUT_ID = 'voice-transcription-api-key';
const STALE_VALIDATION_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const VOLCENGINE_CONSOLE_URL = 'https://console.volcengine.com/';

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

function VerifiedStatus({ timestamp }: { readonly timestamp: string }) {
  return (
    <VoiceValidationStatus tone="ok">
      已验证 · {formatValidationTime(timestamp)}
    </VoiceValidationStatus>
  );
}

function staleValidationLabel(isoTimestamp: string) {
  const elapsedMs = Math.max(0, Date.now() - new Date(isoTimestamp).getTime());
  const elapsedDays = Math.max(1, Math.floor(elapsedMs / STALE_VALIDATION_THRESHOLD_MS));

  return `上次验证 ${elapsedDays} 天前`;
}

export type VoiceSettingsPanelProps = {
  readonly onBusyChange?: (busy: boolean) => void;
};

export function VoiceSettingsPanel({ onBusyChange }: VoiceSettingsPanelProps = {}) {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery(voiceSettingsQueryOptions());
  const [draftApiKey, setDraftApiKey] = useState('');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const setEnabledMutation = useMutation(setVoiceTranscriptionEnabledMutationOptions(queryClient));
  const saveApiKeyMutation = useMutation(saveVoiceTranscriptionApiKeyMutationOptions(queryClient));
  const validateCredentialsMutation = useMutation(
    validateVoiceTranscriptionCredentialsMutationOptions(queryClient)
  );
  const clearApiKeyMutation = useMutation(
    clearVoiceTranscriptionApiKeyMutationOptions(queryClient)
  );
  const isBusy =
    setEnabledMutation.isPending ||
    saveApiKeyMutation.isPending ||
    validateCredentialsMutation.isPending ||
    clearApiKeyMutation.isPending;

  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  if (isLoading || !settings) {
    return <p className="text-ui-sm leading-ui-sm text-muted-foreground">正在载入语音设置。</p>;
  }

  const keyInputDisabled = !settings.enabled || isBusy;
  const showRequiredHint =
    settings.enabled && !settings.apiKeyConfigured && draftApiKey.length === 0;
  const trimmedDraftApiKey = draftApiKey.trim();
  const isValidationFailed =
    settings.lastValidationCode === 'auth' || settings.lastValidationCode === 'network';
  const canValidateConfiguredKey =
    settings.enabled &&
    settings.apiKeyConfigured &&
    isValidationFailed &&
    trimmedDraftApiKey.length === 0;
  const saveDisabled =
    keyInputDisabled || (trimmedDraftApiKey.length === 0 && !canValidateConfiguredKey);
  const showConfiguredHint =
    settings.apiKeyConfigured && settings.apiKeyLastFour !== null && draftApiKey.length === 0;
  const isValidationStale =
    settings.enabled &&
    settings.apiKeyConfigured &&
    !isValidationFailed &&
    settings.lastValidatedAt !== null &&
    Date.now() - new Date(settings.lastValidatedAt).getTime() > STALE_VALIDATION_THRESHOLD_MS;
  const showVerifiedStatus =
    settings.enabled &&
    !isBusy &&
    !isValidationStale &&
    settings.lastValidationCode === 'ok' &&
    settings.lastValidationOk === true &&
    settings.lastValidatedAt !== null;
  const verifiedAt = showVerifiedStatus ? settings.lastValidatedAt : null;
  const configuredPlaceholder = settings.apiKeyConfigured
    ? '输入新的 X-Api-Key 以替换当前密钥'
    : '请输入火山引擎 X-Api-Key';
  const saveButtonLabel = saveApiKeyMutation.isPending
    ? '验证中'
    : settings.enabled && isValidationFailed
      ? '重试'
      : '保存';
  const apiKeyVisibilityLabel = apiKeyVisible ? '隐藏 X-Api-Key' : '显示 X-Api-Key';
  const ApiKeyVisibilityIcon = apiKeyVisible ? EyeOff : Eye;
  const showApiKeyVisibilityToggle = draftApiKey.length > 0;
  const mutationErrorMessage =
    setEnabledMutation.error instanceof Error
      ? setEnabledMutation.error.message
      : saveApiKeyMutation.error instanceof Error
        ? saveApiKeyMutation.error.message
        : validateCredentialsMutation.error instanceof Error
          ? validateCredentialsMutation.error.message
          : clearApiKeyMutation.error instanceof Error
            ? clearApiKeyMutation.error.message
            : null;

  function handleSave() {
    if (saveDisabled) return;

    if (canValidateConfiguredKey) {
      validateCredentialsMutation.mutate();
      return;
    }

    saveApiKeyMutation.mutate(
      { apiKey: trimmedDraftApiKey },
      {
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
      const response = await openExternalUrl({ url: VOLCENGINE_CONSOLE_URL });
      if (!response.ok) {
        toast.error(workspaceErrorDisplayMessage(response.error, '外部链接无法打开。'));
      }
    } catch (error) {
      toast.error(unknownErrorDisplayMessage(error, '外部链接无法打开。'));
    }
  }

  return (
    <div className="flex max-w-[720px] flex-col gap-24">
      <section aria-label="流式语音识别" className="flex items-start justify-between gap-24">
        <div className="min-w-0">
          <h2 className="text-heading-xs font-medium leading-heading-xs">流式语音识别</h2>
          <p className="mt-6 text-ui-sm leading-ui-sm text-muted-foreground">
            录音时使用火山引擎豆包大模型流式语音识别生成转录。
          </p>
        </div>
        <Switch
          aria-label="启用流式语音识别"
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
          <FieldError className="text-destructive">启用后需要 X-Api-Key 才能生成转录</FieldError>
        ) : showConfiguredHint ? (
          <FieldHint>
            已配置 · 末 4 位 {settings.apiKeyLastFour}。输入新 X-Api-Key 可替换当前密钥。
          </FieldHint>
        ) : (
          <FieldHint>密钥只用于本机语音转录设置。</FieldHint>
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
        {settings.enabled && !isBusy && settings.lastValidationCode === 'auth' ? (
          <VoiceValidationStatus tone="auth">
            X-Api-Key 验证失败，请确认密钥后重试。
          </VoiceValidationStatus>
        ) : null}
        {settings.enabled && !isBusy && settings.lastValidationCode === 'network' ? (
          <VoiceValidationStatus tone="network">
            暂时无法连接豆包服务，请稍后重试。
          </VoiceValidationStatus>
        ) : null}
        {!isBusy && isValidationStale && settings.lastValidatedAt !== null ? (
          <VoiceValidationStatus tone="stale">
            {staleValidationLabel(settings.lastValidatedAt)}
          </VoiceValidationStatus>
        ) : null}
        {verifiedAt ? <VerifiedStatus timestamp={verifiedAt} /> : null}
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
        description="清除后，录音不会再使用这枚密钥生成流式转录。"
        confirmLabel={clearApiKeyMutation.isPending ? '清除中' : '清除'}
        disabled={clearApiKeyMutation.isPending}
        onConfirm={handleClear}
      />
    </div>
  );
}

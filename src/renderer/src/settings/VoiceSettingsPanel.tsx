import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldControl, FieldError, FieldGroup, FieldHint, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  saveVoiceTranscriptionApiKeyMutationOptions,
  setVoiceTranscriptionEnabledMutationOptions,
  voiceSettingsQueryOptions,
} from './voiceSettingsQueries';

const API_KEY_INPUT_ID = 'voice-transcription-api-key';

function formatValidationTime(isoTimestamp: string) {
  const date = new Date(isoTimestamp);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function VoiceValidationStatus({
  timestamp,
}: {
  readonly timestamp: string;
}) {
  return (
    <p
      role="status"
      className="mt-4 flex items-center gap-8 text-ui-xs leading-ui-xs text-foreground"
    >
      <span aria-hidden="true" className="size-8 rounded-full bg-primary" />
      已验证 · {formatValidationTime(timestamp)}
    </p>
  );
}

export function VoiceSettingsPanel() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery(voiceSettingsQueryOptions());
  const [draftApiKey, setDraftApiKey] = useState('');
  const setEnabledMutation = useMutation(setVoiceTranscriptionEnabledMutationOptions(queryClient));
  const saveApiKeyMutation = useMutation(
    saveVoiceTranscriptionApiKeyMutationOptions(queryClient)
  );

  if (isLoading || !settings) {
    return <p className="text-ui-sm leading-ui-sm text-muted-foreground">正在载入语音设置。</p>;
  }

  const isBusy = setEnabledMutation.isPending || saveApiKeyMutation.isPending;
  const keyInputDisabled = !settings.enabled || isBusy;
  const showRequiredHint =
    settings.enabled && !settings.apiKeyConfigured && draftApiKey.length === 0;
  const trimmedDraftApiKey = draftApiKey.trim();
  const saveDisabled = keyInputDisabled || trimmedDraftApiKey.length === 0;
  const showConfiguredHint =
    settings.apiKeyConfigured && settings.apiKeyLastFour !== null && draftApiKey.length === 0;
  const showVerifiedStatus =
    !saveApiKeyMutation.isPending &&
    settings.lastValidationCode === 'ok' &&
    settings.lastValidationOk === true &&
    settings.lastValidatedAt !== null;
  const verifiedAt = showVerifiedStatus ? settings.lastValidatedAt : null;

  function handleSave() {
    if (saveDisabled) return;

    saveApiKeyMutation.mutate(
      { apiKey: trimmedDraftApiKey },
      {
        onSuccess: (data) => {
          if (data.settings.lastValidationCode === 'ok' && data.settings.lastValidationOk === true) {
            setDraftApiKey('');
          }
        },
      }
    );
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
          <Input
            id={API_KEY_INPUT_ID}
            type="password"
            value={draftApiKey}
            disabled={keyInputDisabled}
            maxLength={1024}
            autoComplete="off"
            placeholder="请输入火山引擎 X-Api-Key"
            onChange={(event) => setDraftApiKey(event.target.value)}
          />
        </FieldControl>
        {showRequiredHint ? (
          <FieldError className="text-destructive">启用后需要 X-Api-Key 才能生成转录</FieldError>
        ) : showConfiguredHint ? (
          <FieldHint>已配置 · 末 4 位 {settings.apiKeyLastFour}</FieldHint>
        ) : (
          <FieldHint>密钥只用于本机语音转录设置。</FieldHint>
        )}
        {saveApiKeyMutation.isPending ? (
          <p
            role="status"
            className="mt-4 text-ui-xs leading-ui-xs text-muted-foreground"
          >
            正在验证 X-Api-Key
          </p>
        ) : null}
        {verifiedAt ? <VoiceValidationStatus timestamp={verifiedAt} /> : null}
      </FieldGroup>

      <div>
        <Button type="button" disabled={saveDisabled} onClick={handleSave}>
          {saveApiKeyMutation.isPending ? '验证中' : '保存'}
        </Button>
      </div>
    </div>
  );
}

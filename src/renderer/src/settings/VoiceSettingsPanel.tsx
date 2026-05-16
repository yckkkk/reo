import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldControl, FieldError, FieldGroup, FieldHint, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  setVoiceTranscriptionEnabledMutationOptions,
  voiceSettingsQueryOptions,
} from './voiceSettingsQueries';

const API_KEY_INPUT_ID = 'voice-transcription-api-key';

export function VoiceSettingsPanel() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery(voiceSettingsQueryOptions());
  const [draftApiKey, setDraftApiKey] = useState('');
  const setEnabledMutation = useMutation(setVoiceTranscriptionEnabledMutationOptions(queryClient));

  if (isLoading || !settings) {
    return <p className="text-ui-sm leading-ui-sm text-muted-foreground">正在载入语音设置。</p>;
  }

  const keyInputDisabled = !settings.enabled;
  const showRequiredHint =
    settings.enabled && !settings.apiKeyConfigured && draftApiKey.length === 0;
  const saveDisabled = keyInputDisabled || draftApiKey.length === 0;

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
          disabled={setEnabledMutation.isPending}
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
        ) : (
          <FieldHint>密钥只用于本机语音转录设置。</FieldHint>
        )}
      </FieldGroup>

      <div>
        <Button type="button" disabled={saveDisabled}>
          保存
        </Button>
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { voiceSettingsQueryOptions } from '@/settings/voiceSettingsQueries';

export type SidebarSettingsTriggerProps = {
  readonly onOpenSettings: () => void;
  readonly onRecordingBlocked: () => void;
  readonly recordingActive: boolean;
};

export function SidebarSettingsTrigger({
  onOpenSettings,
  onRecordingBlocked,
  recordingActive,
}: SidebarSettingsTriggerProps) {
  const { data: voiceSettings } = useQuery(voiceSettingsQueryOptions());
  const showVoiceCredentialsDot = voiceSettings?.lastValidationCode === 'auth';

  function handleClick() {
    if (recordingActive) {
      onRecordingBlocked();
      return;
    }

    onOpenSettings();
  }

  return (
    <Button
      type="button"
      variant="ghostIcon"
      size="compact"
      aria-disabled={recordingActive}
      aria-label="设置"
      className={cn(
        'justify-start rounded-md px-8 text-muted-foreground hover:bg-secondary hover:text-foreground',
        recordingActive ? 'bg-transparent text-muted-foreground' : null
      )}
      onClick={handleClick}
    >
      <span className="relative grid size-16 place-items-center">
        <Settings className="size-16" aria-hidden="true" />
        {showVoiceCredentialsDot ? <VoiceCredentialsDot /> : null}
      </span>
      <span>设置</span>
    </Button>
  );
}

function VoiceCredentialsDot() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -right-2 -top-2 size-8 rounded-full bg-destructive ring-2 ring-card"
      data-testid="voice-credentials-dot"
    />
  );
}

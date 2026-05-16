import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
      <Settings className="size-16" aria-hidden="true" />
      <span>设置</span>
    </Button>
  );
}

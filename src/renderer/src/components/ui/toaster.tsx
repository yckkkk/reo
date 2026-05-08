import { Toaster, toast } from 'sonner';
import type { ThemeMode } from '@/app-shell/AppShell';

type ReoToasterProps = {
  readonly themeMode: ThemeMode;
};

export function ReoToaster({ themeMode }: ReoToasterProps) {
  return (
    <Toaster
      closeButton
      duration={3200}
      offset={24}
      position="bottom-right"
      theme={themeMode}
      toastOptions={{
        unstyled: true,
        classNames: {
          closeButton:
            'rounded-buttons border border-chalk bg-card-white text-cinder hover:bg-powder hover:text-obsidian',
          description: 'mt-4 text-ui-xs leading-ui-xs text-gravel',
          error: 'border-ember',
          success: 'border-signal-blue',
          title: 'text-ui-sm font-medium leading-ui-sm text-obsidian',
          toast:
            'flex w-full items-start gap-12 rounded-panels border border-chalk bg-card-white px-16 py-12 text-obsidian shadow-subtle-4',
        },
      }}
    />
  );
}

export { toast };

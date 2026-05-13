import { Toaster, toast } from 'sonner';
import type { ThemeMode } from '@/app-shell/themePreference';

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
            'rounded-lg border-0 bg-secondary text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          description: 'mt-4 text-ui-xs leading-ui-xs text-muted-foreground',
          error: 'text-popover-foreground',
          success: 'text-popover-foreground',
          title: 'text-ui-sm font-medium leading-ui-sm text-popover-foreground',
          toast:
            'flex w-full items-start gap-12 rounded-xl border-0 bg-popover px-16 py-12 text-popover-foreground shadow-float',
        },
      }}
    />
  );
}

export { toast };

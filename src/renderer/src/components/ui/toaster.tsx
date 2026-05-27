import { Toaster, toast, type ExternalToast } from 'sonner';
import { Undo2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { ToastT } from 'sonner';
import type { ThemeMode } from '@/app-shell/themePreference';

type ReoToasterProps = {
  readonly themeMode: ThemeMode;
};

export type ReoToastType = 'neutral' | 'success' | 'error' | 'warning' | 'info';

type ReoToastUndo = {
  readonly onUndo: () => void;
  readonly onAutoClose?: (toast: ToastT) => void;
};

type ReoToastInput = {
  readonly type?: ReoToastType;
  readonly title: string;
  readonly description?: string;
  readonly durationMs?: number;
  readonly undo?: ReoToastUndo;
};

const REO_UNDO_TOAST_DURATION_MS = 3200;

export function ReoToastUndoActionLabel() {
  return (
    <span className="inline-flex items-center gap-8">
      <Undo2 aria-hidden="true" className="h-16 w-16 stroke-[2.25]" />
      <span>恢复</span>
    </span>
  );
}

function showUndoToast(input: ReoToastInput & { undo: ReoToastUndo }): string | number {
  const { title, description, durationMs = REO_UNDO_TOAST_DURATION_MS, undo } = input;
  const toastOptions: ExternalToast = {
    action: {
      label: <ReoToastUndoActionLabel />,
      onClick: () => {
        if (undoToastId !== undefined) {
          toast.dismiss(undoToastId);
        }
        undo.onUndo();
      },
    },
    className: 'reo-undo-toast',
    closeButton: false,
    dismissible: false,
    duration: durationMs,
    style: {
      '--reo-toast-duration': `${durationMs}ms`,
    } as CSSProperties,
  };

  if (description !== undefined) {
    toastOptions.description = description;
  }
  if (undo.onAutoClose) {
    toastOptions.onAutoClose = undo.onAutoClose;
  }

  const undoToastId = toast(title, toastOptions);

  return undoToastId;
}

export function showReoToast(input: ReoToastInput): string | number {
  if (input.undo) {
    return showUndoToast({ ...input, undo: input.undo });
  }

  const { type = 'neutral', title, description, durationMs } = input;
  const data: ExternalToast = {};
  if (description !== undefined) {
    data.description = description;
  }
  if (durationMs !== undefined) {
    data.duration = durationMs;
  }

  const level = type === 'neutral' ? toast : toast[type];
  return Object.keys(data).length > 0 ? level(title, data) : level(title);
}

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
          actionButton:
            'reo-toast-action ml-auto inline-flex min-h-32 shrink-0 items-center justify-center gap-8 rounded-lg px-12 text-ui-sm font-medium leading-ui-sm text-popover-foreground outline-none transition-[background-color,color] hover:text-popover-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:text-popover-foreground',
          closeButton:
            'reo-toast-action rounded-lg border-0 text-muted-foreground hover:text-popover-foreground',
          content: 'min-w-0 flex-1',
          description: 'mt-4 text-ui-xs leading-ui-xs text-muted-foreground',
          error: 'text-popover-foreground',
          icon: 'mt-[2px] flex h-20 w-20 shrink-0 items-center justify-center text-muted-foreground',
          success: 'text-popover-foreground',
          title: 'text-ui-sm font-medium leading-ui-sm text-popover-foreground',
          toast:
            'flex w-[min(360px,calc(100vw-(var(--spacing-24)*2)))] items-start gap-12 rounded-xl border-0 bg-popover px-16 py-12 text-popover-foreground shadow-float',
        },
      }}
    />
  );
}

export { toast };

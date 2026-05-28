import { Toaster, toast, type ExternalToast } from 'sonner';
import { Check, Copy, Undo2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { ToastT } from 'sonner';
import type { ThemeMode } from '@/app-shell/themePreference';

type ReoToasterProps = {
  readonly themeMode: ThemeMode;
};

export type ReoToastType = 'neutral' | 'success' | 'error' | 'warning' | 'info' | 'reo-doctor';
type ReoStatusToastType = Exclude<ReoToastType, 'reo-doctor'>;

type ReoToastUndo = {
  readonly onUndo: () => void;
  readonly onAutoClose?: (toast: ToastT) => void;
  readonly onManualDismiss?: (toast: ToastT) => void;
};

type ReoStatusToastInput = {
  readonly type?: ReoStatusToastType;
  readonly title: string;
  readonly description?: string;
  readonly durationMs?: number;
  readonly undo?: ReoToastUndo;
};

type ReoDoctorToastInput = {
  readonly type: 'reo-doctor';
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly onCopyPrompt: () => void;
  readonly copyState?: 'idle' | 'copied';
  readonly durationMs?: number;
  readonly onDismiss?: (toast: ToastT) => void;
};

type ReoToastInput = ReoStatusToastInput | ReoDoctorToastInput;

const REO_UNDO_TOAST_DURATION_MS = 3200;

export function ReoToastUndoActionLabel() {
  return (
    <span className="inline-flex items-center gap-8">
      <span>恢复</span>
      <Undo2 aria-hidden="true" className="h-16 w-16 stroke-[2.25]" />
    </span>
  );
}

export function ReoToastCopyActionLabel({
  state = 'idle',
}: {
  readonly state?: 'idle' | 'copied';
}) {
  const copied = state === 'copied';
  const Icon = copied ? Check : Copy;
  return (
    <span className="inline-flex items-center gap-8" data-state={state}>
      <span>{copied ? '已复制' : '复制'}</span>
      <Icon aria-hidden="true" className="h-16 w-16 stroke-[2.25]" />
    </span>
  );
}

function showUndoToast(input: ReoStatusToastInput & { undo: ReoToastUndo }): string | number {
  const { title, description, durationMs = REO_UNDO_TOAST_DURATION_MS, undo } = input;
  const toastOptions: ExternalToast = {
    action: {
      label: <ReoToastUndoActionLabel />,
      onClick: () => {
        undo.onUndo();
        if (undoToastId !== undefined) {
          toast.dismiss(undoToastId);
        }
      },
    },
    className: 'reo-undo-toast',
    closeButton: true,
    dismissible: true,
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
    toastOptions.onDismiss = undo.onManualDismiss ?? undo.onAutoClose;
  } else if (undo.onManualDismiss) {
    toastOptions.onDismiss = undo.onManualDismiss;
  }

  const undoToastId = toast(title, toastOptions);

  return undoToastId;
}

function showReoDoctorToast(input: ReoDoctorToastInput): string | number {
  return toast(input.title, {
    action: {
      label: <ReoToastCopyActionLabel state={input.copyState ?? 'idle'} />,
      onClick: input.onCopyPrompt,
    },
    className: 'reo-doctor-toast',
    closeButton: true,
    description: input.description,
    dismissible: true,
    duration: input.durationMs ?? Infinity,
    id: input.id,
    ...(input.onDismiss ? { onDismiss: input.onDismiss } : {}),
  });
}

export function showReoToast(input: ReoToastInput): string | number {
  if (input.type === 'reo-doctor') {
    return showReoDoctorToast(input);
  }

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
            'reo-toast-action ml-auto mr-32 inline-flex min-h-32 shrink-0 items-center justify-center gap-8 rounded-lg px-12 text-ui-sm font-medium leading-ui-sm text-popover-foreground outline-none transition-[background-color,color] hover:text-popover-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:text-popover-foreground',
          closeButton:
            'reo-toast-close absolute right-16 top-16 inline-flex h-24 w-24 items-center justify-center rounded-sm border-0 bg-transparent p-0 text-muted-foreground hover:bg-transparent hover:text-popover-foreground active:bg-transparent focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:h-16 [&_svg]:w-16',
          content: 'min-w-0 flex-1 pr-32',
          description: 'mt-4 text-ui-xs leading-ui-xs text-muted-foreground',
          error: 'text-popover-foreground',
          icon: 'mt-[2px] flex h-20 w-20 shrink-0 items-center justify-center text-muted-foreground',
          success: 'text-popover-foreground',
          title: 'text-ui-sm font-medium leading-ui-sm text-popover-foreground',
          toast:
            'relative flex w-[min(360px,calc(100vw-(var(--spacing-24)*2)))] items-start gap-12 rounded-xl border-0 bg-popover px-16 py-12 text-popover-foreground shadow-float',
        },
      }}
    />
  );
}

export { toast };

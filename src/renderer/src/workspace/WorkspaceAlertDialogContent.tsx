import type { ComponentProps } from 'react';
import { AlertDialogContent } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  IMMERSIVE_WORKSPACE_ALERT_CONTENT_Z_CLASS,
  IMMERSIVE_WORKSPACE_ALERT_OVERLAY_Z_CLASS,
} from './immersiveWorkspaceLayers';

export type WorkspaceModalLayer = 'default' | 'immersive';

type WorkspaceAlertDialogContentProps = ComponentProps<typeof AlertDialogContent> & {
  readonly modalLayer?: WorkspaceModalLayer;
};

export function WorkspaceAlertDialogContent({
  className,
  modalLayer = 'default',
  overlayClassName,
  ...props
}: WorkspaceAlertDialogContentProps) {
  const immersive = modalLayer === 'immersive';

  return (
    <AlertDialogContent
      className={cn(immersive ? IMMERSIVE_WORKSPACE_ALERT_CONTENT_Z_CLASS : null, className)}
      overlayClassName={cn(
        immersive ? IMMERSIVE_WORKSPACE_ALERT_OVERLAY_Z_CLASS : null,
        overlayClassName
      )}
      {...props}
    />
  );
}

export function WorkspaceCompactAlertDialogContent({
  className,
  ...props
}: WorkspaceAlertDialogContentProps) {
  return (
    <WorkspaceAlertDialogContent
      className={cn(
        'flex flex-col gap-16 bg-popover shadow-modal sm:w-[min(420px,calc(100vw-40px))] sm:px-24 sm:py-24',
        className
      )}
      {...props}
    />
  );
}

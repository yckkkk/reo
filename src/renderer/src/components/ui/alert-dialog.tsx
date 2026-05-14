import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogPortal = AlertDialogPrimitive.Portal;
export const AlertDialogCancel = AlertDialogPrimitive.Cancel;
export const AlertDialogAction = AlertDialogPrimitive.Action;

export function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn('fixed inset-0 z-50 bg-scrim', className)}
      {...props}
    />
  );
}

export function AlertDialogContent({
  children,
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 max-h-[88vh] rounded-t-xl border-0 bg-popover px-24 py-24 text-popover-foreground shadow-modal outline-none sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:w-[min(var(--container-form),calc(100vw-(var(--spacing-40)*2)))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:px-32 sm:py-32',
          className
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
}

export function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-8 text-left', className)} {...props} />;
}

export function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex justify-end gap-8', className)} {...props} />;
}

export function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        'text-subheading font-medium leading-subheading tracking-normal text-popover-foreground',
        className
      )}
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn('text-ui-sm leading-ui-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

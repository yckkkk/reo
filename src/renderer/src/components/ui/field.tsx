import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-group"
      role={props['aria-label'] ? 'group' : undefined}
      className={cn('grid w-full gap-8', className)}
      {...props}
    />
  );
}

function FieldRow({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-row"
      className={cn(
        'grid gap-12 py-16 md:grid-cols-[minmax(120px,160px)_minmax(0,1fr)] md:items-start md:gap-24',
        className
      )}
      {...props}
    />
  );
}

function FieldControl({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="field-control" className={cn('min-w-0', className)} {...props} />;
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn('block text-ui-sm font-medium leading-ui-sm text-foreground', className)}
      {...props}
    />
  );
}

function FieldHint({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-hint"
      className={cn('mt-4 text-ui-xs font-regular leading-ui-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

function FieldError({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-error"
      className={cn('mt-8 text-ui-xs font-regular leading-ui-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

export { FieldControl, FieldError, FieldGroup, FieldHint, FieldLabel, FieldRow };

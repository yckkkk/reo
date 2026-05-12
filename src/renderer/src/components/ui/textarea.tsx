import * as React from 'react';
import { cn } from '@/lib/utils';

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-72 w-full min-w-0 resize-none rounded-lg border-0 bg-input px-12 py-8 text-ui-sm leading-ui-sm text-foreground shadow-none outline-none transition-colors duration-150 ease-out placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:ring-2 aria-invalid:ring-destructive',
        className
      )}
      {...props}
    />
  );
}

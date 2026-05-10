import * as React from 'react';
import { cn } from '@/lib/utils';

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-72 w-full min-w-0 resize-none rounded-inputs border border-glass-border bg-card-glass px-12 py-8 text-ui-sm leading-ui-sm text-obsidian shadow-subtle outline-none backdrop-blur-glass-sm transition-colors placeholder:text-slate focus:border-signal-blue disabled:cursor-not-allowed disabled:bg-powder disabled:text-gravel aria-invalid:border-ember',
        className
      )}
      {...props}
    />
  );
}

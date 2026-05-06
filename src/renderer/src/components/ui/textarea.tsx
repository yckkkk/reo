import * as React from 'react';
import { cn } from '@/lib/utils';

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-120 w-full resize-none border border-chalk bg-card-white px-16 py-12 text-body-lg leading-body-lg text-obsidian outline-none focus:border-signal-blue disabled:cursor-not-allowed disabled:bg-powder',
        className
      )}
      {...props}
    />
  );
}

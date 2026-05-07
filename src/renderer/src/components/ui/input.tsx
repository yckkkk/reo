import * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'min-h-48 w-full min-w-0 border border-chalk bg-card-white px-16 text-body-lg leading-body-lg text-obsidian outline-none transition-colors selection:bg-signal-blue selection:text-card-white focus:border-signal-blue disabled:cursor-not-allowed disabled:bg-powder aria-invalid:border-ember',
        className
      )}
      {...props}
    />
  );
}

export { Input };

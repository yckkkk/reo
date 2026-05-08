import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const inputVariants = cva(
  'w-full min-w-0 rounded-inputs border border-chalk bg-card-white text-obsidian shadow-subtle outline-none transition-colors selection:bg-signal-blue selection:text-card-white placeholder:text-slate focus:border-signal-blue disabled:cursor-not-allowed disabled:bg-powder disabled:text-gravel aria-invalid:border-ember',
  {
    defaultVariants: {
      size: 'default',
    },
    variants: {
      size: {
        default: 'min-h-40 px-12 text-ui-md leading-ui-md',
        compact: 'min-h-32 px-12 text-ui-sm leading-ui-sm',
      },
    },
  }
);

export type InputProps = Omit<React.ComponentProps<'input'>, 'size'> &
  VariantProps<typeof inputVariants>;

function Input({ className, size, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ className, size }))}
      {...props}
    />
  );
}

export { Input, inputVariants };

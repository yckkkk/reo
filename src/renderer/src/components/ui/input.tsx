import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const inputVariants = cva(
  'w-full min-w-0 rounded-lg border-0 bg-input text-foreground shadow-none outline-none transition-colors duration-150 ease-out selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:ring-2 aria-invalid:ring-destructive',
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

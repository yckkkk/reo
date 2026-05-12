import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-w-fit shrink-0 items-center justify-center gap-8 border-0 text-ui-md font-medium leading-ui-md shadow-none outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100',
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'min-h-40 rounded-lg px-16',
        compact: 'min-h-32 rounded-md px-12 text-ui-sm leading-ui-sm',
        icon: 'size-32 rounded-sm p-0',
        iconMedium: 'size-40 rounded-md p-0',
        iconLarge: 'size-56 rounded-lg p-0',
      },
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive',
        ghostIcon:
          'bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-card text-card-foreground hover:bg-secondary',
      },
    },
  }
);

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    readonly asChild?: boolean;
  };

export function Button({ asChild = false, className, size, variant, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ className, size, variant }))}
      {...props}
    />
  );
}

export { buttonVariants };

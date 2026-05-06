import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-w-fit shrink-0 items-center justify-center gap-8 rounded-buttons text-body font-bold leading-body outline-none transition-colors focus-visible:ring-2 focus-visible:ring-signal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-eggshell disabled:pointer-events-none disabled:border-fog disabled:bg-fog disabled:text-card-white disabled:opacity-100',
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'min-h-48 px-24',
        compact: 'min-h-40 px-16',
      },
      variant: {
        default: 'border border-obsidian bg-obsidian text-card-white hover:bg-cinder',
        primary: 'border border-signal-blue bg-signal-blue text-card-white hover:border-obsidian',
        secondary: 'border border-chalk bg-card-white text-obsidian hover:border-slate',
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

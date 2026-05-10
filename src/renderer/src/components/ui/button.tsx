import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-w-fit shrink-0 items-center justify-center gap-8 rounded-buttons text-ui-md font-medium leading-ui-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-signal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-eggshell disabled:pointer-events-none disabled:border-fog disabled:bg-fog disabled:text-on-accent disabled:opacity-100',
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'min-h-40 px-16',
        compact: 'min-h-32 px-12 text-ui-sm leading-ui-sm',
        icon: 'size-32 p-0',
        iconMedium: 'size-40 p-0',
        iconLarge: 'size-56 p-0',
      },
      variant: {
        default: 'border border-obsidian bg-obsidian text-on-accent hover:bg-cinder',
        accentCircle:
          'rounded-full border border-signal-blue bg-signal-blue text-on-accent hover:border-obsidian hover:bg-obsidian',
        ghostIcon: 'border border-transparent bg-transparent text-cinder hover:text-obsidian',
        secondary:
          'border border-glass-border bg-card-glass text-obsidian backdrop-blur-glass-sm hover:border-slate',
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

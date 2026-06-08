import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'reo-squircle inline-flex w-fit shrink-0 items-center justify-center gap-4 rounded-sm px-8 py-2 text-ui-xs font-medium leading-ui-xs whitespace-nowrap',
  {
    defaultVariants: {
      variant: 'default',
    },
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border border-border bg-transparent text-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
      },
    },
  }
);

export type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ className, variant }))} {...props} />
  );
}

export { badgeVariants };

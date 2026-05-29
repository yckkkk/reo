import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';
import { cn } from '@/lib/utils';

export type ReoCardSurfaceShape = 'default' | 'segmentPreview';

const reoCardSurfaceShapeClassNames = {
  default: 'reo-squircle rounded-xl',
  segmentPreview: 'reo-segment-card-squircle',
} satisfies Record<ReoCardSurfaceShape, string>;

export const reoCardSurfaceClassName = 'overflow-hidden';

export type ReoCardSurfaceProps = React.ComponentProps<'div'> & {
  readonly asChild?: boolean;
  readonly shape?: ReoCardSurfaceShape;
};

export function ReoCardSurface({
  asChild = false,
  className,
  shape = 'default',
  ...props
}: ReoCardSurfaceProps) {
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      data-slot="reo-card-surface"
      {...props}
      className={cn(reoCardSurfaceClassName, reoCardSurfaceShapeClassNames[shape], className)}
    />
  );
}

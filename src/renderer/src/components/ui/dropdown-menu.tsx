import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as React from 'react';
import { cn } from '@/lib/utils';

function DropdownMenu({
  modal = false,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root modal={modal} {...props} />;
}
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPortal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-160 overflow-hidden rounded-lg border-0 bg-popover p-4 text-popover-foreground shadow-float outline-none',
          className
        )}
        {...props}
      />
    </DropdownMenuPortal>
  );
}

function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        'relative flex min-h-32 w-full cursor-default select-none items-center gap-8 rounded-lg px-8 text-left text-ui-xs font-regular leading-ui-xs outline-none transition-colors duration-150 ease-out',
        'text-popover-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground',
        className
      )}
      {...props}
    />
  );
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger };

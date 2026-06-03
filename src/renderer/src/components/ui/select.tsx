import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        'reo-squircle flex min-h-40 w-full min-w-0 items-center justify-between gap-8 rounded-lg border-0 bg-input px-12 text-left text-ui-md font-medium leading-ui-md text-foreground shadow-none outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground data-[placeholder]:text-muted-foreground [&>span]:min-w-0 [&>span]:truncate',
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-16 shrink-0 text-muted-foreground" aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = 'popper',
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={sideOffset}
        className={cn(
          'reo-float-motion reo-squircle z-50 max-h-[min(var(--radix-select-content-available-height),320px)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[18px] border-0 bg-popover p-[6px] text-popover-foreground shadow-float outline-none',
          className
        )}
        {...props}
      >
        <SelectPrimitive.Viewport
          data-slot="select-viewport"
          className={cn(position === 'popper' && 'w-full')}
        >
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'reo-squircle relative flex min-h-32 w-full cursor-default select-none items-center rounded-md py-0 pl-28 pr-8 text-ui-md font-medium leading-[1.15] text-popover-foreground outline-none transition-colors duration-150 ease-out data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
        className
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="absolute left-8 inline-flex size-16 items-center justify-center"
      >
        <SelectPrimitive.ItemIndicator>
          <Check className="size-[14px]" aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue };

import * as React from 'react';
import { cn } from '@/lib/utils';

type MenuSurfaceProps = React.ComponentProps<'div'>;

function MenuSurface({ className, ...props }: MenuSurfaceProps) {
  return (
    <div
      data-slot="menu-surface"
      role="menu"
      className={cn(
        'min-w-160 rounded-xl border border-chalk bg-card-white p-4 shadow-subtle-7',
        className
      )}
      {...props}
    />
  );
}

type MenuItemButtonProps = React.ComponentProps<'button'> & {
  readonly icon?: React.ReactNode;
};

function MenuItemButton({
  children,
  className,
  icon,
  type = 'button',
  ...props
}: MenuItemButtonProps) {
  return (
    <button
      data-slot="menu-item-button"
      role="menuitem"
      type={type}
      className={cn(
        'flex min-h-32 w-full items-center gap-8 rounded-lg px-8 text-left text-ui-xs font-regular leading-ui-xs text-cinder outline-none transition-colors hover:bg-powder hover:text-obsidian focus-visible:ring-2 focus-visible:ring-signal-blue',
        className
      )}
      {...props}
    >
      {icon ? <span className="shrink-0 text-slate">{icon}</span> : null}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

export { MenuItemButton, MenuSurface };

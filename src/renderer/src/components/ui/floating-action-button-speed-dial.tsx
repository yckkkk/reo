import { X } from 'lucide-react';
import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { MenuItem } from 'primereact/menuitem';
import { SpeedDial } from 'primereact/speeddial';
import { cn } from '@/lib/utils';

const DEFAULT_SPEED_DIAL_ID = 'floating-action-button-speed-dial';
export const FLOATING_ACTION_BUTTON_SPEED_DIAL_GEOMETRY = {
  actionSize: 40,
  diameter: 56,
  radius: 92,
  shellHeight: 184,
  shellWidth: 320,
} as const;

const floatingActionButtonSpeedDialGeometryStyle = {
  '--reo-speed-dial-action-size': `${FLOATING_ACTION_BUTTON_SPEED_DIAL_GEOMETRY.actionSize}px`,
  '--reo-speed-dial-diameter': `${FLOATING_ACTION_BUTTON_SPEED_DIAL_GEOMETRY.diameter}px`,
  '--reo-speed-dial-shell-height': `${FLOATING_ACTION_BUTTON_SPEED_DIAL_GEOMETRY.shellHeight}px`,
  '--reo-speed-dial-shell-width': `${FLOATING_ACTION_BUTTON_SPEED_DIAL_GEOMETRY.shellWidth}px`,
} as React.CSSProperties;

type FloatingActionButtonSpeedDialAvailableAction = {
  readonly icon: LucideIcon;
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
};

type FloatingActionButtonSpeedDialUnavailableAction = {
  readonly disabled: true;
  readonly disabledLabel: string;
  readonly icon: LucideIcon;
  readonly id: string;
  readonly label: string;
};

export type FloatingActionButtonSpeedDialAction =
  | FloatingActionButtonSpeedDialAvailableAction
  | FloatingActionButtonSpeedDialUnavailableAction;

type FloatingActionButtonSpeedDialProps = {
  readonly actions: readonly FloatingActionButtonSpeedDialAction[];
  readonly closeLabel?: string;
  readonly id?: string;
  readonly menuLabel?: string;
  readonly openLabel?: string;
};

type PrimeMenuItemOptions = {
  readonly className: string;
  readonly element: React.ReactNode;
  readonly onClick: (event: React.SyntheticEvent) => void;
};

type FloatingActionButtonSpeedDialMenuItem = MenuItem & {
  readonly disabledLabel?: string;
  readonly icon: LucideIcon;
};

function createFloatingActionButtonSpeedDialActionTemplate(open: boolean) {
  return function floatingActionButtonSpeedDialActionTemplate(
    item: MenuItem,
    options: PrimeMenuItemOptions
  ) {
    const speedDialItem = item as FloatingActionButtonSpeedDialMenuItem;
    const Icon = speedDialItem.icon;
    const unavailable = item.disabled === true;

    function handleClick(event: React.SyntheticEvent) {
      if (unavailable) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      options.onClick(event);
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLAnchorElement>) {
      if (unavailable) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
        }

        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        options.onClick(event);
      }
    }

    const actionElement = React.isValidElement<
      React.AnchorHTMLAttributes<HTMLAnchorElement> & { readonly 'data-slot'?: string }
    >(options.element)
      ? React.cloneElement(options.element, {
          'aria-disabled': unavailable ? true : undefined,
          'aria-label': unavailable ? speedDialItem.disabledLabel : item.label,
          children: <Icon className="size-20" strokeWidth={1.9} aria-hidden="true" />,
          className: cn(
            options.className,
            'grid size-[var(--reo-speed-dial-action-size)] place-items-center rounded-full border outline-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-signal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-card-white',
            unavailable
              ? 'cursor-default border-chalk/70 bg-powder text-slate shadow-subtle'
              : 'border-chalk bg-card-white text-cinder shadow-subtle hover:-translate-y-0.5 hover:border-slate hover:text-signal-blue hover:shadow-subtle-4 active:scale-[0.96]'
          ),
          'data-slot': unavailable
            ? 'floating-action-button-speed-dial-action-unavailable'
            : 'floating-action-button-speed-dial-action-active',
          href: undefined,
          onClick: handleClick,
          onKeyDown: handleKeyDown,
          tabIndex: open && !unavailable ? 0 : -1,
        })
      : null;

    return <div>{actionElement}</div>;
  };
}

export function FloatingActionButtonSpeedDial({
  actions,
  closeLabel = '关闭操作菜单',
  id = DEFAULT_SPEED_DIAL_ID,
  menuLabel = '操作菜单',
  openLabel = '打开操作菜单',
}: FloatingActionButtonSpeedDialProps) {
  const [open, setOpen] = React.useState(false);
  const menuId = `${id}-menu`;

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      window.setTimeout(() => {
        document.getElementById(id)?.querySelector('button')?.focus();
      });
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [id, open]);
  const actionTemplate = React.useMemo(
    () => createFloatingActionButtonSpeedDialActionTemplate(open),
    [open]
  );
  const model = React.useMemo<MenuItem[]>(
    () =>
      actions.map((action) => ({
        command: () => {
          if ('onSelect' in action) {
            action.onSelect();
          }
        },
        disabled: 'disabled' in action ? action.disabled : false,
        disabledLabel: 'disabledLabel' in action ? action.disabledLabel : undefined,
        id: action.id,
        label: action.label,
        template: actionTemplate,
        icon: action.icon,
      })),
    [actionTemplate, actions]
  );
  const radialType = model.length > 1 ? 'semi-circle' : 'linear';

  return (
    <div
      data-slot="floating-action-button-speed-dial"
      data-state={open ? 'open' : 'closed'}
      className="pointer-events-none relative mx-auto h-[var(--reo-speed-dial-shell-height)] w-full max-w-[var(--reo-speed-dial-shell-width)]"
      style={floatingActionButtonSpeedDialGeometryStyle}
    >
      <SpeedDial
        id={id}
        aria-label={open ? closeLabel : openLabel}
        buttonClassName="!size-[var(--reo-speed-dial-diameter)] !rounded-full !border !border-signal-blue !bg-signal-blue !text-card-white !shadow-subtle-4 !transition-[background-color,border-color,box-shadow,transform] !duration-200 hover:!-translate-y-0.5 hover:!border-signal-blue hover:!bg-signal-blue hover:!shadow-subtle-7 active:!scale-[0.97] focus-visible:!ring-2 focus-visible:!ring-signal-blue focus-visible:!ring-offset-2 focus-visible:!ring-offset-card-white"
        className="!pointer-events-auto !absolute !bottom-0 !left-1/2 !z-10 !-translate-x-1/2"
        direction="up"
        hideIcon={<X className="size-20" strokeWidth={1.8} aria-hidden="true" />}
        mask={false}
        model={model}
        onVisibleChange={setOpen}
        radius={FLOATING_ACTION_BUTTON_SPEED_DIAL_GEOMETRY.radius}
        rotateAnimation={false}
        showIcon={<span aria-hidden="true" />}
        transitionDelay={28}
        type={radialType}
        visible={open}
        pt={{
          action: {
            className: '!bg-transparent !p-0 !shadow-none',
          },
          button: {
            root: {
              'aria-controls': menuId,
            },
          },
          menu: (options) => {
            const visible = options?.state?.visible === true;

            return {
              'aria-hidden': visible ? undefined : true,
              'aria-label': menuLabel,
              id: menuId,
              className: cn(
                visible ? '!pointer-events-auto' : '!pointer-events-none',
                '!transition-opacity !duration-200 motion-reduce:!transition-none'
              ),
            };
          },
          menuitem: (options) => {
            const visible = options?.state?.visible === true;

            return {
              role: 'none',
              className: cn(
                '!absolute !transition-[transform,opacity] !duration-200 !ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:!transition-none',
                visible && '!pointer-events-auto'
              ),
            };
          },
          root: (options) => ({
            'data-state': options?.state?.visible === true ? 'open' : 'closed',
            'data-slot': 'floating-action-button-speed-dial-root',
          }),
        }}
      />
    </div>
  );
}

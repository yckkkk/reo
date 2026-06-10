import {
  FolderInput,
  MoreHorizontal,
  PencilLine,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentProps, ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  EntityPathActionGroup,
  entityActionMenuSeparatorClassName,
  type EntityPathAction,
} from './EntityPathActionGroup';

type EntityActionMenuSyncAction = () => void;

export type EntityActionMenuTranscriptionAction = {
  readonly disabledReason?: string | null;
  readonly label: '生成转录' | '重新生成转录';
  readonly onSelect: EntityActionMenuSyncAction;
};

export type EntityActionMenuExtraItem = {
  readonly disabledReason?: string | null;
  readonly icon: LucideIcon;
  readonly kind?: 'item';
  readonly label: string;
  readonly onSelect: EntityActionMenuSyncAction;
};

export type EntityActionMenuExtraSubmenu = {
  readonly disabledReason?: string | null;
  readonly icon: LucideIcon;
  readonly items: readonly {
    readonly label: string;
    readonly onSelect: EntityActionMenuSyncAction;
  }[];
  readonly kind: 'submenu';
  readonly label: string;
};

export type EntityActionMenuExtraAction = EntityActionMenuExtraItem | EntityActionMenuExtraSubmenu;

export type EntityActionMenuProps = {
  readonly canDelete?: boolean | undefined;
  readonly canRename?: boolean | undefined;
  readonly contentAlign?: ComponentProps<typeof DropdownMenuContent>['align'];
  readonly deleteLabel?: '删除' | '移除';
  readonly menuLabel: string;
  readonly moveLabel?: string | undefined;
  readonly onCloseAutoFocus?:
    | ComponentProps<typeof DropdownMenuContent>['onCloseAutoFocus']
    | undefined;
  readonly onCopyAbsolutePath: EntityPathAction;
  readonly onCopyRelativePath?: EntityPathAction | undefined;
  readonly onDelete: () => void;
  readonly onMove?: (() => void) | undefined;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
  readonly onOpenDefault: EntityPathAction;
  readonly onRename: () => void;
  readonly onRevealInFinder: EntityPathAction;
  readonly open?: boolean | undefined;
  readonly extraActions?: readonly EntityActionMenuExtraAction[] | undefined;
  readonly transcriptionAction?: EntityActionMenuTranscriptionAction | undefined;
  readonly trigger?: ReactElement | undefined;
  readonly triggerClassName?: string | undefined;
};

function EntityActionMenuIcon({ icon: Icon }: { readonly icon: LucideIcon }) {
  return <Icon className="size-16 shrink-0 text-muted-foreground" aria-hidden="true" />;
}

function EntityActionSyncItem({ action }: { readonly action: EntityActionMenuExtraItem }) {
  const disabled = action.disabledReason !== null && action.disabledReason !== undefined;
  const item = (
    <DropdownMenuItem
      aria-disabled={disabled ? true : undefined}
      data-disabled={disabled ? '' : undefined}
      onSelect={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        action.onSelect();
      }}
    >
      <EntityActionMenuIcon icon={action.icon} />
      {action.label}
    </DropdownMenuItem>
  );

  if (!disabled) {
    return item;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{item}</TooltipTrigger>
        <TooltipContent side="right">{action.disabledReason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function EntityActionTranscriptionItem({
  action,
}: {
  readonly action: EntityActionMenuTranscriptionAction;
}) {
  return <EntityActionSyncItem action={{ ...action, icon: RefreshCw }} />;
}

function EntityActionSubmenu({ action }: { readonly action: EntityActionMenuExtraSubmenu }) {
  const disabled = action.disabledReason !== null && action.disabledReason !== undefined;
  if (disabled) {
    return (
      <EntityActionSyncItem
        action={{
          disabledReason: action.disabledReason,
          icon: action.icon,
          label: action.label,
          onSelect: () => undefined,
        }}
      />
    );
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <EntityActionMenuIcon icon={action.icon} />
        {action.label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {action.items.map((item) => (
          <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function EntityActionExtraItem({ action }: { readonly action: EntityActionMenuExtraAction }) {
  return action.kind === 'submenu' ? (
    <EntityActionSubmenu action={action} />
  ) : (
    <EntityActionSyncItem action={action} />
  );
}

export function EntityActionMenu({
  canDelete = true,
  canRename = true,
  contentAlign = 'end',
  deleteLabel = '删除',
  menuLabel,
  moveLabel = '移动...',
  onCloseAutoFocus,
  onCopyAbsolutePath,
  onCopyRelativePath,
  onDelete,
  onMove,
  onOpenChange,
  onOpenDefault,
  onRename,
  onRevealInFinder,
  open,
  extraActions,
  transcriptionAction,
  trigger,
  triggerClassName,
}: EntityActionMenuProps) {
  const defaultTrigger = (
    <Button
      type="button"
      variant="ghostIcon"
      size="icon"
      aria-label={menuLabel}
      className={triggerClassName}
    >
      <MoreHorizontal className="size-16" aria-hidden="true" />
    </Button>
  );

  return (
    <DropdownMenu
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange === undefined ? {} : { onOpenChange })}
    >
      <DropdownMenuTrigger asChild>{trigger ?? defaultTrigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={contentAlign}
        aria-label={menuLabel}
        aria-labelledby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
        side="bottom"
      >
        <EntityPathActionGroup
          onCopyAbsolutePath={onCopyAbsolutePath}
          onCopyRelativePath={onCopyRelativePath}
          onOpenDefault={onOpenDefault}
          onRevealInFinder={onRevealInFinder}
        />
        {transcriptionAction ? (
          <>
            <DropdownMenuSeparator className={entityActionMenuSeparatorClassName} />
            <DropdownMenuGroup>
              <EntityActionTranscriptionItem action={transcriptionAction} />
            </DropdownMenuGroup>
          </>
        ) : null}
        {extraActions && extraActions.length > 0 ? (
          <>
            <DropdownMenuSeparator className={entityActionMenuSeparatorClassName} />
            <DropdownMenuGroup>
              {extraActions.map((action) => (
                <EntityActionExtraItem key={action.label} action={action} />
              ))}
            </DropdownMenuGroup>
          </>
        ) : null}
        {onMove || canRename || canDelete ? (
          <>
            <DropdownMenuSeparator className={entityActionMenuSeparatorClassName} />
            <DropdownMenuGroup>
              {onMove ? (
                <DropdownMenuItem onSelect={onMove}>
                  <EntityActionMenuIcon icon={FolderInput} />
                  {moveLabel}
                </DropdownMenuItem>
              ) : null}
              {canRename ? (
                <DropdownMenuItem onSelect={onRename}>
                  <EntityActionMenuIcon icon={PencilLine} />
                  重命名
                </DropdownMenuItem>
              ) : null}
              {canDelete ? (
                <DropdownMenuItem onSelect={onDelete}>
                  <EntityActionMenuIcon icon={Trash2} />
                  {deleteLabel}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

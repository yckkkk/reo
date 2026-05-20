import { MoreHorizontal, PencilLine, RefreshCw, Trash2 } from 'lucide-react';
import type { ComponentProps, ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

export type EntityActionMenuProps = {
  readonly contentAlign?: ComponentProps<typeof DropdownMenuContent>['align'];
  readonly deleteLabel?: '删除' | '移除';
  readonly menuLabel: string;
  readonly onCloseAutoFocus?:
    | ComponentProps<typeof DropdownMenuContent>['onCloseAutoFocus']
    | undefined;
  readonly onCopyAbsolutePath: EntityPathAction;
  readonly onCopyRelativePath?: EntityPathAction | undefined;
  readonly onDelete: () => void;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
  readonly onOpenDefault: EntityPathAction;
  readonly onRename: () => void;
  readonly onRevealInFinder: EntityPathAction;
  readonly open?: boolean | undefined;
  readonly transcriptionAction?: EntityActionMenuTranscriptionAction | undefined;
  readonly trigger?: ReactElement | undefined;
  readonly triggerClassName?: string | undefined;
};

function EntityActionMenuIcon({ icon: Icon }: { readonly icon: typeof RefreshCw }) {
  return <Icon className="size-16 shrink-0 text-muted-foreground" aria-hidden="true" />;
}

function EntityActionTranscriptionItem({
  action,
}: {
  readonly action: EntityActionMenuTranscriptionAction;
}) {
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
      <EntityActionMenuIcon icon={RefreshCw} />
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

export function EntityActionMenu({
  contentAlign = 'end',
  deleteLabel = '删除',
  menuLabel,
  onCloseAutoFocus,
  onCopyAbsolutePath,
  onCopyRelativePath,
  onDelete,
  onOpenChange,
  onOpenDefault,
  onRename,
  onRevealInFinder,
  open,
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
        <DropdownMenuSeparator className={entityActionMenuSeparatorClassName} />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onRename}>
            <EntityActionMenuIcon icon={PencilLine} />
            重命名
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDelete}>
            <EntityActionMenuIcon icon={Trash2} />
            {deleteLabel}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import {
  Copy,
  ExternalLink,
  FolderOpen,
  MoreHorizontal,
  PencilLine,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { ComponentProps, ReactElement } from 'react';
import type { WorkspaceEntityActionResponse } from '../../../workspace-contract/workspace-contract';
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
import { toast } from '@/components/ui/toaster';
import { workspaceErrorDisplayMessage } from './workspaceErrorMessages';

export const entityActionMenuSeparatorClassName = 'mx-8 bg-foreground/20';

type EntityActionMenuAction = () => Promise<WorkspaceEntityActionResponse>;
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
  readonly onCopyAbsolutePath: EntityActionMenuAction;
  readonly onCopyRelativePath?: EntityActionMenuAction | undefined;
  readonly onDelete: () => void;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
  readonly onOpenDefault: EntityActionMenuAction;
  readonly onRename: () => void;
  readonly onRevealInFinder: EntityActionMenuAction;
  readonly open?: boolean | undefined;
  readonly transcriptionAction?: EntityActionMenuTranscriptionAction | undefined;
  readonly trigger?: ReactElement | undefined;
  readonly triggerClassName?: string | undefined;
};

function EntityActionMenuIcon({ icon: Icon }: { readonly icon: typeof ExternalLink }) {
  return <Icon className="size-16 shrink-0 text-muted-foreground" aria-hidden="true" />;
}

export function toastEntityActionError(response: WorkspaceEntityActionResponse) {
  if (!response.ok) {
    toast.error(workspaceErrorDisplayMessage(response.error, '操作失败，请重试。'));
    return false;
  }

  return true;
}

export function toastEntityPathCopied() {
  toast.success('已复制路径');
}

async function handleEntityAction(action: EntityActionMenuAction) {
  try {
    toastEntityActionError(await action());
  } catch {
    toast.error('操作失败，请重试。');
  }
}

async function handleEntityPathCopy(action: EntityActionMenuAction) {
  let copied: boolean;
  try {
    copied = toastEntityActionError(await action());
  } catch {
    toast.error('操作失败，请重试。');
    return;
  }

  if (copied) {
    toastEntityPathCopied();
  }
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
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => handleEntityAction(onOpenDefault)}>
            <EntityActionMenuIcon icon={ExternalLink} />
            用默认应用打开
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handleEntityAction(onRevealInFinder)}>
            <EntityActionMenuIcon icon={FolderOpen} />
            在访达中显示
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className={entityActionMenuSeparatorClassName} />
        <DropdownMenuGroup>
          {onCopyRelativePath ? (
            <DropdownMenuItem onSelect={() => handleEntityPathCopy(onCopyRelativePath)}>
              <EntityActionMenuIcon icon={Copy} />
              复制相对路径
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => handleEntityPathCopy(onCopyAbsolutePath)}>
            <EntityActionMenuIcon icon={Copy} />
            复制绝对路径
          </DropdownMenuItem>
        </DropdownMenuGroup>
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

import { Copy, Eraser, ExternalLink, FolderOpen, Maximize2, PencilLine } from 'lucide-react';
import type { ComponentProps, ReactElement } from 'react';
import type {
  WorkspaceEntityActionResponse,
  WorkspaceSegmentEntityActionRequest,
} from '../../../workspace-contract/workspace-contract';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toaster';
import { bindSegmentEntityActions } from './entityActionBindings';
import {
  entityActionMenuSeparatorClassName,
  toastEntityActionError,
  toastEntityPathCopied,
} from './entityActionMenu';

type SegmentContentActionsMenuAction = () => Promise<WorkspaceEntityActionResponse>;

export type SegmentContentActionsMenuProps = {
  readonly actionIdentity: WorkspaceSegmentEntityActionRequest;
  readonly clearDisabled?: boolean;
  readonly contentAlign?: ComponentProps<typeof DropdownMenuContent>['align'];
  readonly contentKind: 'body' | 'transcript';
  readonly editDisabled?: boolean;
  readonly menuLabel: string;
  readonly onClear: () => void;
  readonly onCloseAutoFocus?:
    | ComponentProps<typeof DropdownMenuContent>['onCloseAutoFocus']
    | undefined;
  readonly onEdit: () => void;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onRename: () => void;
  readonly open?: boolean;
  readonly trigger?: ReactElement;
};

function SegmentContentActionIcon({ icon: Icon }: { readonly icon: typeof ExternalLink }) {
  return <Icon className="size-16 shrink-0 text-muted-foreground" aria-hidden="true" />;
}

async function handleEntityAction(action: SegmentContentActionsMenuAction) {
  try {
    toastEntityActionError(await action());
  } catch {
    toast.error('操作失败，请重试。');
  }
}

async function handleEntityPathCopy(action: SegmentContentActionsMenuAction) {
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

export function SegmentContentActionsMenu({
  actionIdentity,
  clearDisabled = false,
  contentAlign = 'center',
  contentKind,
  editDisabled = false,
  menuLabel,
  onClear,
  onCloseAutoFocus,
  onEdit,
  onOpenChange,
  onRename,
  open,
  trigger,
}: SegmentContentActionsMenuProps) {
  const actionBindings = bindSegmentEntityActions(actionIdentity) as {
    readonly onCopyAbsolutePath: SegmentContentActionsMenuAction;
    readonly onCopyRelativePath: SegmentContentActionsMenuAction;
    readonly onOpenDefault: SegmentContentActionsMenuAction;
    readonly onRevealInFinder: SegmentContentActionsMenuAction;
  };
  const editLabel = contentKind === 'transcript' ? '编辑转录' : '编辑正文';
  const clearLabel = contentKind === 'transcript' ? '清空转录' : '清空正文';
  const defaultTrigger = (
    <Button type="button" variant="ghostIcon" size="icon" aria-label={menuLabel}>
      <Maximize2 className="size-16" aria-hidden="true" />
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
          <DropdownMenuItem onSelect={() => handleEntityAction(actionBindings.onOpenDefault)}>
            <SegmentContentActionIcon icon={ExternalLink} />
            用默认应用打开
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handleEntityAction(actionBindings.onRevealInFinder)}>
            <SegmentContentActionIcon icon={FolderOpen} />
            在访达中显示
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className={entityActionMenuSeparatorClassName} />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={() => handleEntityPathCopy(actionBindings.onCopyRelativePath)}
          >
            <SegmentContentActionIcon icon={Copy} />
            复制相对路径
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => handleEntityPathCopy(actionBindings.onCopyAbsolutePath)}
          >
            <SegmentContentActionIcon icon={Copy} />
            复制绝对路径
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className={entityActionMenuSeparatorClassName} />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={editDisabled} onSelect={onEdit}>
            <SegmentContentActionIcon icon={Maximize2} />
            {editLabel}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onRename}>
            <SegmentContentActionIcon icon={PencilLine} />
            重命名
          </DropdownMenuItem>
          <DropdownMenuItem disabled={clearDisabled} onSelect={onClear}>
            <SegmentContentActionIcon icon={Eraser} />
            {clearLabel}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

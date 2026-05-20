import { Copy, ExternalLink, FolderOpen } from 'lucide-react';
import type { WorkspaceEntityActionResponse } from '../../../workspace-contract/workspace-contract';
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toaster';
import { workspaceErrorDisplayMessage } from './workspaceErrorMessages';

export const entityActionMenuSeparatorClassName = 'mx-8 bg-foreground/20';

export type EntityPathAction = () => Promise<WorkspaceEntityActionResponse>;

export type EntityPathActionGroupProps = {
  readonly onCopyAbsolutePath: EntityPathAction;
  readonly onCopyRelativePath?: EntityPathAction | undefined;
  readonly onOpenDefault: EntityPathAction;
  readonly onRevealInFinder: EntityPathAction;
};

function EntityPathActionIcon({ icon: Icon }: { readonly icon: typeof ExternalLink }) {
  return <Icon className="size-16 shrink-0 text-muted-foreground" aria-hidden="true" />;
}

export function toastEntityActionError(response: WorkspaceEntityActionResponse) {
  if (!response.ok) {
    toast.error(workspaceErrorDisplayMessage(response.error, '操作失败，请重试。'));
    return false;
  }

  return true;
}

function toastEntityPathCopied() {
  toast.success('已复制路径');
}

async function handleEntityAction(action: EntityPathAction) {
  try {
    toastEntityActionError(await action());
  } catch {
    toast.error('操作失败，请重试。');
  }
}

async function handleEntityPathCopy(action: EntityPathAction) {
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

export function EntityPathActionGroup({
  onCopyAbsolutePath,
  onCopyRelativePath,
  onOpenDefault,
  onRevealInFinder,
}: EntityPathActionGroupProps) {
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuItem onSelect={() => handleEntityAction(onOpenDefault)}>
          <EntityPathActionIcon icon={ExternalLink} />
          用默认应用打开
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleEntityAction(onRevealInFinder)}>
          <EntityPathActionIcon icon={FolderOpen} />
          在访达中显示
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator className={entityActionMenuSeparatorClassName} />
      <DropdownMenuGroup>
        {onCopyRelativePath ? (
          <DropdownMenuItem onSelect={() => handleEntityPathCopy(onCopyRelativePath)}>
            <EntityPathActionIcon icon={Copy} />
            复制相对路径
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => handleEntityPathCopy(onCopyAbsolutePath)}>
          <EntityPathActionIcon icon={Copy} />
          复制绝对路径
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>
  );
}

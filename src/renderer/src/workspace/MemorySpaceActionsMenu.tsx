import type { ComponentProps, ReactElement } from 'react';
import type { WorkspaceMemorySpaceEntityActionRequest } from '../../../workspace-contract/workspace-contract';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { bindMemorySpaceEntityActions } from './entityActionBindings';
import { EntityActionMenu } from './entityActionMenu';

export type MemorySpaceActionIdentity = WorkspaceMemorySpaceEntityActionRequest;

export type MemorySpaceActionsMenuProps = {
  readonly actionIdentity: MemorySpaceActionIdentity;
  readonly contentAlign?: ComponentProps<typeof DropdownMenuContent>['align'];
  readonly memorySpaceTitle: string;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onRemove: () => void;
  readonly onRename: () => void;
  readonly open?: boolean;
  readonly trigger?: ReactElement;
  readonly triggerClassName?: string;
  readonly triggerLabel?: string;
};

export function MemorySpaceActionsMenu({
  actionIdentity,
  contentAlign = 'end',
  memorySpaceTitle,
  onOpenChange,
  onRemove,
  onRename,
  open,
  trigger,
  triggerClassName,
  triggerLabel,
}: MemorySpaceActionsMenuProps) {
  const menuLabel = triggerLabel ?? `${memorySpaceTitle} 更多操作`;
  const actionBindings = bindMemorySpaceEntityActions(actionIdentity);

  return (
    <EntityActionMenu
      contentAlign={contentAlign}
      deleteLabel="移除"
      menuLabel={menuLabel}
      onCopyAbsolutePath={actionBindings.onCopyAbsolutePath}
      onDelete={onRemove}
      onOpenChange={onOpenChange}
      onOpenDefault={actionBindings.onOpenDefault}
      onRename={onRename}
      onRevealInFinder={actionBindings.onRevealInFinder}
      open={open}
      trigger={trigger}
      triggerClassName={triggerClassName}
    />
  );
}

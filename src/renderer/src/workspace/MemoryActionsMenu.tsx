import type { ComponentProps, ReactElement } from 'react';
import type { WorkspaceMemoryEntityActionRequest } from '../../../workspace-contract/workspace-contract';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { bindMemoryEntityActions } from './entityActionBindings';
import { EntityActionMenu } from './entityActionMenu';

export type MemoryActionIdentity = WorkspaceMemoryEntityActionRequest;

export type MemoryActionsMenuProps = {
  readonly actionIdentity: MemoryActionIdentity;
  readonly contentAlign?: ComponentProps<typeof DropdownMenuContent>['align'];
  readonly memoryTitle: string;
  readonly onDelete: () => void;
  readonly onRename: () => void;
  readonly trigger?: ReactElement;
  readonly triggerLabel?: string;
};

export function MemoryActionsMenu({
  actionIdentity,
  contentAlign = 'end',
  memoryTitle,
  onDelete,
  onRename,
  trigger,
  triggerLabel,
}: MemoryActionsMenuProps) {
  const menuLabel = triggerLabel ?? `${memoryTitle} 更多操作`;
  const actionBindings = bindMemoryEntityActions(actionIdentity);

  return (
    <EntityActionMenu
      contentAlign={contentAlign}
      menuLabel={menuLabel}
      onCopyAbsolutePath={actionBindings.onCopyAbsolutePath}
      onCopyRelativePath={actionBindings.onCopyRelativePath}
      onDelete={onDelete}
      onOpenDefault={actionBindings.onOpenDefault}
      onRename={onRename}
      onRevealInFinder={actionBindings.onRevealInFinder}
      trigger={trigger}
    />
  );
}

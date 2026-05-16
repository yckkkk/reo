import type { ComponentProps, ReactElement } from 'react';
import type { WorkspaceSegmentEntityActionRequest } from '../../../workspace-contract/workspace-contract';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { bindSegmentEntityActions } from './entityActionBindings';
import { EntityActionMenu } from './entityActionMenu';

export type SegmentActionIdentity = WorkspaceSegmentEntityActionRequest;

export type SegmentActionsMenuProps = {
  readonly actionIdentity: SegmentActionIdentity;
  readonly contentAlign?: ComponentProps<typeof DropdownMenuContent>['align'];
  readonly onDelete: () => void;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onRename: () => void;
  readonly open?: boolean;
  readonly segmentTitle: string;
  readonly trigger?: ReactElement;
  readonly triggerLabel?: string;
};

export function SegmentActionsMenu({
  actionIdentity,
  contentAlign = 'end',
  onDelete,
  onOpenChange,
  onRename,
  open,
  segmentTitle,
  trigger,
  triggerLabel,
}: SegmentActionsMenuProps) {
  const menuLabel = triggerLabel ?? `${segmentTitle} 更多操作`;
  const actionBindings = bindSegmentEntityActions(actionIdentity);

  return (
    <EntityActionMenu
      contentAlign={contentAlign}
      menuLabel={menuLabel}
      onCopyAbsolutePath={actionBindings.onCopyAbsolutePath}
      onCopyRelativePath={actionBindings.onCopyRelativePath}
      onDelete={onDelete}
      onOpenChange={onOpenChange}
      onOpenDefault={actionBindings.onOpenDefault}
      onRename={onRename}
      onRevealInFinder={actionBindings.onRevealInFinder}
      open={open}
      trigger={trigger}
    />
  );
}

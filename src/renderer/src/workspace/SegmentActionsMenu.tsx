import type { ComponentProps, ReactElement } from 'react';
import type { WorkspaceSegmentEntityActionRequest } from '../../../workspace-contract/workspace-contract';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';
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
  const payload = actionIdentity;

  return (
    <EntityActionMenu
      contentAlign={contentAlign}
      menuLabel={menuLabel}
      onCopyAbsolutePath={() => window.reoWorkspace.copySegmentAbsolutePath(payload)}
      onCopyRelativePath={() => window.reoWorkspace.copySegmentRelativePath(payload)}
      onDelete={onDelete}
      onOpenChange={onOpenChange}
      onOpenDefault={() => window.reoWorkspace.openSegmentDocument(payload)}
      onRename={onRename}
      onRevealInFinder={() => window.reoWorkspace.revealSegmentInFinder(payload)}
      open={open}
      trigger={trigger}
    />
  );
}

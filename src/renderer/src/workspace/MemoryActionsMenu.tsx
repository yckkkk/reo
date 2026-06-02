import type { ComponentProps, ReactElement } from 'react';
import { ImageOff } from 'lucide-react';
import type {
  WorkspaceMemoryCoverProjection,
  WorkspaceMemoryEntityActionRequest,
} from '../../../workspace-contract/workspace-contract';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { bindMemoryEntityActions } from './entityActionBindings';
import { EntityActionMenu } from './entityActionMenu';

export type MemoryActionIdentity = WorkspaceMemoryEntityActionRequest;

export type MemoryActionsMenuProps = {
  readonly actionIdentity: MemoryActionIdentity;
  readonly contentAlign?: ComponentProps<typeof DropdownMenuContent>['align'];
  readonly cover?: WorkspaceMemoryCoverProjection | undefined;
  readonly memoryTitle: string;
  readonly onDelete: () => void;
  readonly onRename: () => void;
  readonly onResetCover: () => void;
  readonly trigger?: ReactElement;
  readonly triggerLabel?: string;
};

export function MemoryActionsMenu({
  actionIdentity,
  contentAlign = 'end',
  cover,
  memoryTitle,
  onDelete,
  onRename,
  onResetCover,
  trigger,
  triggerLabel,
}: MemoryActionsMenuProps) {
  const menuLabel = triggerLabel ?? `${memoryTitle} 更多操作`;
  const actionBindings = bindMemoryEntityActions(actionIdentity);
  const hasCustomCover = cover?.source === 'custom';

  return (
    <EntityActionMenu
      contentAlign={contentAlign}
      extraActions={[
        {
          disabledReason: hasCustomCover ? null : '当前已是随机默认图片。',
          icon: ImageOff,
          label: '恢复随机默认图片',
          onSelect: onResetCover,
        },
      ]}
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

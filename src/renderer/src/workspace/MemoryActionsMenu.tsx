import type { ComponentProps, ReactElement } from 'react';
import { ImageOff, Shuffle } from 'lucide-react';
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
  readonly canDelete?: boolean | undefined;
  readonly canRename?: boolean | undefined;
  readonly contentAlign?: ComponentProps<typeof DropdownMenuContent>['align'];
  readonly cover?: WorkspaceMemoryCoverProjection | undefined;
  readonly memoryTitle: string;
  readonly onDelete: () => void;
  readonly onMove?: (() => void) | undefined;
  readonly onRename: () => void;
  readonly onResetCover: () => void;
  readonly onSwitchDefaultCover: () => void;
  readonly trigger?: ReactElement;
  readonly triggerLabel?: string;
};

export function MemoryActionsMenu({
  actionIdentity,
  canDelete = true,
  canRename = true,
  contentAlign = 'end',
  cover,
  memoryTitle,
  onDelete,
  onMove,
  onRename,
  onResetCover,
  onSwitchDefaultCover,
  trigger,
  triggerLabel,
}: MemoryActionsMenuProps) {
  const menuLabel = triggerLabel ?? `${memoryTitle} 更多操作`;
  const actionBindings = bindMemoryEntityActions(actionIdentity);
  const hasCustomCover = cover?.source === 'custom';

  return (
    <EntityActionMenu
      canDelete={canDelete}
      canRename={canRename}
      contentAlign={contentAlign}
      extraActions={[
        {
          disabledReason: hasCustomCover ? null : '当前已是随机默认图片。',
          icon: ImageOff,
          label: '恢复随机默认图片',
          onSelect: onResetCover,
        },
        {
          disabledReason: hasCustomCover ? '当前使用自定义封面，请先恢复随机默认图片。' : null,
          icon: Shuffle,
          label: '切换随机默认图片',
          onSelect: onSwitchDefaultCover,
        },
      ]}
      menuLabel={menuLabel}
      moveLabel="移动记忆..."
      onCopyAbsolutePath={actionBindings.onCopyAbsolutePath}
      onCopyRelativePath={actionBindings.onCopyRelativePath}
      onDelete={onDelete}
      onMove={onMove}
      onOpenDefault={actionBindings.onOpenDefault}
      onRename={onRename}
      onRevealInFinder={actionBindings.onRevealInFinder}
      trigger={trigger}
    />
  );
}

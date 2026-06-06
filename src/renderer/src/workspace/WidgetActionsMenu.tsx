import type { ComponentProps, ReactElement } from 'react';
import { AppWindow, RefreshCw } from 'lucide-react';
import type { WorkspaceWidgetEntityActionRequest } from '../../../workspace-contract/workspace-contract';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { bindWidgetEntityActions } from './entityActionBindings';
import { EntityActionMenu, type EntityActionMenuExtraAction } from './entityActionMenu';

export type WidgetActionIdentity = WorkspaceWidgetEntityActionRequest;

type WidgetActionsMenuProps = {
  readonly actionIdentity: WidgetActionIdentity;
  readonly contentAlign?: ComponentProps<typeof DropdownMenuContent>['align'];
  readonly onDelete: () => void;
  readonly onRefresh: () => void;
  readonly onRename: () => void;
  readonly onRequestAgentUpdate: () => void;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
  readonly open?: boolean | undefined;
  readonly trigger?: ReactElement;
  readonly triggerLabel?: string;
  readonly widgetTitle: string;
};

export function WidgetActionsMenu({
  actionIdentity,
  contentAlign = 'end',
  onDelete,
  onOpenChange,
  onRefresh,
  onRename,
  onRequestAgentUpdate,
  open,
  trigger,
  triggerLabel,
  widgetTitle,
}: WidgetActionsMenuProps) {
  const menuLabel = triggerLabel ?? `${widgetTitle} 更多操作`;
  const actionBindings = bindWidgetEntityActions(actionIdentity);
  const extraActions: readonly EntityActionMenuExtraAction[] = [
    {
      icon: RefreshCw,
      label: '刷新页面',
      onSelect: onRefresh,
    },
    {
      icon: AppWindow,
      label: '让 Agent 更新 Widget',
      onSelect: onRequestAgentUpdate,
    },
  ];

  return (
    <EntityActionMenu
      contentAlign={contentAlign}
      extraActions={extraActions}
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

import type { ComponentProps, ReactElement } from 'react';
import type { WorkspaceSegmentSupplementEntityActionRequest } from '../../../workspace-contract/workspace-contract';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { bindSegmentSupplementEntityActions } from './entityActionBindings';
import { EntityActionMenu } from './entityActionMenu';

export type SegmentSupplementActionIdentity = WorkspaceSegmentSupplementEntityActionRequest;

export type SegmentSupplementActionsMenuProps = {
  readonly actionIdentity: SegmentSupplementActionIdentity;
  readonly contentAlign?: ComponentProps<typeof DropdownMenuContent>['align'];
  readonly onDelete: () => void;
  readonly onCloseAutoFocus?: ComponentProps<typeof DropdownMenuContent>['onCloseAutoFocus'];
  readonly onOpenChange?: (open: boolean) => void;
  readonly onRequestTranscriptionBackfill?: (() => void) | undefined;
  readonly onRename: () => void;
  readonly open?: boolean;
  readonly supplementTitle: string;
  readonly transcriptExists?: boolean | undefined;
  readonly transcriptionBackfillDisabledReason?: string | null | undefined;
  readonly trigger?: ReactElement;
  readonly triggerLabel?: string;
};

export function SegmentSupplementActionsMenu({
  actionIdentity,
  contentAlign = 'end',
  onDelete,
  onCloseAutoFocus,
  onOpenChange,
  onRequestTranscriptionBackfill,
  onRename,
  open,
  supplementTitle,
  transcriptExists = false,
  transcriptionBackfillDisabledReason = null,
  trigger,
  triggerLabel,
}: SegmentSupplementActionsMenuProps) {
  const menuLabel = triggerLabel ?? `${supplementTitle} 更多操作`;
  const actionBindings = bindSegmentSupplementEntityActions(actionIdentity);

  return (
    <EntityActionMenu
      contentAlign={contentAlign}
      menuLabel={menuLabel}
      onCloseAutoFocus={onCloseAutoFocus}
      onCopyAbsolutePath={actionBindings.onCopyAbsolutePath}
      onCopyRelativePath={actionBindings.onCopyRelativePath}
      onDelete={onDelete}
      onOpenChange={onOpenChange}
      onOpenDefault={actionBindings.onOpenDefault}
      onRename={onRename}
      onRevealInFinder={actionBindings.onRevealInFinder}
      open={open}
      transcriptionAction={
        onRequestTranscriptionBackfill
          ? {
              disabledReason: transcriptionBackfillDisabledReason,
              label: transcriptExists ? '重新生成转录' : '生成转录',
              onSelect: onRequestTranscriptionBackfill,
            }
          : undefined
      }
      trigger={trigger}
    />
  );
}

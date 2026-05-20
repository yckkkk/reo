import type { ComponentProps, ReactElement } from 'react';
import type { WorkspaceSegmentEntityActionRequest } from '../../../workspace-contract/workspace-contract';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { bindSegmentEntityActions } from './entityActionBindings';
import { EntityActionMenu } from './entityActionMenu';

export type SegmentActionIdentity = WorkspaceSegmentEntityActionRequest;

export type SegmentActionsMenuProps = {
  readonly actionIdentity: SegmentActionIdentity;
  readonly contentAlign?: ComponentProps<typeof DropdownMenuContent>['align'];
  readonly onCloseAutoFocus?: ComponentProps<typeof DropdownMenuContent>['onCloseAutoFocus'];
  readonly onDelete: () => void;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onRequestTranscriptionBackfill?: (() => void) | undefined;
  readonly onRename: () => void;
  readonly open?: boolean;
  readonly segmentTitle: string;
  readonly transcriptExists?: boolean | undefined;
  readonly transcriptionBackfillDisabledReason?: string | null | undefined;
  readonly trigger?: ReactElement;
  readonly triggerLabel?: string;
};

export function SegmentActionsMenu({
  actionIdentity,
  contentAlign = 'end',
  onCloseAutoFocus,
  onDelete,
  onOpenChange,
  onRequestTranscriptionBackfill,
  onRename,
  open,
  segmentTitle,
  transcriptExists = false,
  transcriptionBackfillDisabledReason = null,
  trigger,
  triggerLabel,
}: SegmentActionsMenuProps) {
  const menuLabel = triggerLabel ?? `${segmentTitle} 更多操作`;
  const actionBindings = bindSegmentEntityActions(actionIdentity);

  return (
    <EntityActionMenu
      contentAlign={contentAlign}
      onCloseAutoFocus={onCloseAutoFocus}
      menuLabel={menuLabel}
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

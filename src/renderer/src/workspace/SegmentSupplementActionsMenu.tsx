import type { ComponentProps, ReactElement } from 'react';
import { AppWindow, RefreshCw } from 'lucide-react';
import type { WorkspaceSegmentSupplementEntityActionRequest } from '../../../workspace-contract/workspace-contract';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';
import type { VoiceSpeechSynthesisSpeaker } from '../voiceSpeechSynthesisSpeakers';
import { bindSegmentSupplementEntityActions } from './entityActionBindings';
import { EntityActionMenu, type EntityActionMenuExtraAction } from './entityActionMenu';
import { createSpeechSynthesisExtraAction } from './speechSynthesisMenuAction';

export type SegmentSupplementActionIdentity = WorkspaceSegmentSupplementEntityActionRequest;

export type SegmentSupplementActionsMenuProps = {
  readonly actionIdentity: SegmentSupplementActionIdentity;
  readonly contentAlign?: ComponentProps<typeof DropdownMenuContent>['align'];
  readonly onDelete: () => void;
  readonly onCloseAutoFocus?: ComponentProps<typeof DropdownMenuContent>['onCloseAutoFocus'];
  readonly onMove?: (() => void) | undefined;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onRequestArtifactRefresh?: (() => void) | undefined;
  readonly onRequestArtifactUpdate?: (() => void) | undefined;
  readonly onRequestSpeechSynthesis?: ((speaker: VoiceSpeechSynthesisSpeaker) => void) | undefined;
  readonly onRequestTranscriptionBackfill?: (() => void) | undefined;
  readonly onRename: () => void;
  readonly open?: boolean;
  readonly speechSynthesisDisabledReason?: string | null | undefined;
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
  onMove,
  onOpenChange,
  onRequestArtifactRefresh,
  onRequestArtifactUpdate,
  onRequestSpeechSynthesis,
  onRequestTranscriptionBackfill,
  onRename,
  open,
  speechSynthesisDisabledReason = null,
  supplementTitle,
  transcriptExists = false,
  transcriptionBackfillDisabledReason = null,
  trigger,
  triggerLabel,
}: SegmentSupplementActionsMenuProps) {
  const menuLabel = triggerLabel ?? `${supplementTitle} 更多操作`;
  const actionBindings = bindSegmentSupplementEntityActions(actionIdentity);
  const extraActions: readonly EntityActionMenuExtraAction[] = [
    ...(onRequestArtifactRefresh
      ? [
          {
            icon: RefreshCw,
            label: '刷新页面',
            onSelect: onRequestArtifactRefresh,
          },
        ]
      : []),
    ...(onRequestArtifactUpdate
      ? [
          {
            icon: AppWindow,
            items: [{ label: '更新作品', onSelect: onRequestArtifactUpdate }],
            kind: 'submenu' as const,
            label: 'Agent 操作',
          },
        ]
      : []),
    ...(onRequestSpeechSynthesis
      ? [createSpeechSynthesisExtraAction(onRequestSpeechSynthesis, speechSynthesisDisabledReason)]
      : []),
  ];

  return (
    <EntityActionMenu
      contentAlign={contentAlign}
      menuLabel={menuLabel}
      onCloseAutoFocus={onCloseAutoFocus}
      onCopyAbsolutePath={actionBindings.onCopyAbsolutePath}
      onCopyRelativePath={actionBindings.onCopyRelativePath}
      onDelete={onDelete}
      onMove={onMove}
      onOpenChange={onOpenChange}
      onOpenDefault={actionBindings.onOpenDefault}
      onRename={onRename}
      onRevealInFinder={actionBindings.onRevealInFinder}
      open={open}
      extraActions={extraActions}
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

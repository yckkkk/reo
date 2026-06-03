import type { ComponentProps, ReactElement } from 'react';
import { AppWindow, ImageOff, Shuffle } from 'lucide-react';
import type {
  WorkspaceCoverProjection,
  WorkspaceSegmentEntityActionRequest,
} from '../../../workspace-contract/workspace-contract';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';
import type { VoiceSpeechSynthesisSpeaker } from '../voiceSpeechSynthesisSpeakers';
import { bindSegmentEntityActions } from './entityActionBindings';
import { EntityActionMenu, type EntityActionMenuExtraAction } from './entityActionMenu';
import { createSpeechSynthesisExtraAction } from './speechSynthesisMenuAction';

export type SegmentActionIdentity = WorkspaceSegmentEntityActionRequest;

export type SegmentActionsMenuProps = {
  readonly actionIdentity: SegmentActionIdentity;
  readonly contentAlign?: ComponentProps<typeof DropdownMenuContent>['align'];
  readonly cover?: WorkspaceCoverProjection | undefined;
  readonly onCloseAutoFocus?: ComponentProps<typeof DropdownMenuContent>['onCloseAutoFocus'];
  readonly onDelete: () => void;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onRequestArtifactUpdate?: (() => void) | undefined;
  readonly onRequestSpeechSynthesis?: ((speaker: VoiceSpeechSynthesisSpeaker) => void) | undefined;
  readonly onRequestTranscriptionBackfill?: (() => void) | undefined;
  readonly onRename: () => void;
  readonly onResetCover: () => void;
  readonly onSwitchDefaultCover: () => void;
  readonly open?: boolean;
  readonly segmentTitle: string;
  readonly speechSynthesisDisabledReason?: string | null | undefined;
  readonly transcriptExists?: boolean | undefined;
  readonly transcriptionBackfillDisabledReason?: string | null | undefined;
  readonly trigger?: ReactElement;
  readonly triggerLabel?: string;
};

export function SegmentActionsMenu({
  actionIdentity,
  contentAlign = 'end',
  cover,
  onCloseAutoFocus,
  onDelete,
  onOpenChange,
  onRequestArtifactUpdate,
  onRequestSpeechSynthesis,
  onRequestTranscriptionBackfill,
  onRename,
  onResetCover,
  onSwitchDefaultCover,
  open,
  segmentTitle,
  speechSynthesisDisabledReason = null,
  transcriptExists = false,
  transcriptionBackfillDisabledReason = null,
  trigger,
  triggerLabel,
}: SegmentActionsMenuProps) {
  const menuLabel = triggerLabel ?? `${segmentTitle} 更多操作`;
  const actionBindings = bindSegmentEntityActions(actionIdentity);
  const hasCustomCover = cover?.source === 'custom';
  const extraActions: readonly EntityActionMenuExtraAction[] = [
    ...(onRequestArtifactUpdate
      ? [
          {
            icon: AppWindow,
            label: '让 Agent 更新作品',
            onSelect: onRequestArtifactUpdate,
          },
        ]
      : []),
    ...(onRequestSpeechSynthesis
      ? [createSpeechSynthesisExtraAction(onRequestSpeechSynthesis, speechSynthesisDisabledReason)]
      : []),
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
  ];

  return (
    <EntityActionMenu
      contentAlign={contentAlign}
      extraActions={extraActions}
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

import {
  AppWindow,
  Ellipsis,
  Eraser,
  FolderInput,
  PencilLine,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentProps, ReactElement } from 'react';
import type { WorkspaceSegmentEntityActionRequest } from '../../../workspace-contract/workspace-contract';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { VoiceSpeechSynthesisSpeaker } from '../voiceSpeechSynthesisSpeakers';
import { bindSegmentEntityActions } from './entityActionBindings';
import { EntityPathActionGroup, entityActionMenuSeparatorClassName } from './EntityPathActionGroup';
import { SpeechSynthesisSpeakerSubmenu } from './speechSynthesisMenuAction';

export type SegmentContentActionsMenuProps = {
  readonly actionIdentity: WorkspaceSegmentEntityActionRequest;
  readonly clearDisabled?: boolean;
  readonly contentAlign?: ComponentProps<typeof DropdownMenuContent>['align'];
  readonly contentKind: 'artifact' | 'body' | 'transcript';
  readonly menuLabel: string;
  readonly onClear?: (() => void) | undefined;
  readonly onCloseAutoFocus?:
    | ComponentProps<typeof DropdownMenuContent>['onCloseAutoFocus']
    | undefined;
  readonly onMoveSegment?: (() => void) | undefined;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onRequestArtifactRefresh?: (() => void) | undefined;
  readonly onRequestArtifactUpdate?: (() => void) | undefined;
  readonly onRequestSpeechSynthesis?: ((speaker: VoiceSpeechSynthesisSpeaker) => void) | undefined;
  readonly onRequestTranscriptionBackfill?: (() => void) | undefined;
  readonly onRename?: (() => void) | undefined;
  readonly open?: boolean;
  readonly speechSynthesisDisabledReason?: string | null | undefined;
  readonly transcriptExists?: boolean | undefined;
  readonly transcriptionBackfillDisabledReason?: string | null | undefined;
  readonly trigger?: ReactElement;
};

function SegmentContentActionIcon({ icon: Icon }: { readonly icon: LucideIcon }) {
  return <Icon className="size-16 shrink-0 text-muted-foreground" aria-hidden="true" />;
}

function disabledReasonExists(reason: string | null | undefined) {
  return reason !== null && reason !== undefined;
}

function SegmentContentAgentActionsSubmenu({
  onRequestArtifactUpdate,
}: {
  readonly onRequestArtifactUpdate: () => void;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <SegmentContentActionIcon icon={AppWindow} />
        Agent 操作
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem onSelect={onRequestArtifactUpdate}>更新作品</DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function SegmentContentActionsMenu({
  actionIdentity,
  clearDisabled = false,
  contentAlign = 'center',
  contentKind,
  menuLabel,
  onClear,
  onCloseAutoFocus,
  onMoveSegment,
  onOpenChange,
  onRequestArtifactRefresh,
  onRequestArtifactUpdate,
  onRequestSpeechSynthesis,
  onRequestTranscriptionBackfill,
  onRename,
  open,
  speechSynthesisDisabledReason = null,
  transcriptExists = false,
  transcriptionBackfillDisabledReason = null,
  trigger,
}: SegmentContentActionsMenuProps) {
  const actionBindings = bindSegmentEntityActions(actionIdentity);
  const clearLabel = contentKind === 'transcript' ? '清空转录' : '清空正文';
  const showArtifactRefresh = contentKind === 'artifact' && onRequestArtifactRefresh;
  const showArtifactUpdate = contentKind === 'artifact' && onRequestArtifactUpdate;
  const transcriptionBackfillDisabled = disabledReasonExists(transcriptionBackfillDisabledReason);
  const showSpeechSynthesis = contentKind === 'body' && onRequestSpeechSynthesis;
  const showTranscriptionBackfill = contentKind === 'transcript' && onRequestTranscriptionBackfill;
  const defaultTrigger = (
    <Button type="button" variant="ghostIcon" size="icon" aria-label={menuLabel}>
      <Ellipsis className="size-16" aria-hidden="true" />
    </Button>
  );

  return (
    <DropdownMenu
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange === undefined ? {} : { onOpenChange })}
    >
      <DropdownMenuTrigger asChild>{trigger ?? defaultTrigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={contentAlign}
        aria-label={menuLabel}
        aria-labelledby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
        side="bottom"
      >
        <EntityPathActionGroup
          onCopyAbsolutePath={actionBindings.onCopyAbsolutePath}
          onCopyRelativePath={actionBindings.onCopyRelativePath}
          onOpenDefault={actionBindings.onOpenDefault}
          onRevealInFinder={actionBindings.onRevealInFinder}
        />
        {showArtifactRefresh ||
        showArtifactUpdate ||
        showSpeechSynthesis ||
        showTranscriptionBackfill ? (
          <>
            <DropdownMenuSeparator className={entityActionMenuSeparatorClassName} />
            <DropdownMenuGroup>
              {showArtifactRefresh ? (
                <DropdownMenuItem onSelect={onRequestArtifactRefresh}>
                  <SegmentContentActionIcon icon={RefreshCw} />
                  刷新页面
                </DropdownMenuItem>
              ) : null}
              {showArtifactUpdate ? (
                <SegmentContentAgentActionsSubmenu
                  onRequestArtifactUpdate={onRequestArtifactUpdate}
                />
              ) : null}
              {showSpeechSynthesis ? (
                <SpeechSynthesisSpeakerSubmenu
                  disabledReason={speechSynthesisDisabledReason}
                  onSelect={onRequestSpeechSynthesis}
                />
              ) : null}
              {showTranscriptionBackfill ? (
                <DropdownMenuItem
                  disabled={transcriptionBackfillDisabled}
                  title={
                    transcriptionBackfillDisabled ? transcriptionBackfillDisabledReason : undefined
                  }
                  onSelect={(event) => {
                    if (transcriptionBackfillDisabled) {
                      event.preventDefault();
                      return;
                    }
                    onRequestTranscriptionBackfill();
                  }}
                >
                  <SegmentContentActionIcon icon={RefreshCw} />
                  {transcriptExists ? '重新生成转录' : '生成转录'}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
          </>
        ) : null}
        {onMoveSegment || (contentKind !== 'artifact' && onClear && onRename) ? (
          <>
            <DropdownMenuSeparator className={entityActionMenuSeparatorClassName} />
            <DropdownMenuGroup>
              {onMoveSegment ? (
                <DropdownMenuItem onSelect={onMoveSegment}>
                  <SegmentContentActionIcon icon={FolderInput} />
                  移动片段...
                </DropdownMenuItem>
              ) : null}
              {contentKind !== 'artifact' && onRename ? (
                <DropdownMenuItem onSelect={onRename}>
                  <SegmentContentActionIcon icon={PencilLine} />
                  重命名
                </DropdownMenuItem>
              ) : null}
              {contentKind !== 'artifact' && onClear ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive data-[disabled]:text-destructive/50 data-[highlighted]:text-destructive"
                  disabled={clearDisabled}
                  onSelect={onClear}
                >
                  <SegmentContentActionIcon icon={Eraser} />
                  {clearLabel}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

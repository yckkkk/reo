import { WorkspaceDangerConfirmDialog } from './WorkspaceDangerConfirmDialog';
import type { SegmentAttachmentDeleteTarget } from './segmentActionTargets';

type SegmentAttachmentDeleteDialogProps = {
  readonly disabled?: boolean;
  readonly onConfirm: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly target: SegmentAttachmentDeleteTarget | null;
};

export function SegmentAttachmentDeleteDialog({
  disabled = false,
  onConfirm,
  onOpenChange,
  open,
  target,
}: SegmentAttachmentDeleteDialogProps) {
  const attachmentTitle = target?.attachment.title ?? '这个补充内容';

  return (
    <WorkspaceDangerConfirmDialog
      description={`删除“${attachmentTitle}”？音频、转录和元数据会先进入恢复区。`}
      disabled={disabled}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      title="删除补充内容"
    />
  );
}

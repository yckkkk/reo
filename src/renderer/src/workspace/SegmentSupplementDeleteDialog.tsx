import { WorkspaceDangerConfirmDialog } from './WorkspaceDangerConfirmDialog';
import type { SegmentSupplementDeleteTarget } from './segmentActionTargets';

type SegmentSupplementDeleteDialogProps = {
  readonly disabled?: boolean;
  readonly onConfirm: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly target: SegmentSupplementDeleteTarget | null;
};

export function SegmentSupplementDeleteDialog({
  disabled = false,
  onConfirm,
  onOpenChange,
  open,
  target,
}: SegmentSupplementDeleteDialogProps) {
  const supplementTitle = target?.supplement.title ?? '这个补充内容';

  return (
    <WorkspaceDangerConfirmDialog
      description={`删除“${supplementTitle}”？音频、转录和元数据会先进入恢复区。`}
      disabled={disabled}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      title="删除补充内容"
    />
  );
}

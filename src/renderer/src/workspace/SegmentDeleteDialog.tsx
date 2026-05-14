import { WorkspaceDangerConfirmDialog } from './WorkspaceDangerConfirmDialog';
import type { SegmentDeleteTarget } from './segmentActionTargets';

type SegmentDeleteDialogProps = {
  readonly disabled?: boolean;
  readonly onConfirm: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly target: SegmentDeleteTarget | null;
};

export function SegmentDeleteDialog({
  disabled = false,
  onConfirm,
  onOpenChange,
  open,
  target,
}: SegmentDeleteDialogProps) {
  const segmentTitle = target?.segment.title ?? '这段录音';

  return (
    <WorkspaceDangerConfirmDialog
      description={`删除“${segmentTitle}”？补充录音会随片段一起进入恢复区。`}
      disabled={disabled}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      title="删除片段"
    />
  );
}

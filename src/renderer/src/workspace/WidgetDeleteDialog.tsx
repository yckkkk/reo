import type { WorkspaceWidgetProjection } from './workspaceApi';
import { WorkspaceDangerConfirmDialog } from './WorkspaceDangerConfirmDialog';

type WidgetDeleteDialogProps = {
  readonly disabled: boolean;
  readonly onConfirm: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly widget: WorkspaceWidgetProjection | null;
};

export function WidgetDeleteDialog({
  disabled,
  onConfirm,
  onOpenChange,
  open,
  widget,
}: WidgetDeleteDialogProps) {
  const widgetTitle = widget?.title ?? '这个 Widget';

  return (
    <WorkspaceDangerConfirmDialog
      confirmLabel="删除 Widget"
      description={`删除“${widgetTitle}”？Reo 会把这个 Widget 移入回收区，可从提示中恢复。`}
      disabled={disabled}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      title="删除 Widget"
    />
  );
}

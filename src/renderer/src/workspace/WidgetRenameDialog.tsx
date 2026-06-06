import type { WorkspaceWidgetProjection } from './workspaceApi';
import { MemoryTitleDialog } from './MemoryTitleDialog';

type WidgetRenameDialogProps = {
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: (widget: WorkspaceWidgetProjection, title: string) => Promise<string | null>;
  readonly open: boolean;
  readonly widget: WorkspaceWidgetProjection | null;
};

export function WidgetRenameDialog({
  onOpenChange,
  onSave,
  open,
  widget,
}: WidgetRenameDialogProps) {
  return (
    <MemoryTitleDialog
      description="组件名称会写回 widget.md。"
      initialTitle={widget?.title ?? ''}
      fieldLabel="组件名称"
      onOpenChange={onOpenChange}
      onSubmitTitle={(title) => (widget ? onSave(widget, title) : Promise.resolve(null))}
      open={open}
      saveErrorTitle="无法重命名组件"
      submitLabel="保存"
      title="重命名组件"
    />
  );
}

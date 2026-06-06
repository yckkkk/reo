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
      description="Widget 名称会写回 widget.md。"
      initialTitle={widget?.title ?? ''}
      fieldLabel="Widget 名称"
      onOpenChange={onOpenChange}
      onSubmitTitle={(title) => (widget ? onSave(widget, title) : Promise.resolve(null))}
      open={open}
      saveErrorTitle="无法重命名 Widget"
      submitLabel="保存"
      title="重命名 Widget"
    />
  );
}

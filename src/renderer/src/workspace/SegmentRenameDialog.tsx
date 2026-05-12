import { MemoryTitleDialog } from './MemoryTitleDialog';
import type { WorkspaceMemoryDetail } from './workspaceApi';

type SegmentRenameTarget = {
  readonly memoryId: string;
  readonly segment: WorkspaceMemoryDetail['segments'][number];
};

type SegmentRenameDialogProps = {
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: (target: SegmentRenameTarget, title: string) => Promise<string | null>;
  readonly open: boolean;
  readonly target: SegmentRenameTarget | null;
};

export function SegmentRenameDialog({
  onOpenChange,
  onSave,
  open,
  target,
}: SegmentRenameDialogProps) {
  return (
    <MemoryTitleDialog
      description="保持简短且易识别"
      fieldLabel="片段名称"
      initialTitle={target?.segment.title ?? ''}
      labelClassName="sr-only"
      maxLengthMessage="片段名称过长"
      onOpenChange={onOpenChange}
      onSubmitTitle={(title) => (target ? onSave(target, title) : Promise.resolve(null))}
      open={open}
      requiredMessage="请输入片段名称"
      saveErrorTitle="无法保存片段名称"
      submitLabel="保存"
      title="重命名片段"
    />
  );
}

export type { SegmentRenameTarget };

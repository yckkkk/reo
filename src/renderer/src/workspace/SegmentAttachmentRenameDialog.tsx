import { MemoryTitleDialog } from './MemoryTitleDialog';
import type { SegmentAttachmentRenameTarget } from './segmentActionTargets';

type SegmentAttachmentRenameDialogProps = {
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: (target: SegmentAttachmentRenameTarget, title: string) => Promise<string | null>;
  readonly open: boolean;
  readonly target: SegmentAttachmentRenameTarget | null;
};

export function SegmentAttachmentRenameDialog({
  onOpenChange,
  onSave,
  open,
  target,
}: SegmentAttachmentRenameDialogProps) {
  return (
    <MemoryTitleDialog
      description="保持简短且易识别"
      fieldLabel="补充内容名称"
      initialTitle={target?.attachment.title ?? ''}
      labelClassName="sr-only"
      maxLengthMessage="补充内容名称过长"
      onOpenChange={onOpenChange}
      onSubmitTitle={(title) => (target ? onSave(target, title) : Promise.resolve(null))}
      open={open}
      requiredMessage="请输入补充内容名称"
      saveErrorTitle="无法保存补充内容名称"
      submitLabel="保存"
      title="重命名补充内容"
    />
  );
}

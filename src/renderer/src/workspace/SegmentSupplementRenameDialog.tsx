import { MemoryTitleDialog } from './MemoryTitleDialog';
import type { SegmentSupplementRenameTarget } from './segmentActionTargets';

type SegmentSupplementRenameDialogProps = {
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: (target: SegmentSupplementRenameTarget, title: string) => Promise<string | null>;
  readonly open: boolean;
  readonly target: SegmentSupplementRenameTarget | null;
};

export function SegmentSupplementRenameDialog({
  onOpenChange,
  onSave,
  open,
  target,
}: SegmentSupplementRenameDialogProps) {
  return (
    <MemoryTitleDialog
      description="保持简短且易识别"
      fieldLabel="补充内容名称"
      initialTitle={target?.supplement.title ?? ''}
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

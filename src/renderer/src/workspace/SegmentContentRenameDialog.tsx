import { MemoryTitleDialog } from './MemoryTitleDialog';
import type { SegmentContentRenameTarget } from './segmentActionTargets';

type SegmentContentRenameDialogProps = {
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: (target: SegmentContentRenameTarget, title: string) => Promise<string | null>;
  readonly open: boolean;
  readonly target: SegmentContentRenameTarget | null;
};

export function SegmentContentRenameDialog({
  onOpenChange,
  onSave,
  open,
  target,
}: SegmentContentRenameDialogProps) {
  const copy =
    target?.contentKind === 'body'
      ? {
          fieldLabel: '正文名称',
          maxLengthMessage: '正文名称过长',
          requiredMessage: '请输入正文名称',
          saveErrorTitle: '无法保存正文名称',
          title: '重命名正文',
        }
      : {
          fieldLabel: '转录名称',
          maxLengthMessage: '转录名称过长',
          requiredMessage: '请输入转录名称',
          saveErrorTitle: '无法保存转录名称',
          title: '重命名转录',
        };

  return (
    <MemoryTitleDialog
      description="保持简短且易识别"
      fieldLabel={copy.fieldLabel}
      initialTitle={target?.currentTitle ?? ''}
      labelClassName="sr-only"
      maxLengthMessage={copy.maxLengthMessage}
      onOpenChange={onOpenChange}
      onSubmitTitle={(title) => (target ? onSave(target, title) : Promise.resolve(null))}
      open={open}
      requiredMessage={copy.requiredMessage}
      saveErrorTitle={copy.saveErrorTitle}
      submitLabel="保存"
      title={copy.title}
    />
  );
}

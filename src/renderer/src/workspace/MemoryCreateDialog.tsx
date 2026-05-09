import { MemoryTitleDialog } from './MemoryTitleDialog';

type MemoryCreateDialogProps = {
  readonly description: string;
  readonly onCreate: (title: string) => Promise<string | null>;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly submitLabel: string;
};

export function MemoryCreateDialog({
  description,
  onCreate,
  onOpenChange,
  open,
  submitLabel,
}: MemoryCreateDialogProps) {
  return (
    <MemoryTitleDialog
      description={description}
      labelClassName="mb-8"
      onOpenChange={onOpenChange}
      onSubmitTitle={onCreate}
      open={open}
      placeholder="例如：产品灵感与思考"
      submitLabel={submitLabel}
      title="新建记忆"
    />
  );
}

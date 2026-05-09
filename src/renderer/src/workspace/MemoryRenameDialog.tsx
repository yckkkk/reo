import { MemoryTitleDialog } from './MemoryTitleDialog';
import type { WorkspaceMemorySummary } from './workspaceApi';

type MemoryRenameDialogProps = {
  readonly memory: WorkspaceMemorySummary | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: (memory: WorkspaceMemorySummary, title: string) => Promise<string | null>;
  readonly open: boolean;
};

export function MemoryRenameDialog({
  memory,
  onOpenChange,
  onSave,
  open,
}: MemoryRenameDialogProps) {
  return (
    <MemoryTitleDialog
      description="保持简短且易识别"
      initialTitle={memory?.title ?? ''}
      labelClassName="sr-only"
      onOpenChange={onOpenChange}
      onSubmitTitle={(title) => (memory ? onSave(memory, title) : Promise.resolve(null))}
      open={open}
      submitLabel="保存"
      title="重命名记忆"
    />
  );
}

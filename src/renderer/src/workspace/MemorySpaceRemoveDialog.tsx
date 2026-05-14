import { WorkspaceDangerConfirmDialog } from './WorkspaceDangerConfirmDialog';

type MemorySpaceRemoveDialogProps = {
  readonly disabled?: boolean;
  readonly onConfirm: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly workspaceTitle?: string | undefined;
};

export function MemorySpaceRemoveDialog({
  disabled = false,
  onConfirm,
  onOpenChange,
  open,
  workspaceTitle,
}: MemorySpaceRemoveDialogProps) {
  const targetTitle = workspaceTitle ?? '这个记忆空间';

  return (
    <WorkspaceDangerConfirmDialog
      confirmLabel="移除"
      description={`从 Reo 的记忆空间列表中移除“${targetTitle}”？本地文件夹不会被删除。`}
      disabled={disabled}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      title="移除记忆空间"
    />
  );
}

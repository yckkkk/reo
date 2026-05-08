import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>移除记忆空间</DialogTitle>
          <DialogDescription>
            是否从 Reo 的记忆空间列表中移除
            {workspaceTitle ? `「${workspaceTitle}」` : '这个记忆空间'}？
          </DialogDescription>
        </DialogHeader>

        <p className="text-ui-sm leading-ui-sm text-gravel">本地文件夹不会被删除。</p>

        <div className="flex justify-end gap-8">
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button type="button" disabled={disabled} onClick={onConfirm}>
            移除
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

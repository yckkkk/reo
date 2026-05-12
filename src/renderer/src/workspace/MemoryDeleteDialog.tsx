import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { WorkspaceMemorySummary } from './workspaceApi';

type MemoryDeleteDialogProps = {
  readonly disabled?: boolean;
  readonly memory: WorkspaceMemorySummary | null;
  readonly onConfirm: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
};

export function MemoryDeleteDialog({
  disabled = false,
  memory,
  onConfirm,
  onOpenChange,
  open,
}: MemoryDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover shadow-modal">
        <DialogHeader>
          <DialogTitle>删除记忆</DialogTitle>
          <DialogDescription>是否删除这条记忆？</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-card px-16 py-14">
          <p className="text-body-lg font-semibold leading-body-lg text-foreground">
            {memory?.title ?? '这条记忆'}
          </p>
          <p className="mt-8 text-body leading-body text-muted-foreground">
            片段和补充录音会先进入恢复区。
          </p>
        </div>

        <div className="flex justify-end gap-8">
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button type="button" variant="destructive" disabled={disabled} onClick={onConfirm}>
            删除
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
      <DialogContent className="border-2 border-glass-border-highlight bg-card-glass shadow-glass">
        <DialogHeader>
          <DialogTitle>删除记忆</DialogTitle>
          <DialogDescription>是否删除这条记忆？</DialogDescription>
        </DialogHeader>

        <div className="rounded-cards border border-chalk bg-eggshell px-16 py-14">
          <p className="text-body-lg font-semibold leading-body-lg text-obsidian">
            {memory?.title ?? '这条记忆'}
          </p>
          <p className="mt-8 text-body leading-body text-gravel">片段和补充录音会先进入恢复区。</p>
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
          <Button type="button" disabled={disabled} onClick={onConfirm}>
            删除
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

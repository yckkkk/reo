import { X } from 'lucide-react';
import { useLayoutEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CREATE_WORKSPACE_TITLE_INPUT_ID, CreateWorkspaceForm } from './CreateWorkspaceForm';
import type { WorkspaceSession } from './workspaceApi';

type WorkspaceCreateDialogProps = {
  readonly disabled?: boolean;
  readonly onCreateFinish: () => void;
  readonly onCreateStart: () => boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onWorkspaceReady: (workspaceSession: WorkspaceSession) => boolean | Promise<boolean>;
  readonly open: boolean;
};

export function WorkspaceCreateDialog({
  disabled = false,
  onCreateFinish,
  onCreateStart,
  onOpenChange,
  onWorkspaceReady,
  open,
}: WorkspaceCreateDialogProps) {
  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    document.getElementById(CREATE_WORKSPACE_TITLE_INPUT_ID)?.focus();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100vh-(var(--spacing-40)*2))] overflow-y-auto sm:w-[min(var(--container-form),calc(100vw-(var(--spacing-40)*2)))]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById(CREATE_WORKSPACE_TITLE_INPUT_ID)?.focus();
        }}
      >
        <div className="flex items-start justify-between gap-24">
          <DialogHeader className="gap-0">
            <DialogTitle>创建本地记忆空间</DialogTitle>
            <DialogDescription className="sr-only">选择位置并创建本地记忆空间。</DialogDescription>
          </DialogHeader>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghostIcon"
              size="icon"
              aria-label="关闭"
              disabled={disabled}
              className="-mr-8 -mt-8 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="size-16" aria-hidden="true" />
            </Button>
          </DialogClose>
        </div>

        <CreateWorkspaceForm
          disabled={disabled}
          onCreateFinish={onCreateFinish}
          onCreateStart={onCreateStart}
          onWorkspaceReady={onWorkspaceReady}
        />
      </DialogContent>
    </Dialog>
  );
}

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreateWorkspaceForm } from './CreateWorkspaceForm';
import { WorkspaceErrorBanner } from './WorkspaceErrorBanner';
import type { WorkspaceSession } from './workspaceApi';

type WorkspaceCreateDialogProps = {
  readonly disabled?: boolean;
  readonly error?: string | null;
  readonly onCreateFinish: () => void;
  readonly onCreateStart: () => boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onWorkspaceReady: (workspaceSession: WorkspaceSession) => boolean | Promise<boolean>;
  readonly open: boolean;
};

export function WorkspaceCreateDialog({
  disabled = false,
  error = null,
  onCreateFinish,
  onCreateStart,
  onOpenChange,
  onWorkspaceReady,
  open,
}: WorkspaceCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-(var(--spacing-40)*2))] overflow-y-auto sm:w-[min(var(--container-form),calc(100vw-(var(--spacing-40)*2)))]">
        <div className="flex items-start justify-between gap-24">
          <DialogHeader className="gap-0">
            <DialogTitle>创建本地记忆空间</DialogTitle>
          </DialogHeader>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghostIcon"
              size="icon"
              aria-label="关闭"
              disabled={disabled}
              className="-mr-8 -mt-8 text-slate hover:bg-powder hover:text-obsidian"
            >
              <X className="size-16" aria-hidden="true" />
            </Button>
          </DialogClose>
        </div>

        {error ? <WorkspaceErrorBanner>{error}</WorkspaceErrorBanner> : null}

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

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { X } from 'lucide-react';
import * as React from 'react';
import { CreateWorkspaceForm } from './CreateWorkspaceForm';
import { OpenWorkspaceAction } from './OpenWorkspaceAction';
import type { WorkspaceSession } from './workspaceApi';

type WorkspaceEntryAction = 'create' | 'open';

type WorkspaceEntryDialogProps = {
  readonly onOpenChange: (open: boolean) => void;
  readonly onWorkspaceReady: (workspaceSession: WorkspaceSession) => void;
  readonly open: boolean;
};

export function WorkspaceEntryDialog({
  onOpenChange,
  onWorkspaceReady,
  open,
}: WorkspaceEntryDialogProps) {
  const [pendingAction, setPendingAction] = React.useState<WorkspaceEntryAction | null>(null);
  const pending = pendingAction !== null;

  function beginAction(action: WorkspaceEntryAction) {
    if (pendingAction) {
      return false;
    }

    setPendingAction(action);
    return true;
  }

  function finishAction(action: WorkspaceEntryAction) {
    setPendingAction((currentAction) => (currentAction === action ? null : currentAction));
  }

  function handleOpenChange(nextOpen: boolean) {
    if (pending && !nextOpen) {
      return;
    }
    onOpenChange(nextOpen);
  }

  function handleWorkspaceReady(workspaceSession: WorkspaceSession) {
    setPendingAction(null);
    onOpenChange(false);
    onWorkspaceReady(workspaceSession);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogTitle>Create workspace</DialogTitle>
        <DialogDescription className="max-w-[560px] text-body-lg leading-body-lg">
          Start with a local memory workspace. Reo keeps user content in this folder.
        </DialogDescription>
        <Button
          asChild
          type="button"
          variant="ghostIcon"
          size="iconMedium"
          className="absolute right-16 top-16 text-gravel hover:bg-card-white"
          disabled={pending}
        >
          <DialogClose aria-label="Close">
            <X className="size-16" aria-hidden="true" />
          </DialogClose>
        </Button>
        <div className="flex flex-col gap-24">
          <CreateWorkspaceForm
            disabled={pendingAction === 'open'}
            onCreateFinish={() => finishAction('create')}
            onCreateStart={() => beginAction('create')}
            onWorkspaceReady={handleWorkspaceReady}
          />
          <Separator />
          <OpenWorkspaceAction
            disabled={pendingAction === 'create'}
            onOpenFinish={() => finishAction('open')}
            onOpenStart={() => beginAction('open')}
            onWorkspaceReady={handleWorkspaceReady}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  WorkspaceCompactAlertDialogContent,
  type WorkspaceModalLayer,
} from './WorkspaceAlertDialogContent';

type WorkspaceDangerConfirmDialogProps = {
  readonly confirmLabel?: string;
  readonly description: string;
  readonly disabled?: boolean;
  readonly modalLayer?: WorkspaceModalLayer;
  readonly onConfirm: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly title: string;
};

export function WorkspaceDangerConfirmDialog({
  confirmLabel = '删除',
  description,
  disabled = false,
  modalLayer = 'default',
  onConfirm,
  onOpenChange,
  open,
  title,
}: WorkspaceDangerConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <WorkspaceCompactAlertDialogContent modalLayer={modalLayer}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="secondary" disabled={disabled}>
              取消
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              variant="destructive"
              disabled={disabled}
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </WorkspaceCompactAlertDialogContent>
    </AlertDialog>
  );
}

import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TITLEBAR_CONTROL_LEFT, TITLEBAR_CONTROL_TOP } from '../app-shell/appShellGeometry';

type ImmersiveWorkspaceReturnButtonProps = {
  readonly disabled?: boolean;
  readonly onReturn: () => void;
};

export function ImmersiveWorkspaceReturnButton({
  disabled = false,
  onReturn,
}: ImmersiveWorkspaceReturnButtonProps) {
  return (
    <Button
      aria-label="返回"
      className="absolute z-10 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-100"
      data-vaul-no-drag
      disabled={disabled}
      onClick={onReturn}
      size="icon"
      style={{ left: TITLEBAR_CONTROL_LEFT, top: TITLEBAR_CONTROL_TOP }}
      type="button"
      variant="ghostIcon"
    >
      <ChevronLeft aria-hidden="true" className="size-16" />
    </Button>
  );
}

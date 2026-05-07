import type { ReactNode } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { WorkspaceErrorBanner } from '../WorkspaceErrorBanner';

type RecordAudioDrawerProps = {
  readonly children: ReactNode;
  readonly closeBlocked: boolean;
  readonly description: string;
  readonly error: string | null;
  readonly footer: ReactNode;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly title: string;
};

export function RecordAudioDrawer({
  children,
  closeBlocked,
  description,
  error,
  footer,
  onOpenChange,
  open,
  title,
}: RecordAudioDrawerProps) {
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && closeBlocked) {
      return;
    }
    onOpenChange(nextOpen);
  }

  return (
    <Drawer
      dismissible={!closeBlocked}
      direction="bottom"
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DrawerContent>
        <DrawerHeader className="shrink-0">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>

        <div
          className="mt-24 flex min-h-0 flex-1 flex-col gap-20 overflow-y-auto pr-4"
          data-vaul-no-drag
        >
          {error ? <WorkspaceErrorBanner>{error}</WorkspaceErrorBanner> : null}
          {children}
        </div>

        <DrawerFooter className="shrink-0 border-t border-chalk pt-16" data-vaul-no-drag>
          {footer}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

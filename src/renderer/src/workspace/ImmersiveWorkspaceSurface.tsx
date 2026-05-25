import type { ReactNode } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

type ImmersiveWorkspaceSurfaceProps = {
  readonly children: ReactNode;
  readonly closeBlocked: boolean;
  readonly description: string;
  readonly footer?: ReactNode;
  readonly immersive?: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly title: string;
};

export function ImmersiveWorkspaceSurface({
  children,
  closeBlocked,
  description,
  footer,
  immersive = false,
  onOpenChange,
  open,
  title,
}: ImmersiveWorkspaceSurfaceProps) {
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
      <DrawerContent
        showHandle={!immersive}
        {...(immersive
          ? {
              className:
                'fixed inset-0 z-[100010] flex h-dvh max-h-none w-screen translate-x-0 flex-col overflow-hidden rounded-none border-0 bg-transparent px-0 pb-0 pt-0 shadow-none sm:left-0 sm:right-0 sm:w-screen sm:translate-x-0 sm:px-0 sm:pb-0',
              overlayClassName: 'z-[100005] bg-background',
            }
          : {})}
      >
        <DrawerHeader className={immersive ? 'sr-only' : 'shrink-0'}>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>

        {immersive ? (
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden" data-vaul-no-drag>
            <div
              className="mx-auto flex min-h-0 w-full max-w-[1360px] flex-1 items-end justify-center px-24 pb-24 pt-72 sm:px-48 sm:pb-28"
              data-testid="immersive-workspace-surface-stage"
            >
              <div className="flex w-full flex-col gap-20">
                {children}
                {footer ? <div className="w-full">{footer}</div> : null}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              className="mt-24 flex min-h-0 flex-1 flex-col gap-20 overflow-y-auto pr-4"
              data-vaul-no-drag
            >
              {children}
            </div>

            {footer ? (
              <DrawerFooter className="shrink-0 pt-16" data-vaul-no-drag>
                {footer}
              </DrawerFooter>
            ) : null}
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

import { useCallback, useEffect, useRef, type AnimationEvent, type ReactNode } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  IMMERSIVE_WORKSPACE_SURFACE_CONTENT_Z_CLASS,
  IMMERSIVE_WORKSPACE_SURFACE_OVERLAY_Z_CLASS,
} from './immersiveWorkspaceLayers';

const IMMERSIVE_WORKSPACE_MOTION_DURATION_PROPERTY = '--reo-immersive-workspace-motion-duration';
const FALLBACK_IMMERSIVE_WORKSPACE_MOTION_DURATION_MS = 280;

function readImmersiveWorkspaceMotionDurationMs() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return FALLBACK_IMMERSIVE_WORKSPACE_MOTION_DURATION_MS;
  }

  const duration = window
    .getComputedStyle(document.body)
    .getPropertyValue(IMMERSIVE_WORKSPACE_MOTION_DURATION_PROPERTY)
    .trim();
  const parsedDuration = Number.parseFloat(duration);

  if (!Number.isFinite(parsedDuration)) {
    return FALLBACK_IMMERSIVE_WORKSPACE_MOTION_DURATION_MS;
  }

  if (duration.endsWith('ms')) {
    return parsedDuration;
  }
  if (duration.endsWith('s')) {
    return parsedDuration * 1000;
  }
  return parsedDuration;
}

type ImmersiveWorkspaceSurfaceProps = {
  readonly children: ReactNode;
  readonly closeBlocked: boolean;
  readonly description: string;
  readonly fill?: boolean;
  readonly footer?: ReactNode;
  readonly immersive?: boolean;
  readonly onExitAnimationEnd?: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly title: string;
};

export function ImmersiveWorkspaceSurface({
  children,
  closeBlocked,
  description,
  fill = false,
  footer,
  immersive = false,
  onExitAnimationEnd,
  onOpenChange,
  open,
  title,
}: ImmersiveWorkspaceSurfaceProps) {
  const onExitAnimationEndRef = useRef(onExitAnimationEnd);
  const previousOpenRef = useRef(open);
  const exitAnimationSettledRef = useRef(true);
  const exitAnimationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    onExitAnimationEndRef.current = onExitAnimationEnd;
  }, [onExitAnimationEnd]);

  const clearExitAnimationTimeout = useCallback(() => {
    if (exitAnimationTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(exitAnimationTimeoutRef.current);
    exitAnimationTimeoutRef.current = null;
  }, []);

  const completeExitAnimation = useCallback(() => {
    if (exitAnimationSettledRef.current) {
      return;
    }

    exitAnimationSettledRef.current = true;
    clearExitAnimationTimeout();
    onExitAnimationEndRef.current?.();
  }, [clearExitAnimationTimeout]);

  useEffect(() => {
    const previousOpen = previousOpenRef.current;
    previousOpenRef.current = open;

    if (open) {
      exitAnimationSettledRef.current = true;
      clearExitAnimationTimeout();
      return;
    }

    if (!previousOpen || !onExitAnimationEndRef.current) {
      return;
    }

    exitAnimationSettledRef.current = false;

    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      completeExitAnimation();
      return;
    }

    exitAnimationTimeoutRef.current = window.setTimeout(
      completeExitAnimation,
      readImmersiveWorkspaceMotionDurationMs()
    );

    return clearExitAnimationTimeout;
  }, [clearExitAnimationTimeout, completeExitAnimation, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && closeBlocked) {
      return;
    }
    onOpenChange(nextOpen);
  }

  function handleSurfaceAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.currentTarget !== event.target || open) {
      return;
    }

    completeExitAnimation();
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
        {...(onExitAnimationEnd ? { onAnimationEnd: handleSurfaceAnimationEnd } : {})}
        {...(immersive
          ? {
              className: `reo-immersive-workspace-surface-motion fixed inset-0 ${IMMERSIVE_WORKSPACE_SURFACE_CONTENT_Z_CLASS} flex h-dvh max-h-none w-screen translate-x-0 flex-col overflow-hidden rounded-none border-0 bg-transparent px-0 pb-0 pt-0 shadow-none sm:left-0 sm:right-0 sm:w-screen sm:translate-x-0 sm:px-0 sm:pb-0`,
              overlayClassName: `reo-immersive-workspace-overlay-motion ${IMMERSIVE_WORKSPACE_SURFACE_OVERLAY_Z_CLASS} bg-background`,
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
              className={
                fill
                  ? 'flex min-h-0 w-full flex-1 flex-col pt-48'
                  : 'mx-auto flex min-h-0 w-full max-w-[1360px] flex-1 items-end justify-center px-24 pb-24 pt-72 sm:px-48 sm:pb-28'
              }
              data-testid="immersive-workspace-surface-stage"
            >
              <div
                className={
                  fill
                    ? 'flex min-h-0 w-full flex-1 flex-col gap-20'
                    : 'flex w-full flex-col gap-20'
                }
              >
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

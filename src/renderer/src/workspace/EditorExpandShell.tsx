import { Maximize, Minimize } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  TITLEBAR_ACTION_RIGHT,
  TITLEBAR_CONTROL_GAP,
  TITLEBAR_CONTROL_LEFT,
  TITLEBAR_CONTROL_SIZE,
  TITLEBAR_CONTROL_TOP,
} from '../app-shell/appShellGeometry';
import { ImmersiveWorkspaceSurface } from './ImmersiveWorkspaceSurface';

const EXPANDED_TITLEBAR_TITLE_LEFT =
  TITLEBAR_CONTROL_LEFT + TITLEBAR_CONTROL_SIZE + TITLEBAR_CONTROL_GAP;

type EditorExpandShellProps = {
  readonly ariaLabelledBy: string;
  readonly cancelButtonClassName?: string;
  readonly cancelLabel?: string;
  readonly children: ReactNode;
  readonly dirty: boolean;
  readonly expanded: boolean;
  readonly onCancel: () => void;
  readonly onExpandedChange: (expanded: boolean) => void;
  readonly onSave: () => void;
  readonly panelId: string;
  readonly pending: boolean;
  readonly renderAsPanel: boolean;
  readonly saveButtonClassName?: string;
  readonly saveDisabled: boolean;
  readonly saveLabel: string;
  readonly title: string;
};

export function EditorExpandShell({
  ariaLabelledBy,
  cancelButtonClassName,
  cancelLabel = '取消',
  children,
  dirty,
  expanded,
  onCancel,
  onExpandedChange,
  onSave,
  panelId,
  pending,
  renderAsPanel,
  saveButtonClassName,
  saveDisabled,
  saveLabel,
  title,
}: EditorExpandShellProps) {
  const showActions = dirty && !pending;

  return (
    <>
      {expanded ? null : (
        <div
          aria-labelledby={renderAsPanel ? ariaLabelledBy : undefined}
          className="relative mt-12 flex min-h-0 w-full flex-1"
          data-slot="memory-studio-inline-markdown-editor"
          id={panelId}
          role={renderAsPanel ? 'tabpanel' : undefined}
        >
          {children}
          <button
            aria-label="展开为全屏"
            className="group absolute bottom-0 right-0 z-10 flex size-24 items-center justify-center rounded-tl-md text-muted-foreground transition-colors hover:text-foreground"
            data-testid="editor-expand-grip"
            onClick={() => onExpandedChange(true)}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="block size-14 group-hover:hidden"
              fill="none"
              viewBox="0 0 14 14"
            >
              <path
                d="M2 12 A 10 10 0 0 0 12 2"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
            </svg>
            <Maximize aria-hidden="true" className="hidden size-14 group-hover:block" />
          </button>
        </div>
      )}

      <ImmersiveWorkspaceSurface
        closeBlocked={pending}
        description={title}
        fill
        immersive
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onExpandedChange(false);
          }
        }}
        open={expanded}
        title={title}
      >
        <Button
          aria-label="退出全屏"
          className="absolute z-10 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-100"
          data-vaul-no-drag
          disabled={pending}
          onClick={() => onExpandedChange(false)}
          size="icon"
          style={{ left: TITLEBAR_CONTROL_LEFT, top: TITLEBAR_CONTROL_TOP }}
          type="button"
          variant="ghostIcon"
        >
          <Minimize aria-hidden="true" className="size-16" />
        </Button>
        <span
          className="absolute z-10 flex h-32 max-w-[calc(100vw-280px)] items-center truncate text-body font-regular leading-body text-foreground"
          data-testid="editor-expand-titlebar-title"
          style={{ left: EXPANDED_TITLEBAR_TITLE_LEFT, top: TITLEBAR_CONTROL_TOP }}
        >
          {title}
        </span>
        {showActions ? (
          <div
            className="absolute z-10 flex h-48 items-center gap-8"
            data-testid="editor-expand-titlebar-actions"
            style={{ right: TITLEBAR_ACTION_RIGHT, top: 0 }}
          >
            <Button
              className={cancelButtonClassName}
              disabled={saveDisabled}
              onClick={onCancel}
              size="compact"
              type="button"
            >
              {cancelLabel}
            </Button>
            <Button
              className={saveButtonClassName}
              disabled={saveDisabled}
              onClick={onSave}
              size="compact"
              type="button"
            >
              {saveLabel}
            </Button>
          </div>
        ) : null}

        <section
          className="grid min-h-0 w-full flex-1 grid-rows-[minmax(0,1fr)] text-left"
          data-testid="editor-expand-stage"
          id={panelId}
          {...(renderAsPanel
            ? { role: 'tabpanel', 'aria-labelledby': ariaLabelledBy }
            : { 'aria-label': '笔记编辑器' })}
        >
          {children}
        </section>
      </ImmersiveWorkspaceSurface>
    </>
  );
}

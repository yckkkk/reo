import { Maximize, Minimize } from 'lucide-react';
import type { ReactNode } from 'react';
import { ImmersiveWorkspaceSurface } from './ImmersiveWorkspaceSurface';
import { ImmersiveWorkspaceTitlebar } from './ImmersiveWorkspaceTitlebar';

type EditorExpandShellProps = {
  readonly ariaLabelledBy: string;
  readonly children: ReactNode;
  readonly expanded: boolean;
  readonly onExpandedChange: (expanded: boolean) => void;
  readonly onReturn: () => void;
  readonly panelId: string;
  readonly pending: boolean;
  readonly renderAsPanel: boolean;
  readonly title: string;
};

export function EditorExpandShell({
  ariaLabelledBy,
  children,
  expanded,
  onExpandedChange,
  onReturn,
  panelId,
  pending,
  renderAsPanel,
  title,
}: EditorExpandShellProps) {
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
          <EditorCornerGrip
            disabled={pending}
            icon="maximize"
            label="展开编辑器"
            onClick={() => onExpandedChange(true)}
          />
        </div>
      )}

      <ImmersiveWorkspaceSurface
        closeBlocked={pending}
        description={title}
        fill
        immersive
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onReturn();
          }
        }}
        open={expanded}
        title={title}
      >
        <ImmersiveWorkspaceTitlebar
          onReturn={onReturn}
          returnDisabled={pending}
          title={title}
          titleTestId="editor-expand-titlebar-title"
        />

        <section
          className="relative grid min-h-0 w-full flex-1 grid-rows-[minmax(0,1fr)] text-left"
          data-testid="editor-expand-stage"
          id={panelId}
          {...(renderAsPanel
            ? { role: 'tabpanel', 'aria-labelledby': ariaLabelledBy }
            : { 'aria-label': '笔记编辑器' })}
        >
          {children}
          <EditorCornerGrip
            disabled={pending}
            icon="minimize"
            label="缩小编辑器"
            onClick={() => onExpandedChange(false)}
          />
        </section>
      </ImmersiveWorkspaceSurface>
    </>
  );
}

type EditorCornerGripProps = {
  readonly disabled: boolean;
  readonly icon: 'maximize' | 'minimize';
  readonly label: string;
  readonly onClick: () => void;
};

function EditorCornerGrip({ disabled, icon, label, onClick }: EditorCornerGripProps) {
  const Icon = icon === 'maximize' ? Maximize : Minimize;

  return (
    <button
      aria-label={label}
      className="group absolute bottom-0 right-0 z-10 flex size-24 items-center justify-center rounded-tl-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:text-muted-foreground disabled:opacity-50"
      data-testid={`editor-${icon}-grip`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="block size-14 group-hover:hidden group-focus-visible:hidden"
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
      <Icon
        aria-hidden="true"
        className="hidden size-14 group-hover:block group-focus-visible:block"
      />
    </button>
  );
}

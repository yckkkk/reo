import { FileText } from 'lucide-react';
import type { ClipboardEventHandler, DragEventHandler, Ref } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LightweightMarkdownToolbar } from './LightweightMarkdownToolbar';
import type { LightweightMarkdownFormatAction } from './noteEditorModel';

export type LightweightMarkdownEditorSurfaceProps = {
  readonly disabled?: boolean;
  readonly headerLabel: string;
  readonly notice?: string | null;
  readonly onChange: (value: string) => void;
  readonly onDrop?: DragEventHandler<HTMLElement>;
  readonly onDragOver?: DragEventHandler<HTMLElement>;
  readonly onFormat: (action: LightweightMarkdownFormatAction) => void;
  readonly onPaste?: ClipboardEventHandler<HTMLTextAreaElement>;
  readonly onSave: () => void;
  readonly placeholder: string;
  readonly saveDisabled?: boolean;
  readonly saveLabel: string;
  readonly surfaceTestId: string;
  readonly textareaId: string;
  readonly textareaLabel: string;
  readonly textareaRef?: Ref<HTMLTextAreaElement>;
  readonly toolbarDisabled?: boolean;
  readonly value: string;
};

export function LightweightMarkdownEditorSurface({
  disabled = false,
  headerLabel,
  notice = null,
  onChange,
  onDragOver,
  onDrop,
  onFormat,
  onPaste,
  onSave,
  placeholder,
  saveDisabled = false,
  saveLabel,
  surfaceTestId,
  textareaId,
  textareaLabel,
  textareaRef,
  toolbarDisabled = false,
  value,
}: LightweightMarkdownEditorSurfaceProps) {
  return (
    <div
      className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md bg-card focus-within:ring-1 focus-within:ring-border"
      data-testid={surfaceTestId}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex min-h-[44px] items-center gap-8 border-b border-secondary px-12">
        <div className="flex min-w-fit items-center gap-8 text-ui-sm leading-ui-sm text-muted-foreground">
          <FileText aria-hidden="true" className="size-16 shrink-0" />
          <span>{headerLabel}</span>
        </div>
        <LightweightMarkdownToolbar
          className="flex min-w-0 flex-1 items-center gap-4"
          disabled={toolbarDisabled}
          onAction={onFormat}
        />
        <Button type="button" size="compact" disabled={saveDisabled} onClick={onSave}>
          {saveLabel}
        </Button>
      </div>
      <div className="flex min-h-0 flex-col">
        {notice ? (
          <p
            role="status"
            className="border-b border-secondary px-20 py-10 text-ui-sm leading-ui-sm text-muted-foreground"
          >
            {notice}
          </p>
        ) : null}
        <Label htmlFor={textareaId} className="sr-only">
          {textareaLabel}
        </Label>
        <Textarea
          ref={textareaRef}
          id={textareaId}
          autoFocus
          className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-20 py-16 font-mono text-body leading-[1.65] text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          disabled={disabled}
          onPaste={onPaste}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </div>
    </div>
  );
}

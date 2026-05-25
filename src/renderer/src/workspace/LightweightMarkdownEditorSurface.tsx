import { useState, type ClipboardEventHandler, type DragEventHandler, type Ref } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { LightweightMarkdownToolbar } from './LightweightMarkdownToolbar';
import type { LightweightMarkdownFormatAction } from './noteEditorModel';

export type LightweightMarkdownEditorSurfaceProps = {
  readonly cancelButtonClassName?: string;
  readonly cancelLabel?: string;
  readonly disabled?: boolean;
  readonly headerLabel: string;
  readonly notice?: string | null;
  readonly onCancel?: () => void;
  readonly onChange: (value: string) => void;
  readonly onDrop?: DragEventHandler<HTMLElement>;
  readonly onDragOver?: DragEventHandler<HTMLElement>;
  readonly onFormat: (action: LightweightMarkdownFormatAction) => void;
  readonly onPaste?: ClipboardEventHandler<HTMLTextAreaElement>;
  readonly onSave: () => void;
  readonly placeholder: string;
  readonly saveDisabled?: boolean;
  readonly saveButtonClassName?: string;
  readonly saveLabel: string;
  readonly showHeaderLabel?: boolean;
  readonly showActions?: boolean;
  readonly surfaceRef?: Ref<HTMLDivElement>;
  readonly surfaceTestId: string;
  readonly textareaFocused?: boolean;
  readonly textareaId: string;
  readonly textareaLabel: string;
  readonly onTextareaFocusChange?: (textareaFocused: boolean) => void;
  readonly textareaRef?: Ref<HTMLTextAreaElement>;
  readonly toolbarDisabled?: boolean;
  readonly value: string;
};

export function LightweightMarkdownEditorSurface({
  cancelButtonClassName,
  cancelLabel = '取消',
  disabled = false,
  headerLabel,
  notice = null,
  onCancel,
  onChange,
  onDragOver,
  onDrop,
  onFormat,
  onPaste,
  onSave,
  placeholder,
  saveDisabled = false,
  saveButtonClassName,
  saveLabel,
  showHeaderLabel = true,
  showActions = true,
  surfaceRef,
  surfaceTestId,
  textareaFocused,
  textareaId,
  textareaLabel,
  onTextareaFocusChange,
  textareaRef,
  toolbarDisabled = false,
  value,
}: LightweightMarkdownEditorSurfaceProps) {
  const [uncontrolledTextareaFocused, setUncontrolledTextareaFocused] = useState(false);
  const resolvedTextareaFocused = textareaFocused ?? uncontrolledTextareaFocused;

  function setResolvedTextareaFocused(nextTextareaFocused: boolean) {
    if (textareaFocused === undefined) {
      setUncontrolledTextareaFocused(nextTextareaFocused);
    }
    onTextareaFocusChange?.(nextTextareaFocused);
  }

  return (
    <div
      ref={surfaceRef}
      className={cn(
        'grid h-full min-h-0 w-full grid-rows-[44px_minmax(0,1fr)] overflow-hidden rounded-md border bg-background transition-[border-color] duration-150 ease-out',
        resolvedTextareaFocused ? 'border-ring' : 'border-secondary'
      )}
      data-slot="lightweight-markdown-editor-surface"
      data-testid={surfaceTestId}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        data-slot="lightweight-markdown-editor-toolbar"
        className="flex h-[44px] min-h-[44px] items-center gap-8 border-b border-secondary !bg-transparent px-12 transition-none"
      >
        {showHeaderLabel ? (
          <span className="flex min-w-fit items-center text-ui-sm leading-ui-sm text-muted-foreground">
            {headerLabel}
          </span>
        ) : (
          <span className="sr-only">{headerLabel}</span>
        )}
        <LightweightMarkdownToolbar
          className="flex min-w-0 flex-1 items-center gap-4"
          disabled={toolbarDisabled}
          onAction={onFormat}
        />
        {showActions ? (
          <div className="flex min-w-fit items-center gap-8">
            {onCancel ? (
              <Button
                type="button"
                size="compact"
                disabled={saveDisabled}
                className={cancelButtonClassName}
                onClick={onCancel}
              >
                {cancelLabel}
              </Button>
            ) : null}
            <Button
              type="button"
              size="compact"
              disabled={saveDisabled}
              className={saveButtonClassName}
              onClick={onSave}
            >
              {saveLabel}
            </Button>
          </div>
        ) : null}
      </div>
      <div
        data-slot="lightweight-markdown-editor-body"
        className="flex min-h-0 flex-col !bg-transparent px-20 py-16 transition-none"
      >
        {notice ? (
          <p role="status" className="mb-10 text-ui-sm leading-ui-sm text-muted-foreground">
            {notice}
          </p>
        ) : null}
        <Label htmlFor={textareaId} className="sr-only">
          {textareaLabel}
        </Label>
        <Textarea
          ref={textareaRef}
          id={textareaId}
          className="min-h-0 flex-1 resize-none rounded-none border-0 !bg-transparent p-0 font-mono text-body leading-[1.65] text-foreground !shadow-none !outline-none transition-none placeholder:text-muted-foreground focus-visible:!ring-0 focus-visible:!ring-offset-0"
          disabled={disabled}
          onBlur={() => setResolvedTextareaFocused(false)}
          onFocus={() => setResolvedTextareaFocused(true)}
          onPaste={onPaste}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </div>
    </div>
  );
}

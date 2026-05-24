import { useCallback, type RefObject } from 'react';
import {
  applyLightweightMarkdownFormat,
  type LightweightMarkdownFormatAction,
} from './noteEditorModel';
import { restoreTextareaSelection } from './textareaSelection';

export function useLightweightMarkdownFormatting({
  disabled = false,
  onChange,
  textareaRef,
  value,
}: {
  readonly disabled?: boolean;
  readonly onChange: (value: string) => void;
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
  readonly value: string;
}) {
  return useCallback(
    (action: LightweightMarkdownFormatAction) => {
      if (disabled) {
        return;
      }
      const textarea = textareaRef.current;
      const result = applyLightweightMarkdownFormat({
        action,
        markdown: value,
        selectionEnd: textarea?.selectionEnd ?? value.length,
        selectionStart: textarea?.selectionStart ?? value.length,
      });
      onChange(result.markdown);
      restoreTextareaSelection(textareaRef, result.selectionStart, result.selectionEnd);
    },
    [disabled, onChange, textareaRef, value]
  );
}

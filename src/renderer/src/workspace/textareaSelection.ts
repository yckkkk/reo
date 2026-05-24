import type { RefObject } from 'react';

export function restoreTextareaSelection(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  selectionStart: number,
  selectionEnd: number
) {
  requestAnimationFrame(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.focus();
    textarea.setSelectionRange(selectionStart, selectionEnd);
  });
}

export const REO_TIPTAP_HIGHLIGHT_COLOR_VALUES = [
  'var(--tt-color-highlight-gray)',
  'var(--tt-color-highlight-brown)',
  'var(--tt-color-highlight-orange)',
  'var(--tt-color-highlight-yellow)',
  'var(--tt-color-highlight-green)',
  'var(--tt-color-highlight-blue)',
  'var(--tt-color-highlight-purple)',
  'var(--tt-color-highlight-pink)',
  'var(--tt-color-highlight-red)',
] as const;

const REO_TIPTAP_HIGHLIGHT_COLOR_SET = new Set<string>(REO_TIPTAP_HIGHLIGHT_COLOR_VALUES);

export function isReoTiptapHighlightColor(
  value: unknown
): value is (typeof REO_TIPTAP_HIGHLIGHT_COLOR_VALUES)[number] {
  return typeof value === 'string' && REO_TIPTAP_HIGHLIGHT_COLOR_SET.has(value);
}

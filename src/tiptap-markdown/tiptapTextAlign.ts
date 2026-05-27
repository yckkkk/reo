export const REO_TIPTAP_TEXT_ALIGN_VALUES = ['left', 'center', 'right', 'justify'] as const;

export type ReoTiptapTextAlign = (typeof REO_TIPTAP_TEXT_ALIGN_VALUES)[number];

const REO_TIPTAP_TEXT_ALIGN_SET = new Set<string>(REO_TIPTAP_TEXT_ALIGN_VALUES);

export function isReoTiptapTextAlign(value: unknown): value is ReoTiptapTextAlign {
  return typeof value === 'string' && REO_TIPTAP_TEXT_ALIGN_SET.has(value);
}

import { mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import {
  resolveMarkdownImageSource,
  type MarkdownAttachmentContext,
} from './markdownAttachmentSource';

export {
  HEADING_LEVELS,
  MarkdownHeading,
  MarkdownHighlight,
  MarkdownParagraph,
  MarkdownSubscript,
  MarkdownSuperscript,
  type HeadingLevel,
} from '../../../tiptap-markdown/tiptapMarkdownExtensions';

export function createMarkdownImageExtension(
  attachmentContext: MarkdownAttachmentContext | undefined
) {
  return Image.configure({
    HTMLAttributes: {
      class: 'reo-tiptap-image',
    },
  }).extend({
    renderHTML({ node, HTMLAttributes }) {
      const rawSrc =
        typeof node.attrs['src'] === 'string'
          ? node.attrs['src']
          : typeof HTMLAttributes['src'] === 'string'
            ? HTMLAttributes['src']
            : '';

      const resolvedSrc = resolveMarkdownImageSource(rawSrc, attachmentContext);
      return [
        'img',
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          'data-reo-image-source': resolvedSrc ? undefined : 'unsupported',
          src: resolvedSrc ?? null,
        }),
      ];
    },
  });
}

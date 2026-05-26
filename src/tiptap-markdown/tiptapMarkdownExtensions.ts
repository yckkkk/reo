import type { JSONContent } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import Highlight from '@tiptap/extension-highlight';
import Paragraph from '@tiptap/extension-paragraph';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { isReoTiptapHighlightColor } from './tiptapHighlightColors.js';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] satisfies readonly HeadingLevel[];

const HIGHLIGHT_TEXT_COLOR = 'inherit';

function textAlignAttr(node: { readonly attrs?: Record<string, unknown> | undefined }) {
  const textAlign = node.attrs?.['textAlign'];
  return typeof textAlign === 'string' ? textAlign : null;
}

function renderHtmlMarkdownBlock({
  attrs,
  content,
  tag,
}: {
  readonly attrs?: string;
  readonly content: string;
  readonly tag: string;
}) {
  return `<${tag}${attrs ? ` ${attrs}` : ''}>${content}</${tag}>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeHtmlAttribute(value: string) {
  return escapeHtml(value).replaceAll("'", '&#39;');
}

function stringAttr(attrs: Record<string, unknown> | undefined, key: string) {
  const value = attrs?.[key];
  return typeof value === 'string' ? value : '';
}

function wrapInlineHtmlMark(mark: NonNullable<JSONContent['marks']>[number], content: string) {
  if (mark.type === 'bold') {
    return `<strong>${content}</strong>`;
  }
  if (mark.type === 'italic') {
    return `<em>${content}</em>`;
  }
  if (mark.type === 'strike') {
    return `<s>${content}</s>`;
  }
  if (mark.type === 'code') {
    return `<code>${content}</code>`;
  }
  if (mark.type === 'underline') {
    return `<u>${content}</u>`;
  }
  if (mark.type === 'highlight') {
    const color = stringAttr(mark.attrs, 'color');
    return isReoTiptapHighlightColor(color)
      ? `<mark data-color="${escapeHtmlAttribute(color)}" style="background-color: ${escapeHtmlAttribute(
          color
        )}; color: ${HIGHLIGHT_TEXT_COLOR}">${content}</mark>`
      : `<mark>${content}</mark>`;
  }
  if (mark.type === 'superscript') {
    return `<sup>${content}</sup>`;
  }
  if (mark.type === 'subscript') {
    return `<sub>${content}</sub>`;
  }
  if (mark.type === 'link') {
    const href = escapeHtmlAttribute(stringAttr(mark.attrs, 'href'));
    const title = stringAttr(mark.attrs, 'title');
    return title
      ? `<a href="${href}" title="${escapeHtmlAttribute(title)}">${content}</a>`
      : `<a href="${href}">${content}</a>`;
  }
  return content;
}

function renderInlineHtmlNode(node: JSONContent): string {
  if (node.type === 'text') {
    const text = escapeHtml(node.text ?? '');
    return (node.marks ?? []).reduceRight(
      (content, mark) => wrapInlineHtmlMark(mark, content),
      text
    );
  }
  if (node.type === 'hardBreak') {
    return '<br>';
  }
  if (node.type === 'image') {
    const src = escapeHtmlAttribute(stringAttr(node.attrs, 'src'));
    const alt = escapeHtmlAttribute(stringAttr(node.attrs, 'alt'));
    const title = stringAttr(node.attrs, 'title');
    return title
      ? `<img src="${src}" alt="${alt}" title="${escapeHtmlAttribute(title)}">`
      : `<img src="${src}" alt="${alt}">`;
  }
  return renderInlineHtml(node.content ?? []);
}

function renderInlineHtml(nodes: readonly JSONContent[]) {
  return nodes.map((node) => renderInlineHtmlNode(node)).join('');
}

function renderTextAlignedMarkdownBlock({
  fallback,
  node,
  tag,
}: {
  readonly fallback: string;
  readonly node: {
    readonly attrs?: Record<string, unknown> | undefined;
    readonly content?: readonly JSONContent[] | undefined;
  };
  readonly tag: string;
}) {
  const align = textAlignAttr(node);
  if (!align || align === 'left') {
    return fallback;
  }
  return renderHtmlMarkdownBlock({
    attrs: `style="text-align: ${align}"`,
    content: renderInlineHtml(node.content ?? []),
    tag,
  });
}

export const MarkdownParagraph = Paragraph.extend({
  renderMarkdown(node, h, ctx) {
    const content = Array.isArray(node.content) ? node.content : [];
    const fallback =
      content.length > 0
        ? h.renderChildren(content)
        : ctx?.previousNode?.type === 'paragraph' &&
            Array.isArray(ctx.previousNode.content) &&
            ctx.previousNode.content.length === 0
          ? '&nbsp;'
          : '';
    return renderTextAlignedMarkdownBlock({
      fallback,
      node,
      tag: 'p',
    });
  },
});

export const MarkdownHeading = Heading.extend({
  renderMarkdown(node, h) {
    const content = Array.isArray(node.content) ? node.content : [];
    if (content.length === 0) {
      return '';
    }
    const rawLevel = node.attrs?.['level'];
    const level =
      typeof rawLevel === 'number' ? (Math.min(Math.max(rawLevel, 1), 6) as HeadingLevel) : 1;
    const fallback = `${'#'.repeat(level)} ${h.renderChildren(content)}`;
    return renderTextAlignedMarkdownBlock({
      fallback,
      node,
      tag: `h${level}`,
    });
  },
});

export const MarkdownSuperscript = Superscript.extend({
  markdownOptions: {
    htmlReopen: {
      close: '</sup>',
      open: '<sup>',
    },
  },
  renderMarkdown(node, h) {
    return renderHtmlMarkdownBlock({
      content: h.renderChildren(node.content ?? []),
      tag: 'sup',
    });
  },
});

export const MarkdownSubscript = Subscript.extend({
  markdownOptions: {
    htmlReopen: {
      close: '</sub>',
      open: '<sub>',
    },
  },
  renderMarkdown(node, h) {
    return renderHtmlMarkdownBlock({
      content: h.renderChildren(node.content ?? []),
      tag: 'sub',
    });
  },
});

export const MarkdownHighlight = Highlight.extend({
  renderMarkdown(node, h) {
    const color = stringAttr(node.attrs, 'color');
    if (!isReoTiptapHighlightColor(color)) {
      return `==${h.renderChildren(node.content ?? [])}==`;
    }
    return renderHtmlMarkdownBlock({
      attrs: `data-color="${escapeHtmlAttribute(color)}" style="background-color: ${escapeHtmlAttribute(
        color
      )}; color: ${HIGHLIGHT_TEXT_COLOR}"`,
      content: renderInlineHtml(node.content ?? []),
      tag: 'mark',
    });
  },
});

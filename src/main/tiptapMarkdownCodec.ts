import type { JSONContent } from '@tiptap/core';
import { Extension } from '@tiptap/core';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Image from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import { MarkdownManager } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import {
  HEADING_LEVELS,
  MarkdownHeading,
  MarkdownHighlight,
  MarkdownParagraph,
  MarkdownSubscript,
  MarkdownSuperscript,
} from '../tiptap-markdown/tiptapMarkdownExtensions.js';
import { isReoTiptapHighlightColor } from '../tiptap-markdown/tiptapHighlightColors.js';

const SUPPORTED_NODE_TYPES = new Set([
  'blockquote',
  'bulletList',
  'codeBlock',
  'doc',
  'hardBreak',
  'heading',
  'horizontalRule',
  'image',
  'listItem',
  'orderedList',
  'paragraph',
  'taskItem',
  'taskList',
  'text',
]);
const SUPPORTED_MARK_TYPES = new Set([
  'bold',
  'code',
  'highlight',
  'italic',
  'link',
  'strike',
  'subscript',
  'superscript',
  'underline',
]);
const TEXT_ALIGN_VALUES = new Set(['left', 'center', 'right', 'justify']);
const DEFAULT_LINK_TARGET = '_blank';
const DEFAULT_LINK_REL = 'noopener noreferrer nofollow';

function meaningfulAttrValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== false && value !== '';
}

function allowedNodeAttr(nodeType: string, key: string, value: unknown): boolean {
  if (!meaningfulAttrValue(value)) {
    return true;
  }
  if (nodeType === 'heading') {
    return key === 'level' || key === 'textAlign';
  }
  if (nodeType === 'paragraph') {
    return key === 'textAlign';
  }
  if (nodeType === 'orderedList') {
    return key === 'start';
  }
  if (nodeType === 'taskItem') {
    return key === 'checked';
  }
  if (nodeType === 'codeBlock') {
    return key === 'language';
  }
  if (nodeType === 'image') {
    return key === 'src' || key === 'alt' || key === 'title';
  }
  return false;
}

function allowedMarkAttr(markType: string, key: string, value: unknown): boolean {
  if (!meaningfulAttrValue(value)) {
    return true;
  }
  if (markType === 'highlight') {
    return key === 'color' && isReoTiptapHighlightColor(value);
  }
  if (markType === 'link') {
    if (key === 'href' || key === 'title') {
      return true;
    }
    if (key === 'target') {
      return value === DEFAULT_LINK_TARGET;
    }
    if (key === 'rel') {
      return value === DEFAULT_LINK_REL;
    }
    return false;
  }
  return false;
}

function collectUnsupportedTiptapMarkdownContent(
  node: JSONContent,
  issues: string[],
  path: string
): void {
  if (!node.type || !SUPPORTED_NODE_TYPES.has(node.type)) {
    issues.push(`${path}:${node.type ?? 'missing-node-type'}`);
    return;
  }
  for (const [key, value] of Object.entries(node.attrs ?? {})) {
    if (!allowedNodeAttr(node.type, key, value)) {
      issues.push(`${path}.${key}`);
    }
  }
  for (const [index, mark] of (node.marks ?? []).entries()) {
    if (!mark.type || !SUPPORTED_MARK_TYPES.has(mark.type)) {
      issues.push(`${path}.marks[${index}]:${mark.type ?? 'missing-mark-type'}`);
      continue;
    }
    for (const [key, value] of Object.entries(mark.attrs ?? {})) {
      if (!allowedMarkAttr(mark.type, key, value)) {
        issues.push(`${path}.marks[${index}].${key}`);
      }
    }
  }
  for (const [index, child] of (node.content ?? []).entries()) {
    collectUnsupportedTiptapMarkdownContent(child, issues, `${path}.content[${index}]`);
  }
}

export class UnsupportedTiptapMarkdownContentError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Unsupported Tiptap Markdown content: ${issues.join(', ')}`);
    this.name = 'UnsupportedTiptapMarkdownContentError';
    this.issues = issues;
  }
}

export function assertTiptapMarkdownSerializable(content: JSONContent): void {
  const issues: string[] = [];
  collectUnsupportedTiptapMarkdownContent(content, issues, '$');
  if (issues.length > 0) {
    throw new UnsupportedTiptapMarkdownContentError(issues);
  }
}

function unescapeHtmlAttribute(value: string) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&');
}

function extractColoredHighlight(attrs: string) {
  const dataColor = /\bdata-color=(["'])(.*?)\1/i.exec(attrs)?.[2];
  if (dataColor) {
    const color = unescapeHtmlAttribute(dataColor);
    if (isReoTiptapHighlightColor(color)) {
      return color;
    }
  }
  const style = /\bstyle=(["'])(.*?)\1/i.exec(attrs)?.[2];
  const background = style ? /background-color\s*:\s*([^;]+)/i.exec(style)?.[1] : undefined;
  if (!background) {
    return null;
  }
  const color = unescapeHtmlAttribute(background.trim());
  return isReoTiptapHighlightColor(color) ? color : null;
}

function extractHtmlAttribute(attrs: string, name: string) {
  const match = new RegExp(`\\b${name}=(["'])(.*?)\\1`, 'i').exec(attrs);
  return match?.[2] ? unescapeHtmlAttribute(match[2]) : null;
}

function extractTextAlign(attrs: string) {
  const style = extractHtmlAttribute(attrs, 'style');
  const textAlign = style ? /text-align\s*:\s*([^;]+)/i.exec(style)?.[1]?.trim() : undefined;
  return textAlign && TEXT_ALIGN_VALUES.has(textAlign) ? textAlign : null;
}

const ReoColoredHighlightMarkdown = Extension.create({
  name: 'reoColoredHighlightMarkdown',
  markdownTokenName: 'reoColoredHighlight',
  markdownTokenizer: {
    name: 'reoColoredHighlight',
    level: 'inline',
    start(src) {
      return src.indexOf('<mark');
    },
    tokenize(src, _tokens, helpers) {
      const match = /^<mark\b([^>]*)>([\s\S]*?)<\/mark>/i.exec(src);
      if (!match) {
        return undefined;
      }
      const attrs = match[1] ?? '';
      const innerContent = match[2] ?? '';
      return {
        type: 'reoColoredHighlight',
        raw: match[0],
        text: innerContent,
        tokens: helpers.inlineTokens(innerContent),
        attrs: {
          color: extractColoredHighlight(attrs),
        },
      };
    },
  },
  parseMarkdown(token, helpers) {
    const attrs = token['attrs'] as { readonly color?: unknown } | undefined;
    const color = typeof attrs?.color === 'string' && attrs.color ? attrs.color : null;
    return helpers.applyMark(
      'highlight',
      helpers.parseInline(token.tokens ?? []),
      color ? { color } : {}
    );
  },
});

function createInlineHtmlMarkMarkdownExtension({
  markName,
  tagName,
  attrs,
}: {
  readonly markName: string;
  readonly tagName: string;
  readonly attrs?: (rawAttrs: string) => Record<string, unknown>;
}) {
  return Extension.create({
    name: `reo${markName[0]?.toUpperCase() ?? ''}${markName.slice(1)}HtmlMarkdown`,
    markdownTokenName: `reo${markName}Html`,
    markdownTokenizer: {
      name: `reo${markName}Html`,
      level: 'inline',
      start(src) {
        return src.toLowerCase().indexOf(`<${tagName}`);
      },
      tokenize(src, _tokens, helpers) {
        const match = new RegExp(`^<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, 'i').exec(
          src
        );
        if (!match) {
          return undefined;
        }
        const innerContent = match[2] ?? '';
        return {
          type: `reo${markName}Html`,
          raw: match[0],
          text: innerContent,
          tokens: helpers.inlineTokens(innerContent),
          attrs: attrs?.(match[1] ?? '') ?? {},
        };
      },
    },
    parseMarkdown(token, helpers) {
      return helpers.applyMark(
        markName,
        helpers.parseInline(token.tokens ?? []),
        (token['attrs'] as Record<string, unknown> | undefined) ?? {}
      );
    },
  });
}

const ReoStrongHtmlMarkdown = createInlineHtmlMarkMarkdownExtension({
  markName: 'bold',
  tagName: 'strong',
});
const ReoEmHtmlMarkdown = createInlineHtmlMarkMarkdownExtension({
  markName: 'italic',
  tagName: 'em',
});
const ReoStrikeHtmlMarkdown = createInlineHtmlMarkMarkdownExtension({
  markName: 'strike',
  tagName: 's',
});
const ReoCodeHtmlMarkdown = createInlineHtmlMarkMarkdownExtension({
  markName: 'code',
  tagName: 'code',
});
const ReoUnderlineHtmlMarkdown = createInlineHtmlMarkMarkdownExtension({
  markName: 'underline',
  tagName: 'u',
});
const ReoSuperscriptHtmlMarkdown = createInlineHtmlMarkMarkdownExtension({
  markName: 'superscript',
  tagName: 'sup',
});
const ReoSubscriptHtmlMarkdown = createInlineHtmlMarkMarkdownExtension({
  markName: 'subscript',
  tagName: 'sub',
});
const ReoLinkHtmlMarkdown = createInlineHtmlMarkMarkdownExtension({
  markName: 'link',
  tagName: 'a',
  attrs(rawAttrs) {
    return {
      href: extractHtmlAttribute(rawAttrs, 'href') ?? '',
      title: extractHtmlAttribute(rawAttrs, 'title'),
    };
  },
});

const ReoTextAlignedBlockMarkdown = Extension.create({
  name: 'reoTextAlignedBlockMarkdown',
  markdownTokenName: 'reoTextAlignedBlock',
  markdownTokenizer: {
    name: 'reoTextAlignedBlock',
    level: 'block',
    start(src) {
      const paragraphIndex = src.toLowerCase().indexOf('<p');
      const headingIndex = /<h[1-6]\b/i.exec(src)?.index ?? -1;
      if (paragraphIndex === -1) {
        return headingIndex;
      }
      if (headingIndex === -1) {
        return paragraphIndex;
      }
      return Math.min(paragraphIndex, headingIndex);
    },
    tokenize(src, _tokens, helpers) {
      const match = /^<(p|h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>\s*/i.exec(src);
      if (!match) {
        return undefined;
      }
      const align = extractTextAlign(match[2] ?? '');
      if (!align) {
        return undefined;
      }
      const innerContent = match[3] ?? '';
      return {
        type: 'reoTextAlignedBlock',
        raw: match[0],
        tagName: (match[1] ?? '').toLowerCase(),
        tokens: helpers.inlineTokens(innerContent),
        attrs: { textAlign: align },
      };
    },
  },
  parseMarkdown(token, helpers) {
    const tagName = token['tagName'];
    const attrs = token['attrs'] as { readonly textAlign?: unknown } | undefined;
    const textAlign = typeof attrs?.textAlign === 'string' ? attrs.textAlign : null;
    const content = helpers.parseInline(token.tokens ?? []);
    if (typeof tagName === 'string' && /^h[1-6]$/.test(tagName)) {
      return {
        type: 'heading',
        attrs: {
          level: Number(tagName.slice(1)),
          ...(textAlign ? { textAlign } : {}),
        },
        content,
      };
    }
    return {
      type: 'paragraph',
      ...(textAlign ? { attrs: { textAlign } } : {}),
      content,
    };
  },
});

function createTiptapMarkdownManager() {
  return new MarkdownManager({
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
        paragraph: false,
      }),
      MarkdownHeading.configure({ levels: [...HEADING_LEVELS] }),
      MarkdownParagraph,
      HorizontalRule,
      TaskList,
      TaskItem.configure({ nested: true }),
      MarkdownHighlight.configure({ multicolor: true }),
      ReoColoredHighlightMarkdown,
      ReoStrongHtmlMarkdown,
      ReoEmHtmlMarkdown,
      ReoStrikeHtmlMarkdown,
      ReoCodeHtmlMarkdown,
      ReoUnderlineHtmlMarkdown,
      ReoSuperscriptHtmlMarkdown,
      ReoSubscriptHtmlMarkdown,
      ReoLinkHtmlMarkdown,
      ReoTextAlignedBlockMarkdown,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Typography,
      MarkdownSuperscript,
      MarkdownSubscript,
      Image,
    ],
    indentation: {
      style: 'space',
      size: 2,
    },
    markedOptions: {
      gfm: true,
    },
  });
}

let tiptapMarkdownManager: MarkdownManager | null = null;

function getTiptapMarkdownManager() {
  tiptapMarkdownManager ??= createTiptapMarkdownManager();
  return tiptapMarkdownManager;
}

export function parseTiptapMarkdown(markdown: string): JSONContent {
  return getTiptapMarkdownManager().parse(markdown);
}

export function serializeTiptapMarkdown(content: JSONContent): string {
  assertTiptapMarkdownSerializable(content);
  return getTiptapMarkdownManager().serialize(content);
}

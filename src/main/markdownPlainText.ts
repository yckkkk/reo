import { parseTiptapMarkdown } from './tiptapMarkdownCodec.js';

function normalizeMarkdownPlainText(text: string): string {
  return text
    .replace(/https?:\/\/[^\s)]+/g, ' ')
    .replace(/\+\+/g, '')
    .replace(/={2,}/g, '')
    .replace(/~~/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/[#*_>~|\\`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectTiptapText(node: unknown, output: string[]): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  const record = node as {
    readonly content?: unknown;
    readonly text?: unknown;
    readonly type?: unknown;
  };
  if (record.type === 'text' && typeof record.text === 'string') {
    output.push(record.text);
  }
  if (Array.isArray(record.content)) {
    for (const child of record.content) {
      collectTiptapText(child, output);
    }
  }
}

function plainTextFromTiptapMarkdown(markdown: string): string | null {
  try {
    const doc = parseTiptapMarkdown(markdown);
    const parts: string[] = [];
    collectTiptapText(doc, parts);
    return normalizeMarkdownPlainText(parts.join(' '));
  } catch {
    return null;
  }
}

function fallbackPlainTextFromMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^```[^\n]*\n([\s\S]*?)^```\s*$/gm, '$1')
    .replace(/```([\s\S]*?)```/g, '$1')
    .replace(/^\s{0,3}[-*_]{3,}\s*$/gm, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/!\[([^\]]*)]\((?:\\.|[^)])*\)/g, '$1')
    .replace(/\[([^\]]+)]\((?:\\.|[^)])*\)/g, '$1')
    .replace(/^\s*\|?[\s:-]+\|[\s|:-]*$/gm, ' ')
    .replace(/\|/g, ' ')
    .replace(/\[[ xX]\]/g, ' ')
    .replace(/<[^>\n]+>/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\S+/g, ' ')
    .replace(/attachments\/[^\s)]+/g, ' ');
}

export function plainTextFromMarkdown(markdown: string): string {
  const parsed = plainTextFromTiptapMarkdown(markdown);
  if (parsed !== null && parsed.length > 0) {
    return parsed;
  }
  return normalizeMarkdownPlainText(fallbackPlainTextFromMarkdown(markdown));
}

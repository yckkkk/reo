import { type WorkspaceError } from './workspaceApi';

export const NOTE_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const NOTE_ATTACHMENT_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const NOTE_ATTACHMENT_EXTENSION_BY_MIME = new Map([
  ['image/gif', '.gif'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

export type NoteEditorTarget =
  | {
      readonly kind: 'segment';
      readonly memoryId: string;
      readonly title: string;
    }
  | {
      readonly kind: 'segment-supplement';
      readonly memoryId: string;
      readonly segmentId: string;
      readonly title: string;
    };

export type NoteContentConflict = {
  readonly currentBaselineContentHash: string;
  readonly currentBodyMarkdown: string;
};

export type LightweightMarkdownFormatAction =
  | 'bold'
  | 'bullet-list'
  | 'emphasis'
  | 'heading'
  | 'image'
  | 'numbered-list'
  | 'quote'
  | 'separator';

type MarkdownSelectionResult = {
  readonly markdown: string;
  readonly selectionEnd: number;
  readonly selectionStart: number;
};

export type LightweightMarkdownFormatResult = MarkdownSelectionResult;

export function targetIdentity(target: NoteEditorTarget | null) {
  if (!target) {
    return 'closed';
  }
  if (target.kind === 'segment') {
    return `segment:${target.memoryId}:${target.title}`;
  }
  return `segment-supplement:${target.memoryId}:${target.segmentId}:${target.title}`;
}

export function noteEditorDisplayTitle(target: NoteEditorTarget | null) {
  if (!target) {
    return '正文';
  }
  if (target.kind === 'segment') {
    return '正文';
  }
  return target.title;
}

export function attachmentAltFromFilename(filename: string) {
  const withoutPath = filename.split(/[\\/]/).pop() ?? filename;
  const withoutExtension = withoutPath.replace(/\.[^.]+$/, '');
  return withoutExtension.trim() || '图片';
}

export function attachmentOriginalFilename(file: File, fallbackStem: string) {
  const trimmedName = file.name.trim();
  if (trimmedName.length > 0) {
    return trimmedName;
  }
  const extension = NOTE_ATTACHMENT_EXTENSION_BY_MIME.get(file.type) ?? '.png';
  return `${fallbackStem}${extension}`;
}

function readImageFile(files: FileList | readonly File[]) {
  const fileList = Array.from(files);
  return fileList.find((file) => NOTE_ATTACHMENT_MIME_TYPES.has(file.type)) ?? null;
}

export function readDroppedImageFile(dataTransfer: DataTransfer) {
  return readImageFile(dataTransfer.files);
}

export function readPastedImageFile(clipboardData: DataTransfer) {
  const files = Array.from(clipboardData.files);
  if (files.length > 0) {
    return readImageFile(files);
  }

  const itemFiles = Array.from(clipboardData.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  return readImageFile(itemFiles);
}

export function insertMarkdownAtSelection(
  currentMarkdown: string,
  insertText: string,
  textarea: HTMLTextAreaElement | null
) {
  const start = textarea?.selectionStart ?? currentMarkdown.length;
  const end = textarea?.selectionEnd ?? currentMarkdown.length;
  const insertion = insertMarkdownIntoRange(currentMarkdown, start, end, insertText, 0);
  return { cursor: insertion.selectionEnd, markdown: insertion.markdown };
}

export function applyLightweightMarkdownFormat({
  action,
  markdown,
  selectionEnd,
  selectionStart,
}: {
  readonly action: LightweightMarkdownFormatAction;
  readonly markdown: string;
  readonly selectionEnd: number;
  readonly selectionStart: number;
}): LightweightMarkdownFormatResult {
  const start = Math.max(0, Math.min(selectionStart, markdown.length));
  const end = Math.max(start, Math.min(selectionEnd, markdown.length));

  if (action === 'bold') {
    return wrapSelection(markdown, start, end, '**', '**', '粗体');
  }
  if (action === 'emphasis') {
    return wrapSelection(markdown, start, end, '*', '*', '强调');
  }
  if (action === 'image') {
    return insertMarkdownIntoRange(markdown, start, end, '![图片]()', -1);
  }
  if (action === 'separator') {
    const prefix = readSeparatorPrefix(markdown, start);
    const snippet = `${prefix}---\n\n`;
    return insertMarkdownIntoRange(markdown, start, end, snippet, 0);
  }

  const prefixByAction: Record<
    Exclude<LightweightMarkdownFormatAction, 'bold' | 'emphasis' | 'image' | 'separator'>,
    string
  > = {
    'bullet-list': '- ',
    heading: '## ',
    'numbered-list': '1. ',
    quote: '> ',
  };
  return prefixSelectedLines(markdown, start, end, prefixByAction[action]);
}

function insertMarkdownIntoRange(
  markdown: string,
  start: number,
  end: number,
  insertText: string,
  cursorOffset: number
): MarkdownSelectionResult {
  const nextMarkdown = `${markdown.slice(0, start)}${insertText}${markdown.slice(end)}`;
  const cursor = start + insertText.length + cursorOffset;
  return {
    markdown: nextMarkdown,
    selectionEnd: cursor,
    selectionStart: cursor,
  };
}

function readSeparatorPrefix(markdown: string, start: number) {
  if (start === 0) {
    return '';
  }
  if (markdown[start - 1] === '\n') {
    return '\n';
  }
  return '\n\n';
}

function wrapSelection(
  markdown: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string
): LightweightMarkdownFormatResult {
  const selected = markdown.slice(start, end);
  const content = selected.length > 0 ? selected : placeholder;
  const nextMarkdown = `${markdown.slice(0, start)}${before}${content}${after}${markdown.slice(end)}`;
  return {
    markdown: nextMarkdown,
    selectionEnd: start + before.length + content.length,
    selectionStart: start + before.length,
  };
}

function prefixSelectedLines(
  markdown: string,
  start: number,
  end: number,
  prefix: string
): LightweightMarkdownFormatResult {
  const lineStart = markdown.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIndex = markdown.indexOf('\n', end);
  const lineEnd = lineEndIndex === -1 ? markdown.length : lineEndIndex;
  const selectedLines = markdown.slice(lineStart, lineEnd).split('\n');
  let originalOffset = 0;
  let startOffset = 0;
  let endOffset = 0;
  const prefixed = selectedLines
    .map((line) => {
      const currentLineStart = lineStart + originalOffset;
      const addedOffset = line.startsWith(prefix) ? 0 : prefix.length;
      if (currentLineStart <= start) {
        startOffset += addedOffset;
      }
      if (currentLineStart <= end) {
        endOffset += addedOffset;
      }
      originalOffset += line.length + 1;
      return addedOffset === 0 ? line : `${prefix}${line}`;
    })
    .join('\n');
  const nextMarkdown = `${markdown.slice(0, lineStart)}${prefixed}${markdown.slice(lineEnd)}`;
  return {
    markdown: nextMarkdown,
    selectionEnd: end + endOffset,
    selectionStart: start + startOffset,
  };
}

export function readStaleNoteContentConflict(error: WorkspaceError): NoteContentConflict | null {
  if (
    error.code !== 'ERR_SEGMENT_CONTENT_STALE' ||
    typeof error.currentBodyMarkdown !== 'string' ||
    typeof error.currentBaselineContentHash !== 'string'
  ) {
    return null;
  }

  return {
    currentBaselineContentHash: error.currentBaselineContentHash,
    currentBodyMarkdown: error.currentBodyMarkdown,
  };
}

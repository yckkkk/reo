import {
  type WorkspaceError,
  type WorkspaceNoteSegmentContent,
  type WorkspaceNoteSegmentSupplementContent,
} from './workspaceApi';

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
const utf8Encoder = new TextEncoder();

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
    }
  | {
      readonly baselineContentHash: string;
      readonly bodyMarkdown: string;
      readonly kind: 'edit-segment';
      readonly memoryId: string;
      readonly segmentId: string;
      readonly title: string;
    }
  | {
      readonly baselineContentHash: string;
      readonly bodyMarkdown: string;
      readonly kind: 'edit-segment-supplement';
      readonly memoryId: string;
      readonly segmentId: string;
      readonly supplementId: string;
      readonly title: string;
    };

export type NoteContentConflict = {
  readonly currentBaselineContentHash: string;
  readonly currentBodyMarkdown: string;
};

export type LatestNoteEditorContent = {
  readonly baselineContentHash: string;
  readonly bodyMarkdown: string;
};

export type NoteContentCachePatch = {
  readonly baselineContentHash: string;
  readonly bodyByteLength: number;
  readonly bodyMarkdown: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
  readonly workspaceId: string;
};

export function targetIdentity(target: NoteEditorTarget | null) {
  if (!target) {
    return 'closed';
  }
  if (target.kind === 'segment') {
    return `segment:${target.memoryId}:${target.title}`;
  }
  if (target.kind === 'edit-segment') {
    return `${target.kind}:${target.memoryId}:${target.segmentId}:${target.title}`;
  }
  if (target.kind === 'edit-segment-supplement') {
    return `${target.kind}:${target.memoryId}:${target.segmentId}:${target.supplementId}:${target.title}`;
  }
  return `${target.kind}:${target.memoryId}:${target.segmentId}:${target.title}`;
}

export function noteEditorDisplayTitle(target: NoteEditorTarget | null) {
  if (!target) {
    return '正文';
  }
  if (target.kind === 'segment' || target.kind === 'edit-segment') {
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
  if (!textarea) {
    const markdown = `${currentMarkdown}${insertText}`;
    return { cursor: markdown.length, markdown };
  }
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  return {
    cursor: start + insertText.length,
    markdown: `${currentMarkdown.slice(0, start)}${insertText}${currentMarkdown.slice(end)}`,
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

export function readLatestNoteEditorContent(content: unknown): LatestNoteEditorContent | null {
  if (
    content &&
    typeof content === 'object' &&
    'bodyMarkdown' in content &&
    'baselineContentHash' in content &&
    typeof content.bodyMarkdown === 'string' &&
    typeof content.baselineContentHash === 'string'
  ) {
    return {
      baselineContentHash: content.baselineContentHash,
      bodyMarkdown: content.bodyMarkdown,
    };
  }

  return null;
}

export function createNoteContentCachePatch({
  baselineContentHash,
  bodyMarkdown,
  memoryId,
  segmentId,
  title,
  workspaceId,
}: {
  readonly baselineContentHash: string;
  readonly bodyMarkdown: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
  readonly workspaceId: string;
}): NoteContentCachePatch {
  return {
    baselineContentHash,
    bodyByteLength: utf8Encoder.encode(bodyMarkdown).byteLength,
    bodyMarkdown,
    memoryId,
    segmentId,
    title,
    workspaceId,
  };
}

export function patchSegmentNoteContentCache({
  cachePatch,
  current,
  segmentId,
}: {
  readonly cachePatch: NoteContentCachePatch;
  readonly current: WorkspaceNoteSegmentContent | undefined;
  readonly segmentId: string;
}): WorkspaceNoteSegmentContent {
  return {
    requestId: current?.requestId ?? `segment-content-conflict:${segmentId}`,
    type: 'note',
    ...cachePatch,
    title: current?.title ?? cachePatch.title,
  };
}

export function patchSegmentSupplementNoteContentCache({
  cachePatch,
  current,
  supplementId,
}: {
  readonly cachePatch: NoteContentCachePatch;
  readonly current: WorkspaceNoteSegmentSupplementContent | undefined;
  readonly supplementId: string;
}): WorkspaceNoteSegmentSupplementContent {
  return {
    requestId: current?.requestId ?? `segment-supplement-content-conflict:${supplementId}`,
    supplementId,
    type: 'note',
    ...cachePatch,
    title: current?.title ?? cachePatch.title,
  };
}

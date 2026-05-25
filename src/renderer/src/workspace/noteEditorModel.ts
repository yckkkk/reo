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

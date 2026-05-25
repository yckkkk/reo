export type MarkdownAttachmentContext =
  | {
      readonly kind: 'segment';
      readonly workspaceId: string;
      readonly segmentId: string;
    }
  | {
      readonly kind: 'segment-supplement';
      readonly workspaceId: string;
      readonly segmentId: string;
      readonly supplementId: string;
    };

export function markdownAttachmentContextKey(
  attachmentContext: MarkdownAttachmentContext | undefined
) {
  if (!attachmentContext) {
    return 'none';
  }
  if (attachmentContext.kind === 'segment') {
    return `${attachmentContext.workspaceId}:segment:${attachmentContext.segmentId}`;
  }
  return `${attachmentContext.workspaceId}:segment-supplement:${attachmentContext.segmentId}:${attachmentContext.supplementId}`;
}

export function createMarkdownAttachmentContext(
  input:
    | {
        readonly kind: 'segment';
        readonly workspaceId: string;
        readonly segmentId: string;
      }
    | {
        readonly kind: 'segment-supplement';
        readonly workspaceId: string;
        readonly segmentId: string;
        readonly supplementId: string;
      }
    | null
    | undefined
): MarkdownAttachmentContext | undefined {
  if (!input) {
    return undefined;
  }
  if (input.kind === 'segment') {
    return {
      kind: 'segment',
      workspaceId: input.workspaceId,
      segmentId: input.segmentId,
    };
  }
  return {
    kind: 'segment-supplement',
    workspaceId: input.workspaceId,
    segmentId: input.segmentId,
    supplementId: input.supplementId,
  };
}

export function resolveMarkdownImageSource(
  src: string,
  attachmentContext: MarkdownAttachmentContext | undefined
): string | null {
  if (!attachmentContext || !src.startsWith('attachments/')) {
    return null;
  }
  const filename = src.slice('attachments/'.length);
  if (
    filename.length === 0 ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('..')
  ) {
    return null;
  }
  const encodedFilename = encodeURIComponent(filename);
  if (attachmentContext.kind === 'segment') {
    return `reo-attachment://${attachmentContext.workspaceId}/segments/${attachmentContext.segmentId}/${encodedFilename}`;
  }
  return `reo-attachment://${attachmentContext.workspaceId}/segments/${attachmentContext.segmentId}/supplements/${attachmentContext.supplementId}/${encodedFilename}`;
}

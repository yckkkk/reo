import type {
  WorkspaceDefaultCoverTemplateId,
  WorkspaceMemorySummary,
  WorkspaceSegmentProjection,
  WorkspaceCoverProjection,
} from '../../../../workspace-contract/workspace-contract';
import { WORKSPACE_DEFAULT_COVER_TEMPLATE_IDS } from '../../../../workspace-contract/workspace-contract';

const DEFAULT_COVER_TEMPLATES = {
  'cover-01': new URL('./defaults/cover-01.png', import.meta.url).toString(),
  'cover-02': new URL('./defaults/cover-02.png', import.meta.url).toString(),
  'cover-03': new URL('./defaults/cover-03.png', import.meta.url).toString(),
  'cover-04': new URL('./defaults/cover-04.png', import.meta.url).toString(),
  'cover-05': new URL('./defaults/cover-05.png', import.meta.url).toString(),
  'cover-06': new URL('./defaults/cover-06.png', import.meta.url).toString(),
  'cover-07': new URL('./defaults/cover-07.png', import.meta.url).toString(),
  'cover-08': new URL('./defaults/cover-08.png', import.meta.url).toString(),
  'cover-09': new URL('./defaults/cover-09.png', import.meta.url).toString(),
  'cover-10': new URL('./defaults/cover-10.png', import.meta.url).toString(),
  'cover-11': new URL('./defaults/cover-11.png', import.meta.url).toString(),
  'cover-12': new URL('./defaults/cover-12.png', import.meta.url).toString(),
  'cover-13': new URL('./defaults/cover-13.png', import.meta.url).toString(),
} as const satisfies Record<WorkspaceDefaultCoverTemplateId, string>;

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function resolveStableDefaultCoverTemplateId(
  entityId: string
): WorkspaceDefaultCoverTemplateId {
  return (
    WORKSPACE_DEFAULT_COVER_TEMPLATE_IDS[
      stableHash(entityId) % WORKSPACE_DEFAULT_COVER_TEMPLATE_IDS.length
    ] ?? WORKSPACE_DEFAULT_COVER_TEMPLATE_IDS[0]
  );
}

export function resolveDefaultCoverTemplate(
  entityId: string,
  templateId?: WorkspaceDefaultCoverTemplateId | undefined
): string {
  return DEFAULT_COVER_TEMPLATES[templateId ?? resolveStableDefaultCoverTemplateId(entityId)];
}

function defaultCoverTemplateIdFromProjection({
  cover,
  entityId,
}: {
  readonly cover?: WorkspaceCoverProjection | undefined;
  readonly entityId: string;
}): WorkspaceDefaultCoverTemplateId {
  return cover?.source === 'default' && cover.templateId
    ? cover.templateId
    : resolveStableDefaultCoverTemplateId(entityId);
}

export function resolveNextDefaultCoverTemplateId({
  currentTemplateId,
  entityId,
  random = Math.random,
}: {
  readonly currentTemplateId?: WorkspaceDefaultCoverTemplateId | undefined;
  readonly entityId: string;
  readonly random?: () => number;
}): WorkspaceDefaultCoverTemplateId {
  const current = currentTemplateId ?? resolveStableDefaultCoverTemplateId(entityId);
  const currentIndex = Math.max(0, WORKSPACE_DEFAULT_COVER_TEMPLATE_IDS.indexOf(current));
  const boundedRandom = Math.min(0.999999999, Math.max(0, random()));
  const offset =
    1 + Math.floor(boundedRandom * Math.max(1, WORKSPACE_DEFAULT_COVER_TEMPLATE_IDS.length - 1));
  return (
    WORKSPACE_DEFAULT_COVER_TEMPLATE_IDS[
      (currentIndex + offset) % WORKSPACE_DEFAULT_COVER_TEMPLATE_IDS.length
    ] ?? WORKSPACE_DEFAULT_COVER_TEMPLATE_IDS[0]
  );
}

export function resolveMemoryCoverImageSource({
  memory,
  workspaceId,
}: {
  readonly memory: WorkspaceMemorySummary;
  readonly workspaceId: string;
}): string {
  if (memory.cover?.source === 'custom') {
    return `reo-attachment://${workspaceId}/memories/${memory.memoryId}/cover/${encodeURIComponent(
      memory.cover.filename
    )}?v=${encodeURIComponent(memory.cover.version)}`;
  }

  return resolveDefaultCoverTemplate(
    memory.memoryId,
    defaultCoverTemplateIdFromProjection({ cover: memory.cover, entityId: memory.memoryId })
  );
}

export function resolveSegmentCoverImageSource({
  segment,
  workspaceId,
}: {
  readonly segment: WorkspaceSegmentProjection;
  readonly workspaceId: string;
}): string {
  if (segment.cover?.source === 'custom') {
    return `reo-attachment://${workspaceId}/segments/${
      segment.segmentId
    }/cover/${encodeURIComponent(segment.cover.filename)}?v=${encodeURIComponent(
      segment.cover.version
    )}`;
  }

  return resolveDefaultCoverTemplate(
    segment.segmentId,
    defaultCoverTemplateIdFromProjection({ cover: segment.cover, entityId: segment.segmentId })
  );
}

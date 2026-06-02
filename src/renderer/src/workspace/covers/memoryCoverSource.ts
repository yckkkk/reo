import type { WorkspaceMemorySummary } from '../../../../workspace-contract/workspace-contract';

const DEFAULT_COVER_TEMPLATES = [
  new URL('./defaults/cover-01.png', import.meta.url).toString(),
  new URL('./defaults/cover-02.png', import.meta.url).toString(),
  new URL('./defaults/cover-03.png', import.meta.url).toString(),
  new URL('./defaults/cover-04.png', import.meta.url).toString(),
  new URL('./defaults/cover-05.png', import.meta.url).toString(),
  new URL('./defaults/cover-06.png', import.meta.url).toString(),
] as const;

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function resolveDefaultCoverTemplate(entityId: string): string {
  return (
    DEFAULT_COVER_TEMPLATES[stableHash(entityId) % DEFAULT_COVER_TEMPLATES.length] ??
    DEFAULT_COVER_TEMPLATES[0]
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

  return resolveDefaultCoverTemplate(memory.memoryId);
}

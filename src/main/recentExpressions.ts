import path from 'node:path';
import { z } from 'zod';
import { readMemoryDetailFromFileTruth } from './memoryFiles.js';
import { readWorkspaceSnapshotFromFileTruth } from './workspaceFiles.js';
import { readBoundedJsonNoFollow } from './workspaceJsonFile.js';
import type {
  WorkspaceErrorCode,
  WorkspaceRecentExpressionItem,
  WorkspaceRecentExpressionSkipped,
} from '../workspace-contract/workspace-contract.js';

const MAX_OBJECT_MANIFEST_BYTES = 65_536;
const objectManifestTimesSchema = z
  .object({
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export interface RecentExpressionWorkspaceSource {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly workspaceTitle: string;
}

export interface ReadRecentExpressionsFromWorkspaceSourcesOptions {
  readonly limit: number;
  readonly sources: readonly RecentExpressionWorkspaceSource[];
}

export interface RecentExpressionFeed {
  readonly items: readonly WorkspaceRecentExpressionItem[];
  readonly skipped: readonly WorkspaceRecentExpressionSkipped[];
}

export async function readRecentExpressionsFromWorkspaceSources({
  limit,
  sources,
}: ReadRecentExpressionsFromWorkspaceSourcesOptions): Promise<RecentExpressionFeed> {
  const items: WorkspaceRecentExpressionItem[] = [];
  const skipped: WorkspaceRecentExpressionSkipped[] = [];

  for (const source of sources) {
    const snapshot = await readWorkspaceSnapshotFromFileTruth({
      rootPath: source.rootPath,
      workspaceId: source.workspaceId,
    });
    if (!snapshot.ok) {
      skipped.push(skippedSource(source, skipReasonForWorkspaceError(snapshot.error.code)));
      continue;
    }

    for (const memory of snapshot.snapshot.memories) {
      const detail = await readMemoryDetailFromFileTruth({
        rootPath: source.rootPath,
        workspaceId: source.workspaceId,
        memoryId: memory.memoryId,
      });
      if (!detail.ok) {
        skipped.push(skippedSource(source, skipReasonForWorkspaceError(detail.error.code)));
        break;
      }

      for (const segment of detail.value.segments) {
        const segmentTimes = await readObjectManifestTimes({
          fallback: { createdAt: segment.createdAt, updatedAt: segment.updatedAt },
          kind: 'segments',
          objectId: segment.segmentId,
          rootPath: source.rootPath,
        });
        items.push({
          id: `${source.workspaceId}:${memory.memoryId}:${segment.segmentId}`,
          workspaceId: source.workspaceId,
          workspaceTitle: source.workspaceTitle,
          memoryId: memory.memoryId,
          memoryTitle: memory.title,
          segmentId: segment.segmentId,
          objectType: 'segment',
          contentKind: segment.type,
          title: segment.contentTitle ?? segment.title,
          createdAt: segmentTimes.createdAt,
          updatedAt: segmentTimes.updatedAt,
        });

        for (const supplement of segment.supplements) {
          const supplementTimes = await readObjectManifestTimes({
            fallback: { createdAt: supplement.createdAt, updatedAt: supplement.updatedAt },
            kind: 'supplements',
            objectId: supplement.supplementId,
            rootPath: source.rootPath,
          });
          items.push({
            id: `${source.workspaceId}:${memory.memoryId}:${segment.segmentId}:${supplement.supplementId}`,
            workspaceId: source.workspaceId,
            workspaceTitle: source.workspaceTitle,
            memoryId: memory.memoryId,
            memoryTitle: memory.title,
            segmentId: segment.segmentId,
            supplementId: supplement.supplementId,
            objectType: 'supplement',
            contentKind: supplement.type,
            title: supplement.title,
            createdAt: supplementTimes.createdAt,
            updatedAt: supplementTimes.updatedAt,
          });
        }
      }
    }
  }

  return {
    items: items.sort(compareRecentExpressionItems).slice(0, Math.max(0, limit)),
    skipped,
  };
}

async function readObjectManifestTimes({
  fallback,
  kind,
  objectId,
  rootPath,
}: {
  readonly fallback: { readonly createdAt: string; readonly updatedAt: string };
  readonly kind: 'segments' | 'supplements';
  readonly objectId: string;
  readonly rootPath: string;
}): Promise<{ readonly createdAt: string; readonly updatedAt: string }> {
  const result = await readBoundedJsonNoFollow({
    filePath: path.join(rootPath, '.reo', 'objects', kind, `${objectId}.json`),
    maxBytes: MAX_OBJECT_MANIFEST_BYTES,
    schema: objectManifestTimesSchema,
  });
  return result.status === 'ok'
    ? { createdAt: result.value.createdAt, updatedAt: result.value.updatedAt }
    : fallback;
}

function compareRecentExpressionItems(
  left: WorkspaceRecentExpressionItem,
  right: WorkspaceRecentExpressionItem
): number {
  const updated = right.updatedAt.localeCompare(left.updatedAt);
  if (updated !== 0) {
    return updated;
  }
  return right.createdAt.localeCompare(left.createdAt);
}

function skippedSource(
  source: RecentExpressionWorkspaceSource,
  reason: WorkspaceRecentExpressionSkipped['reason']
): WorkspaceRecentExpressionSkipped {
  return {
    workspaceId: source.workspaceId,
    workspaceTitle: source.workspaceTitle,
    reason,
  };
}

function skipReasonForWorkspaceError(
  code: WorkspaceErrorCode
): WorkspaceRecentExpressionSkipped['reason'] {
  if (code === 'ERR_WORKSPACE_ROOT_MISSING' || code === 'ERR_WORKSPACE_MEMORY_SPACE_NOT_FOUND') {
    return 'missing';
  }
  if (
    code === 'ERR_WORKSPACE_LOCKED' ||
    code === 'ERR_WORKSPACE_LOCK_FAILED' ||
    code === 'ERR_WORKSPACE_LOCK_LOST'
  ) {
    return 'locked';
  }
  if (code === 'ERR_WORKSPACE_UNSAFE_PATH') {
    return 'unsafe';
  }
  if (code === 'ERR_WORKSPACE_METADATA_INVALID') {
    return 'invalid';
  }
  return 'read-error';
}

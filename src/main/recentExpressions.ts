import {
  readRecentExpressionCoverProjection,
  readRecentExpressionItemsFromFileTruth,
  type RecentExpressionItemFromFileTruth,
} from './memoryFiles.js';
import type {
  WorkspaceContentKind,
  WorkspaceErrorCode,
  WorkspaceRecentExpressionItem,
  WorkspaceRecentExpressionSkipped,
} from '../workspace-contract/workspace-contract.js';

const RETURN_ITEM_HYDRATION_CONCURRENCY = 12;
const SOURCE_READ_CONCURRENCY = 3;

export interface RecentExpressionWorkspaceSource {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly workspaceTitle: string;
}

export interface ReadRecentExpressionsFromWorkspaceSourcesOptions {
  readonly contentKinds?: readonly WorkspaceContentKind[] | undefined;
  readonly limit: number;
  readonly readCover?: typeof readRecentExpressionCoverProjection;
  readonly sources: readonly RecentExpressionWorkspaceSource[];
}

export interface RecentExpressionFeed {
  readonly items: readonly WorkspaceRecentExpressionItem[];
  readonly skipped: readonly WorkspaceRecentExpressionSkipped[];
}

export async function readRecentExpressionsFromWorkspaceSources({
  contentKinds,
  limit,
  readCover = readRecentExpressionCoverProjection,
  sources,
}: ReadRecentExpressionsFromWorkspaceSourcesOptions): Promise<RecentExpressionFeed> {
  const candidates: RecentExpressionCandidate[] = [];
  const skipped: WorkspaceRecentExpressionSkipped[] = [];

  const sourceReads = await readSourcesWithConcurrency(sources, async (source) => {
    const items = await readRecentExpressionItemsFromFileTruth({
      ...(contentKinds ? { contentKinds } : {}),
      rootPath: source.rootPath,
      workspaceId: source.workspaceId,
      workspaceTitle: source.workspaceTitle,
    });
    if (!items.ok) {
      return {
        candidates: [],
        skipped: [skippedSource(source, skipReasonForWorkspaceError(items.error.code))],
      };
    }
    const sourceSkipped =
      items.value.skippedMemoryCount > 0 ? [skippedSource(source, 'read-error')] : [];
    return {
      candidates: items.value.items.map((item) => ({
        ...item,
      })),
      skipped: sourceSkipped,
    };
  });

  for (const sourceRead of sourceReads) {
    skipped.push(...sourceRead.skipped);
    candidates.push(...sourceRead.candidates);
  }

  const limitedCandidates = candidates
    .sort(compareRecentExpressionItems)
    .slice(0, Math.max(0, limit));
  const items = await hydrateCandidateReturnItems(limitedCandidates, readCover);

  return {
    items,
    skipped,
  };
}

type RecentExpressionCandidate = RecentExpressionItemFromFileTruth;

async function readSourcesWithConcurrency<Result>(
  sources: readonly RecentExpressionWorkspaceSource[],
  readSource: (source: RecentExpressionWorkspaceSource) => Promise<Result>
): Promise<readonly Result[]> {
  const results: Result[] = new Array(sources.length);
  let nextIndex = 0;
  const workerCount = Math.min(SOURCE_READ_CONCURRENCY, sources.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < sources.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await readSource(sources[index]!);
      }
    })
  );

  return results;
}

async function hydrateCandidateReturnItems(
  candidates: readonly RecentExpressionCandidate[],
  readCover: typeof readRecentExpressionCoverProjection
): Promise<readonly WorkspaceRecentExpressionItem[]> {
  const items: WorkspaceRecentExpressionItem[] = new Array(candidates.length);
  let nextIndex = 0;
  const workerCount = Math.min(RETURN_ITEM_HYDRATION_CONCURRENCY, candidates.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < candidates.length) {
        const index = nextIndex;
        nextIndex += 1;
        const { coverTarget, ...candidate } = candidates[index]!;
        const cover = await readCover(coverTarget);
        items[index] = { ...candidate, cover };
      }
    })
  );

  return items;
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

export type BackfillEligibleTarget =
  | {
      readonly kind: 'segment';
      readonly memoryId: string;
      readonly segmentId: string;
      readonly updatedAt: string;
      readonly workspaceId: string;
    }
  | {
      readonly kind: 'supplement';
      readonly memoryId: string;
      readonly segmentId: string;
      readonly supplementId: string;
      readonly updatedAt: string;
      readonly workspaceId: string;
    };

type BackfillScannerInput = {
  readonly memories: ReadonlyArray<{
    readonly memoryId: string;
    readonly segments: readonly BackfillScannerSegmentProjection[];
  }>;
};

export type BackfillScannerProjection = {
  readonly audioByteLength: number;
  readonly lastTranscriptionAttempt: 'failed' | 'never' | 'success';
  readonly transcript: { readonly exists: boolean };
};

type BackfillScannerSupplementProjection = BackfillScannerProjection & {
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly updatedAt: string;
  readonly workspaceId: string;
};

type BackfillScannerSegmentProjection = BackfillScannerProjection & {
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplements: readonly BackfillScannerSupplementProjection[];
  readonly updatedAt: string;
  readonly workspaceId: string;
};

export function isBackfillEligibleProjection(projection: BackfillScannerProjection) {
  return (
    projection.audioByteLength > 0 &&
    projection.lastTranscriptionAttempt === 'failed' &&
    !projection.transcript.exists
  );
}

export function collectEligibleBackfillTargets(
  input: BackfillScannerInput,
  limit = Number.POSITIVE_INFINITY
): BackfillEligibleTarget[] {
  const targets: BackfillEligibleTarget[] = [];

  for (const memory of input.memories) {
    for (const segment of memory.segments) {
      if (isBackfillEligibleProjection(segment)) {
        targets.push({
          kind: 'segment',
          memoryId: segment.memoryId,
          segmentId: segment.segmentId,
          updatedAt: segment.updatedAt,
          workspaceId: segment.workspaceId,
        });
      }
      for (const supplement of segment.supplements) {
        if (isBackfillEligibleProjection(supplement)) {
          targets.push({
            kind: 'supplement',
            memoryId: supplement.memoryId,
            segmentId: supplement.segmentId,
            supplementId: supplement.supplementId,
            updatedAt: supplement.updatedAt,
            workspaceId: supplement.workspaceId,
          });
        }
      }
    }
  }

  return limitBackfillTargets(targets, limit);
}

export function limitBackfillTargets(
  targets: readonly BackfillEligibleTarget[],
  limit = Number.POSITIVE_INFINITY
): BackfillEligibleTarget[] {
  return [...targets]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, Math.max(0, Math.trunc(limit)));
}

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

type BackfillScannerSegmentBaseProjection = {
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplements: readonly BackfillScannerSupplementProjection[];
  readonly updatedAt: string;
  readonly workspaceId: string;
};

type BackfillScannerSegmentProjection =
  | BackfillScannerSegmentBaseProjection
  | (BackfillScannerSegmentBaseProjection & BackfillScannerProjection);

function segmentHasBackfillAudioProjection(
  segment: BackfillScannerSegmentProjection
): segment is BackfillScannerSegmentBaseProjection & BackfillScannerProjection {
  return 'audioByteLength' in segment;
}

export function isBackfillEligibleProjection(projection: BackfillScannerProjection) {
  return (
    projection.audioByteLength > 0 &&
    projection.lastTranscriptionAttempt === 'failed' &&
    !projection.transcript.exists
  );
}

export function isManualFillMissingEligibleProjection(projection: BackfillScannerProjection) {
  return projection.audioByteLength > 0 && !projection.transcript.exists;
}

export function addEligibleBackfillTargets(
  input: BackfillScannerInput,
  selector: ReturnType<typeof createBackfillTargetSelector>
): void {
  for (const memory of input.memories) {
    for (const segment of memory.segments) {
      if (segmentHasBackfillAudioProjection(segment) && isBackfillEligibleProjection(segment)) {
        selector.add({
          kind: 'segment',
          memoryId: segment.memoryId,
          segmentId: segment.segmentId,
          updatedAt: segment.updatedAt,
          workspaceId: segment.workspaceId,
        });
      }
      for (const supplement of segment.supplements) {
        if (isBackfillEligibleProjection(supplement)) {
          selector.add({
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
}

export function collectEligibleBackfillTargets(
  input: BackfillScannerInput,
  limit = Number.POSITIVE_INFINITY
): BackfillEligibleTarget[] {
  const normalizedLimit = normalizeBackfillTargetLimit(limit);
  if (normalizedLimit === 0) {
    return [];
  }
  const selector = createBackfillTargetSelector(normalizedLimit);
  addEligibleBackfillTargets(input, selector);

  return selector.toArray();
}

export function normalizeBackfillTargetLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, Math.trunc(limit));
}

type SequencedBackfillTarget = {
  readonly sequence: number;
  readonly target: BackfillEligibleTarget;
};

export function createBackfillTargetSelector(limit: number) {
  const normalizedLimit = normalizeBackfillTargetLimit(limit);
  const isBounded = Number.isFinite(normalizedLimit);
  const selected: SequencedBackfillTarget[] = [];
  let sequence = 0;

  return {
    add(target: BackfillEligibleTarget) {
      const item = { sequence, target };
      sequence += 1;
      if (!isBounded) {
        selected.push(item);
        return;
      }

      if (normalizedLimit === 0) {
        return;
      }

      const oldestSelected = selected.at(-1);
      if (
        selected.length >= normalizedLimit &&
        oldestSelected &&
        compareBackfillTargetPriority(item, oldestSelected) <= 0
      ) {
        return;
      }

      insertSelectedBackfillTarget(selected, item);
      if (selected.length > normalizedLimit) {
        selected.pop();
      }
    },
    peekOldestSelected() {
      return selected.at(-1)?.target ?? null;
    },
    isFull() {
      return isBounded && selected.length >= normalizedLimit;
    },
    toArray() {
      const ordered = isBounded
        ? selected
        : selected.slice().sort((left, right) => -compareBackfillTargetPriority(left, right));
      return ordered.map((item) => item.target);
    },
  };
}

function compareBackfillTargetPriority(
  left: SequencedBackfillTarget,
  right: SequencedBackfillTarget
): number {
  const updatedAtOrder = left.target.updatedAt.localeCompare(right.target.updatedAt);
  if (updatedAtOrder !== 0) {
    return updatedAtOrder;
  }
  return right.sequence - left.sequence;
}

function insertSelectedBackfillTarget(
  selected: SequencedBackfillTarget[],
  item: SequencedBackfillTarget
) {
  const insertIndex = selected.findIndex(
    (selectedItem) => compareBackfillTargetPriority(item, selectedItem) > 0
  );
  if (insertIndex === -1) {
    selected.push(item);
    return;
  }
  selected.splice(insertIndex, 0, item);
}

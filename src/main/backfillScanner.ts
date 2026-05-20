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

export function limitBackfillTargets(
  targets: readonly BackfillEligibleTarget[],
  limit = Number.POSITIVE_INFINITY
): BackfillEligibleTarget[] {
  const normalizedLimit = normalizeBackfillTargetLimit(limit);
  if (normalizedLimit === 0) {
    return [];
  }
  const selector = createBackfillTargetSelector(normalizedLimit);
  for (const target of targets) {
    selector.add(target);
  }
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
  const selected: SequencedBackfillTarget[] = [];
  let sequence = 0;

  return {
    add(target: BackfillEligibleTarget) {
      const item = { sequence, target };
      sequence += 1;
      if (!Number.isFinite(limit)) {
        selected.push(item);
        return;
      }
      if (selected.length < limit) {
        heapPushWorstFirst(selected, item);
        return;
      }
      const worst = selected[0];
      if (worst && compareBackfillTargetPriority(item, worst) > 0) {
        selected[0] = item;
        heapifyWorstFirstDown(selected, 0);
      }
    },
    peekOldestSelected() {
      return selected[0]?.target ?? null;
    },
    isFull() {
      return Number.isFinite(limit) && selected.length >= limit;
    },
    toArray() {
      return selected
        .slice()
        .sort((left, right) => -compareBackfillTargetPriority(left, right))
        .map((item) => item.target);
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

function heapPushWorstFirst(heap: SequencedBackfillTarget[], item: SequencedBackfillTarget) {
  heap.push(item);
  heapifyWorstFirstUp(heap, heap.length - 1);
}

function heapifyWorstFirstUp(heap: SequencedBackfillTarget[], startIndex: number) {
  let index = startIndex;
  while (index > 0) {
    const parentIndex = Math.floor((index - 1) / 2);
    const parent = heap[parentIndex];
    const item = heap[index];
    if (!parent || !item || compareBackfillTargetPriority(item, parent) >= 0) {
      return;
    }
    heap[parentIndex] = item;
    heap[index] = parent;
    index = parentIndex;
  }
}

function heapifyWorstFirstDown(heap: SequencedBackfillTarget[], startIndex: number) {
  let index = startIndex;
  while (true) {
    const leftIndex = index * 2 + 1;
    const rightIndex = leftIndex + 1;
    let worstIndex = index;
    const left = heap[leftIndex];
    const right = heap[rightIndex];
    const worst = heap[worstIndex];
    if (left && worst && compareBackfillTargetPriority(left, worst) < 0) {
      worstIndex = leftIndex;
    }
    const currentWorst = heap[worstIndex];
    if (right && currentWorst && compareBackfillTargetPriority(right, currentWorst) < 0) {
      worstIndex = rightIndex;
    }
    if (worstIndex === index) {
      return;
    }
    const item = heap[index];
    const replacement = heap[worstIndex];
    if (!item || !replacement) {
      return;
    }
    heap[index] = replacement;
    heap[worstIndex] = item;
    index = worstIndex;
  }
}

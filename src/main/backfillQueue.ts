export type BackfillTaskSource = 'auto' | 'manual';
export type BackfillTaskMode = 'fill-missing' | 'regenerate';

export const BACKFILL_QUEUE_ERROR_CODES = [
  'abort',
  'auth',
  'batch-capped',
  'breaker-tripped',
  'canceled',
  'empty-audio',
  'format',
  'lock-lost',
  'malformed',
  'network',
  'quota',
  'queue-full',
  'rate-limit',
  'save-failed',
  'server-busy',
  'silent-audio',
  'size',
  'timeout',
  'target-not-eligible',
  'transcript-changed',
  'transcode-failed',
] as const;

export const BACKFILL_QUEUE_CANCEL_REASONS = ['app-quit', 'lock-lost', 'workspace-switch'] as const;

export const BACKFILL_QUEUE_PAUSE_REASONS = ['recording'] as const;

export const BACKFILL_QUEUE_EVENT_NAMES = [
  'batch-capped',
  'breaker-tripped',
  'queue-canceled',
  'queue-paused',
  'queue-resumed',
  'task-failed',
  'task-started',
  'task-succeeded',
] as const;

export type BackfillWorkspaceTaskContext = {
  readonly assertWorkspaceUsable?:
    | (() => { readonly ok: true } | { readonly ok: false })
    | undefined;
  readonly rootPath?: string | undefined;
};

export type BackfillQueueTask =
  | (BackfillWorkspaceTaskContext & {
      readonly kind: 'segment';
      readonly memoryId: string;
      readonly mode: BackfillTaskMode;
      readonly segmentId: string;
      readonly source: BackfillTaskSource;
      readonly workspaceHandle: string;
      readonly workspaceId: string;
    })
  | (BackfillWorkspaceTaskContext & {
      readonly kind: 'supplement';
      readonly memoryId: string;
      readonly mode: BackfillTaskMode;
      readonly segmentId: string;
      readonly source: BackfillTaskSource;
      readonly supplementId: string;
      readonly workspaceHandle: string;
      readonly workspaceId: string;
    });

export type BackfillQueueErrorCode = (typeof BACKFILL_QUEUE_ERROR_CODES)[number];

export type BackfillQueueRunResult<TResponse = unknown> =
  | {
      readonly ok: true;
      readonly response?: TResponse;
      readonly transcriptText: string;
    }
  | {
      readonly errorCode: BackfillQueueErrorCode;
      readonly ok: false;
      readonly response?: TResponse;
    };

export type BackfillQueue<TResponse = unknown> = {
  readonly awaitTask: (task: BackfillQueueTask) => Promise<BackfillQueueRunResult<TResponse>>;
  readonly cancelAll: (reason: BackfillQueueCancelReason) => void;
  readonly cancelAllAndDrain: (reason: BackfillQueueCancelReason) => Promise<void>;
  readonly enqueue: (
    task: BackfillQueueTask,
    options: { readonly insertAtHead: boolean }
  ) => BackfillQueueEnqueueResult;
  readonly enqueueAutomaticBatch: (
    tasks: Iterable<BackfillQueueTask>
  ) => BackfillQueueBatchEnqueueResult;
  readonly pause: (reason: BackfillQueuePauseReason) => void;
  readonly resume: (reason: BackfillQueuePauseReason) => void;
  readonly runManual: (task: BackfillQueueTask) => Promise<BackfillQueueRunResult<TResponse>>;
};

export type BackfillQueueCancelReason = (typeof BACKFILL_QUEUE_CANCEL_REASONS)[number];
export type BackfillQueuePauseReason = (typeof BACKFILL_QUEUE_PAUSE_REASONS)[number];

export type BackfillQueueEnqueueResult =
  | {
      readonly accepted: true;
      readonly position: number;
    }
  | {
      readonly accepted: false;
      readonly reason: 'duplicate' | 'queue-canceled' | 'queue-full';
    };

export type BackfillQueueBatchEnqueueResult = {
  readonly accepted: number;
  readonly capped: number;
  readonly duplicates: number;
};

export type CreateBackfillQueueInput<TResponse = unknown> = {
  readonly automaticBatchLimit: number;
  readonly automaticBreakerThreshold: number;
  readonly manualQueueLimit?: number;
  readonly onEvent?: (event: {
    readonly event: (typeof BACKFILL_QUEUE_EVENT_NAMES)[number];
    readonly fields?: Record<string, unknown>;
    readonly level?: 'info' | 'warn' | 'error';
  }) => void;
  readonly runTask: (input: {
    readonly signal: AbortSignal;
    readonly task: BackfillQueueTask;
  }) => Promise<BackfillQueueRunResult<TResponse>>;
};

type QueueEntry<TResponse = unknown> = {
  readonly batchId: number | null;
  readonly promise: Promise<BackfillQueueRunResult<TResponse>>;
  readonly resolve: (result: BackfillQueueRunResult<TResponse>) => void;
  readonly task: BackfillQueueTask;
  abortController?: AbortController;
};

type BreakerState = {
  readonly count: number;
  readonly errorCode: BackfillQueueErrorCode | null;
};

const CANCELED_RESULT: BackfillQueueRunResult<never> = { errorCode: 'canceled', ok: false };
const BATCH_CAPPED_RESULT: BackfillQueueRunResult<never> = {
  errorCode: 'batch-capped',
  ok: false,
};
const BREAKER_TRIPPED_RESULT: BackfillQueueRunResult<never> = {
  errorCode: 'breaker-tripped',
  ok: false,
};
const MAX_TERMINAL_TASK_RESULTS = 100;
const DEFAULT_MANUAL_QUEUE_LIMIT = 20;

export class BackfillAlreadyRunningError extends Error {
  readonly code = 'ERR_BACKFILL_ALREADY_RUNNING';
  readonly targetKey: string;

  constructor(task: BackfillQueueTask) {
    const targetKey = getBackfillTargetKey(task);
    super(`Backfill target is already running: ${targetKey}`);
    this.name = 'BackfillAlreadyRunningError';
    this.targetKey = targetKey;
  }
}

export function getBackfillTargetKey(task: BackfillQueueTask): string {
  if (task.kind === 'supplement') {
    return [task.kind, task.workspaceId, task.memoryId, task.segmentId, task.supplementId].join(
      ':'
    );
  }
  return [task.kind, task.workspaceId, task.memoryId, task.segmentId].join(':');
}

export function createBackfillQueue({
  automaticBatchLimit,
  automaticBreakerThreshold,
  onEvent,
  runTask,
}: CreateBackfillQueueInput): BackfillQueue;
export function createBackfillQueue<TResponse>({
  automaticBatchLimit,
  automaticBreakerThreshold,
  onEvent,
  runTask,
}: CreateBackfillQueueInput<TResponse>): BackfillQueue<TResponse>;
export function createBackfillQueue<TResponse = unknown>({
  automaticBatchLimit,
  automaticBreakerThreshold,
  manualQueueLimit = DEFAULT_MANUAL_QUEUE_LIMIT,
  onEvent,
  runTask,
}: CreateBackfillQueueInput<TResponse>): BackfillQueue<TResponse> {
  const queue: QueueEntry<TResponse>[] = [];
  const activeTargets = new Set<string>();
  const taskPromises = new Map<string, Promise<BackfillQueueRunResult<TResponse>>>();
  const terminalTaskKeys = new Set<string>();
  const pausedReasons = new Set<BackfillQueuePauseReason>();
  const breakerStates = new Map<number, BreakerState>();
  const batchPendingCounts = new Map<number, number>();
  const queuedTaskCountsByWorkspaceHandle = new Map<string, number>();
  let currentBatchId = 0;
  let pumpScheduled = false;
  let queueHeadIndex = 0;
  let queuedManualTaskCount = 0;
  let runningEntry: QueueEntry<TResponse> | null = null;

  function createEntry(task: BackfillQueueTask, batchId: number | null): QueueEntry<TResponse> {
    let resolve: (result: BackfillQueueRunResult<TResponse>) => void = () => undefined;
    const promise = new Promise<BackfillQueueRunResult<TResponse>>((innerResolve) => {
      resolve = innerResolve;
    });
    return { batchId, promise, resolve, task };
  }

  function rememberTerminalResult(
    task: BackfillQueueTask,
    result: BackfillQueueRunResult<TResponse>
  ) {
    const targetKey = getBackfillTargetKey(task);
    terminalTaskKeys.delete(targetKey);
    taskPromises.set(targetKey, Promise.resolve(result));
    terminalTaskKeys.add(targetKey);
    while (terminalTaskKeys.size > MAX_TERMINAL_TASK_RESULTS) {
      const expiredKey = terminalTaskKeys.values().next().value;
      if (expiredKey) {
        terminalTaskKeys.delete(expiredKey);
        taskPromises.delete(expiredKey);
      }
    }
  }

  function enqueueEntry(
    entry: QueueEntry<TResponse>,
    insertAtHead: boolean
  ): BackfillQueueEnqueueResult {
    const targetKey = getBackfillTargetKey(entry.task);
    if (activeTargets.has(targetKey)) {
      return { accepted: false, reason: 'duplicate' };
    }
    if (entry.task.source === 'manual' && activeManualTaskCount() >= manualQueueLimit) {
      return { accepted: false, reason: 'queue-full' };
    }
    activeTargets.add(targetKey);
    taskPromises.set(targetKey, entry.promise);
    registerQueuedEntry(entry);
    if (insertAtHead) {
      compactQueueIfNeeded(true);
      queue.unshift(entry);
      schedulePump();
      return { accepted: true, position: 1 };
    } else {
      queue.push(entry);
    }
    schedulePump();
    return { accepted: true, position: queuedEntryCount() };
  }

  function activeManualTaskCount() {
    return queuedManualTaskCount + (runningEntry?.task.source === 'manual' ? 1 : 0);
  }

  function registerQueuedEntry(entry: QueueEntry<TResponse>) {
    if (entry.task.source === 'manual') {
      queuedManualTaskCount += 1;
    }
    if (entry.batchId !== null) {
      batchPendingCounts.set(entry.batchId, (batchPendingCounts.get(entry.batchId) ?? 0) + 1);
    }
    incrementCount(queuedTaskCountsByWorkspaceHandle, entry.task.workspaceHandle);
  }

  function markEntryDequeued(entry: QueueEntry<TResponse>) {
    if (entry.task.source === 'manual') {
      queuedManualTaskCount -= 1;
    }
    decrementCount(queuedTaskCountsByWorkspaceHandle, entry.task.workspaceHandle);
  }

  function markEntryComplete(entry: QueueEntry<TResponse>) {
    if (entry.batchId === null) {
      return;
    }
    const pending = (batchPendingCounts.get(entry.batchId) ?? 0) - 1;
    if (pending <= 0) {
      batchPendingCounts.delete(entry.batchId);
    } else {
      batchPendingCounts.set(entry.batchId, pending);
    }
  }

  function queuedEntryCount() {
    return queue.length - queueHeadIndex;
  }

  function queuedEntries(): QueueEntry<TResponse>[] {
    return queue.slice(queueHeadIndex);
  }

  function incrementCount(counts: Map<string, number>, key: string) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  function decrementCount(counts: Map<string, number>, key: string) {
    const nextCount = (counts.get(key) ?? 0) - 1;
    if (nextCount <= 0) {
      counts.delete(key);
    } else {
      counts.set(key, nextCount);
    }
  }

  function compactQueueIfNeeded(force = false) {
    if (!force && queueHeadIndex < 64) {
      return;
    }
    if (queueHeadIndex === 0) {
      return;
    }
    queue.splice(0, queueHeadIndex);
    queueHeadIndex = 0;
  }

  function schedulePump() {
    if (pumpScheduled) {
      return;
    }
    pumpScheduled = true;
    queueMicrotask(() => {
      pumpScheduled = false;
      void pump();
    });
  }

  async function runEntry(
    entry: QueueEntry<TResponse>
  ): Promise<BackfillQueueRunResult<TResponse>> {
    const abortController = new AbortController();
    entry.abortController = abortController;
    const signal = abortController.signal;

    try {
      onEvent?.({
        event: 'task-started',
        fields: { mode: entry.task.mode, taskCount: 1 },
        level: 'info',
      });
      const result = await runTask({ signal, task: entry.task });
      if (!signal.aborted) {
        return result;
      }
      return result.response !== undefined ? result : CANCELED_RESULT;
    } catch {
      return signal.aborted ? CANCELED_RESULT : { errorCode: 'network', ok: false };
    }
  }

  function releaseEntry(entry: QueueEntry<TResponse>, result: BackfillQueueRunResult<TResponse>) {
    activeTargets.delete(getBackfillTargetKey(entry.task));
    onEvent?.({
      event: result.ok ? 'task-succeeded' : 'task-failed',
      fields: result.ok
        ? { mode: entry.task.mode, taskCount: 1 }
        : { errorCode: result.errorCode, mode: entry.task.mode, taskCount: 1 },
      level: result.ok ? 'info' : 'warn',
    });
    entry.resolve(result);
    rememberTerminalResult(entry.task, result);
    markEntryComplete(entry);
  }

  async function pump() {
    if (runningEntry || pausedReasons.size > 0) {
      return;
    }
    const next = queueHeadIndex < queue.length ? queue[queueHeadIndex] : undefined;
    if (!next) {
      compactQueueIfNeeded(true);
      return;
    }
    queueHeadIndex += 1;
    markEntryDequeued(next);
    compactQueueIfNeeded();

    runningEntry = next;
    const result = await runEntry(next);
    runningEntry = null;
    releaseEntry(next, result);
    if (!result.ok && result.errorCode === 'lock-lost') {
      cancelWorkspaceHandle('lock-lost', next.task.workspaceHandle);
      cleanupBatchIfIdle(next.batchId);
      schedulePump();
      return;
    }
    updateBreakerAfter(next, result);
    cleanupBatchIfIdle(next.batchId);
    schedulePump();
  }

  function updateBreakerAfter(
    entry: QueueEntry<TResponse>,
    result: BackfillQueueRunResult<TResponse>
  ) {
    if (entry.task.source !== 'auto' || result.ok) {
      if (entry.batchId !== null) {
        breakerStates.set(entry.batchId, { count: 0, errorCode: null });
      }
      return;
    }

    if (
      result.errorCode === 'canceled' ||
      result.errorCode === 'lock-lost' ||
      result.errorCode === 'batch-capped'
    ) {
      return;
    }

    if (entry.batchId === null) {
      return;
    }

    const breakerState = breakerStates.get(entry.batchId) ?? { count: 0, errorCode: null };
    const nextState =
      breakerState.errorCode === result.errorCode
        ? {
            count: breakerState.count + 1,
            errorCode: result.errorCode,
          }
        : { count: 1, errorCode: result.errorCode };
    breakerStates.set(entry.batchId, nextState);

    if (nextState.count >= automaticBreakerThreshold) {
      tripAutomaticBreaker(entry.batchId, result.errorCode);
    }
  }

  function cleanupBatchIfIdle(batchId: number | null) {
    if (batchId === null) {
      return;
    }
    if (!batchPendingCounts.has(batchId)) {
      breakerStates.delete(batchId);
    }
  }

  function tripAutomaticBreaker(batchId: number, errorCode: BackfillQueueErrorCode) {
    onEvent?.({
      event: 'breaker-tripped',
      fields: { errorCode },
      level: 'warn',
    });
    const preserved: QueueEntry<TResponse>[] = [];
    for (const entry of queuedEntries()) {
      if (entry.task.source === 'auto' && entry.batchId === batchId) {
        markEntryDequeued(entry);
        markEntryComplete(entry);
        activeTargets.delete(getBackfillTargetKey(entry.task));
        entry.resolve(BREAKER_TRIPPED_RESULT);
        rememberTerminalResult(entry.task, BREAKER_TRIPPED_RESULT);
      } else {
        preserved.push(entry);
      }
    }
    queue.splice(0, queue.length, ...preserved);
    queueHeadIndex = 0;
    cleanupBatchIfIdle(batchId);
  }

  function cancelQueuedEntries(
    result: BackfillQueueRunResult<TResponse>,
    predicate: (entry: QueueEntry<TResponse>) => boolean = () => true
  ) {
    const preserved: QueueEntry<TResponse>[] = [];
    const canceledBatchIds = new Set<number>();
    let canceledCount = 0;
    for (const entry of queuedEntries()) {
      if (predicate(entry)) {
        canceledCount += 1;
        markEntryDequeued(entry);
        markEntryComplete(entry);
        if (entry.batchId !== null) {
          canceledBatchIds.add(entry.batchId);
        }
        activeTargets.delete(getBackfillTargetKey(entry.task));
        entry.resolve(result);
        rememberTerminalResult(entry.task, result);
      } else {
        preserved.push(entry);
      }
    }
    queue.splice(0, queue.length, ...preserved);
    queueHeadIndex = 0;
    for (const batchId of canceledBatchIds) {
      cleanupBatchIfIdle(batchId);
    }
    return canceledCount;
  }

  function cancelAll(reason: BackfillQueueCancelReason) {
    const taskCount = queuedEntryCount() + (runningEntry ? 1 : 0);
    if (taskCount > 0) {
      onEvent?.({
        event: 'queue-canceled',
        fields: { errorCode: reason, taskCount },
        level: 'warn',
      });
    }
    pausedReasons.clear();
    runningEntry?.abortController?.abort();
    cancelQueuedEntries(CANCELED_RESULT);
  }

  function cancelWorkspaceHandle(reason: BackfillQueueCancelReason, workspaceHandle: string) {
    const taskCount = queuedTaskCountsByWorkspaceHandle.get(workspaceHandle) ?? 0;
    if (taskCount > 0) {
      onEvent?.({
        event: 'queue-canceled',
        fields: { errorCode: reason, taskCount },
        level: 'warn',
      });
    }
    cancelQueuedEntries(CANCELED_RESULT, (entry) => entry.task.workspaceHandle === workspaceHandle);
  }

  async function cancelAllAndDrain(reason: BackfillQueueCancelReason): Promise<void> {
    const running = runningEntry;
    cancelAll(reason);
    if (running) {
      await running.promise.catch(() => CANCELED_RESULT);
    }
  }

  function enqueue(
    task: BackfillQueueTask,
    options: { readonly insertAtHead: boolean }
  ): BackfillQueueEnqueueResult {
    return enqueueEntry(createEntry(task, null), options.insertAtHead);
  }

  function enqueueAutomaticBatch(
    tasks: Iterable<BackfillQueueTask>
  ): BackfillQueueBatchEnqueueResult {
    currentBatchId += 1;
    breakerStates.set(currentBatchId, { count: 0, errorCode: null });

    let accepted = 0;
    let capped = 0;
    let duplicates = 0;

    for (const task of tasks) {
      if (accepted >= automaticBatchLimit) {
        capped += 1;
        rememberTerminalResult(task, BATCH_CAPPED_RESULT);
        continue;
      }
      const result = enqueueEntry(createEntry(task, currentBatchId), false);
      if (result.accepted) {
        accepted += 1;
      } else if (result.reason === 'duplicate') {
        duplicates += 1;
      }
    }
    if (accepted === 0) {
      breakerStates.delete(currentBatchId);
    }
    if (capped > 0) {
      onEvent?.({
        event: 'batch-capped',
        fields: { taskCount: capped },
        level: 'warn',
      });
    }

    return { accepted, capped, duplicates };
  }

  async function runManual(task: BackfillQueueTask): Promise<BackfillQueueRunResult<TResponse>> {
    const result = enqueue(task, { insertAtHead: true });
    if (!result.accepted) {
      if (result.reason === 'duplicate') {
        throw new BackfillAlreadyRunningError(task);
      }
      if (result.reason === 'queue-full') {
        return { errorCode: 'queue-full', ok: false };
      }
      return CANCELED_RESULT;
    }
    return awaitTask(task);
  }

  function awaitTask(task: BackfillQueueTask): Promise<BackfillQueueRunResult<TResponse>> {
    return taskPromises.get(getBackfillTargetKey(task)) ?? Promise.resolve(CANCELED_RESULT);
  }

  function pause(reason: BackfillQueuePauseReason) {
    if (pausedReasons.has(reason)) {
      return;
    }
    onEvent?.({ event: 'queue-paused', fields: { errorCode: reason }, level: 'info' });
    pausedReasons.add(reason);
  }

  function resume(reason: BackfillQueuePauseReason) {
    if (!pausedReasons.has(reason)) {
      return;
    }
    onEvent?.({ event: 'queue-resumed', fields: { errorCode: reason }, level: 'info' });
    pausedReasons.delete(reason);
    schedulePump();
  }

  return {
    awaitTask,
    cancelAll,
    cancelAllAndDrain,
    enqueue,
    enqueueAutomaticBatch,
    pause,
    resume,
    runManual,
  };
}

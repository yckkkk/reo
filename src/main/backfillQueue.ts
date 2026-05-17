export type BackfillTaskSource = 'auto' | 'manual';

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
      readonly segmentId: string;
      readonly source: BackfillTaskSource;
      readonly workspaceHandle: string;
      readonly workspaceId: string;
    })
  | (BackfillWorkspaceTaskContext & {
      readonly kind: 'supplement';
      readonly memoryId: string;
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
    tasks: readonly BackfillQueueTask[]
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
  const terminalTaskKeys: string[] = [];
  const pausedReasons = new Set<BackfillQueuePauseReason>();
  const breakerStates = new Map<number, BreakerState>();
  let currentBatchId = 0;
  let pumpScheduled = false;
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
    const existingTerminalIndex = terminalTaskKeys.indexOf(targetKey);
    if (existingTerminalIndex !== -1) {
      terminalTaskKeys.splice(existingTerminalIndex, 1);
    }
    taskPromises.set(targetKey, Promise.resolve(result));
    terminalTaskKeys.push(targetKey);
    while (terminalTaskKeys.length > MAX_TERMINAL_TASK_RESULTS) {
      const expiredKey = terminalTaskKeys.shift();
      if (expiredKey) {
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
    if (insertAtHead) {
      queue.unshift(entry);
    } else {
      queue.push(entry);
    }
    schedulePump();
    return { accepted: true, position: queue.indexOf(entry) + 1 };
  }

  function activeManualTaskCount() {
    return (
      queue.filter((entry) => entry.task.source === 'manual').length +
      (runningEntry?.task.source === 'manual' ? 1 : 0)
    );
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
      onEvent?.({ event: 'task-started', fields: { taskCount: 1 }, level: 'info' });
      const result = await runTask({ signal, task: entry.task });
      if (!signal.aborted) {
        return result;
      }
      return !result.ok && result.response ? result : CANCELED_RESULT;
    } catch {
      return signal.aborted ? CANCELED_RESULT : { errorCode: 'network', ok: false };
    }
  }

  function releaseEntry(entry: QueueEntry<TResponse>, result: BackfillQueueRunResult<TResponse>) {
    activeTargets.delete(getBackfillTargetKey(entry.task));
    onEvent?.({
      event: result.ok ? 'task-succeeded' : 'task-failed',
      fields: result.ok ? { taskCount: 1 } : { errorCode: result.errorCode, taskCount: 1 },
      level: result.ok ? 'info' : 'warn',
    });
    entry.resolve(result);
    rememberTerminalResult(entry.task, result);
  }

  async function pump() {
    if (runningEntry || pausedReasons.size > 0) {
      return;
    }
    const next = queue.shift();
    if (!next) {
      return;
    }

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
    if (!hasBatchEntry(batchId, queue, runningEntry)) {
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
    for (const entry of queue) {
      if (entry.task.source === 'auto' && entry.batchId === batchId) {
        activeTargets.delete(getBackfillTargetKey(entry.task));
        entry.resolve(BREAKER_TRIPPED_RESULT);
        rememberTerminalResult(entry.task, BREAKER_TRIPPED_RESULT);
      } else {
        preserved.push(entry);
      }
    }
    queue.splice(0, queue.length, ...preserved);
    cleanupBatchIfIdle(batchId);
  }

  function cancelQueuedEntries(
    result: BackfillQueueRunResult<TResponse>,
    predicate: (entry: QueueEntry<TResponse>) => boolean = () => true
  ) {
    const canceled: QueueEntry<TResponse>[] = [];
    const preserved: QueueEntry<TResponse>[] = [];
    for (const entry of queue) {
      if (predicate(entry)) {
        canceled.push(entry);
      } else {
        preserved.push(entry);
      }
    }
    queue.splice(0, queue.length, ...preserved);
    const canceledBatchIds = new Set<number>();
    for (const entry of canceled) {
      if (entry.batchId !== null) {
        canceledBatchIds.add(entry.batchId);
      }
      activeTargets.delete(getBackfillTargetKey(entry.task));
      entry.resolve(result);
      rememberTerminalResult(entry.task, result);
    }
    for (const batchId of canceledBatchIds) {
      cleanupBatchIfIdle(batchId);
    }
  }

  function cancelAll(reason: BackfillQueueCancelReason) {
    const taskCount = queue.length + (runningEntry ? 1 : 0);
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
    const taskCount = queue.filter(
      (entry) => entry.task.workspaceHandle === workspaceHandle
    ).length;
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
    tasks: readonly BackfillQueueTask[]
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

function hasBatchEntry<TResponse>(
  batchId: number,
  queue: readonly QueueEntry<TResponse>[],
  runningEntry: QueueEntry<TResponse> | null
): boolean {
  return runningEntry?.batchId === batchId || queue.some((entry) => entry.batchId === batchId);
}

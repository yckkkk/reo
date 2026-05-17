export type BackfillTaskSource = 'auto' | 'manual';

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

export type BackfillQueueErrorCode =
  | 'abort'
  | 'auth'
  | 'batch-capped'
  | 'breaker-tripped'
  | 'canceled'
  | 'empty-audio'
  | 'format'
  | 'lock-lost'
  | 'malformed'
  | 'network'
  | 'quota'
  | 'rate-limit'
  | 'save-failed'
  | 'size'
  | 'timeout'
  | 'target-not-eligible'
  | 'url-source-failed'
  | 'url-source-unconfigured';

export type BackfillQueueRunResult =
  | {
      readonly ok: true;
      readonly transcriptText: string;
    }
  | {
      readonly errorCode: BackfillQueueErrorCode;
      readonly ok: false;
    };

export type BackfillQueueUrlSourceResult =
  | {
      readonly cleanup: () => Promise<void>;
      readonly ok: true;
      readonly url: string;
    }
  | {
      readonly errorCode: BackfillQueueErrorCode;
      readonly ok: false;
    };

export type BackfillQueue = {
  readonly awaitTask: (task: BackfillQueueTask) => Promise<BackfillQueueRunResult>;
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
  readonly runManual: (task: BackfillQueueTask) => Promise<BackfillQueueRunResult>;
};

export type BackfillQueueCancelReason = 'app-quit' | 'lock-lost' | 'workspace-switch';
export type BackfillQueuePauseReason = 'recording';

export type BackfillQueueEnqueueResult =
  | {
      readonly accepted: true;
      readonly position: number;
    }
  | {
      readonly accepted: false;
      readonly reason: 'duplicate' | 'queue-canceled';
    };

export type BackfillQueueBatchEnqueueResult = {
  readonly accepted: number;
  readonly capped: number;
  readonly duplicates: number;
};

export type CreateBackfillQueueInput = {
  readonly acquireUrlSource: (input: {
    readonly signal: AbortSignal;
    readonly task: BackfillQueueTask;
  }) => Promise<BackfillQueueUrlSourceResult>;
  readonly automaticBatchLimit: number;
  readonly automaticBreakerThreshold: number;
  readonly onCleanupError?: (input: {
    readonly error: unknown;
    readonly task: BackfillQueueTask;
  }) => void;
  readonly onEvent?: (event: {
    readonly event:
      | 'batch-capped'
      | 'breaker-tripped'
      | 'queue-canceled'
      | 'queue-paused'
      | 'queue-resumed'
      | 'task-failed'
      | 'task-started'
      | 'task-succeeded';
    readonly fields?: Record<string, unknown>;
    readonly level?: 'info' | 'warn' | 'error';
  }) => void;
  readonly runTask: (input: {
    readonly signal: AbortSignal;
    readonly task: BackfillQueueTask;
    readonly url: string;
  }) => Promise<BackfillQueueRunResult>;
};

type QueueEntry = {
  readonly batchId: number | null;
  readonly promise: Promise<BackfillQueueRunResult>;
  readonly reject: (error: unknown) => void;
  readonly resolve: (result: BackfillQueueRunResult) => void;
  readonly task: BackfillQueueTask;
  abortController?: AbortController;
};

type BreakerState = {
  readonly count: number;
  readonly errorCode: BackfillQueueErrorCode | null;
};

const CANCELED_RESULT: BackfillQueueRunResult = { errorCode: 'canceled', ok: false };
const BATCH_CAPPED_RESULT: BackfillQueueRunResult = { errorCode: 'batch-capped', ok: false };
const BREAKER_TRIPPED_RESULT: BackfillQueueRunResult = {
  errorCode: 'breaker-tripped',
  ok: false,
};
const MAX_TERMINAL_TASK_RESULTS = 100;

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
  acquireUrlSource,
  automaticBatchLimit,
  automaticBreakerThreshold,
  onCleanupError,
  onEvent,
  runTask,
}: CreateBackfillQueueInput): BackfillQueue {
  const queue: QueueEntry[] = [];
  const activeTargets = new Set<string>();
  const taskPromises = new Map<string, Promise<BackfillQueueRunResult>>();
  const terminalTaskKeys: string[] = [];
  const pausedReasons = new Set<BackfillQueuePauseReason>();
  const breakerStates = new Map<number, BreakerState>();
  let currentBatchId = 0;
  let pumpScheduled = false;
  let runningEntry: QueueEntry | null = null;

  function createEntry(task: BackfillQueueTask, batchId: number | null): QueueEntry {
    let resolve: (result: BackfillQueueRunResult) => void = () => undefined;
    let reject: (error: unknown) => void = () => undefined;
    const promise = new Promise<BackfillQueueRunResult>((innerResolve, innerReject) => {
      resolve = innerResolve;
      reject = innerReject;
    });
    return { batchId, promise, reject, resolve, task };
  }

  function rememberTerminalResult(task: BackfillQueueTask, result: BackfillQueueRunResult) {
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

  function enqueueEntry(entry: QueueEntry, insertAtHead: boolean): BackfillQueueEnqueueResult {
    const targetKey = getBackfillTargetKey(entry.task);
    if (activeTargets.has(targetKey)) {
      return { accepted: false, reason: 'duplicate' };
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

  async function cleanupUrlSource(task: BackfillQueueTask, cleanup: () => Promise<void>) {
    try {
      await cleanup();
    } catch (error) {
      onCleanupError?.({ error, task });
    }
  }

  async function runEntry(entry: QueueEntry): Promise<BackfillQueueRunResult> {
    const abortController = new AbortController();
    entry.abortController = abortController;
    const signal = abortController.signal;

    let source: BackfillQueueUrlSourceResult;
    try {
      source = await acquireUrlSource({ signal, task: entry.task });
    } catch {
      return signal.aborted ? CANCELED_RESULT : { errorCode: 'url-source-failed', ok: false };
    }

    if (!source.ok) {
      return source;
    }

    try {
      onEvent?.({ event: 'task-started', fields: { taskCount: 1 }, level: 'info' });
      if (signal.aborted) {
        return CANCELED_RESULT;
      }
      const result = await runTask({ signal, task: entry.task, url: source.url });
      return signal.aborted ? CANCELED_RESULT : result;
    } catch {
      return signal.aborted ? CANCELED_RESULT : { errorCode: 'network', ok: false };
    } finally {
      await cleanupUrlSource(entry.task, source.cleanup);
    }
  }

  function releaseEntry(entry: QueueEntry, result: BackfillQueueRunResult) {
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
    updateBreakerAfter(next, result);
    cleanupBatchIfIdle(next.batchId);
    schedulePump();
  }

  function updateBreakerAfter(entry: QueueEntry, result: BackfillQueueRunResult) {
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
    const preserved: QueueEntry[] = [];
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

  function cancelQueuedEntries(result: BackfillQueueRunResult) {
    const canceled = queue.splice(0, queue.length);
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
    if (runningEntry?.abortController) {
      runningEntry.abortController.abort();
    }

    cancelQueuedEntries(CANCELED_RESULT);
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
      const automaticTask = asSource(task, 'auto');
      if (accepted >= automaticBatchLimit) {
        capped += 1;
        rememberTerminalResult(automaticTask, BATCH_CAPPED_RESULT);
        continue;
      }
      const result = enqueueEntry(createEntry(automaticTask, currentBatchId), false);
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

  async function runManual(task: BackfillQueueTask): Promise<BackfillQueueRunResult> {
    const manualTask = asSource(task, 'manual');
    const result = enqueue(manualTask, { insertAtHead: true });
    if (!result.accepted) {
      if (result.reason === 'duplicate') {
        throw new BackfillAlreadyRunningError(manualTask);
      }
      return CANCELED_RESULT;
    }
    return awaitTask(manualTask);
  }

  function awaitTask(task: BackfillQueueTask): Promise<BackfillQueueRunResult> {
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

function hasBatchEntry(
  batchId: number,
  queue: readonly QueueEntry[],
  runningEntry: QueueEntry | null
): boolean {
  return runningEntry?.batchId === batchId || queue.some((entry) => entry.batchId === batchId);
}

function asSource(task: BackfillQueueTask, source: BackfillTaskSource): BackfillQueueTask {
  if (task.kind === 'supplement') {
    return { ...task, source };
  }
  return { ...task, source };
}

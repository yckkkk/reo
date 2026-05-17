import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BackfillAlreadyRunningError,
  createBackfillQueue,
  getBackfillTargetKey,
  type BackfillQueueRunResult,
  type BackfillQueueTask,
} from '../../src/main/backfillQueue.js';

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly reject: (error: unknown) => void;
  readonly resolve: (value: T) => void;
};

type RunCall = {
  readonly signal: AbortSignal;
  readonly task: BackfillQueueTask;
  readonly url: string;
};

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, reject, resolve };
}

function success(transcriptText = 'done'): BackfillQueueRunResult {
  return { ok: true, transcriptText };
}

function failure(errorCode: 'auth' | 'network'): BackfillQueueRunResult {
  return { errorCode, ok: false };
}

function segmentTask(id: string, source: 'auto' | 'manual' = 'auto'): BackfillQueueTask {
  return {
    kind: 'segment',
    memoryId: `memory-${id}`,
    segmentId: `segment-${id}`,
    source,
    workspaceHandle: 'workspace-handle-1',
    workspaceId: 'workspace-1',
  };
}

async function flushQueue() {
  await Promise.resolve();
  await Promise.resolve();
}

function createControlledQueue({
  automaticBatchLimit = 20,
  automaticBreakerThreshold = 3,
}: {
  readonly automaticBatchLimit?: number;
  readonly automaticBreakerThreshold?: number;
} = {}) {
  const calls: RunCall[] = [];
  const cleanups: string[] = [];
  const pending: Deferred<BackfillQueueRunResult>[] = [];
  const queue = createBackfillQueue({
    acquireUrlSource: async ({ task }) => ({
      cleanup: async () => {
        cleanups.push(getBackfillTargetKey(task));
      },
      ok: true,
      url: `url:${getBackfillTargetKey(task)}`,
    }),
    automaticBatchLimit,
    automaticBreakerThreshold,
    runTask: async ({ signal, task, url }) => {
      calls.push({ signal, task, url });
      const next = deferred<BackfillQueueRunResult>();
      pending.push(next);
      return next.promise;
    },
  });
  return { calls, cleanups, pending, queue };
}

test('backfill queue runs automatic tasks in FIFO order and cleans up acquired URL sources', async () => {
  const { calls, cleanups, pending, queue } = createControlledQueue();
  const first = segmentTask('1');
  const second = segmentTask('2');

  assert.deepEqual(queue.enqueueAutomaticBatch([first, second]), {
    accepted: 2,
    capped: 0,
    duplicates: 0,
  });
  await flushQueue();

  assert.deepEqual(
    calls.map((call) => call.task.segmentId),
    ['segment-1']
  );
  pending[0]?.resolve(success('one'));
  assert.deepEqual(await queue.awaitTask(first), { ok: true, transcriptText: 'one' });
  await flushQueue();

  assert.deepEqual(
    calls.map((call) => call.task.segmentId),
    ['segment-1', 'segment-2']
  );
  pending[1]?.resolve(success('two'));
  assert.deepEqual(await queue.awaitTask(second), { ok: true, transcriptText: 'two' });
  assert.deepEqual(cleanups, [getBackfillTargetKey(first), getBackfillTargetKey(second)]);
});

test('manual head insert waits for the in-flight task and then runs before queued automatic work', async () => {
  const { calls, pending, queue } = createControlledQueue();
  const firstAuto = segmentTask('auto-1');
  const secondAuto = segmentTask('auto-2');
  const manual = segmentTask('manual', 'manual');

  queue.enqueueAutomaticBatch([firstAuto, secondAuto]);
  await flushQueue();
  const manualResult = queue.runManual(manual);

  assert.deepEqual(
    calls.map((call) => call.task.segmentId),
    ['segment-auto-1']
  );
  pending[0]?.resolve(success('auto one'));
  await queue.awaitTask(firstAuto);
  await flushQueue();

  assert.deepEqual(
    calls.map((call) => call.task.segmentId),
    ['segment-auto-1', 'segment-manual']
  );
  pending[1]?.resolve(success('manual done'));
  assert.deepEqual(await manualResult, { ok: true, transcriptText: 'manual done' });
  await flushQueue();

  assert.deepEqual(
    calls.map((call) => call.task.segmentId),
    ['segment-auto-1', 'segment-manual', 'segment-auto-2']
  );
  pending[2]?.resolve(success('auto two'));
  await queue.awaitTask(secondAuto);
});

test('deduplicates by target and rejects same-target manual callers with typed already-running error', async () => {
  const { queue } = createControlledQueue();
  const automatic = segmentTask('same');
  const duplicateAutomatic = { ...automatic };
  const duplicateManual = segmentTask('same', 'manual');

  assert.deepEqual(queue.enqueue(automatic, { insertAtHead: false }), {
    accepted: true,
    position: 1,
  });
  assert.deepEqual(queue.enqueue(duplicateAutomatic, { insertAtHead: false }), {
    accepted: false,
    reason: 'duplicate',
  });
  await assert.rejects(() => queue.runManual(duplicateManual), BackfillAlreadyRunningError);
});

test('pause blocks dequeue and resume starts from the queue head', async () => {
  const { calls, pending, queue } = createControlledQueue();
  const task = segmentTask('paused');

  queue.pause('recording');
  queue.enqueueAutomaticBatch([task]);
  await flushQueue();
  assert.equal(calls.length, 0);

  queue.resume('recording');
  await flushQueue();
  assert.deepEqual(
    calls.map((call) => call.task.segmentId),
    ['segment-paused']
  );
  pending[0]?.resolve(success());
  await queue.awaitTask(task);
});

test('cancelAll aborts the in-flight task and cancels queued automatic and manual tasks', async () => {
  const { calls, pending, queue } = createControlledQueue();
  const running = segmentTask('running');
  const queuedAuto = segmentTask('queued-auto');
  const queuedManual = segmentTask('queued-manual', 'manual');

  queue.enqueueAutomaticBatch([running, queuedAuto]);
  await flushQueue();
  const manualResult = queue.runManual(queuedManual);
  assert.equal(calls.length, 1);

  queue.cancelAll('workspace-switch');
  assert.equal(calls[0]?.signal.aborted, true);
  pending[0]?.resolve({ errorCode: 'canceled', ok: false });

  assert.deepEqual(await queue.awaitTask(running), { errorCode: 'canceled', ok: false });
  assert.deepEqual(await queue.awaitTask(queuedAuto), { errorCode: 'canceled', ok: false });
  assert.deepEqual(await manualResult, { errorCode: 'canceled', ok: false });
  await flushQueue();
  assert.equal(calls.length, 1);
});

test('cancelAll coerces late provider success to canceled when the provider ignores abort', async () => {
  const { calls, pending, queue } = createControlledQueue();
  const running = segmentTask('late-success');

  queue.enqueueAutomaticBatch([running]);
  await flushQueue();
  const result = queue.awaitTask(running);

  queue.cancelAll('workspace-switch');
  assert.equal(calls[0]?.signal.aborted, true);
  pending[0]?.resolve(success('late transcript'));

  assert.deepEqual(await result, { errorCode: 'canceled', ok: false });
});

test('backfill queue emits allowlisted diagnostics for pause cancel cap breaker and task outcomes', async () => {
  const events: Array<{
    readonly event: string;
    readonly fields?: Record<string, unknown>;
    readonly level?: string;
  }> = [];
  const pending: Deferred<BackfillQueueRunResult>[] = [];
  const queue = createBackfillQueue({
    acquireUrlSource: async ({ task }) => ({
      cleanup: async () => undefined,
      ok: true,
      url: `url:${getBackfillTargetKey(task)}`,
    }),
    automaticBatchLimit: 1,
    automaticBreakerThreshold: 1,
    onEvent: (event) => events.push(event),
    runTask: async () => {
      const next = deferred<BackfillQueueRunResult>();
      pending.push(next);
      return next.promise;
    },
  });
  const first = segmentTask('event-1');
  const capped = segmentTask('event-capped');
  const canceled = segmentTask('event-canceled');

  queue.pause('recording');
  queue.enqueueAutomaticBatch([first, capped]);
  queue.resume('recording');
  await flushQueue();
  pending[0]?.resolve(failure('auth'));
  await queue.awaitTask(first);
  queue.enqueueAutomaticBatch([canceled]);
  await flushQueue();
  queue.cancelAll('workspace-switch');
  pending[1]?.resolve(success('late'));
  await queue.awaitTask(canceled);

  assert.deepEqual(
    events.map((event) => event.event),
    [
      'queue-paused',
      'batch-capped',
      'queue-resumed',
      'task-started',
      'task-failed',
      'breaker-tripped',
      'task-started',
      'queue-canceled',
      'task-failed',
    ]
  );
  const serialized = JSON.stringify(events);
  assert.equal(serialized.includes('/Users/'), false);
  assert.equal(serialized.includes('https://'), false);
  assert.equal(serialized.includes('transcript'), false);
});

test('automatic batch cap accepts only the first N automatic tasks while manual tasks bypass the cap', async () => {
  const { pending, queue } = createControlledQueue({ automaticBatchLimit: 2 });
  const first = segmentTask('cap-1');
  const second = segmentTask('cap-2');
  const capped = segmentTask('cap-3');
  const manual = segmentTask('cap-manual', 'manual');

  queue.pause('recording');
  assert.deepEqual(queue.enqueueAutomaticBatch([first, second, capped]), {
    accepted: 2,
    capped: 1,
    duplicates: 0,
  });
  const manualResult = queue.runManual(manual);
  queue.resume('recording');
  await flushQueue();

  pending[0]?.resolve(success('manual bypassed cap'));
  assert.deepEqual(await manualResult, { ok: true, transcriptText: 'manual bypassed cap' });
  assert.deepEqual(await queue.awaitTask(capped), { errorCode: 'batch-capped', ok: false });
});

test('automatic breaker trips after K consecutive same error codes and does not trip for alternating errors', async () => {
  const { calls, pending, queue } = createControlledQueue({ automaticBreakerThreshold: 2 });
  const first = segmentTask('breaker-1');
  const second = segmentTask('breaker-2');
  const third = segmentTask('breaker-3');

  queue.enqueueAutomaticBatch([first, second, third]);
  await flushQueue();
  pending[0]?.resolve(failure('auth'));
  await queue.awaitTask(first);
  await flushQueue();
  pending[1]?.resolve(failure('auth'));
  await queue.awaitTask(second);
  await flushQueue();

  assert.deepEqual(
    calls.map((call) => call.task.segmentId),
    ['segment-breaker-1', 'segment-breaker-2']
  );
  assert.deepEqual(await queue.awaitTask(third), { errorCode: 'breaker-tripped', ok: false });

  const alternating = createControlledQueue({ automaticBreakerThreshold: 2 });
  const altFirst = segmentTask('alt-1');
  const altSecond = segmentTask('alt-2');
  const altThird = segmentTask('alt-3');

  alternating.queue.enqueueAutomaticBatch([altFirst, altSecond, altThird]);
  await flushQueue();
  alternating.pending[0]?.resolve(failure('auth'));
  await alternating.queue.awaitTask(altFirst);
  await flushQueue();
  alternating.pending[1]?.resolve(failure('network'));
  await alternating.queue.awaitTask(altSecond);
  await flushQueue();

  assert.deepEqual(
    alternating.calls.map((call) => call.task.segmentId),
    ['segment-alt-1', 'segment-alt-2', 'segment-alt-3']
  );
});

test('manual tasks bypass the automatic breaker and are preserved when the breaker drops automatic work', async () => {
  const { calls, pending, queue } = createControlledQueue({ automaticBreakerThreshold: 1 });
  const automatic = segmentTask('breaker-auto');
  const droppedAutomatic = segmentTask('breaker-dropped');
  const manual = segmentTask('breaker-manual', 'manual');

  queue.enqueueAutomaticBatch([automatic, droppedAutomatic]);
  await flushQueue();
  const manualResult = queue.runManual(manual);

  pending[0]?.resolve(failure('auth'));
  await queue.awaitTask(automatic);
  await flushQueue();

  assert.deepEqual(
    calls.map((call) => call.task.segmentId),
    ['segment-breaker-auto', 'segment-breaker-manual']
  );
  assert.deepEqual(await queue.awaitTask(droppedAutomatic), {
    errorCode: 'breaker-tripped',
    ok: false,
  });

  pending[1]?.resolve(success('manual still runs'));
  assert.deepEqual(await manualResult, { ok: true, transcriptText: 'manual still runs' });
});

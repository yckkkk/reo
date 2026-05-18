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
  readonly resolve: (value: T) => void;
};

type RunCall = {
  readonly signal: AbortSignal;
  readonly task: BackfillQueueTask;
};

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

function success(transcriptText = 'done'): BackfillQueueRunResult {
  return { ok: true, transcriptText };
}

function failure(errorCode: 'auth' | 'lock-lost' | 'network'): BackfillQueueRunResult {
  return { errorCode, ok: false };
}

function segmentTask(
  id: string,
  source: 'auto' | 'manual' = 'auto',
  workspaceHandle = 'workspace-handle-1',
  mode: 'fill-missing' | 'regenerate' = 'fill-missing'
): BackfillQueueTask {
  return {
    kind: 'segment',
    memoryId: `mem_${id}`,
    mode,
    segmentId: `seg_${id}`,
    source,
    workspaceHandle,
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
  manualQueueLimit,
}: {
  readonly automaticBatchLimit?: number;
  readonly automaticBreakerThreshold?: number;
  readonly manualQueueLimit?: number;
} = {}) {
  const calls: RunCall[] = [];
  const pending: Deferred<BackfillQueueRunResult>[] = [];
  const queue = createBackfillQueue({
    automaticBatchLimit,
    automaticBreakerThreshold,
    ...(manualQueueLimit === undefined ? {} : { manualQueueLimit }),
    runTask: async ({ signal, task }) => {
      calls.push({ signal, task });
      const next = deferred<BackfillQueueRunResult>();
      pending.push(next);
      return next.promise;
    },
  });
  return { calls, pending, queue };
}

test('backfill queue runs automatic tasks in FIFO order', async () => {
  const { calls, pending, queue } = createControlledQueue();
  const first = segmentTask('one');
  const second = segmentTask('two');

  assert.deepEqual(queue.enqueueAutomaticBatch([first, second]), {
    accepted: 2,
    capped: 0,
    duplicates: 0,
  });
  await flushQueue();
  assert.deepEqual(
    calls.map((call) => call.task.segmentId),
    ['seg_one']
  );

  pending[0]?.resolve(success('one done'));
  assert.deepEqual(await queue.awaitTask(first), { ok: true, transcriptText: 'one done' });
  await flushQueue();
  assert.deepEqual(
    calls.map((call) => call.task.segmentId),
    ['seg_one', 'seg_two']
  );
});

test('manual head insert waits for in-flight work and runs before queued automatic work', async () => {
  const { calls, pending, queue } = createControlledQueue();
  const firstAuto = segmentTask('auto_one');
  const secondAuto = segmentTask('auto_two');
  const manual = segmentTask('manual', 'manual');

  queue.enqueueAutomaticBatch([firstAuto, secondAuto]);
  await flushQueue();
  const manualResult = queue.runManual(manual);

  pending[0]?.resolve(success('auto one'));
  await queue.awaitTask(firstAuto);
  await flushQueue();
  assert.deepEqual(
    calls.map((call) => call.task.segmentId),
    ['seg_auto_one', 'seg_manual']
  );

  pending[1]?.resolve(success('manual done'));
  assert.deepEqual(await manualResult, { ok: true, transcriptText: 'manual done' });
  await flushQueue();
  assert.deepEqual(
    calls.map((call) => call.task.segmentId),
    ['seg_auto_one', 'seg_manual', 'seg_auto_two']
  );
});

test('deduplicates by target and rejects same-target manual callers', async () => {
  const { queue } = createControlledQueue();
  const automatic = segmentTask('same');

  assert.deepEqual(queue.enqueue(automatic, { insertAtHead: false }), {
    accepted: true,
    position: 1,
  });
  assert.deepEqual(queue.enqueue({ ...automatic }, { insertAtHead: false }), {
    accepted: false,
    reason: 'duplicate',
  });
  await assert.rejects(
    () => queue.runManual(segmentTask('same', 'manual')),
    BackfillAlreadyRunningError
  );
});

test('deduplicates by target identity without using backfill mode', async () => {
  const { queue } = createControlledQueue();
  const automatic = segmentTask('same_mode_identity', 'auto', 'workspace-handle-1', 'fill-missing');
  const regenerate = segmentTask(
    'same_mode_identity',
    'manual',
    'workspace-handle-1',
    'regenerate'
  );

  assert.deepEqual(queue.enqueue(automatic, { insertAtHead: false }), {
    accepted: true,
    position: 1,
  });
  assert.equal(getBackfillTargetKey(automatic), getBackfillTargetKey(regenerate));
  await assert.rejects(() => queue.runManual(regenerate), BackfillAlreadyRunningError);
});

test('manual head insert reports its effective queued position', async () => {
  const { queue } = createControlledQueue();
  const automatic = segmentTask('manual_position_auto');
  const manual = segmentTask('manual_position_manual', 'manual');

  assert.deepEqual(queue.enqueue(automatic, { insertAtHead: false }), {
    accepted: true,
    position: 1,
  });
  assert.deepEqual(queue.enqueue(manual, { insertAtHead: true }), {
    accepted: true,
    position: 1,
  });
});

test('task diagnostics carry mode for started and terminal queue events', async () => {
  const events: Array<{ readonly event: string; readonly fields?: Record<string, unknown> }> = [];
  const queue = createBackfillQueue({
    automaticBatchLimit: 20,
    automaticBreakerThreshold: 3,
    onEvent: (event) => {
      events.push({
        event: event.event,
        ...(event.fields ? { fields: event.fields } : {}),
      });
    },
    runTask: async () => success('done'),
  });
  const task = segmentTask('diagnostic_mode', 'manual', 'workspace-handle-1', 'regenerate');

  assert.deepEqual(await queue.runManual(task), { ok: true, transcriptText: 'done' });

  assert.deepEqual(
    events.filter((event) => event.event === 'task-started' || event.event === 'task-succeeded'),
    [
      { event: 'task-started', fields: { mode: 'regenerate', taskCount: 1 } },
      { event: 'task-succeeded', fields: { mode: 'regenerate', taskCount: 1 } },
    ]
  );
});

test('pause resume and cancel preserve queue semantics', async () => {
  const { calls, pending, queue } = createControlledQueue();
  const paused = segmentTask('paused');
  const queued = segmentTask('queued');

  queue.pause('recording');
  queue.enqueueAutomaticBatch([paused, queued]);
  await flushQueue();
  assert.equal(calls.length, 0);

  queue.resume('recording');
  await flushQueue();
  assert.equal(calls[0]?.task.segmentId, 'seg_paused');
  queue.cancelAll('workspace-switch');
  assert.equal(calls[0]?.signal.aborted, true);
  pending[0]?.resolve(success('late'));

  assert.deepEqual(await queue.awaitTask(paused), { errorCode: 'canceled', ok: false });
  assert.deepEqual(await queue.awaitTask(queued), { errorCode: 'canceled', ok: false });
});

test('cancel after a committed successful result preserves the response', async () => {
  const { calls, pending, queue } = createControlledQueue();
  const running = segmentTask('committed_success', 'manual', 'workspace-handle-1', 'regenerate');
  const committedResult: BackfillQueueRunResult<{ readonly saved: true }> = {
    ok: true,
    response: { saved: true },
    transcriptText: 'committed transcript',
  };

  const manualResult = queue.runManual(running);
  await flushQueue();

  queue.cancelAll('workspace-switch');
  assert.equal(calls[0]?.signal.aborted, true);
  pending[0]?.resolve(committedResult);

  assert.deepEqual(await manualResult, committedResult);
  assert.deepEqual(await queue.awaitTask(running), committedResult);
});

test('cancel after a committed falsey response preserves the result', async () => {
  const { calls, pending, queue } = createControlledQueue();
  const running = segmentTask('committed_falsey', 'manual', 'workspace-handle-1', 'regenerate');
  const committedResult: BackfillQueueRunResult<false> = {
    ok: true,
    response: false,
    transcriptText: 'committed transcript',
  };

  const manualResult = queue.runManual(running);
  await flushQueue();

  queue.cancelAll('workspace-switch');
  assert.equal(calls[0]?.signal.aborted, true);
  pending[0]?.resolve(committedResult);

  assert.deepEqual(await manualResult, committedResult);
  assert.deepEqual(await queue.awaitTask(running), committedResult);
});

test('cancelAllAndDrain waits for the in-flight task to settle after abort', async () => {
  const { calls, pending, queue } = createControlledQueue();
  const running = segmentTask('drain');

  queue.enqueueAutomaticBatch([running]);
  await flushQueue();
  assert.equal(calls.length, 1);

  let drained = false;
  const drain = queue.cancelAllAndDrain('app-quit').then(() => {
    drained = true;
  });
  await flushQueue();

  assert.equal(calls[0]?.signal.aborted, true);
  assert.equal(drained, false);

  pending[0]?.resolve(success('late'));
  await drain;

  assert.equal(drained, true);
  assert.deepEqual(await queue.awaitTask(running), { errorCode: 'canceled', ok: false });
});

test('batch cap and breaker apply only to automatic tasks', async () => {
  const cappedQueue = createControlledQueue({ automaticBatchLimit: 1 });
  const first = segmentTask('cap_one');
  const capped = segmentTask('cap_two');
  assert.deepEqual(cappedQueue.queue.enqueueAutomaticBatch([first, capped]), {
    accepted: 1,
    capped: 1,
    duplicates: 0,
  });
  assert.deepEqual(await cappedQueue.queue.awaitTask(capped), {
    errorCode: 'batch-capped',
    ok: false,
  });

  const breakerQueue = createControlledQueue({ automaticBreakerThreshold: 2 });
  const one = segmentTask('breaker_one');
  const two = segmentTask('breaker_two');
  const three = segmentTask('breaker_three');
  breakerQueue.queue.enqueueAutomaticBatch([one, two, three]);
  await flushQueue();
  breakerQueue.pending[0]?.resolve(failure('auth'));
  await breakerQueue.queue.awaitTask(one);
  await flushQueue();
  breakerQueue.pending[1]?.resolve(failure('auth'));
  await breakerQueue.queue.awaitTask(two);
  await flushQueue();

  assert.deepEqual(await breakerQueue.queue.awaitTask(three), {
    errorCode: 'breaker-tripped',
    ok: false,
  });

  const manual = segmentTask('manual_after_breaker', 'manual');
  const manualResult = breakerQueue.queue.runManual(manual);
  await flushQueue();
  assert.equal(
    breakerQueue.calls
      .map((call) => getBackfillTargetKey(call.task))
      .includes(getBackfillTargetKey(manual)),
    true
  );
  breakerQueue.pending.at(-1)?.resolve(success('manual done'));
  assert.deepEqual(await manualResult, { ok: true, transcriptText: 'manual done' });
});

test('manual queue applies backpressure without using automatic batch caps', async () => {
  const { pending, queue } = createControlledQueue({ automaticBatchLimit: 1, manualQueueLimit: 2 });
  const first = segmentTask('manual_limit_one', 'manual');
  const second = segmentTask('manual_limit_two', 'manual');
  const third = segmentTask('manual_limit_three', 'manual');

  const firstResult = queue.runManual(first);
  await flushQueue();
  const secondResult = queue.runManual(second);
  await flushQueue();

  assert.deepEqual(await queue.runManual(third), { errorCode: 'queue-full', ok: false });

  pending[0]?.resolve(success('first done'));
  assert.deepEqual(await firstResult, { ok: true, transcriptText: 'first done' });
  await flushQueue();
  pending[1]?.resolve(success('second done'));
  assert.deepEqual(await secondResult, { ok: true, transcriptText: 'second done' });
});

test('lock lost cancels queued backfill tasks instead of continuing the batch', async () => {
  const { calls, pending, queue } = createControlledQueue();
  const first = segmentTask('lock_lost_one');
  const second = segmentTask('lock_lost_two');
  const nextWorkspace = segmentTask('lock_lost_other_workspace', 'auto', 'workspace-handle-2');

  queue.enqueueAutomaticBatch([first, second, nextWorkspace]);
  await flushQueue();
  assert.equal(calls[0]?.task.segmentId, first.segmentId);

  pending[0]?.resolve(failure('lock-lost'));
  assert.deepEqual(await queue.awaitTask(first), { errorCode: 'lock-lost', ok: false });
  await flushQueue();

  assert.equal(calls.length, 2);
  assert.deepEqual(await queue.awaitTask(second), { errorCode: 'canceled', ok: false });
  assert.equal(calls[1]?.task.segmentId, nextWorkspace.segmentId);
  pending[1]?.resolve(success('next workspace done'));
  assert.deepEqual(await queue.awaitTask(nextWorkspace), {
    ok: true,
    transcriptText: 'next workspace done',
  });
});

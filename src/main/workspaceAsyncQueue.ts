export async function withWorkspaceAsyncQueue<T>(
  queues: Map<string, Promise<void>>,
  key: string,
  run: () => Promise<T>
): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  let releaseCurrent: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const tail = previous.then(() => current);
  queues.set(key, tail);
  await previous;
  try {
    return await run();
  } finally {
    releaseCurrent();
    if (queues.get(key) === tail) {
      queues.delete(key);
    }
  }
}

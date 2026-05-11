import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('main window teardown releases workspace handles', async () => {
  const source = await readFile('src/main/index.ts', 'utf8');

  assert.match(source, /closeAllWorkspaceHandles/);
  assert.match(source, /bindWorkspaceHandleLifecycle/);
  assert.match(source, /closeWorkspaceHandles:\s*closeAllWorkspaceHandles/);
  assert.match(source, /uncaughtException[\s\S]*closeAllWorkspaceHandles/);
});

test('main window uses hidden-inset chrome for the layered app shell', async () => {
  const source = await readFile('src/main/index.ts', 'utf8');

  assert.match(source, /titleBarStyle:\s*'hiddenInset'/);
});

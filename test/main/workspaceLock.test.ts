import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { acquireWorkspaceLock } from '../../src/main/workspaceLock.js';

test('workspace lock rejects duplicate open and releases explicitly', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-'));
  const first = await acquireWorkspaceLock({ canonicalRoot: root });
  assert.equal(first.ok, true);
  if (!first.ok) {
    return;
  }

  const duplicate = await acquireWorkspaceLock({ canonicalRoot: root });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) {
    assert.equal(duplicate.error.code, 'ERR_WORKSPACE_LOCKED');
  }

  await first.lock.release();
  assert.equal(first.lock.isHeld(), false);

  const second = await acquireWorkspaceLock({ canonicalRoot: root });
  assert.equal(second.ok, true);
  if (second.ok) {
    await second.lock.release();
  }
});

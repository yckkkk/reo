import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspaceHandleStore } from '../../src/main/workspaceHandles.js';
import type { TrustedSenderIdentity } from '../../src/main/trustedSender.js';

const senderA: TrustedSenderIdentity = {
  processId: 1,
  frameRoutingId: 10,
  origin: 'reo-app://renderer',
  sessionKey: 'default',
};

const senderB: TrustedSenderIdentity = {
  processId: 1,
  frameRoutingId: 11,
  origin: 'reo-app://renderer',
  sessionKey: 'default',
};

test('workspace handle is opaque, sender-bound, and invalid after close or lock loss', async () => {
  let held = true;
  let released = false;
  const store = createWorkspaceHandleStore({ createHandle: () => 'wh_1' });
  const registered = store.register({
    canonicalRoot: '/workspace',
    workspaceId: 'ws_1',
    sender: senderA,
    lock: {
      isHeld: () => held,
      release: async () => {
        released = true;
      },
    },
  });

  assert.deepEqual(registered, {
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.deepEqual(store.requireHandle({ workspaceHandle: 'wh_1', sender: senderA }), {
    ok: true,
    handle: {
      canonicalRoot: '/workspace',
      workspaceId: 'ws_1',
    },
  });

  const crossSender = store.requireHandle({ workspaceHandle: 'wh_1', sender: senderB });
  assert.equal(crossSender.ok, false);
  if (!crossSender.ok) {
    assert.equal(crossSender.error.code, 'ERR_WORKSPACE_HANDLE_UNTRUSTED');
  }

  held = false;
  const lockLost = store.requireHandle({ workspaceHandle: 'wh_1', sender: senderA });
  assert.equal(lockLost.ok, false);
  if (!lockLost.ok) {
    assert.equal(lockLost.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }

  await store.closeHandle({ workspaceHandle: 'wh_1', sender: senderA });
  assert.equal(released, true);
  const closed = store.requireHandle({ workspaceHandle: 'wh_1', sender: senderA });
  assert.equal(closed.ok, false);
  if (!closed.ok) {
    assert.equal(closed.error.code, 'ERR_WORKSPACE_HANDLE_NOT_FOUND');
  }
});

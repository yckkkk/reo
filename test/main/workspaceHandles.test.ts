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
      isUsable: () => held,
      relocate: () => ({ ok: true }),
      release: async () => {
        released = true;
      },
    },
  });

  assert.deepEqual(registered, {
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  const required = store.requireHandle({ workspaceHandle: 'wh_1', sender: senderA });
  assert.equal(required.ok, true);
  if (required.ok) {
    assert.equal(required.handle.canonicalRoot, '/workspace');
    assert.equal(required.handle.workspaceId, 'ws_1');
    assert.deepEqual(required.handle.assertUsable(), { ok: true });
  }

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

test('workspace handle remains registered when lock release fails', async () => {
  const store = createWorkspaceHandleStore({ createHandle: () => 'wh_release_fails' });
  store.register({
    canonicalRoot: '/workspace',
    workspaceId: 'ws_release_fails',
    sender: senderA,
    lock: {
      isHeld: () => true,
      isUsable: () => true,
      relocate: () => ({ ok: true }),
      release: async () => {
        throw new Error('release failed');
      },
    },
  });

  const closed = await store.closeHandle({ workspaceHandle: 'wh_release_fails', sender: senderA });

  assert.equal(closed.ok, false);
  if (!closed.ok) {
    assert.equal(closed.error.code, 'ERR_WORKSPACE_LOCK_FAILED');
  }
  const retained = store.requireHandle({ workspaceHandle: 'wh_release_fails', sender: senderA });
  assert.equal(retained.ok, true);
  if (retained.ok) {
    assert.equal(retained.handle.canonicalRoot, '/workspace');
    assert.equal(retained.handle.workspaceId, 'ws_release_fails');
    assert.deepEqual(retained.handle.assertUsable(), { ok: true });
  }
});

test('required workspace handles can recheck lock usability before delayed filesystem work', () => {
  let usable = true;
  const store = createWorkspaceHandleStore({ createHandle: () => 'wh_delayed_work' });
  store.register({
    canonicalRoot: '/workspace',
    workspaceId: 'ws_delayed_work',
    sender: senderA,
    lock: {
      isHeld: () => true,
      isUsable: () => usable,
      relocate: () => ({ ok: true }),
      release: async () => {},
    },
  });

  const required = store.requireHandle({ workspaceHandle: 'wh_delayed_work', sender: senderA });
  assert.equal(required.ok, true);
  if (required.ok) {
    usable = false;
    const lockLost = required.handle.assertUsable();
    assert.equal(lockLost.ok, false);
    if (!lockLost.ok) {
      assert.equal(lockLost.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
  }
});

test('workspace handle store releases all handles for window teardown', async () => {
  let releasedA = false;
  let releasedB = false;
  const handles = ['wh_a', 'wh_b'];
  const store = createWorkspaceHandleStore({ createHandle: () => handles.shift() ?? 'wh_extra' });
  store.register({
    canonicalRoot: '/workspace-a',
    workspaceId: 'ws_a',
    sender: senderA,
    lock: {
      isHeld: () => true,
      isUsable: () => true,
      relocate: () => ({ ok: true }),
      release: async () => {
        releasedA = true;
      },
    },
  });
  store.register({
    canonicalRoot: '/workspace-b',
    workspaceId: 'ws_b',
    sender: senderB,
    lock: {
      isHeld: () => true,
      isUsable: () => true,
      relocate: () => ({ ok: true }),
      release: async () => {
        releasedB = true;
      },
    },
  });

  const closeAllHandles = (store as typeof store & { closeAllHandles: () => Promise<void> })
    .closeAllHandles;
  await closeAllHandles.call(store);

  assert.equal(releasedA, true);
  assert.equal(releasedB, true);
  const closed = store.requireHandle({ workspaceHandle: 'wh_a', sender: senderA });
  assert.equal(closed.ok, false);
  if (!closed.ok) {
    assert.equal(closed.error.code, 'ERR_WORKSPACE_HANDLE_NOT_FOUND');
  }
});

test('workspace handle store keeps handles whose teardown release fails', async () => {
  let releaseAttempts = 0;
  let usable = true;
  const store = createWorkspaceHandleStore({ createHandle: () => 'wh_teardown_fails' });
  store.register({
    canonicalRoot: '/workspace',
    workspaceId: 'ws_teardown_fails',
    sender: senderA,
    lock: {
      isHeld: () => true,
      isUsable: () => usable,
      relocate: () => ({ ok: true }),
      release: async () => {
        releaseAttempts += 1;
        usable = false;
        throw new Error('release failed');
      },
    },
  });

  await store.closeAllHandles();

  assert.equal(releaseAttempts, 1);
  const retained = store.requireHandle({ workspaceHandle: 'wh_teardown_fails', sender: senderA });
  assert.equal(retained.ok, false);
  if (!retained.ok) {
    assert.equal(retained.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
});

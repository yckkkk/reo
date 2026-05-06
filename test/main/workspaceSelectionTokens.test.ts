import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspaceSelectionTokenStore } from '../../src/main/workspaceSelectionTokens.js';
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

test('selection token is returned without rootPath and is consumed once', () => {
  let tokenNumber = 0;
  const store = createWorkspaceSelectionTokenStore({
    createToken: () => `selection-token-${++tokenNumber}`,
    now: () => 1_000,
    ttlMs: 500,
  });

  const issued = store.issueSelection({
    rootPath: '/Users/example/Voice Notes',
    displayPath: 'Voice Notes',
    sender: senderA,
  });

  assert.deepEqual(issued, {
    selectionToken: 'selection-token-1',
    displayPath: 'Voice Notes',
  });
  assert.equal('rootPath' in issued, false);

  assert.deepEqual(
    store.consumeSelection({ selectionToken: issued.selectionToken, sender: senderA }),
    {
      ok: true,
      rootPath: '/Users/example/Voice Notes',
    }
  );

  const replay = store.consumeSelection({ selectionToken: issued.selectionToken, sender: senderA });
  assert.equal(replay.ok, false);
  if (!replay.ok) {
    assert.equal('rootPath' in replay.error, false);
    assert.equal(replay.error.code, 'ERR_WORKSPACE_SELECTION_NOT_FOUND');
  }
});

test('selection token expires without exposing rootPath', () => {
  let now = 1_000;
  const store = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-expiring',
    now: () => now,
    ttlMs: 100,
  });

  const issued = store.issueSelection({
    rootPath: '/Users/example/Voice Notes',
    displayPath: 'Voice Notes',
    sender: senderA,
  });

  now = 1_101;

  const expired = store.consumeSelection({
    selectionToken: issued.selectionToken,
    sender: senderA,
  });
  assert.equal(expired.ok, false);
  if (!expired.ok) {
    assert.equal('rootPath' in expired.error, false);
    assert.equal(expired.error.code, 'ERR_WORKSPACE_SELECTION_EXPIRED');
  }
});

test('selection token is bound to sender identity', () => {
  const store = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-bound',
    now: () => 1_000,
    ttlMs: 500,
  });

  const issued = store.issueSelection({
    rootPath: '/Users/example/Voice Notes',
    displayPath: 'Voice Notes',
    sender: senderA,
  });

  const mismatch = store.consumeSelection({
    selectionToken: issued.selectionToken,
    sender: senderB,
  });
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) {
    assert.equal('rootPath' in mismatch.error, false);
    assert.equal(mismatch.error.code, 'ERR_WORKSPACE_SELECTION_SENDER_MISMATCH');
  }

  assert.deepEqual(
    store.consumeSelection({
      selectionToken: issued.selectionToken,
      sender: senderA,
    }),
    {
      ok: true,
      rootPath: '/Users/example/Voice Notes',
    }
  );
});

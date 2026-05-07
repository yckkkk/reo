import assert from 'node:assert/strict';
import { beforeEach } from 'node:test';
import test from 'node:test';
import {
  clearAllMicrophoneIntents,
  clearMicrophoneIntent,
  clearMicrophoneIntentsForWorkspaceHandle,
  createMicrophoneIntent,
  decideMediaPermissionCheck,
  decideMediaPermissionRequest,
  resetMicrophoneIntentsForTest,
} from '../../src/main/security.js';
import { createContentSecurityPolicy } from '../../src/main/securityPolicy.js';

beforeEach(() => {
  resetMicrophoneIntentsForTest();
});

test('production content security policy allows local blob audio media only', () => {
  const policy = createContentSecurityPolicy({ usesDevServer: false });

  assert.match(policy, /media-src 'self' blob:/);
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /worker-src 'none'/);
  assert.doesNotMatch(policy, /media-src \*/);
});

test('denies microphone permission without a one-shot renderer intent', () => {
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      isMainFrame: true,
      requested: { audio: true, video: false },
    }),
    false
  );
});

test('consumes a microphone intent once for the matching sender', () => {
  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 2,
      isMainFrame: true,
      requested: { audio: true, video: false },
    }),
    false
  );
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      isMainFrame: true,
      requested: { audio: true, video: false },
    }),
    true
  );
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      isMainFrame: true,
      requested: { audio: true, video: false },
    }),
    false
  );
});

test('expires microphone intent by TTL before browser permission is granted', () => {
  createMicrophoneIntent({
    senderId: 1,
    workspaceHandle: 'wh_1',
    drawerSessionId: 'drawer_1',
    now: () => 1_000,
  });

  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 16_001,
    }),
    false
  );
});

test('permission check never grants media without consuming intent', () => {
  assert.equal(decideMediaPermissionCheck(), false);

  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

  assert.equal(decideMediaPermissionCheck(), false);
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      isMainFrame: true,
      requested: { audio: true, video: false },
    }),
    true
  );
});

test('rejects a second active microphone intent for the same sender', () => {
  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

  const second = createMicrophoneIntent({
    senderId: 1,
    workspaceHandle: 'wh_2',
    drawerSessionId: 'drawer_1',
  });

  assert.equal(second.ok, false);
  if (!second.ok) {
    assert.equal(second.error.code, 'ERR_MIC_INTENT_ALREADY_ACTIVE');
  }
});

test('clear requires the matching workspace and drawer session owner', () => {
  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

  clearMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_2', drawerSessionId: 'drawer_1' });
  clearMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_2' });

  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      isMainFrame: true,
      requested: { audio: true, video: false },
    }),
    true
  );
});

test('clears only the matching microphone intent when recording is cancelled', () => {
  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });
  createMicrophoneIntent({ senderId: 2, workspaceHandle: 'wh_2', drawerSessionId: 'drawer_2' });

  clearMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      isMainFrame: true,
      requested: { audio: true, video: false },
    }),
    false
  );
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 2,
      isMainFrame: true,
      requested: { audio: true, video: false },
    }),
    true
  );
});

test('clears pending microphone intents when a workspace handle closes', () => {
  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });
  createMicrophoneIntent({ senderId: 2, workspaceHandle: 'wh_2', drawerSessionId: 'drawer_2' });

  clearMicrophoneIntentsForWorkspaceHandle('wh_1');

  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      isMainFrame: true,
      requested: { audio: true, video: false },
    }),
    false
  );
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 2,
      isMainFrame: true,
      requested: { audio: true, video: false },
    }),
    true
  );
});

test('clears all pending microphone intents during renderer teardown', () => {
  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

  clearAllMicrophoneIntents();

  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      isMainFrame: true,
      requested: { audio: true, video: false },
    }),
    false
  );
});

test('denies microphone permission for an untrusted origin even with a valid intent', () => {
  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'https://example.test/index.html',
      senderId: 1,
      isMainFrame: true,
      requested: { audio: true, video: false },
    }),
    false
  );
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      isMainFrame: true,
      requested: { audio: true, video: false },
    }),
    false
  );
});

test('denies microphone permission for a subframe even with a valid intent', () => {
  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      isMainFrame: false,
      requested: { audio: true, video: false },
    }),
    false
  );
});

test('denies video or camera media even for a trusted renderer with a valid microphone intent', () => {
  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      isMainFrame: true,
      requested: { audio: true, video: true },
    }),
    false
  );
  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_2' });
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      isMainFrame: true,
      requested: { audio: false, video: true },
    }),
    false
  );
});

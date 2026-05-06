import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORKSPACE_CHOOSE_DIRECTORY_CHANNEL,
  WORKSPACE_IPC_CHANNELS,
  workspaceChooseDirectoryResponseSchema,
  workspaceChooseDirectoryResultSchema,
  workspaceErrorEnvelopeSchema,
  workspaceNoInputSchema,
} from '../../src/main/workspaceContract.js';

test('workspace contract exposes only the explicit chooseDirectory channel', () => {
  assert.equal(WORKSPACE_CHOOSE_DIRECTORY_CHANNEL, 'workspace:chooseDirectory');
  assert.deepEqual(WORKSPACE_IPC_CHANNELS, ['workspace:chooseDirectory']);
  assert.ok(WORKSPACE_IPC_CHANNELS.every((channel) => !channel.includes('*')));
});

test('chooseDirectory has no request payload', () => {
  assert.equal(workspaceNoInputSchema.parse(undefined), undefined);
  assert.throws(() => workspaceNoInputSchema.parse({}));
});

test('chooseDirectory result does not expose raw root path or early judgments', () => {
  const selected = workspaceChooseDirectoryResultSchema.parse({
    status: 'selected',
    selectionToken: 'selection-token-1',
    displayPath: '/Users/example/Voice Notes',
    rootPath: '/Users/example/Voice Notes',
    conflict: true,
    permission: 'granted',
  });

  assert.deepEqual(selected, {
    status: 'selected',
    selectionToken: 'selection-token-1',
    displayPath: '/Users/example/Voice Notes',
  });
  assert.throws(() =>
    workspaceChooseDirectoryResultSchema.parse({
      status: 'selected',
      rootPath: '/Users/example/Voice Notes',
    })
  );
  assert.throws(() =>
    workspaceChooseDirectoryResultSchema.parse({
      status: 'conflict',
      displayPath: '/Users/example/Voice Notes',
    })
  );
  assert.throws(() =>
    workspaceChooseDirectoryResultSchema.parse({
      status: 'permissionDenied',
      displayPath: '/Users/example/Voice Notes',
    })
  );
});

test('workspace response envelope strips unsafe error fields', () => {
  assert.deepEqual(
    workspaceChooseDirectoryResponseSchema.parse({
      ok: true,
      value: { status: 'canceled' },
    }),
    { ok: true, value: { status: 'canceled' } }
  );

  assert.deepEqual(
    workspaceErrorEnvelopeSchema.parse({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_UNTRUSTED_SENDER',
        message: 'Sender is not trusted',
        rootPath: '/Users/example/Voice Notes',
      },
    }),
    {
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_UNTRUSTED_SENDER',
        message: 'Sender is not trusted',
      },
    }
  );
});

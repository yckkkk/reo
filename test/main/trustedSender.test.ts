import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateTrustedWorkspaceSender,
  type TrustedSenderEventAdapter,
} from '../../src/main/trustedSender.js';

const expectedSession = { label: 'default-session' };
const wrongSession = { label: 'wrong-session' };

function senderEvent({
  url = 'reo-app://renderer/index.html',
  routingId = 4,
  topRoutingId = 4,
  session = expectedSession,
}: {
  readonly url?: string;
  readonly routingId?: number;
  readonly topRoutingId?: number;
  readonly session?: object;
} = {}): TrustedSenderEventAdapter {
  return {
    processId: 7,
    sender: { session },
    senderFrame: {
      routingId,
      topRoutingId,
      url,
    },
  };
}

function validate(event: TrustedSenderEventAdapter, channel = 'workspace:chooseDirectory') {
  return validateTrustedWorkspaceSender({
    event,
    channel,
    allowedChannels: new Set(['workspace:chooseDirectory']),
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url) => url.startsWith('reo-app://renderer/'),
  });
}

test('trusted sender accepts main frame from trusted app url and expected session', () => {
  const result = validate(senderEvent());

  assert.deepEqual(result, {
    ok: true,
    sender: {
      processId: 7,
      frameRoutingId: 4,
      origin: 'reo-app://renderer',
      sessionKey: 'default',
    },
  });
});

test('trusted sender rejects subframes, wrong origin, wrong session, and unknown channel', () => {
  const subframe = validate(senderEvent({ routingId: 5, topRoutingId: 4 }));
  assert.equal(subframe.ok, false);

  const wrongOrigin = validate(senderEvent({ url: 'https://example.com/index.html' }));
  assert.equal(wrongOrigin.ok, false);

  const wrongSessionResult = validate(senderEvent({ session: wrongSession }));
  assert.equal(wrongSessionResult.ok, false);

  const unknownChannel = validate(senderEvent(), 'workspace:invokeAnything');
  assert.equal(unknownChannel.ok, false);

  for (const result of [subframe, wrongOrigin, wrongSessionResult, unknownChannel]) {
    if (!result.ok) {
      assert.equal(result.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
    }
  }
});

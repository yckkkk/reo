import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appProtocolResolveFailureDetails,
  warnAppProtocolResolveFailure,
} from '../../src/main/appProtocolDiagnostics.js';

test('app protocol resolve details do not include raw URLs or error messages', () => {
  const error = new Error('failed to load /Users/example/private/audio.webm?X-Api-Key=secret');
  error.name = 'ProviderSecretError';

  const details = appProtocolResolveFailureDetails({ error });

  assert.deepEqual(details, { errorName: 'Error' });
  assert.equal(JSON.stringify(details).includes('secret'), false);
  assert.equal(JSON.stringify(details).includes('audio.webm'), false);
  assert.equal(JSON.stringify(details).includes('ProviderSecretError'), false);
});

test('app protocol resolve warning call logs only sanitized details', () => {
  const error = new Error('failed to load reo-app://app-shell/?X-Api-Key=secret');
  error.name = 'ProviderSecretError';
  const calls: Array<{
    readonly details: { readonly errorName: string };
    readonly message: string;
  }> = [];

  warnAppProtocolResolveFailure({
    error,
    warn: (message, details) => {
      calls.push({ details, message });
    },
  });

  assert.deepEqual(calls, [
    {
      details: { errorName: 'Error' },
      message: '[AppProtocol] Failed to resolve renderer asset',
    },
  ]);
  assert.equal(JSON.stringify(calls).includes('secret'), false);
  assert.equal(JSON.stringify(calls).includes('reo-app://'), false);
  assert.equal(JSON.stringify(calls).includes('ProviderSecretError'), false);
});

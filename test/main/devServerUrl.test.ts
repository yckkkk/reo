import assert from 'node:assert/strict';
import test from 'node:test';
import { getDevServerConnectSources, resolveDevServerUrl } from '../../src/main/devServerUrl.js';

test('packaged app ignores ELECTRON_RENDERER_URL', () => {
  const warnings: string[] = [];

  assert.equal(
    resolveDevServerUrl({
      rawUrl: 'http://127.0.0.1:5173/some/path',
      isPackaged: true,
      warn: (message) => warnings.push(message),
    }),
    null
  );
  assert.deepEqual(warnings, []);
});

test('development app accepts only loopback http or https origins', () => {
  assert.equal(
    resolveDevServerUrl({
      rawUrl: 'http://127.0.0.1:5173/some/path',
      isPackaged: false,
    }),
    'http://127.0.0.1:5173'
  );
  assert.equal(
    resolveDevServerUrl({
      rawUrl: 'https://localhost:5173/renderer',
      isPackaged: false,
    }),
    'https://localhost:5173'
  );
  assert.equal(
    resolveDevServerUrl({
      rawUrl: 'http://[::1]:5173/renderer',
      isPackaged: false,
    }),
    'http://[::1]:5173'
  );
});

test('development app rejects non-loopback and invalid dev server URLs', () => {
  const warnings: string[] = [];

  assert.equal(
    resolveDevServerUrl({
      rawUrl: 'https://example.com:5173',
      isPackaged: false,
      warn: (message) => warnings.push(message),
    }),
    null
  );
  assert.equal(
    resolveDevServerUrl({
      rawUrl: 'not a url',
      isPackaged: false,
      warn: (message) => warnings.push(message),
    }),
    null
  );
  assert.deepEqual(warnings, [
    '[Security] Ignoring non-loopback ELECTRON_RENDERER_URL',
    '[Security] Ignoring invalid ELECTRON_RENDERER_URL',
  ]);
});

test('dev server connect sources match accepted origins', () => {
  assert.deepEqual(getDevServerConnectSources(['http://127.0.0.1:5173']), ['ws://127.0.0.1:5173']);
  assert.deepEqual(getDevServerConnectSources(['https://localhost:5173']), [
    'wss://localhost:5173',
  ]);
  assert.deepEqual(getDevServerConnectSources(['http://[::1]:5173']), ['ws://[::1]:5173']);
});

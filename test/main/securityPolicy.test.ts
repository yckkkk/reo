import assert from 'node:assert/strict';
import test from 'node:test';
import { createContentSecurityPolicy } from '../../src/main/securityPolicy.js';

test('production content security policy allows local blob audio media only', () => {
  const policy = createContentSecurityPolicy({ usesDevServer: false });

  assert.match(policy, /media-src 'self' blob:/);
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /worker-src 'none'/);
  assert.doesNotMatch(policy, /media-src \*/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import electronViteConfig from '../../electron.vite.config.js';

test('renderer dev server uses the Reo-owned development port', () => {
  const config = electronViteConfig as {
    readonly renderer?: {
      readonly server?: {
        readonly port?: unknown;
        readonly strictPort?: unknown;
      };
    };
  };

  assert.equal(config.renderer?.server?.port, 5183);
  assert.equal(config.renderer?.server?.strictPort, true);
});

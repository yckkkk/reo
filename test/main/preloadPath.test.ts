import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolvePreloadPath } from '../../src/main/preloadPath.js';

test('preload path points to the sandbox-compatible cjs preload output next to main output', () => {
  const mainModuleUrl = pathToFileURL('/app/out/main/index.js').toString();

  assert.equal(resolvePreloadPath(mainModuleUrl), path.normalize('/app/out/preload/index.cjs'));
});

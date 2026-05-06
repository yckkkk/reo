import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const PRELOAD_SOURCE_FILES = ['src/preload/index.ts', 'src/preload/workspaceBridge.ts'];

test('preload source does not import Zod-backed contracts or regular Node packages', () => {
  for (const filePath of PRELOAD_SOURCE_FILES) {
    const source = readFileSync(filePath, 'utf8');

    assert.equal(source.includes('workspaceContract'), false, filePath);
    assert.equal(source.includes('zod'), false, filePath);
  }
});

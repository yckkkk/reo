import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const PRELOAD_SOURCE_FILES = ['src/preload/index.ts', 'src/preload/workspaceBridge.ts'];

test('preload source does not import Zod-backed contracts or regular Node packages', () => {
  for (const filePath of PRELOAD_SOURCE_FILES) {
    const source = readFileSync(filePath, 'utf8');

    assert.equal(
      /from ['"][^'"]*workspace-contract\/workspace-contract/.test(source),
      false,
      filePath
    );
    assert.equal(/from ['"]zod['"]/.test(source), false, filePath);
    for (const line of source.split('\n')) {
      assert.equal(
        /^import\s+(?!type).*from ['"][^'"]*workspace-contract/.test(line.trim()),
        false,
        filePath
      );
    }
  }
});

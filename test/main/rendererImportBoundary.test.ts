import assert from 'node:assert/strict';
import test from 'node:test';
import { ESLint } from 'eslint';

test('renderer source cannot import Node or Electron modules', async () => {
  const eslint = new ESLint({ cwd: process.cwd() });
  const results = await eslint.lintText(
    [
      "import { ipcRenderer } from 'electron';",
      "import fs from 'node:fs';",
      "import path from 'path';",
      'export const value = Boolean(ipcRenderer) && Boolean(fs) && Boolean(path);',
    ].join('\n'),
    { filePath: 'src/renderer/src/violates.ts' }
  );
  const result = results[0];

  assert.ok(result);
  assert.ok(
    result.messages.some((message) => message.ruleId === 'no-restricted-imports'),
    JSON.stringify(result.messages, null, 2)
  );
});

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

  const bareBuiltinResults = await eslint.lintText(
    ["import http from 'http';", 'export const value = Boolean(http);'].join('\n'),
    { filePath: 'src/renderer/src/violates-bare-builtin.ts' }
  );
  const bareBuiltinResult = bareBuiltinResults[0];

  assert.ok(bareBuiltinResult);
  assert.ok(
    bareBuiltinResult.messages.some((message) => message.ruleId === 'no-restricted-imports'),
    JSON.stringify(bareBuiltinResult.messages, null, 2)
  );
});

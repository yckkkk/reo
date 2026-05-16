import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { ESLint } from 'eslint';

function preloadSourceFiles(directory = 'src/preload'): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      return preloadSourceFiles(filePath);
    }
    return entry.isFile() && filePath.endsWith('.ts') ? [filePath] : [];
  });
}

test('preload source does not import Zod-backed contracts or regular Node packages', () => {
  for (const filePath of preloadSourceFiles()) {
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

test('preload source lint rejects ordinary package imports', async () => {
  const eslint = new ESLint({ cwd: process.cwd() });
  const results = await eslint.lintText(
    ["import { format } from 'date-fns';", "export const value = format(new Date(), 'yyyy');"].join(
      '\n'
    ),
    { filePath: 'src/preload/violates-package.ts' }
  );
  const result = results[0];

  assert.ok(result);
  assert.ok(
    result.messages.some((message) => message.ruleId === 'no-restricted-imports'),
    JSON.stringify(result.messages, null, 2)
  );
});

test('preload source lint rejects relative imports outside preload and safe contract modules', async () => {
  const eslint = new ESLint({ cwd: process.cwd() });
  const results = await eslint.lintText(
    ["import { createWindow } from '../main/index.js';", 'export const value = createWindow;'].join(
      '\n'
    ),
    { filePath: 'src/preload/violates-main-import.ts' }
  );
  const result = results[0];

  assert.ok(result);
  assert.ok(
    result.messages.some((message) => message.ruleId === 'no-restricted-imports'),
    JSON.stringify(result.messages, null, 2)
  );
});

test('preload source lint rejects unsafe dynamic imports', async () => {
  const eslint = new ESLint({ cwd: process.cwd() });
  const packageResults = await eslint.lintText(
    ["const dateFns = await import('date-fns');", 'export const value = Boolean(dateFns);'].join(
      '\n'
    ),
    { filePath: 'src/preload/violates-dynamic-package.ts' }
  );
  const nodeResults = await eslint.lintText(
    ["const fs = await import('node:fs');", 'export const value = Boolean(fs);'].join('\n'),
    { filePath: 'src/preload/violates-dynamic-node.ts' }
  );
  const mainResults = await eslint.lintText(
    ["const main = await import('../main/index.js');", 'export const value = Boolean(main);'].join(
      '\n'
    ),
    { filePath: 'src/preload/violates-dynamic-main.ts' }
  );

  for (const result of [packageResults[0], nodeResults[0], mainResults[0]]) {
    assert.ok(result);
    assert.ok(
      result.messages.some((message) => message.ruleId === 'no-restricted-syntax'),
      JSON.stringify(result.messages, null, 2)
    );
  }
});

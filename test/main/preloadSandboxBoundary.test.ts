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

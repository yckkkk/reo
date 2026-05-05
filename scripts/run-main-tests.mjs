import { spawnSync } from 'node:child_process';
import { rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = '.tmp/test-main';
const testDir = join(outDir, 'test/main');

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function findTestFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return findTestFiles(entryPath);
    }
    return entry.isFile() && entry.name.endsWith('.test.js') ? [entryPath] : [];
  });
}

rmSync(outDir, { recursive: true, force: true });
run('tsc', ['-p', 'tsconfig.main.test.json']);

const testFiles = findTestFiles(testDir);
if (testFiles.length === 0) {
  console.error(`No main test files found in ${testDir}`);
  process.exit(1);
}

run(process.execPath, ['--test', ...testFiles]);

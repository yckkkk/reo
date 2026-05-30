import { spawnSync } from 'node:child_process';
import { rmSync, readdirSync } from 'node:fs';
import { join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = '.tmp/test-main';
const testDir = join(outDir, 'test/main');
export const defaultBatchSize = 64;

export function parseMainTestBatchSize(raw) {
  if (raw === undefined) {
    return defaultBatchSize;
  }
  if (!/^\d+$/.test(raw)) {
    throw new Error('MAIN_TEST_BATCH_SIZE must be 0 or a positive integer');
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error('MAIN_TEST_BATCH_SIZE must be 0 or a positive integer');
  }
  return parsed;
}

function readBatchSizeFromEnv() {
  try {
    return parseMainTestBatchSize(process.env.MAIN_TEST_BATCH_SIZE);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'MAIN_TEST_BATCH_SIZE is invalid');
    process.exit(1);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export function* findTestFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* findTestFiles(entryPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.test.js')) {
      yield entryPath;
    }
  }
}

export function buildNodeTestArgBatches(testFiles, batchSize, nodeTestArgs) {
  if (Number.isInteger(batchSize) && batchSize > 0 && testFiles.length > batchSize) {
    const batches = [];
    for (let index = 0; index < testFiles.length; index += batchSize) {
      batches.push(['--test', ...nodeTestArgs, ...testFiles.slice(index, index + batchSize)]);
    }
    return batches;
  }
  return [['--test', ...nodeTestArgs, ...testFiles]];
}

function normalizePathForMatch(filePath) {
  return normalize(filePath).split('\\').join('/');
}

function toCompiledMainTestPath(filePath) {
  return normalizePathForMatch(filePath).replace(/\.ts$/, '.js');
}

export function parseMainTestFiles(raw) {
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(normalizePathForMatch);
}

export function mainTestFileFilterToCompiledPath(filePath) {
  const normalized = normalizePathForMatch(filePath).replace(/^\.\//, '');
  if (normalized.startsWith(`${outDir}/`)) {
    return toCompiledMainTestPath(normalized);
  }
  if (normalized.startsWith('test/main/')) {
    return toCompiledMainTestPath(join(outDir, normalized));
  }
  return toCompiledMainTestPath(join(testDir, normalized));
}

export function filterMainTestFiles(testFiles, rawFilters) {
  const filters = parseMainTestFiles(rawFilters);
  if (filters.length === 0) {
    return testFiles;
  }
  const allowed = new Set(filters.map(mainTestFileFilterToCompiledPath));
  const unmatched = new Set(allowed);
  const filtered = testFiles.filter((testFile) => {
    const normalized = normalizePathForMatch(testFile);
    if (!allowed.has(normalized)) {
      return false;
    }
    unmatched.delete(normalized);
    return true;
  });
  if (unmatched.size > 0) {
    throw new Error(`MAIN_TEST_FILES did not match compiled tests: ${[...unmatched].join(', ')}`);
  }
  return filtered;
}

export function runMainTests() {
  rmSync(outDir, { recursive: true, force: true });
  const batchSize = readBatchSizeFromEnv();
  const nodeTestArgs = process.argv.slice(2);

  run('tsc', ['-p', 'tsconfig.main.test.json']);

  const discoveredTestFiles = [...findTestFiles(testDir)];
  let testFiles;
  try {
    testFiles = filterMainTestFiles(discoveredTestFiles, process.env.MAIN_TEST_FILES);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'MAIN_TEST_FILES is invalid');
    process.exit(1);
  }
  if (testFiles.length === 0) {
    const scope = process.env.MAIN_TEST_FILES ? ` matching MAIN_TEST_FILES` : ` in ${testDir}`;
    console.error(`No main test files found${scope}`);
    process.exit(1);
  }

  for (const nodeArgs of buildNodeTestArgBatches(testFiles, batchSize, nodeTestArgs)) {
    run(process.execPath, nodeArgs);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runMainTests();
}

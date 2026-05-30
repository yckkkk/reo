#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const scanner =
  process.env.COMPLEXITY_OPTIMIZER_SCANNER ??
  path.join(os.homedir(), '.codex/skills/complexity-optimizer/scripts/analyze_complexity.py');
const excludedPaths = ['.tmp', '.agents', '.claude', '.reference', 'out', 'archive'];

if (!existsSync(scanner)) {
  console.error(
    `Complexity scanner not found: ${scanner}\n` +
      'Set COMPLEXITY_OPTIMIZER_SCANNER to a scanner script path or install the local complexity-optimizer skill.'
  );
  process.exit(1);
}

const scannerArgs = [
  scanner,
  '.',
  ...excludedPaths.flatMap((excludedPath) => ['--exclude', excludedPath]),
  ...process.argv.slice(2),
];

const result = spawnSync('python3', scannerArgs, {
  encoding: 'utf8',
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

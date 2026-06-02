import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const verifyQuickPhases = [
  [{ script: 'typecheck:quick' }],
  [{ script: 'test:main' }, { script: 'test:renderer:quick' }],
  [{ script: 'lint:strict' }, { script: 'format:check' }],
];

export function buildVerifyQuickPhases() {
  return verifyQuickPhases.map((phase) => phase.map((task) => ({ ...task })));
}

function runScript(script) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    process.stdout.write(`\n[verify:quick] start ${script}\n`);
    const child = spawn('npm', ['run', script], {
      env: process.env,
      stdio: 'inherit',
    });

    child.on('error', (error) => {
      process.stderr.write(`[verify:quick] ${script} failed to start: ${error.message}\n`);
      resolve({ code: 1, durationMs: Date.now() - startedAt, script });
    });
    child.on('close', (code, signal) => {
      const durationMs = Date.now() - startedAt;
      if (signal) {
        process.stderr.write(`[verify:quick] ${script} exited from signal ${signal}\n`);
        resolve({ code: 1, durationMs, script });
        return;
      }
      const exitCode = code ?? 1;
      process.stdout.write(`[verify:quick] done ${script} in ${durationMs}ms\n`);
      resolve({ code: exitCode, durationMs, script });
    });
  });
}

export async function runVerifyQuick() {
  for (const phase of verifyQuickPhases) {
    const results = await Promise.all(phase.map((task) => runScript(task.script)));
    const failures = results.filter((result) => result.code !== 0);
    if (failures.length > 0) {
      process.stderr.write(
        `[verify:quick] failed: ${failures.map((failure) => failure.script).join(', ')}\n`
      );
      process.exitCode = failures[0]?.code ?? 1;
      return;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runVerifyQuick();
}

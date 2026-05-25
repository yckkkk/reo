import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const LOCAL_STORAGE_WARNING =
  'ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.';

const defaultRendererProjects = [
  'renderer-node',
  'renderer-jsdom-browser',
  'renderer-jsdom-components',
];

export function buildRendererTestRuns(args) {
  if (args.length > 0) {
    return [args];
  }
  return defaultRendererProjects.map((project) => ['--project', project]);
}

export function classifyRendererTestStderrLine(line, suppressNextTraceHint) {
  if (line.includes('ExperimentalWarning:')) {
    if (line.includes(LOCAL_STORAGE_WARNING)) {
      return {
        nextSuppressTraceHint: true,
        unexpectedExperimentalWarning: false,
        write: false,
      };
    }
    return {
      nextSuppressTraceHint: false,
      unexpectedExperimentalWarning: true,
      write: true,
    };
  }
  if (suppressNextTraceHint && line.includes('Use `node --trace-warnings ...`')) {
    return {
      nextSuppressTraceHint: false,
      unexpectedExperimentalWarning: false,
      write: false,
    };
  }
  return {
    nextSuppressTraceHint: false,
    unexpectedExperimentalWarning: false,
    write: true,
  };
}

function runVitest(args) {
  const vitestBin = path.join(process.cwd(), 'node_modules', 'vitest', 'vitest.mjs');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [vitestBin, 'run', ...args], {
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stderrLine = '';
    let unexpectedExperimentalWarning = false;
    let suppressNextTraceHint = false;

    function handleStderr(chunk) {
      stderrLine += chunk.toString('utf8');
      const lines = stderrLine.split(/\r?\n/);
      stderrLine = lines.pop() ?? '';
      for (const line of lines) {
        const classification = classifyRendererTestStderrLine(line, suppressNextTraceHint);
        suppressNextTraceHint = classification.nextSuppressTraceHint;
        unexpectedExperimentalWarning ||= classification.unexpectedExperimentalWarning;
        if (classification.write) {
          process.stderr.write(`${line}\n`);
        }
      }
    }

    child.stdout.on('data', (chunk) => process.stdout.write(chunk));
    child.stderr.on('data', handleStderr);
    child.on('error', (error) => {
      process.stderr.write(`${error.message}\n`);
      resolve(1);
    });
    child.on('close', (code, signal) => {
      if (stderrLine.length > 0) {
        handleStderr('\n');
      }
      if (unexpectedExperimentalWarning) {
        process.stderr.write('Unexpected ExperimentalWarning emitted during renderer tests.\n');
        resolve(1);
        return;
      }
      if (signal) {
        process.stderr.write(`Renderer tests exited from signal ${signal}.\n`);
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });
  });
}

export async function runRendererTests() {
  for (const args of buildRendererTestRuns(process.argv.slice(2))) {
    const exitCode = await runVitest(args);
    if (exitCode !== 0) {
      process.exitCode = exitCode;
      return;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRendererTests();
}

import { spawn } from 'node:child_process';
import { constants as osConstants } from 'node:os';
import { loadLocalEnvFiles } from './local-env.mjs';

const { env, loadedFiles } = loadLocalEnvFiles();

if (loadedFiles.length > 0) {
  console.info(`Loaded local dev env: ${loadedFiles.join(', ')}`);
}

const child = spawn('electron-vite', ['dev', '--ignoreConfigWarning'], {
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Failed to start electron-vite dev: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(128 + (osConstants.signals[signal] ?? 0));
  }
  process.exit(code ?? 1);
});

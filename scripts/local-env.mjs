import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

const LOCAL_ENV_FILES = ['.env.local'];
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function applyLocalEnvContent(nextEnv, content) {
  for (const [key, value] of Object.entries(parseEnv(content.replace(/^\uFEFF/, '')))) {
    if (!ENV_KEY_PATTERN.test(key) || key.startsWith('VITE_') || nextEnv[key] !== undefined) {
      continue;
    }
    nextEnv[key] = value;
  }
}

export function loadLocalEnvFiles({
  cwd = process.cwd(),
  env = process.env,
  files = LOCAL_ENV_FILES,
} = {}) {
  const nextEnv = { ...env };
  const loadedFiles = [];

  for (const file of files) {
    const filePath = resolve(cwd, file);
    let content;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
        continue;
      }
      throw error;
    }
    loadedFiles.push(file);
    applyLocalEnvContent(nextEnv, content);
  }

  return { env: nextEnv, loadedFiles };
}

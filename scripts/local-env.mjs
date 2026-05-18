import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LOCAL_ENV_FILES = ['.env.local'];
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function stripInlineComment(value) {
  const hashIndex = value.indexOf('#');
  if (hashIndex === -1) {
    return value;
  }

  const beforeHash = value.slice(0, hashIndex);
  return /\s$/.test(beforeHash) ? beforeHash : value;
}

function unquoteValue(value) {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if ((quote !== '"' && quote !== "'") || trimmed.at(-1) !== quote) {
    return stripInlineComment(trimmed).trim();
  }

  const inner = trimmed.slice(1, -1);
  if (quote === "'") {
    return inner;
  }

  return inner
    .replaceAll('\\n', '\n')
    .replaceAll('\\r', '\r')
    .replaceAll('\\t', '\t')
    .replaceAll('\\"', '"')
    .replaceAll('\\\\', '\\');
}

export function parseLocalEnv(content) {
  const entries = {};
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    if (line.startsWith('export ')) {
      line = line.slice('export '.length).trimStart();
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!ENV_KEY_PATTERN.test(key)) {
      continue;
    }

    entries[key] = unquoteValue(line.slice(separatorIndex + 1));
  }

  return entries;
}

function applyLocalEnvEntries(nextEnv, parsed) {
  for (const [key, value] of Object.entries(parsed)) {
    if (key.startsWith('VITE_')) {
      continue;
    }
    if (nextEnv[key] === undefined) {
      nextEnv[key] = value;
    }
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
    const parsed = parseLocalEnv(content);
    loadedFiles.push(file);
    applyLocalEnvEntries(nextEnv, parsed);
  }

  return { env: nextEnv, loadedFiles };
}

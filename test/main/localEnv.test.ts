import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

type LocalEnvModule = {
  readonly loadLocalEnvFiles: (input: {
    readonly cwd: string;
    readonly env: Record<string, string | undefined>;
  }) => {
    readonly env: Record<string, string | undefined>;
    readonly loadedFiles: readonly string[];
  };
};

async function importLocalEnvModule() {
  return (await import(
    pathToFileURL(join(process.cwd(), 'scripts/local-env.mjs')).href
  )) as LocalEnvModule;
}

test('local env loader injects ignored main-process variables without exposing them to source', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'reo-local-env-'));
  await writeFile(
    join(directory, '.env.local'),
    ['REO_MAIN_ONLY_TOKEN=dev-token', 'REO_MAIN_ONLY_SECRET="dev secret"', ''].join('\n')
  );

  const { loadLocalEnvFiles } = await importLocalEnvModule();
  const result = loadLocalEnvFiles({ cwd: directory, env: {} });

  assert.deepEqual(result.loadedFiles, ['.env.local']);
  assert.equal(result.env['REO_MAIN_ONLY_TOKEN'], 'dev-token');
  assert.equal(result.env['REO_MAIN_ONLY_SECRET'], 'dev secret');
});

test('local env loader keeps explicit shell values ahead of .env.local', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'reo-local-env-'));
  await writeFile(
    join(directory, '.env.local'),
    ['REO_MAIN_ONLY_TOKEN=local-token', 'REO_MAIN_ONLY_SECRET=local-secret'].join('\n')
  );

  const { loadLocalEnvFiles } = await importLocalEnvModule();
  const result = loadLocalEnvFiles({
    cwd: directory,
    env: {
      REO_MAIN_ONLY_TOKEN: 'shell-token',
    },
  });

  assert.equal(result.env['REO_MAIN_ONLY_TOKEN'], 'shell-token');
  assert.equal(result.env['REO_MAIN_ONLY_SECRET'], 'local-secret');
});

test('local env loader does not inject Vite-exposed client variables from .env.local', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'reo-local-env-'));
  await writeFile(
    join(directory, '.env.local'),
    ['VITE_SECRET=renderer-visible', 'REO_MAIN_ONLY_TOKEN=main-only-token'].join('\n')
  );

  const { loadLocalEnvFiles } = await importLocalEnvModule();
  const result = loadLocalEnvFiles({ cwd: directory, env: {} });

  assert.equal(result.env['VITE_SECRET'], undefined);
  assert.equal(result.env['REO_MAIN_ONLY_TOKEN'], 'main-only-token');
});

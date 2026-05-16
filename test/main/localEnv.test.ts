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

test('local env loader injects ignored dev credentials without exposing them to source', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'reo-local-env-'));
  await writeFile(
    join(directory, '.env.local'),
    ['REO_DOUBAO_ASR_APP_ID=dev-app-id', 'REO_DOUBAO_ASR_ACCESS_TOKEN="dev access token"', ''].join(
      '\n'
    )
  );

  const { loadLocalEnvFiles } = await importLocalEnvModule();
  const result = loadLocalEnvFiles({ cwd: directory, env: {} });

  assert.deepEqual(result.loadedFiles, ['.env.local']);
  assert.equal(result.env['REO_DOUBAO_ASR_APP_ID'], 'dev-app-id');
  assert.equal(result.env['REO_DOUBAO_ASR_ACCESS_TOKEN'], 'dev access token');
});

test('local env loader keeps explicit shell values ahead of .env.local', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'reo-local-env-'));
  await writeFile(
    join(directory, '.env.local'),
    ['REO_DOUBAO_ASR_ACCESS_TOKEN=local-token', 'REO_DOUBAO_ASR_APP_ID=local-app'].join('\n')
  );

  const { loadLocalEnvFiles } = await importLocalEnvModule();
  const result = loadLocalEnvFiles({
    cwd: directory,
    env: {
      REO_DOUBAO_ASR_ACCESS_TOKEN: 'shell-token',
    },
  });

  assert.equal(result.env['REO_DOUBAO_ASR_ACCESS_TOKEN'], 'shell-token');
  assert.equal(result.env['REO_DOUBAO_ASR_APP_ID'], 'local-app');
});

test('local env loader does not inject Vite-exposed client variables from .env.local', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'reo-local-env-'));
  await writeFile(
    join(directory, '.env.local'),
    ['VITE_SECRET=renderer-visible', 'REO_DOUBAO_ASR_APP_ID=main-only-app'].join('\n')
  );

  const { loadLocalEnvFiles } = await importLocalEnvModule();
  const result = loadLocalEnvFiles({ cwd: directory, env: {} });

  assert.equal(result.env['VITE_SECRET'], undefined);
  assert.equal(result.env['REO_DOUBAO_ASR_APP_ID'], 'main-only-app');
});

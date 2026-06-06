import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import {
  ARTIFACT_PROTOCOL_CACHE_CONTROL,
  ARTIFACT_PROTOCOL_CONTENT_SECURITY_POLICY,
  resolveArtifactProtocolRequest,
} from '../../src/main/artifactProtocol.js';
import { parseArtifactRequestTarget } from '../../src/main/artifactUrl.js';
import { renderWorkspaceMarkdownObject } from '../../src/main/workspaceMarkdownObjects.js';
import {
  artifactSegmentRuntimeHost,
  artifactSegmentRuntimeUrl,
  artifactSupplementRuntimeUrl,
} from '../../src/workspace-contract/artifact-runtime-url.js';

function sha256Text(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

async function workspaceRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'reo-artifact-protocol-'));
}

function rootResolver(rootPath: string) {
  return (workspaceId: string) =>
    workspaceId === 'ws_artifact'
      ? { ok: true as const, canonicalRoot: rootPath }
      : { ok: false as const };
}

test('artifact vendor bridge accepts host responses only from the parent window', async () => {
  const source = await readFile(
    path.join(process.cwd(), 'resources', 'artifact-vendor', 'reo-render', 'bridge.js'),
    'utf8'
  );
  const listeners: ((event: { data: unknown; source: unknown }) => void)[] = [];
  let outbound: Record<string, unknown> | null = null;
  const parentWindow = {
    postMessage(payload: unknown) {
      outbound = payload as Record<string, unknown>;
    },
  };
  let timeoutId = 0;
  const fakeWindow = {
    parent: parentWindow,
    addEventListener(type: string, callback: (event: { data: unknown; source: unknown }) => void) {
      if (type === 'message') {
        listeners.push(callback);
      }
    },
    setTimeout() {
      timeoutId += 1;
      return timeoutId;
    },
    clearTimeout() {},
  } as {
    readonly parent: typeof parentWindow;
    readonly addEventListener: (
      type: string,
      callback: (event: { data: unknown; source: unknown }) => void
    ) => void;
    readonly setTimeout: () => number;
    readonly clearTimeout: () => void;
    reo?: {
      state: {
        read: () => Promise<unknown>;
      };
    };
  };

  runInNewContext(source, { window: fakeWindow });
  assert.ok(fakeWindow.reo);
  assert.equal('call' in fakeWindow.reo, false);
  const listener = listeners[0];
  assert.ok(listener);

  const readPromise = fakeWindow.reo.state.read();
  assert.equal(outbound?.['source'], 'reo-render');
  assert.equal(outbound?.['type'], 'request');
  const requestId = outbound?.['requestId'];
  assert.equal(typeof requestId, 'string');

  listener({
    data: {
      source: 'reo-host',
      type: 'response',
      requestId,
      ok: true,
      value: { poisoned: true },
    },
    source: { not: 'parent' },
  });
  listener({
    data: {
      source: 'reo-host',
      type: 'response',
      requestId,
      ok: true,
      value: { trusted: true },
    },
    source: parentWindow,
  });

  assert.deepEqual(await readPromise, { trusted: true });
});

test('artifact vendor bridge bounds pending host requests and times out unanswered calls', async () => {
  const source = await readFile(
    path.join(process.cwd(), 'resources', 'artifact-vendor', 'reo-render', 'bridge.js'),
    'utf8'
  );
  let timeoutId = 0;
  const timers = new Map<number, () => void>();
  const fakeWindow = {
    parent: {
      postMessage() {},
    },
    addEventListener() {},
    setTimeout(callback: () => void) {
      timeoutId += 1;
      timers.set(timeoutId, callback);
      return timeoutId;
    },
    clearTimeout(id: number) {
      timers.delete(id);
    },
  } as {
    readonly parent: { readonly postMessage: () => void };
    readonly addEventListener: () => void;
    readonly setTimeout: (callback: () => void) => number;
    readonly clearTimeout: (id: number) => void;
    reo?: {
      state: {
        read: () => Promise<unknown>;
      };
    };
  };

  runInNewContext(source, { window: fakeWindow });
  assert.ok(fakeWindow.reo);

  const firstRequest = fakeWindow.reo.state.read();
  for (let index = 1; index < 64; index += 1) {
    void fakeWindow.reo.state.read();
  }
  await assert.rejects(fakeWindow.reo.state.read(), /Too many Reo runtime requests/);

  timers.values().next().value?.();
  await assert.rejects(firstRequest, /Reo runtime request timed out/);
});

test('artifact vendor bridge exposes workspace object selection as a narrow ui method', async () => {
  const source = await readFile(
    path.join(process.cwd(), 'resources', 'artifact-vendor', 'reo-render', 'bridge.js'),
    'utf8'
  );
  const listeners: ((event: { data: unknown; source: unknown }) => void)[] = [];
  let outbound: Record<string, unknown> | null = null;
  const parentWindow = {
    postMessage(payload: unknown) {
      outbound = payload as Record<string, unknown>;
    },
  };
  let timeoutId = 0;
  const fakeWindow = {
    parent: parentWindow,
    addEventListener(type: string, callback: (event: { data: unknown; source: unknown }) => void) {
      if (type === 'message') {
        listeners.push(callback);
      }
    },
    setTimeout() {
      timeoutId += 1;
      return timeoutId;
    },
    clearTimeout() {},
  } as {
    readonly parent: typeof parentWindow;
    readonly addEventListener: (
      type: string,
      callback: (event: { data: unknown; source: unknown }) => void
    ) => void;
    readonly setTimeout: () => number;
    readonly clearTimeout: () => void;
    reo?: {
      ui: {
        selectObject: (input: {
          readonly memoryId: string;
          readonly segmentId?: string;
          readonly supplementId?: string;
        }) => Promise<unknown>;
      };
    };
  };

  runInNewContext(source, { window: fakeWindow });
  assert.ok(fakeWindow.reo);
  const selection = fakeWindow.reo.ui.selectObject({
    memoryId: 'mem_widget',
    segmentId: 'seg_widget',
    supplementId: 'sup_widget',
  });
  assert.equal(outbound?.['method'], 'ui.selectObject');
  const payload = outbound?.['payload'] as
    | {
        readonly memoryId?: unknown;
        readonly segmentId?: unknown;
        readonly supplementId?: unknown;
      }
    | undefined;
  assert.equal(payload?.memoryId, 'mem_widget');
  assert.equal(payload?.segmentId, 'seg_widget');
  assert.equal(payload?.supplementId, 'sup_widget');
  const requestId = outbound?.['requestId'];
  const listener = listeners[0];
  assert.ok(listener);
  listener({
    data: {
      source: 'reo-host',
      type: 'response',
      requestId,
      ok: true,
      value: { selected: true },
    },
    source: parentWindow,
  });

  const result = (await selection) as { readonly selected?: unknown };
  assert.equal(result.selected, true);
});

test('artifact runtime URLs keep per-object hosts ASCII-safe without losing object identity', () => {
  const segmentUrl = artifactSegmentRuntimeUrl({
    workspaceId: 'ws_Mixed_空间',
    segmentId: 'seg_Mixed_作品',
    previewVersion: 'v1',
  });
  const supplementUrl = artifactSupplementRuntimeUrl({
    workspaceId: 'ws_Mixed_空间',
    segmentId: 'seg_Mixed_作品',
    supplementId: 'sup_Mixed_补充',
    previewVersion: 'v1',
  });

  assert.match(new URL(segmentUrl).hostname, /^[a-z0-9-]+$/);
  assert.match(new URL(supplementUrl).hostname, /^[a-z0-9-]+$/);
  assert.deepEqual(parseArtifactRequestTarget(new URL(segmentUrl)), {
    kind: 'segment',
    entry: true,
    fileScope: 'root',
    fileName: 'entry.html',
    workspaceId: 'ws_Mixed_空间',
    segmentId: 'seg_Mixed_作品',
  });
  assert.deepEqual(parseArtifactRequestTarget(new URL(supplementUrl)), {
    kind: 'supplement',
    entry: true,
    fileScope: 'root',
    fileName: 'entry.html',
    workspaceId: 'ws_Mixed_空间',
    segmentId: 'seg_Mixed_作品',
    supplementId: 'sup_Mixed_补充',
  });
});

async function writeArtifactSegmentForProtocolTest(
  rootPath: string,
  {
    html = '<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body>Work</body></html>\n',
  }: { readonly html?: string } = {}
): Promise<{
  readonly entryHash: string;
  readonly segmentDirectory: string;
}> {
  const memoryId = 'mem_artifact_protocol';
  const segmentId = 'seg_artifact_protocol';
  const timestamp = '2026-06-03T12:00:00.000Z';
  const segmentDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  await mkdir(path.join(rootPath, '.reo', 'objects', 'segments'), { recursive: true });
  await mkdir(segmentDirectory, { recursive: true });
  await writeFile(
    path.join(rootPath, 'memories', memoryId, 'memory.md'),
    renderWorkspaceMarkdownObject({
      content: '# Artifact protocol memory\n',
      data: { id: memoryId, title: 'Artifact protocol memory' },
      objectType: 'memory',
    })
  );
  await writeFile(
    path.join(segmentDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      content: '# Protocol work\n',
      data: {
        id: segmentId,
        title: 'Protocol work',
        kind: 'artifact',
        format: 'html',
      },
      objectType: 'segment',
    })
  );
  await mkdir(path.join(segmentDirectory, 'assets'), { recursive: true });
  await writeFile(path.join(segmentDirectory, 'entry.html'), html);
  await writeFile(path.join(segmentDirectory, 'runtime.json'), '{"schemaVersion":1}\n');
  await writeFile(path.join(segmentDirectory, 'state.json'), '{"schemaVersion":1,"stores":{}}\n');
  await writeFile(path.join(segmentDirectory, 'assets', 'style.css'), 'body { color: red; }\n');
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'segments', `${segmentId}.json`),
    JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'segment',
        workspaceId: 'ws_artifact',
        memoryId,
        segmentId,
        kind: 'artifact',
        format: 'html',
        createdAt: timestamp,
        finalizedAt: timestamp,
        updatedAt: timestamp,
        entryByteLength: Buffer.byteLength(html, 'utf8'),
        entryHash: sha256Text(html),
      },
      null,
      2
    )
  );

  return { entryHash: sha256Text(html), segmentDirectory };
}

async function writeArtifactSupplementForProtocolTest(rootPath: string): Promise<{
  readonly entryHash: string;
  readonly supplementDirectory: string;
}> {
  const { segmentDirectory } = await writeArtifactSegmentForProtocolTest(rootPath);
  const memoryId = 'mem_artifact_protocol';
  const segmentId = 'seg_artifact_protocol';
  const supplementId = 'sup_artifact_protocol';
  const timestamp = '2026-06-03T12:10:00.000Z';
  const html = '<!doctype html><html><body>Supplement work</body></html>\n';
  const supplementDirectory = path.join(segmentDirectory, 'supplements', supplementId);
  await mkdir(path.join(rootPath, '.reo', 'objects', 'supplements'), { recursive: true });
  await mkdir(supplementDirectory, { recursive: true });
  await writeFile(
    path.join(supplementDirectory, 'supplement.md'),
    renderWorkspaceMarkdownObject({
      content: '# Supplement protocol work\n',
      data: {
        id: supplementId,
        title: 'Supplement protocol work',
        kind: 'artifact',
        format: 'html',
      },
      objectType: 'supplement',
    })
  );
  await writeFile(path.join(supplementDirectory, 'entry.html'), html);
  await writeFile(path.join(supplementDirectory, 'runtime.json'), '{"schemaVersion":1}\n');
  await writeFile(
    path.join(supplementDirectory, 'state.json'),
    '{"schemaVersion":1,"stores":{}}\n'
  );
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'supplements', `${supplementId}.json`),
    JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'supplement',
        workspaceId: 'ws_artifact',
        memoryId,
        segmentId,
        supplementId,
        kind: 'artifact',
        format: 'html',
        createdAt: timestamp,
        finalizedAt: timestamp,
        updatedAt: timestamp,
        entryByteLength: Buffer.byteLength(html, 'utf8'),
        entryHash: sha256Text(html),
      },
      null,
      2
    )
  );

  return { entryHash: sha256Text(html), supplementDirectory };
}

test('artifact protocol resolves segment runtime bundle files with isolated-origin URLs and no-store CSP', async () => {
  const rootPath = await workspaceRoot();
  const { entryHash } = await writeArtifactSegmentForProtocolTest(rootPath);
  const runtimeHost = artifactSegmentRuntimeHost('ws_artifact', 'seg_artifact_protocol');

  const entry = await resolveArtifactProtocolRequest(
    `reo-render://${runtimeHost}/workspaces/ws_artifact/segments/seg_artifact_protocol/entry.html?v=${entryHash}`,
    rootResolver(rootPath)
  );
  assert.equal(entry.ok, true);
  if (!entry.ok) {
    return;
  }
  assert.equal(Buffer.from(entry.bytes).toString('utf8').includes('Work'), true);
  assert.equal(entry.cacheControl, ARTIFACT_PROTOCOL_CACHE_CONTROL);
  assert.equal(entry.contentSecurityPolicy, ARTIFACT_PROTOCOL_CONTENT_SECURITY_POLICY);
  assert.match(entry.contentSecurityPolicy, /connect-src 'self' https: http: ws: wss:/);
  assert.doesNotMatch(entry.contentSecurityPolicy, /connect-src 'none'/);
  assert.doesNotMatch(entry.contentSecurityPolicy, /file:/);
  assert.equal(entry.mimeType, 'text/html');

  const asset = await resolveArtifactProtocolRequest(
    `reo-render://${runtimeHost}/workspaces/ws_artifact/segments/seg_artifact_protocol/assets/style.css?v=${entryHash}`,
    rootResolver(rootPath)
  );
  assert.equal(asset.ok, true);
  if (asset.ok) {
    assert.equal(asset.mimeType, 'text/css');
    assert.equal(Buffer.from(asset.bytes).toString('utf8'), 'body { color: red; }\n');
  }

  const runtimeManifest = await resolveArtifactProtocolRequest(
    `reo-render://${runtimeHost}/workspaces/ws_artifact/segments/seg_artifact_protocol/runtime.json?v=${entryHash}`,
    rootResolver(rootPath)
  );
  assert.equal(runtimeManifest.ok, true);
  if (runtimeManifest.ok) {
    assert.equal(runtimeManifest.mimeType, 'application/json');
    assert.equal(Buffer.from(runtimeManifest.bytes).toString('utf8'), '{"schemaVersion":1}\n');
  }

  const runtimeState = await resolveArtifactProtocolRequest(
    `reo-render://${runtimeHost}/workspaces/ws_artifact/segments/seg_artifact_protocol/state.json?v=${entryHash}`,
    rootResolver(rootPath)
  );
  assert.equal(runtimeState.ok, true);
  if (runtimeState.ok) {
    assert.equal(runtimeState.mimeType, 'application/json');
    assert.equal(
      Buffer.from(runtimeState.bytes).toString('utf8'),
      '{"schemaVersion":1,"stores":{}}\n'
    );
  }
});

test('artifact protocol resolves supplement entry under its parent segment', async () => {
  const rootPath = await workspaceRoot();
  const { entryHash } = await writeArtifactSupplementForProtocolTest(rootPath);

  const entry = await resolveArtifactProtocolRequest(
    artifactSupplementRuntimeUrl({
      workspaceId: 'ws_artifact',
      segmentId: 'seg_artifact_protocol',
      supplementId: 'sup_artifact_protocol',
      previewVersion: entryHash,
    }),
    rootResolver(rootPath)
  );

  assert.equal(entry.ok, true);
  if (entry.ok) {
    assert.equal(entry.mimeType, 'text/html');
    assert.equal(Buffer.from(entry.bytes).toString('utf8').includes('Supplement work'), true);
  }
});

test('artifact protocol resolves versioned Reo vendor assets with immutable cache', async () => {
  const rootPath = await workspaceRoot();
  const vendorRoot = path.join(rootPath, '_vendor');
  await mkdir(path.join(vendorRoot, 'chartjs'), { recursive: true });
  await writeFile(path.join(vendorRoot, 'chartjs', 'chart.umd.js'), 'window.Chart = {};\n');

  const vendor = await resolveArtifactProtocolRequest(
    'reo-render://vendor/chartjs/chart.umd.js?v=app',
    rootResolver(rootPath),
    { vendorRoot }
  );

  assert.equal(vendor.ok, true);
  if (vendor.ok) {
    assert.equal(vendor.cacheControl, 'max-age=31536000, immutable');
    assert.equal(vendor.mimeType, 'text/javascript');
    assert.equal(Buffer.from(vendor.bytes).toString('utf8'), 'window.Chart = {};\n');
  }
});

test('artifact protocol resolves the bundled Reo runtime bridge vendor asset', async () => {
  const rootPath = await workspaceRoot();

  const vendor = await resolveArtifactProtocolRequest(
    'reo-render://vendor/reo-render/bridge.js?v=app',
    rootResolver(rootPath),
    { vendorRoot: path.join(process.cwd(), 'resources', 'artifact-vendor') }
  );

  assert.equal(vendor.ok, true);
  if (vendor.ok) {
    const script = Buffer.from(vendor.bytes).toString('utf8');
    assert.equal(vendor.cacheControl, 'max-age=31536000, immutable');
    assert.equal(vendor.mimeType, 'text/javascript');
    assert.match(script, /window\.reo/);
    assert.match(script, /postMessage/);
    assert.match(script, /mutations\.updateTitle/);
    assert.doesNotMatch(script, /call:\s*call/);
    assert.doesNotMatch(script, /saveNoteBody/);
  }
});

test('artifact protocol rejects inactive workspaces, traversal, symlinks, unsupported MIME, and byte caps', async () => {
  const rootPath = await workspaceRoot();
  const { entryHash, segmentDirectory } = await writeArtifactSegmentForProtocolTest(rootPath);
  const runtimeHost = artifactSegmentRuntimeHost('ws_artifact', 'seg_artifact_protocol');
  const outsidePath = path.join(await workspaceRoot(), 'outside.png');
  await writeFile(outsidePath, 'outside');
  await symlink(outsidePath, path.join(segmentDirectory, 'assets', 'linked.png'));
  await writeFile(path.join(segmentDirectory, 'notes.txt'), 'not allowed\n');
  await writeFile(path.join(segmentDirectory, 'payload.html'), '<!doctype html><p>Payload</p>');
  await mkdir(path.join(segmentDirectory, 'assets', 'nested'), { recursive: true });
  await writeFile(path.join(segmentDirectory, 'assets', 'nested', 'style.css'), 'body{}\n');

  assert.deepEqual(
    await resolveArtifactProtocolRequest(
      `reo-render://${runtimeHost}/workspaces/ws_other/segments/seg_artifact_protocol/entry.html?v=${entryHash}`,
      rootResolver(rootPath)
    ),
    { ok: false }
  );
  assert.deepEqual(
    await resolveArtifactProtocolRequest(
      `reo-render://${runtimeHost}/workspaces/ws_artifact/segments/seg_artifact_protocol/%2e%2e/secret.png?v=${entryHash}`,
      rootResolver(rootPath)
    ),
    { ok: false }
  );
  assert.deepEqual(
    await resolveArtifactProtocolRequest(
      `reo-render://${runtimeHost}/workspaces/ws_artifact/segments/seg_artifact_protocol/assets/linked.png?v=${entryHash}`,
      rootResolver(rootPath)
    ),
    { ok: false }
  );
  assert.deepEqual(
    await resolveArtifactProtocolRequest(
      `reo-render://${runtimeHost}/workspaces/ws_artifact/segments/seg_artifact_protocol/notes.txt?v=${entryHash}`,
      rootResolver(rootPath)
    ),
    { ok: false }
  );
  assert.deepEqual(
    await resolveArtifactProtocolRequest(
      `reo-render://${runtimeHost}/workspaces/ws_artifact/segments/seg_artifact_protocol/payload.html?v=${entryHash}`,
      rootResolver(rootPath)
    ),
    { ok: false }
  );
  assert.deepEqual(
    await resolveArtifactProtocolRequest(
      `reo-render://${runtimeHost}/workspaces/ws_artifact/segments/seg_artifact_protocol/assets/nested/style.css?v=${entryHash}`,
      rootResolver(rootPath)
    ),
    { ok: false }
  );
  assert.deepEqual(
    await resolveArtifactProtocolRequest(
      `reo-render://workspace/ws_artifact/segments/seg_artifact_protocol/segment.html?v=${entryHash}`,
      rootResolver(rootPath)
    ),
    { ok: false }
  );
  assert.deepEqual(
    await resolveArtifactProtocolRequest(
      `reo-render://${runtimeHost}/workspaces/ws_artifact/segments/seg_artifact_protocol/assets/style.css?v=${entryHash}`,
      rootResolver(rootPath),
      { maxAssetBytes: 2 }
    ),
    { ok: false }
  );
});

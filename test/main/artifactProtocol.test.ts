import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ARTIFACT_PROTOCOL_CACHE_CONTROL,
  ARTIFACT_PROTOCOL_CONTENT_SECURITY_POLICY,
  resolveArtifactProtocolRequest,
} from '../../src/main/artifactProtocol.js';
import { renderWorkspaceMarkdownObject } from '../../src/main/workspaceMarkdownObjects.js';

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
  await writeFile(path.join(segmentDirectory, 'segment.html'), html);
  await writeFile(path.join(segmentDirectory, 'style.css'), 'body { color: red; }\n');
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
  await writeFile(path.join(supplementDirectory, 'supplement.html'), html);
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

test('artifact protocol resolves segment entry and same-directory assets with no-store CSP', async () => {
  const rootPath = await workspaceRoot();
  const { entryHash } = await writeArtifactSegmentForProtocolTest(rootPath);

  const entry = await resolveArtifactProtocolRequest(
    `reo-artifact://workspace/ws_artifact/segments/seg_artifact_protocol/segment.html?v=${entryHash}`,
    rootResolver(rootPath)
  );
  assert.equal(entry.ok, true);
  if (!entry.ok) {
    return;
  }
  assert.equal(Buffer.from(entry.bytes).toString('utf8').includes('Work'), true);
  assert.equal(entry.cacheControl, ARTIFACT_PROTOCOL_CACHE_CONTROL);
  assert.equal(entry.contentSecurityPolicy, ARTIFACT_PROTOCOL_CONTENT_SECURITY_POLICY);
  assert.equal(entry.mimeType, 'text/html');

  const asset = await resolveArtifactProtocolRequest(
    `reo-artifact://workspace/ws_artifact/segments/seg_artifact_protocol/style.css?v=${entryHash}`,
    rootResolver(rootPath)
  );
  assert.equal(asset.ok, true);
  if (asset.ok) {
    assert.equal(asset.mimeType, 'text/css');
    assert.equal(Buffer.from(asset.bytes).toString('utf8'), 'body { color: red; }\n');
  }
});

test('artifact protocol resolves supplement entry under its parent segment', async () => {
  const rootPath = await workspaceRoot();
  const { entryHash } = await writeArtifactSupplementForProtocolTest(rootPath);

  const entry = await resolveArtifactProtocolRequest(
    `reo-artifact://workspace/ws_artifact/segments/seg_artifact_protocol/supplements/sup_artifact_protocol/supplement.html?v=${entryHash}`,
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
    'reo-artifact://vendor/chartjs/chart.umd.js?v=app',
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

test('artifact protocol rejects inactive workspaces, traversal, symlinks, unsupported MIME, and byte caps', async () => {
  const rootPath = await workspaceRoot();
  const { entryHash, segmentDirectory } = await writeArtifactSegmentForProtocolTest(rootPath);
  const outsidePath = path.join(await workspaceRoot(), 'outside.png');
  await writeFile(outsidePath, 'outside');
  await symlink(outsidePath, path.join(segmentDirectory, 'linked.png'));
  await writeFile(path.join(segmentDirectory, 'notes.txt'), 'not allowed\n');
  await writeFile(path.join(segmentDirectory, 'payload.html'), '<!doctype html><p>Payload</p>');

  assert.deepEqual(
    await resolveArtifactProtocolRequest(
      `reo-artifact://workspace/ws_other/segments/seg_artifact_protocol/segment.html?v=${entryHash}`,
      rootResolver(rootPath)
    ),
    { ok: false }
  );
  assert.deepEqual(
    await resolveArtifactProtocolRequest(
      `reo-artifact://workspace/ws_artifact/segments/seg_artifact_protocol/%2e%2e/secret.png?v=${entryHash}`,
      rootResolver(rootPath)
    ),
    { ok: false }
  );
  assert.deepEqual(
    await resolveArtifactProtocolRequest(
      `reo-artifact://workspace/ws_artifact/segments/seg_artifact_protocol/linked.png?v=${entryHash}`,
      rootResolver(rootPath)
    ),
    { ok: false }
  );
  assert.deepEqual(
    await resolveArtifactProtocolRequest(
      `reo-artifact://workspace/ws_artifact/segments/seg_artifact_protocol/notes.txt?v=${entryHash}`,
      rootResolver(rootPath)
    ),
    { ok: false }
  );
  assert.deepEqual(
    await resolveArtifactProtocolRequest(
      `reo-artifact://workspace/ws_artifact/segments/seg_artifact_protocol/payload.html?v=${entryHash}`,
      rootResolver(rootPath)
    ),
    { ok: false }
  );
  assert.deepEqual(
    await resolveArtifactProtocolRequest(
      `reo-artifact://workspace/ws_artifact/segments/seg_artifact_protocol/style.css?v=${entryHash}`,
      rootResolver(rootPath),
      { maxAssetBytes: 2 }
    ),
    { ok: false }
  );
});

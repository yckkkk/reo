import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import type { JSONContent } from '@tiptap/core';
import {
  DEFAULT_REO_COVER_AESTHETIC_SKILL_MD,
  DEFAULT_REO_COVER_IMAGE_SKILL_MD,
  DEFAULT_REO_DOCTOR_SKILL_MD,
  DEFAULT_REO_EDIT_SKILL_MD,
  DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES,
  DEFAULT_REO_GENERATIVE_RUNTIME_SCRIPT_FILES,
  DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD,
  DEFAULT_REO_WORKS_DESIGN_EXAMPLE_FILES,
  DEFAULT_REO_WORKS_DESIGN_SKILL_MD,
  DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES,
  DEFAULT_REO_WORKS_DESIGN_TOKEN_CSS,
  DEFAULT_REO_WORKS_SKILL_MD,
  DEFAULT_REO_WORKS_REFERENCE_FILES,
  DEFAULT_WORKSPACE_AGENTS_MD,
  DEFAULT_WORKSPACE_REO_MD,
  initializeWorkspaceFiles,
  openWorkspaceFiles,
  readWorkspaceSnapshotFromFileTruth,
  readWorkspaceSnapshotFromIndex,
  repairWorkspaceTitleMirrorFromRootName,
  renameWorkspaceRootFromFileTruth,
  setBeforeWorkspaceRootRenameCommitForTest,
  setBeforeWorkspaceRootRenameFinalizeForTest,
  setBeforeWorkspaceJsonNoFollowFinalAssertForTest,
  setBeforeWorkspaceIndexReconciliationPersistForTest,
  updateWorkspaceIndex,
} from '../../src/main/workspaceFiles.js';
import {
  parseWorkspaceMarkdownObject,
  renderWorkspaceMarkdownObject,
} from '../../src/main/workspaceMarkdownObjects.js';
import {
  hashTiptapJsonContent,
  hashTiptapSourceMarkdown,
  readTiptapContentSidecar,
  TIPTAP_CONTENT_SIDECAR_FILE,
  writeTiptapContentSidecar,
} from '../../src/main/tiptapContentSidecar.js';
import {
  WORKSPACE_REVIEW_FALLBACK_RECOVERY_HINT,
  writeWorkspaceNeedsReviewReport,
} from '../../src/main/workspaceReviewReport.js';
import {
  setAfterAtomicWorkspaceFileTempOpenForTest,
  setBeforeAtomicWorkspaceFileCommitForTest,
} from '../../src/main/atomicWorkspaceFile.js';
import {
  extractSegmentTranscript,
  setBeforeReadModelReaddirForTest,
} from '../../src/main/memoryFiles.js';
import { setAfterWorkspaceReoDirectoryCheckForTest } from '../../src/main/workspacePaths.js';

const execFileAsync = promisify(execFile);

type ScriptResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

async function runNodeScript(args: readonly string[], cwd: string): Promise<ScriptResult> {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [...args], {
      cwd,
      encoding: 'utf8',
    });
    return { status: 0, stdout, stderr };
  } catch (error) {
    const result = error as {
      readonly code?: number | string;
      readonly stdout?: string;
      readonly stderr?: string;
    };
    return {
      status: typeof result.code === 'number' ? result.code : null,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  }
}

async function sha256(filePath: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex');
}

function paragraphDoc(text: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

function passiveRichDoc(label: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: `${label} highlight`,
            marks: [
              {
                type: 'highlight',
                attrs: { color: 'var(--tt-color-highlight-purple)' },
              },
            ],
          },
          { type: 'text', text: ' and ' },
          { type: 'text', text: `${label} underline`, marks: [{ type: 'underline' }] },
        ],
      },
    ],
  };
}

function assertIncludesInOrder(text: string, markers: readonly string[]): void {
  let previousIndex = -1;
  for (const marker of markers) {
    const index = text.indexOf(marker);
    assert.notEqual(index, -1, `missing marker: ${marker}`);
    assert.ok(index > previousIndex, `marker out of order: ${marker}`);
    previousIndex = index;
  }
}

function unsupportedTableDoc(): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'table',
        content: [],
      },
    ],
  };
}

function unsupportedOfficialAttrDoc(): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2, textAlign: 'middle' },
        content: [{ type: 'text', text: 'Invalid align' }],
      },
    ],
  };
}

function sidecarWritableFile(sidecar: Awaited<ReturnType<typeof readTiptapContentSidecar>>) {
  const { currentContentHash: _currentContentHash, ...file } = sidecar;
  void _currentContentHash;
  return file;
}

async function readNeedsReviewReport(root: string): Promise<{
  readonly schemaVersion: 1;
  readonly updatedAt: string;
  readonly summary: {
    readonly needsReviewCount: number;
    readonly markdownCandidateCount: number;
    readonly tiptapSidecarCount: number;
  };
  readonly entries: Array<{
    readonly category: string;
    readonly reason: string;
    readonly objectType?: string;
    readonly kind?: string;
    readonly paths: readonly string[];
  }>;
}> {
  return JSON.parse(await readFile(path.join(root, '.reo', 'review', 'needs-review.json'), 'utf8'));
}

async function writeExternalSidecarContent({
  objectDirectory,
  tiptapJson,
  updateContentHash = false,
}: {
  readonly objectDirectory: string;
  readonly tiptapJson: JSONContent;
  readonly updateContentHash?: boolean;
}): Promise<void> {
  const sidecar = await readTiptapContentSidecar(objectDirectory);
  await writeFile(
    path.join(objectDirectory, TIPTAP_CONTENT_SIDECAR_FILE),
    `${JSON.stringify(
      {
        ...sidecarWritableFile(sidecar),
        ...(updateContentHash ? { contentHash: hashTiptapJsonContent(tiptapJson) } : {}),
        content: tiptapJson,
      },
      null,
      2
    )}\n`
  );
}

async function initializePassiveSidecarWorkspace({
  workspaceId = 'ws_passive_sidecar',
}: {
  readonly workspaceId?: string;
} = {}): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-passive-sidecar-'));
  const initialized = await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Passive sidecar',
    description: '',
    createWorkspaceId: () => workspaceId,
    now: () => '2026-05-27T06:00:00.000Z',
  });
  assert.equal(initialized.ok, true);
  return root;
}

async function writeMemoryForPassiveSidecarTest({
  memoryId,
  root,
  title = 'Passive memory',
}: {
  readonly memoryId: string;
  readonly root: string;
  readonly title?: string;
}): Promise<void> {
  const memoryDirectory = path.join(root, 'memories', memoryId);
  await mkdir(memoryDirectory, { recursive: true });
  await mkdir(path.join(root, '.reo', 'objects', 'memories'), { recursive: true });
  await writeFile(
    path.join(memoryDirectory, 'memory.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'memory',
      data: { title },
      content: `# ${title}\n`,
    })
  );
  await writeFile(
    path.join(root, '.reo', 'objects', 'memories', `${memoryId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'memory',
        memoryId,
        createdAt: '2026-05-27T06:00:00.000Z',
        updatedAt: '2026-05-27T06:00:00.000Z',
      },
      null,
      2
    )}\n`
  );
}

async function writeNoteSegmentForPassiveSidecarTest({
  body,
  memoryId,
  root,
  segmentId,
  title = 'Passive note segment',
  workspaceId = 'ws_passive_sidecar',
}: {
  readonly body: string;
  readonly memoryId: string;
  readonly root: string;
  readonly segmentId: string;
  readonly title?: string;
  readonly workspaceId?: string;
}): Promise<string> {
  const segmentDirectory = path.join(root, 'memories', memoryId, 'segments', segmentId);
  await mkdir(segmentDirectory, { recursive: true });
  await writeFile(
    path.join(segmentDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title, kind: 'note' },
      content: body,
    })
  );
  await mkdir(path.join(root, '.reo', 'objects', 'segments'), { recursive: true });
  await writeFile(
    path.join(root, '.reo', 'objects', 'segments', `${segmentId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'segment',
        workspaceId,
        memoryId,
        segmentId,
        kind: 'note',
        createdAt: '2026-05-27T06:01:00.000Z',
        finalizedAt: '2026-05-27T06:01:00.000Z',
        updatedAt: '2026-05-27T06:01:00.000Z',
        bodyByteLength: Buffer.byteLength(body, 'utf8'),
      },
      null,
      2
    )}\n`
  );
  return segmentDirectory;
}

async function writeNoteSupplementForPassiveSidecarTest({
  body,
  memoryId,
  root,
  segmentId,
  supplementId,
  title = 'Passive note supplement',
  workspaceId = 'ws_passive_sidecar',
}: {
  readonly body: string;
  readonly memoryId: string;
  readonly root: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly title?: string;
  readonly workspaceId?: string;
}): Promise<string> {
  const supplementDirectory = path.join(
    root,
    'memories',
    memoryId,
    'segments',
    segmentId,
    'supplements',
    supplementId
  );
  await mkdir(supplementDirectory, { recursive: true });
  await writeFile(
    path.join(supplementDirectory, 'supplement.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'supplement',
      data: { title, kind: 'note' },
      content: body,
    })
  );
  await mkdir(path.join(root, '.reo', 'objects', 'supplements'), { recursive: true });
  await writeFile(
    path.join(root, '.reo', 'objects', 'supplements', `${supplementId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'supplement',
        workspaceId,
        memoryId,
        segmentId,
        supplementId,
        kind: 'note',
        createdAt: '2026-05-27T06:02:00.000Z',
        finalizedAt: '2026-05-27T06:02:00.000Z',
        updatedAt: '2026-05-27T06:02:00.000Z',
        bodyByteLength: Buffer.byteLength(body, 'utf8'),
      },
      null,
      2
    )}\n`
  );
  return supplementDirectory;
}

async function writeAudioSegmentForPassiveSidecarTest({
  memoryId,
  root,
  segmentId,
  title = 'Passive audio segment',
  transcript,
  workspaceId = 'ws_passive_sidecar',
}: {
  readonly memoryId: string;
  readonly root: string;
  readonly segmentId: string;
  readonly title?: string;
  readonly transcript: string;
  readonly workspaceId?: string;
}): Promise<string> {
  const segmentDirectory = path.join(root, 'memories', memoryId, 'segments', segmentId);
  await mkdir(segmentDirectory, { recursive: true });
  await writeFile(path.join(segmentDirectory, 'audio.webm'), new Uint8Array([1, 2, 3, 4]));
  await writeFile(
    path.join(segmentDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title, kind: 'audio' },
      content: `# ${title}\n\nNon transcript context must stay.\n\n## Transcript\n\n${transcript}`,
    })
  );
  await mkdir(path.join(root, '.reo', 'objects', 'segments'), { recursive: true });
  await writeFile(
    path.join(root, '.reo', 'objects', 'segments', `${segmentId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'segment',
        workspaceId,
        memoryId,
        segmentId,
        kind: 'audio',
        createdAt: '2026-05-27T06:01:00.000Z',
        finalizedAt: '2026-05-27T06:01:00.000Z',
        updatedAt: '2026-05-27T06:01:00.000Z',
        durationMs: 1000,
        nextSequence: 1,
        audioByteLength: 4,
        lastTranscriptionAttempt: 'success',
      },
      null,
      2
    )}\n`
  );
  return segmentDirectory;
}

async function writeAudioSupplementForPassiveSidecarTest({
  memoryId,
  root,
  segmentId,
  supplementId,
  title = 'Passive audio supplement',
  transcript,
  workspaceId = 'ws_passive_sidecar',
}: {
  readonly memoryId: string;
  readonly root: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly title?: string;
  readonly transcript: string;
  readonly workspaceId?: string;
}): Promise<string> {
  const supplementDirectory = path.join(
    root,
    'memories',
    memoryId,
    'segments',
    segmentId,
    'supplements',
    supplementId
  );
  await mkdir(supplementDirectory, { recursive: true });
  await writeFile(path.join(supplementDirectory, 'audio.webm'), new Uint8Array([5, 6, 7]));
  await writeFile(
    path.join(supplementDirectory, 'supplement.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'supplement',
      data: { title, kind: 'audio' },
      content: `# ${title}\n\nSupplement context must stay.\n\n## Transcript\n\n${transcript}`,
    })
  );
  await mkdir(path.join(root, '.reo', 'objects', 'supplements'), { recursive: true });
  await writeFile(
    path.join(root, '.reo', 'objects', 'supplements', `${supplementId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'supplement',
        workspaceId,
        memoryId,
        segmentId,
        supplementId,
        kind: 'audio',
        createdAt: '2026-05-27T06:02:00.000Z',
        finalizedAt: '2026-05-27T06:02:00.000Z',
        updatedAt: '2026-05-27T06:02:00.000Z',
        durationMs: 500,
        nextSequence: 1,
        audioByteLength: 3,
        lastTranscriptionAttempt: 'success',
      },
      null,
      2
    )}\n`
  );
  return supplementDirectory;
}

async function writeFinalizedMemoryRecording({
  root,
  workspaceId,
  memoryId,
  segmentId,
  title,
  audio,
  durationMs,
}: {
  readonly root: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
  readonly audio: Uint8Array;
  readonly durationMs: number;
}): Promise<void> {
  const memoryDirectory = path.join(root, 'memories', memoryId);
  const recordingDirectory = path.join(memoryDirectory, 'segments', segmentId);
  await mkdir(recordingDirectory, { recursive: true });
  await mkdir(path.join(root, '.reo', 'objects', 'memories'), { recursive: true });
  await mkdir(path.join(root, '.reo', 'objects', 'segments'), { recursive: true });
  await writeFile(
    path.join(memoryDirectory, 'memory.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'memory',
      data: { title },
      content: `# ${title}\n`,
    })
  );
  await writeFile(
    path.join(root, '.reo', 'objects', 'memories', `${memoryId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'memory',
        memoryId,
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:09:00.000Z',
      },
      null,
      2
    )}\n`
  );
  await writeFile(path.join(recordingDirectory, 'audio.webm'), audio);
  await writeFile(
    path.join(recordingDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title, kind: 'audio' },
      content: `# ${title}\n\n## Transcript\n\n`,
    })
  );
  await writeFile(
    path.join(root, '.reo', 'objects', 'segments', `${segmentId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'segment',
        workspaceId,
        memoryId,
        segmentId,
        kind: 'audio',
        createdAt: '2026-05-06T13:08:00.000Z',
        finalizedAt: '2026-05-06T13:09:00.000Z',
        updatedAt: '2026-05-06T13:09:00.000Z',
        durationMs,
        nextSequence: 1,
        audioByteLength: audio.byteLength,
      },
      null,
      2
    )}\n`
  );
}

test('initialize workspace preserves an existing user AGENTS.md and writes Reo-owned entry', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-conflict-'));
  const agentsPath = path.join(root, 'AGENTS.md');
  await writeFile(agentsPath, '用户已有规则\n');
  const beforeHash = await sha256(agentsPath);

  const result = await initializeWorkspaceFiles({
    rootPath: root,
    title: '会议记录',
    description: '产品讨论',
    createWorkspaceId: () => 'ws_conflict',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(await sha256(agentsPath), beforeHash);
  assert.equal(await readFile(path.join(root, '.reo', 'REO.md'), 'utf8'), DEFAULT_WORKSPACE_REO_MD);
  await stat(path.join(root, 'skills', 'reo-edit', 'SKILL.md'));
});

test('initialize workspace leaves an existing AGENTS.md symlink untouched', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-dangling-agents-'));
  const userAgentsTarget = path.join(root, 'missing-user-agents.md');
  const agentsPath = path.join(root, 'AGENTS.md');
  await symlink(userAgentsTarget, agentsPath);

  const result = await initializeWorkspaceFiles({
    rootPath: root,
    title: '会议记录',
    description: '产品讨论',
    createWorkspaceId: () => 'ws_conflict',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(await realpath(agentsPath).catch(() => userAgentsTarget), userAgentsTarget);
  assert.equal(await readFile(path.join(root, '.reo', 'REO.md'), 'utf8'), DEFAULT_WORKSPACE_REO_MD);
  await stat(path.join(root, 'memories'));
});

test('workspace init creates stable root files and Reo agent skill entry', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-init-'));

  const result = await initializeWorkspaceFiles({
    rootPath: root,
    title: '记忆录音',
    description: '第一产品切片',
    createWorkspaceId: () => 'ws_20260506_000001',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.deepEqual(result, {
    ok: true,
    snapshot: {
      workspaceId: 'ws_20260506_000001',
      title: '记忆录音',
      description: '第一产品切片',
      memories: [],
    },
  });
  assert.deepEqual((await readdir(root)).sort(), [
    '.reo',
    'AGENTS.md',
    'memories',
    'skills',
    'widgets',
  ]);
  const agentsText = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.equal(agentsText, DEFAULT_WORKSPACE_AGENTS_MD);
  assert.match(agentsText, /\.reo\/REO\.md/);
  assert.match(agentsText, /固定的官方同名 Reo skills/);
  assert.match(agentsText, /`reo-edit`/);
  assert.match(agentsText, /`reo-doctor`/);
  assert.doesNotMatch(agentsText, /核心实体/);
  assert.doesNotMatch(agentsText, /<!-- reo-managed:agent-entry:start/);
  const reoText = await readFile(path.join(root, '.reo', 'REO.md'), 'utf8');
  assert.equal(reoText, DEFAULT_WORKSPACE_REO_MD);
  assert.match(reoText, /Codex/);
  assert.match(reoText, /核心实体/);
  assert.match(reoText, /即使根 `AGENTS\.md` 是用户自定义文件/);
  assert.match(reoText, /不需要离开当前记忆空间查询 Reo 仓库源码/);
  assert.match(reoText, /skills\/reo-edit\/SKILL\.md/);
  assert.match(reoText, /skills\/reo-cover-image\/SKILL\.md/);
  assert.match(reoText, /skills\/reo-cover-aesthetic\/SKILL\.md/);
  assert.match(reoText, /skills\/reo-works\/SKILL\.md/);
  assert.match(reoText, /skills\/reo-generative-runtime\/SKILL\.md/);
  assert.match(reoText, /skills\/reo-generative-runtime\/scripts\//);
  assert.match(reoText, /widgets\//);
  assert.match(reoText, /widget\.md/);
  assert.match(reoText, /mount: workspace-rail/);
  assert.match(reoText, /skills\/reo-works\/references\//);
  assert.match(reoText, /skills\/reo-works-design\/SKILL\.md/);
  assert.match(reoText, /skills\/reo-works-design\/references\//);
  assert.match(reoText, /skills\/reo-doctor\/SKILL\.md/);
  assert.match(reoText, /用户自带 skills/);
  assert.doesNotMatch(agentsText, /普通文字/);
  assert.doesNotMatch(agentsText, /var\(--tt-color-highlight-blue\)/);
  assert.doesNotMatch(agentsText, /source\.hash/);
  assert.deepEqual((await readdir(path.join(root, 'skills'))).sort(), [
    'reo-cover-aesthetic',
    'reo-cover-image',
    'reo-doctor',
    'reo-edit',
    'reo-generative-runtime',
    'reo-works',
    'reo-works-design',
  ]);
  assert.deepEqual((await readdir(path.join(root, 'skills', 'reo-cover-aesthetic'))).sort(), [
    'SKILL.md',
  ]);
  assert.deepEqual((await readdir(path.join(root, 'skills', 'reo-edit'))).sort(), ['SKILL.md']);
  assert.deepEqual((await readdir(path.join(root, 'skills', 'reo-works'))).sort(), [
    'SKILL.md',
    'references',
  ]);
  assert.deepEqual((await readdir(path.join(root, 'skills', 'reo-generative-runtime'))).sort(), [
    'SKILL.md',
    'references',
    'scripts',
  ]);
  assert.deepEqual(
    (await readdir(path.join(root, 'skills', 'reo-generative-runtime', 'references'))).sort(),
    ['bridge-api.md', 'bundle-contract.md', 'state-and-storage.md', 'templates.md', 'validation.md']
  );
  assert.deepEqual(
    (await readdir(path.join(root, 'skills', 'reo-generative-runtime', 'scripts'))).sort(),
    Object.keys(DEFAULT_REO_GENERATIVE_RUNTIME_SCRIPT_FILES).sort()
  );
  assert.deepEqual((await readdir(path.join(root, 'skills', 'reo-works-design'))).sort(), [
    'SKILL.md',
    'examples',
    'references',
  ]);
  const worksDesignExamplesDirectory = path.join(root, 'skills', 'reo-works-design', 'examples');
  const worksDesignExampleFiles = [
    'derive-chain.html',
    'number-line.html',
    'rail-widget.html',
    'reactive-binding.html',
    'zoomable-series.html',
  ];
  assert.deepEqual((await readdir(worksDesignExamplesDirectory)).sort(), worksDesignExampleFiles);
  for (const filename of worksDesignExampleFiles) {
    const example = await readFile(path.join(worksDesignExamplesDirectory, filename), 'utf8');
    assert.match(example, /^<!doctype html>/, filename);
    assert.match(example, /--background: var\(--surface-1\)/, filename);
    assert.match(example, /\[data-theme='dark'\]/, filename);
    assert.match(example, /function derive\(/, filename);
    assert.doesNotMatch(
      example,
      /--color-background-primary|--color-text-primary|--shadow-card|--border-radius-md/,
      filename
    );
    assert.doesNotMatch(example, /[`]|\$\{/, filename);
  }
  const explorablesReference = await readFile(
    path.join(root, 'skills', 'reo-works-design', 'references', 'explorables.md'),
    'utf8'
  );
  assert.match(explorablesReference, /source -> derive -> render/);
  assert.match(explorablesReference, /examples\/reactive-binding\.html/);
  assert.match(explorablesReference, /独立源变量/);
  assert.deepEqual((await readdir(path.join(root, 'skills', 'reo-works', 'references'))).sort(), [
    'file-contract.md',
    'runtime-contract-check.md',
    'workflows.md',
  ]);
  assert.deepEqual(
    (await readdir(path.join(root, 'skills', 'reo-works-design', 'references'))).sort(),
    [
      'charts.md',
      'core-design-system.md',
      'explorables.md',
      'interaction-patterns.md',
      'mockups-and-art.md',
      'modules.md',
      'svg-and-diagrams.md',
    ]
  );
  assert.deepEqual((await readdir(path.join(root, 'skills', 'reo-cover-image'))).sort(), [
    'SKILL.md',
  ]);
  assert.deepEqual((await readdir(path.join(root, 'skills', 'reo-doctor'))).sort(), [
    'SKILL.md',
    'scripts',
  ]);
  assert.deepEqual((await readdir(path.join(root, 'skills', 'reo-doctor', 'scripts'))).sort(), [
    'reo-doctor.mjs',
  ]);
  const skillText = await readFile(path.join(root, 'skills', 'reo-doctor', 'SKILL.md'), 'utf8');
  assert.match(skillText, /^name: reo-doctor/m);
  assert.match(skillText, /Use when/);
  const editSkillText = await readFile(path.join(root, 'skills', 'reo-edit', 'SKILL.md'), 'utf8');
  assert.match(editSkillText, /^name: reo-edit/m);
  assert.match(editSkillText, /Rename/);
  assert.match(editSkillText, /Verify direct file effects, then stop/);
  const worksSkillText = await readFile(path.join(root, 'skills', 'reo-works', 'SKILL.md'), 'utf8');
  assert.match(worksSkillText, /^name: reo-works/m);
  assert.match(worksSkillText, /kind: artifact/);
  assert.match(worksSkillText, /format: html/);
  assert.match(worksSkillText, /entry\.html/);
  assert.match(worksSkillText, /runtime\.json/);
  assert.match(worksSkillText, /state\.json/);
  assert.match(worksSkillText, /不要写缩略 token block/);
  assert.doesNotMatch(worksSkillText, /segment\.html|supplement\.html/);
  assert.match(worksSkillText, /skills\/reo-generative-runtime\/SKILL\.md/);
  assert.match(worksSkillText, /references\/file-contract\.md/);
  assert.doesNotMatch(worksSkillText, /Michaelliv|pi-generative-ui|github\.com/);
  const runtimeSkillText = await readFile(
    path.join(root, 'skills', 'reo-generative-runtime', 'SKILL.md'),
    'utf8'
  );
  assert.match(runtimeSkillText, /^name: reo-generative-runtime/m);
  assert.match(runtimeSkillText, /entry\.html/);
  assert.match(runtimeSkillText, /runtime\.json/);
  assert.match(runtimeSkillText, /state\.json/);
  assert.match(runtimeSkillText, /普通 Web 网络/);
  assert.match(runtimeSkillText, /scaffold-runtime\.mjs/);
  assert.match(runtimeSkillText, /validate-runtime\.mjs/);
  assert.match(runtimeSkillText, /inspect-runtime\.mjs/);
  assert.match(runtimeSkillText, /do not hand-write an abbreviated token block/);
  assert.doesNotMatch(runtimeSkillText, /migrate-runtime\.mjs/);
  assert.doesNotMatch(runtimeSkillText, /Michaelliv|pi-generative-ui|github\.com/);
  const worksContractText = await readFile(
    path.join(root, 'skills', 'reo-works', 'references', 'file-contract.md'),
    'utf8'
  );
  assert.match(worksContractText, /complete HTML document/);
  assert.match(worksContractText, /kind: artifact/);
  assert.match(worksContractText, /format: html/);
  assert.match(worksContractText, /entry\.html/);
  assert.match(worksContractText, /runtime\.json/);
  assert.match(worksContractText, /state\.json/);
  assert.doesNotMatch(worksContractText, /segment\.html|supplement\.html/);
  assert.doesNotMatch(worksContractText, /Michaelliv|pi-generative-ui|github\.com/);
  const worksDesignSkillText = await readFile(
    path.join(root, 'skills', 'reo-works-design', 'SKILL.md'),
    'utf8'
  );
  assert.match(worksDesignSkillText, /^name: reo-works-design/m);
  assert.match(worksDesignSkillText, /references\/core-design-system\.md/);
  assert.match(worksDesignSkillText, /--background: var\(--surface-1\)/);
  assert.match(worksDesignSkillText, /\[data-theme='dark'\]/);
  assert.match(worksDesignSkillText, /--tracking-heading: 0/);
  assert.match(worksDesignSkillText, /--font-weight-medium: 500/);
  assert.match(worksDesignSkillText, /--container-form: 720px/);
  assert.match(worksDesignSkillText, /--shadow-hero-fill:/);
  assert.match(worksDesignSkillText, /内容画布可以有自己的创作风格/);
  assert.doesNotMatch(
    worksDesignSkillText,
    /--color-background-primary|--color-text-primary|--shadow-card|--border-radius-md|c-purple/
  );
  assert.doesNotMatch(worksDesignSkillText, /Michaelliv|pi-generative-ui|github\.com/);
  const worksDesignCoreText = await readFile(
    path.join(root, 'skills', 'reo-works-design', 'references', 'core-design-system.md'),
    'utf8'
  );
  assert.match(worksDesignCoreText, /--background: var\(--surface-1\)/);
  assert.match(worksDesignCoreText, /--shadow-hero-lift:/);
  assert.match(worksDesignCoreText, /Seamless frame, expressive content/);
  assert.doesNotMatch(
    worksDesignCoreText,
    /--color-background-primary|--color-text-primary|--shadow-card|--border-radius-md|c-purple/
  );
  assert.match(worksDesignCoreText, /普通 Web 网络/);
  assert.doesNotMatch(worksDesignCoreText, /Michaelliv|pi-generative-ui|github\.com/);
  const worksDesignModulesText = await readFile(
    path.join(root, 'skills', 'reo-works-design', 'references', 'modules.md'),
    'utf8'
  );
  assert.match(worksDesignModulesText, /diagram/);
  assert.match(worksDesignModulesText, /mockup/);
  assert.match(worksDesignModulesText, /interactive/);
  assert.match(worksDesignModulesText, /chart/);
  assert.match(worksDesignModulesText, /art/);
  const coverSkillText = await readFile(
    path.join(root, 'skills', 'reo-cover-image', 'SKILL.md'),
    'utf8'
  );
  assert.match(coverSkillText, /^name: reo-cover-image/m);
  assert.match(coverSkillText, /封面图片任务/);
  assert.match(coverSkillText, /memories\/<memory-directory>\/cover\//);
  assert.match(coverSkillText, /segments\/<segment-directory>\/cover\//);
  assert.match(coverSkillText, /不要编辑 `.reo\/index\.json`/);
  const aestheticSkillText = await readFile(
    path.join(root, 'skills', 'reo-cover-aesthetic', 'SKILL.md'),
    'utf8'
  );
  assert.match(aestheticSkillText, /^name: reo-cover-aesthetic/m);
  assert.match(aestheticSkillText, /基于开源 `aesthetic` skill 优化后的 Reo 封面审美 skill/);
  assert.match(aestheticSkillText, /## 核心框架：四阶段方法/);
  assert.match(aestheticSkillText, /## Reo 封面规则/);
  assert.doesNotMatch(aestheticSkillText, /\$aesthetic/);
  assert.doesNotMatch(aestheticSkillText, /npx skills add/);
  for (const expected of [
    /Reo Markdown profile/,
    /# Heading/,
    /\[text\]\(https:\/\/example\.com\)/,
    /- \[ \] task/,
    /var\(--tt-color-highlight-blue\)/,
    /<p style="text-align: center">text<\/p>/,
    /```ts\nconst value = 1\n```/,
    /edit only the `content` field/,
    /Do not maintain `source\.hash` or `contentHash`/,
  ]) {
    assert.match(editSkillText, expected);
  }
  const scriptText = await readFile(
    path.join(root, 'skills', 'reo-doctor', 'scripts', 'reo-doctor.mjs'),
    'utf8'
  );
  assert.match(scriptText, /reo-doctor/);
  assert.deepEqual((await readdir(path.join(root, '.reo'))).sort(), [
    'REO.md',
    'drafts',
    'index.json',
    'workspace.json',
  ]);
  assert.deepEqual(await readdir(path.join(root, '.reo', 'drafts')), ['segments']);
  for (const forbidden of ['photos', 'videos', 'files', 'films']) {
    await assert.rejects(stat(path.join(root, forbidden)));
  }
});

test('managed Reo entry presents ordinary file editing before Reo internals', () => {
  assertIncludesInOrder(DEFAULT_WORKSPACE_REO_MD, [
    '## 普通任务默认路径',
    '不要把能力限制成 Markdown-only',
    '验证直接文件效果后停止',
    '## 需要检查时',
    '## 核心实体',
  ]);
  assert.match(
    DEFAULT_WORKSPACE_REO_MD,
    /Markdown、同节点 `content\.tiptap\.json`、附件和普通对象文件/
  );
  assert.match(DEFAULT_WORKSPACE_REO_MD, /skills\/reo-cover-image\/SKILL\.md/);
  assert.match(DEFAULT_WORKSPACE_REO_MD, /skills\/reo-cover-aesthetic\/SKILL\.md/);
  assert.match(DEFAULT_WORKSPACE_REO_MD, /skills\/reo-works\/SKILL\.md/);
  assert.match(DEFAULT_WORKSPACE_REO_MD, /skills\/reo-works\/references\//);
  assert.match(DEFAULT_WORKSPACE_REO_MD, /skills\/reo-works-design\/SKILL\.md/);
  assert.match(DEFAULT_WORKSPACE_REO_MD, /skills\/reo-works-design\/references\//);
  assert.match(DEFAULT_WORKSPACE_REO_MD, /短提示创建作品、Widget 或主页组件/);
  assert.match(DEFAULT_WORKSPACE_REO_MD, /通过后停止，不继续打磨/);
  assert.match(DEFAULT_WORKSPACE_REO_MD, /不要先进入通用 brainstorming/);
  assert.match(DEFAULT_WORKSPACE_REO_MD, /app-level `home components root`/);
  assert.match(DEFAULT_WORKSPACE_REO_MD, /不要把 app-level 组件补丁套到当前记忆空间根目录/);
  assert.match(DEFAULT_WORKSPACE_REO_MD, /验证直接文件效果后停止/);
  assert.match(DEFAULT_WORKSPACE_REO_MD, /Reo 明确提示 needs-review/);
  assert.match(DEFAULT_WORKSPACE_REO_MD, /workspace-relative 信息与 recovery hint/);
  assert.match(DEFAULT_WORKSPACE_AGENTS_MD, /\.reo\/REO\.md/);
  assert.match(DEFAULT_WORKSPACE_AGENTS_MD, /固定的官方同名 Reo skills/);
  assert.match(DEFAULT_WORKSPACE_AGENTS_MD, /`reo-doctor`/);
  assert.match(DEFAULT_WORKSPACE_AGENTS_MD, /不要先启动通用 brainstorming/);
  assert.doesNotMatch(DEFAULT_WORKSPACE_AGENTS_MD, /## 核心实体/);
});

test('managed reo-edit skill keeps stop rules explicit and keeps Tiptap JSON non-default', () => {
  assertIncludesInOrder(DEFAULT_REO_EDIT_SKILL_MD, [
    '## Quick Start',
    'Do not reduce Reo work to Markdown-only',
    '## Stop Rules',
    '## Common File Operations',
    '## Rich Text Markdown',
    '## Expert Tiptap JSON',
  ]);
  assert.match(
    DEFAULT_REO_EDIT_SKILL_MD,
    /Markdown, same-node `content\.tiptap\.json`, attachments and ordinary object files/
  );
  assert.match(DEFAULT_REO_EDIT_SKILL_MD, /After direct file verification, stop/);
  assert.match(
    DEFAULT_REO_EDIT_SKILL_MD,
    /Do not inspect Reo repo source, global memories, `.reo`, hashes, manifests, index or lock files/
  );
  assert.match(
    DEFAULT_REO_EDIT_SKILL_MD,
    /Use Expert Tiptap JSON only when the user asks for exact rich structure/
  );
  assert.match(DEFAULT_REO_EDIT_SKILL_MD, /seg_YYYYMMDDHHMMSS_8hex/);
  assert.match(DEFAULT_REO_EDIT_SKILL_MD, /sup_YYYYMMDDHHMMSS_8hex/);
  assert.doesNotMatch(DEFAULT_REO_EDIT_SKILL_MD, /seg_agent_|sup_agent_/);
  assert.doesNotMatch(DEFAULT_REO_EDIT_SKILL_MD, /only edit Markdown/i);
});

test('managed reo-cover-image skill keeps cover file operations explicit', () => {
  assertIncludesInOrder(DEFAULT_REO_COVER_IMAGE_SKILL_MD, [
    '## 快速开始',
    '## 目标路径',
    '## 替换或创建自定义封面',
    '## 生成封面',
    '## 切换随机默认图片',
    '## 恢复默认封面',
    '## 验证',
  ]);
  assert.match(DEFAULT_REO_COVER_IMAGE_SKILL_MD, /memories\/<memory-directory>\/cover\//);
  assert.match(
    DEFAULT_REO_COVER_IMAGE_SKILL_MD,
    /memories\/<memory-directory>\/segments\/<segment-directory>\/cover\//
  );
  assert.match(DEFAULT_REO_COVER_IMAGE_SKILL_MD, /PNG、JPEG 和 WebP/);
  assert.match(DEFAULT_REO_COVER_IMAGE_SKILL_MD, /不要编辑 `.reo\/index\.json`/);
  assert.match(DEFAULT_REO_COVER_IMAGE_SKILL_MD, /切换随机默认图片/);
  assert.match(DEFAULT_REO_COVER_IMAGE_SKILL_MD, /defaultCoverTemplateId/);
  assert.match(DEFAULT_REO_COVER_IMAGE_SKILL_MD, /明确对象目录或 manifest 路径，直接使用该路径/);
  assert.match(DEFAULT_REO_COVER_IMAGE_SKILL_MD, /只改那个文件、那个字段/);
  assert.doesNotMatch(DEFAULT_REO_COVER_IMAGE_SKILL_MD, /先读 `AGENTS\.md`/);
  assert.match(DEFAULT_REO_COVER_IMAGE_SKILL_MD, /不要创建 symlink/);
  assert.match(DEFAULT_REO_COVER_IMAGE_SKILL_MD, /自然铺满整个画布/);
  assert.match(DEFAULT_REO_COVER_IMAGE_SKILL_MD, /不要在图片内部绘制边框/);
  assert.match(DEFAULT_REO_COVER_IMAGE_SKILL_MD, /不要在图中预留文字胶囊/);
});

test('managed reo-cover-aesthetic skill is a Reo-adapted aesthetic workflow', () => {
  assertIncludesInOrder(DEFAULT_REO_COVER_AESTHETIC_SKILL_MD, [
    '## 使用场景',
    '## 核心框架：四阶段方法',
    '## Reo 封面规则',
    '## 提示词结构',
    '## 评估清单',
    '## 输出',
  ]);
  assert.match(DEFAULT_REO_COVER_AESTHETIC_SKILL_MD, /BEAUTIFUL：理解审美/);
  assert.match(DEFAULT_REO_COVER_AESTHETIC_SKILL_MD, /RIGHT：适配 Reo 封面/);
  assert.match(DEFAULT_REO_COVER_AESTHETIC_SKILL_MD, /图片内容必须自然铺满整个画布/);
  assert.match(DEFAULT_REO_COVER_AESTHETIC_SKILL_MD, /Memory 或 Segment/);
  assert.match(DEFAULT_REO_COVER_AESTHETIC_SKILL_MD, /skills\/reo-cover-image\/SKILL\.md/);
  assert.match(DEFAULT_REO_COVER_AESTHETIC_SKILL_MD, /no border, no frame, no white margin/);
  assert.doesNotMatch(DEFAULT_REO_COVER_AESTHETIC_SKILL_MD, /\$aesthetic/);
  assert.doesNotMatch(DEFAULT_REO_COVER_AESTHETIC_SKILL_MD, /npx skills add/);
});

test('managed reo-works skill defines artifact file creation without external references', () => {
  assertIncludesInOrder(DEFAULT_REO_WORKS_SKILL_MD, [
    '## 使用场景',
    '## 创建作品片段',
    '## 创建作品补充',
    '## 更新作品',
    '## 文件合同',
    '## 验证',
  ]);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /kind: artifact/);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /format: html/);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /seg_YYYYMMDDHHMMSS_8hex/);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /sup_YYYYMMDDHHMMSS_8hex/);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /已有 Reo 对象可能使用更早的合法 id/);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /entry\.html/);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /runtime\.json/);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /state\.json/);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /do not ask where to put it/i);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /new standalone work Segment/i);
  assert.doesNotMatch(DEFAULT_REO_WORKS_SKILL_MD, /segment\.html|supplement\.html/);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /skills\/reo-generative-runtime\/SKILL\.md/);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /skills\/reo-works-design\/SKILL\.md/);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /用户未指定风格时默认按 `reo-works-design`/);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /readPlaybackAudio/);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /references\/file-contract\.md/);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /references\/workflows\.md/);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /references\/runtime-contract-check\.md/);
  assert.match(DEFAULT_REO_WORKS_SKILL_MD, /不要创建空白占位作品/);
  assert.doesNotMatch(DEFAULT_REO_WORKS_SKILL_MD, /不会被 Reo 投影/);
  assert.doesNotMatch(DEFAULT_REO_WORKS_SKILL_MD, /Michaelliv|pi-generative-ui|github\.com/);
  assert.match(DEFAULT_REO_WORKS_REFERENCE_FILES['file-contract.md'], /complete HTML document/);
  assert.match(DEFAULT_REO_WORKS_REFERENCE_FILES['file-contract.md'], /seg_YYYYMMDDHHMMSS_8hex/);
  assert.match(DEFAULT_REO_WORKS_REFERENCE_FILES['file-contract.md'], /sup_YYYYMMDDHHMMSS_8hex/);
  assert.match(
    DEFAULT_REO_WORKS_REFERENCE_FILES['file-contract.md'],
    /do not invent placeholder ids/
  );
  assert.match(DEFAULT_REO_WORKS_REFERENCE_FILES['file-contract.md'], /entry\.html/);
  assert.match(DEFAULT_REO_WORKS_REFERENCE_FILES['file-contract.md'], /runtime\.json/);
  assert.match(DEFAULT_REO_WORKS_REFERENCE_FILES['file-contract.md'], /state\.json/);
  assert.doesNotMatch(
    DEFAULT_REO_WORKS_REFERENCE_FILES['file-contract.md'],
    /segment\.html|supplement\.html/
  );
  assert.match(DEFAULT_REO_WORKS_REFERENCE_FILES['workflows.md'], /Create from Reo prompt/);
  assert.match(DEFAULT_REO_WORKS_REFERENCE_FILES['workflows.md'], /Short user prompt/);
  assert.match(DEFAULT_REO_WORKS_REFERENCE_FILES['workflows.md'], /do not offer choices/i);
  assert.match(
    DEFAULT_REO_WORKS_REFERENCE_FILES['workflows.md'],
    /Stop as soon as validation passes/
  );
  assert.match(
    DEFAULT_REO_WORKS_REFERENCE_FILES['workflows.md'],
    /Do not run browser screenshots/i
  );
  assert.match(
    DEFAULT_REO_WORKS_REFERENCE_FILES['runtime-contract-check.md'],
    /validate-runtime\.mjs/
  );
  assert.doesNotMatch(
    DEFAULT_REO_WORKS_REFERENCE_FILES['runtime-contract-check.md'],
    /visual|privacy|content quality|taste|risk/i
  );
  for (const text of Object.values(DEFAULT_REO_WORKS_REFERENCE_FILES)) {
    assert.doesNotMatch(text, /Michaelliv|pi-generative-ui|github\.com/);
  }
});

test('managed reo-generative-runtime skill defines bundle, state, network, templates, and scripts', () => {
  assertIncludesInOrder(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, [
    '## Runtime Bundle',
    '## State',
    '## Bridge',
    '## Web Capability',
    '## Templates',
    '## Scripts',
  ]);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /entry\.html/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /runtime\.json/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /state\.json/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /workspace rail widgets/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /widgets\/<widget-directory>/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /widget\.md/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /mount: workspace-rail/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /home-components\/<component-directory>/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /component\.md/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /mount: home/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /window\.reo/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /bridge\.js/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /readPlaybackAudio/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /they do not reload the host iframe/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /普通 Web 网络/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /scaffold-runtime\.mjs/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /validate-runtime\.mjs/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /inspect-runtime\.mjs/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /do not run headless browser screenshots/i);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /Generic global workflow gates/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /provided home components root/);
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD,
    /Do not apply patches against the memory-space cwd/
  );
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD,
    /do not hand-write an abbreviated token block/
  );
  assert.doesNotMatch(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /migrate-runtime\.mjs/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['templates.md'], /dashboard/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['templates.md'], /todo/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['templates.md'], /spaced review/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['templates.md'], /state\.json/);
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['templates.md'],
    /Do not hand-write an abbreviated copy/
  );
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['validation.md'],
    /full Reo semantic token block/
  );
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_SCRIPT_FILES['validate-runtime.mjs'],
    /reo-theme-token-block-incomplete/
  );
  assert.deepEqual(Object.keys(DEFAULT_REO_GENERATIVE_RUNTIME_SCRIPT_FILES).sort(), [
    'inspect-runtime.mjs',
    'reo-token-contract.mjs',
    'scaffold-runtime.mjs',
    'validate-runtime.mjs',
  ]);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /text-overflow: ellipsis/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /overflow-wrap: anywhere/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /240px rail to a 520px rail/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /fixed pixel height/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD, /literal local file URL scheme/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['templates.md'], /min-width: 0/);
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['templates.md'],
    /white-space: nowrap/
  );
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['validation.md'],
    /horizontal text overflow/
  );
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['validation.md'], /long scroll/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['validation.md'], /240px to 520px/);
  assert.doesNotMatch(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['templates.md'],
    /localStorage persistence/
  );
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['state-and-storage.md'],
    /window\.reo\.state/
  );
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['state-and-storage.md'],
    /only long-term state/
  );
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['state-and-storage.md'],
    /does not reload the host iframe/
  );
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['state-and-storage.md'], /刷新页面/);
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['bridge-api.md'],
    /all Memory summaries/
  );
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['bridge-api.md'], /ui\.selectMemory/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['bridge-api.md'], /ui\.selectObject/);
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['bridge-api.md'],
    /media\.readPlaybackAudio/
  );
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['bridge-api.md'], /note-speech/);
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['bridge-api.md'],
    /readMemoryDetail\(\{ memoryId \}\)/
  );
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD,
    /Memory summaries expose `memoryId`, not `id`/
  );
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['bridge-api.md'],
    /const memoryId = memory\.memoryId/
  );
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['bridge-api.md'],
    /Do not use `memory\.id`/
  );
  assert.doesNotMatch(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['bridge-api.md'],
    /window\.reo\.secrets/
  );
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['bridge-api.md'],
    /mutations\.updateTitle/
  );
  assert.doesNotMatch(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['bridge-api.md'],
    /saveNoteBody/
  );
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['bridge-api.md'],
    /Artifact works cannot write arbitrary note bodies/
  );
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['bundle-contract.md'], /bridge\.js/);
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['bundle-contract.md'],
    /kind: widget/
  );
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['bundle-contract.md'],
    /mount: workspace-rail/
  );
  assert.match(
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['bundle-contract.md'],
    /kind: home-component/
  );
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['bundle-contract.md'], /hcmp_/);
  assert.match(DEFAULT_WORKSPACE_REO_MD, /home-components\/<component-directory>\/component\.md/);
  assert.match(DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES['validation.md'], /can run/);
  assert.doesNotMatch(
    DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD,
    /M2\.1|future widgets|should not assume a Reo write bridge/
  );
  for (const text of [
    DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD,
    ...Object.values(DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES),
  ]) {
    assert.doesNotMatch(text, /Michaelliv|pi-generative-ui|github\.com/);
  }
});

test('managed runtime scripts reject symlink targets outside the memory space', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-runtime-scripts-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-runtime-outside-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Runtime scripts',
    description: '',
    createWorkspaceId: () => 'ws_runtime_scripts',
    now: () => '2026-06-03T13:20:00.000Z',
  });
  await symlink(outside, path.join(root, 'linked-outside'), 'dir');

  const scaffoldOk = await runNodeScript(
    [
      path.join(root, 'skills', 'reo-generative-runtime', 'scripts', 'scaffold-runtime.mjs'),
      'work',
      '--title',
      'Bridge work',
      '--template',
      'todo',
    ],
    root
  );
  assert.equal(scaffoldOk.status, 0, scaffoldOk.stderr || scaffoldOk.stdout);
  const scaffoldedEntry = await readFile(path.join(root, 'work', 'entry.html'), 'utf8');
  assert.match(scaffoldedEntry, /window\.reo/);
  assert.match(scaffoldedEntry, /reo-render:\/\/vendor\/reo-render\/bridge\.js/);
  assert.match(scaffoldedEntry, /data-template="todo"/);
  assert.equal(scaffoldedEntry.includes(DEFAULT_REO_WORKS_DESIGN_TOKEN_CSS), true);
  assert.match(scaffoldedEntry, /:root,\s*\n\[data-theme='light'\]/);
  assert.match(scaffoldedEntry, /\[data-theme='dark'\]/);
  assert.match(scaffoldedEntry, /@media \(prefers-color-scheme: dark\)/);
  assert.match(scaffoldedEntry, /:root:not\(\[data-theme\]\)/);
  assert.match(scaffoldedEntry, /--background: var\(--surface-1\)/);
  assert.match(scaffoldedEntry, /--foreground: #18181b/);
  assert.match(scaffoldedEntry, /--card: var\(--surface-2\)/);
  assert.match(scaffoldedEntry, /--popover: var\(--surface-4\)/);
  assert.match(scaffoldedEntry, /--tracking-heading: 0/);
  assert.match(scaffoldedEntry, /--font-weight-medium: 500/);
  assert.match(scaffoldedEntry, /--container-form: 720px/);
  assert.match(scaffoldedEntry, /--shadow-hero-fill:/);
  assert.match(scaffoldedEntry, /background:var\(--background\)/);
  assert.match(scaffoldedEntry, /color:var\(--foreground\)/);
  assert.match(scaffoldedEntry, /border-radius:var\(--radius-md\)/);
  assert.doesNotMatch(
    scaffoldedEntry,
    /--color-background-primary|--color-text-primary|--shadow-card|--border-radius-md/
  );
  assert.match(scaffoldedEntry, /新增一项/);
  assert.doesNotMatch(scaffoldedEntry, /innerHTML\s*=\s*items\(\)\.map/);
  assert.match(scaffoldedEntry, /label\.textContent\s*=/);
  assert.match(scaffoldedEntry, /button\.textContent\s*=/);
  assert.doesNotMatch(scaffoldedEntry, /Runtime bundle scaffolded/);
  const runtimeJson = JSON.parse(await readFile(path.join(root, 'work', 'runtime.json'), 'utf8'));
  assert.deepEqual(runtimeJson.bridge.needs, ['state']);
  assert.deepEqual(runtimeJson.theme, {
    tokens: 'reo-semantic-v1',
    modes: ['light', 'dark'],
    default: 'system',
  });
  assert.equal(Object.hasOwn(runtimeJson, 'secrets'), false);

  const [validateOk, inspectOk] = await Promise.all([
    runNodeScript(
      [
        path.join(root, 'skills', 'reo-generative-runtime', 'scripts', 'validate-runtime.mjs'),
        'work',
      ],
      root
    ),
    runNodeScript(
      [
        path.join(root, 'skills', 'reo-generative-runtime', 'scripts', 'inspect-runtime.mjs'),
        'work',
      ],
      root
    ),
  ]);
  assert.equal(validateOk.status, 0, validateOk.stderr || validateOk.stdout);
  assert.equal(inspectOk.status, 0, inspectOk.stderr || inspectOk.stdout);
  assert.match(inspectOk.stdout, /"template": "todo"/);
  assert.match(inspectOk.stdout, /"usesBridge": true/);

  await mkdir(path.join(root, 'bad-theme', 'assets'), { recursive: true });
  await writeFile(
    path.join(root, 'bad-theme', 'entry.html'),
    '<!doctype html><html><head><style>:root{--background:#fff;--foreground:#111}[data-theme="dark"]{--background:#000}</style></head><body>ok</body></html>'
  );
  await writeFile(
    path.join(root, 'bad-theme', 'runtime.json'),
    JSON.stringify({
      schemaVersion: 1,
      entry: 'entry.html',
      theme: { tokens: 'reo-semantic-v1', modes: ['light', 'dark'], default: 'system' },
    })
  );
  await writeFile(path.join(root, 'bad-theme', 'state.json'), '{"schemaVersion":1}\n');
  const validateBadTheme = await runNodeScript(
    [
      path.join(root, 'skills', 'reo-generative-runtime', 'scripts', 'validate-runtime.mjs'),
      'bad-theme',
    ],
    root
  );
  assert.equal(validateBadTheme.status, 1, validateBadTheme.stdout);
  assert.deepEqual(
    (JSON.parse(validateBadTheme.stdout) as { issues: Array<{ code: string }> }).issues.map(
      (issue) => issue.code
    ),
    ['reo-theme-token-block-incomplete']
  );

  await mkdir(path.join(root, 'home-components', 'hcmp_missing_md--Missing', 'assets'), {
    recursive: true,
  });
  await writeFile(
    path.join(root, 'home-components', 'hcmp_missing_md--Missing', 'entry.html'),
    '<!doctype html><html><head><title>Missing</title></head><body>missing component md</body></html>'
  );
  await writeFile(
    path.join(root, 'home-components', 'hcmp_missing_md--Missing', 'runtime.json'),
    '{"schemaVersion":1}\n'
  );
  await writeFile(
    path.join(root, 'home-components', 'hcmp_missing_md--Missing', 'state.json'),
    '{"schemaVersion":1}\n'
  );
  const validateMissingHomeComponentMarkdown = await runNodeScript(
    [
      path.join(root, 'skills', 'reo-generative-runtime', 'scripts', 'validate-runtime.mjs'),
      'home-components/hcmp_missing_md--Missing',
    ],
    root
  );
  assert.equal(
    validateMissingHomeComponentMarkdown.status,
    1,
    validateMissingHomeComponentMarkdown.stdout
  );
  assert.deepEqual(
    (
      JSON.parse(validateMissingHomeComponentMarkdown.stdout) as {
        issues: Array<{ code: string }>;
      }
    ).issues.map((issue) => issue.code),
    ['missing-object-markdown']
  );

  await mkdir(
    path.join(
      root,
      'memories',
      'mem_runtime_scripts--Runtime scripts',
      'segments',
      'seg_missing_md--Missing',
      'assets'
    ),
    { recursive: true }
  );
  const missingSegmentMarkdownDirectory =
    'memories/mem_runtime_scripts--Runtime scripts/segments/seg_missing_md--Missing';
  await writeFile(
    path.join(root, missingSegmentMarkdownDirectory, 'entry.html'),
    '<!doctype html><html><head><title>Missing</title></head><body>missing segment md</body></html>'
  );
  await writeFile(
    path.join(root, missingSegmentMarkdownDirectory, 'runtime.json'),
    '{"schemaVersion":1}\n'
  );
  await writeFile(
    path.join(root, missingSegmentMarkdownDirectory, 'state.json'),
    '{"schemaVersion":1}\n'
  );
  const validateMissingSegmentMarkdown = await runNodeScript(
    [
      path.join(root, 'skills', 'reo-generative-runtime', 'scripts', 'validate-runtime.mjs'),
      missingSegmentMarkdownDirectory,
    ],
    root
  );
  assert.equal(validateMissingSegmentMarkdown.status, 1, validateMissingSegmentMarkdown.stdout);
  assert.deepEqual(
    (
      JSON.parse(validateMissingSegmentMarkdown.stdout) as {
        issues: Array<{ code: string }>;
      }
    ).issues.map((issue) => issue.code),
    ['missing-object-markdown']
  );

  await mkdir(path.join(root, 'bad-script', 'assets'), { recursive: true });
  await writeFile(
    path.join(root, 'bad-script', 'entry.html'),
    `<!doctype html>
<html><head><meta charset="utf-8"><title>Bad script</title></head>
<body><script>document.body.textContent = 'broken
line';</script></body></html>
`
  );
  await writeFile(path.join(root, 'bad-script', 'runtime.json'), '{"schemaVersion":1}\n');
  await writeFile(path.join(root, 'bad-script', 'state.json'), '{"schemaVersion":1}\n');
  const validateBadScript = await runNodeScript(
    [
      path.join(root, 'skills', 'reo-generative-runtime', 'scripts', 'validate-runtime.mjs'),
      'bad-script',
    ],
    root
  );
  assert.equal(validateBadScript.status, 1, validateBadScript.stdout);
  assert.deepEqual(
    (JSON.parse(validateBadScript.stdout) as { issues: Array<{ code: string }> }).issues.map(
      (issue) => issue.code
    ),
    ['entry-script-syntax']
  );

  await mkdir(path.join(root, 'bad-classic-script-with-params', 'assets'), { recursive: true });
  await writeFile(
    path.join(root, 'bad-classic-script-with-params', 'entry.html'),
    `<!doctype html>
<html><head><meta charset="utf-8"><title>Bad classic script</title></head>
<body><script type="text/javascript; charset=utf-8">document.body.textContent = 'broken
line';</script></body></html>
`
  );
  await writeFile(
    path.join(root, 'bad-classic-script-with-params', 'runtime.json'),
    '{"schemaVersion":1}\n'
  );
  await writeFile(
    path.join(root, 'bad-classic-script-with-params', 'state.json'),
    '{"schemaVersion":1}\n'
  );
  const validateBadClassicScriptWithParams = await runNodeScript(
    [
      path.join(root, 'skills', 'reo-generative-runtime', 'scripts', 'validate-runtime.mjs'),
      'bad-classic-script-with-params',
    ],
    root
  );
  assert.equal(
    validateBadClassicScriptWithParams.status,
    1,
    validateBadClassicScriptWithParams.stdout
  );
  assert.deepEqual(
    (
      JSON.parse(validateBadClassicScriptWithParams.stdout) as {
        issues: Array<{ code: string }>;
      }
    ).issues.map((issue) => issue.code),
    ['entry-script-syntax']
  );

  await mkdir(path.join(root, 'module-script', 'assets'), { recursive: true });
  await writeFile(
    path.join(root, 'module-script', 'entry.html'),
    `<!doctype html>
<html><head><meta charset="utf-8"><title>Module script</title>
<script type="importmap">{"imports":{"demo":"./assets/demo.js"}}</script>
</head><body><script type="module">import "demo"; await Promise.resolve();</script></body></html>
`
  );
  await writeFile(path.join(root, 'module-script', 'runtime.json'), '{"schemaVersion":1}\n');
  await writeFile(path.join(root, 'module-script', 'state.json'), '{"schemaVersion":1}\n');
  const validateModuleScript = await runNodeScript(
    [
      path.join(root, 'skills', 'reo-generative-runtime', 'scripts', 'validate-runtime.mjs'),
      'module-script',
    ],
    root
  );
  assert.equal(validateModuleScript.status, 0, validateModuleScript.stdout);

  await assert.rejects(
    stat(path.join(root, 'skills', 'reo-generative-runtime', 'scripts', 'migrate-runtime.mjs'))
  );

  const inspectReo = await runNodeScript(
    [path.join(root, 'skills', 'reo-generative-runtime', 'scripts', 'inspect-runtime.mjs'), '.reo'],
    root
  );
  assert.equal(inspectReo.status, 1, inspectReo.stdout);

  const scaffold = await runNodeScript(
    [
      path.join(root, 'skills', 'reo-generative-runtime', 'scripts', 'scaffold-runtime.mjs'),
      'linked-outside/work',
      '--title',
      'Escaped work',
    ],
    root
  );
  assert.equal(scaffold.status, 1, scaffold.stdout);
  await assert.rejects(stat(path.join(outside, 'work')));

  await writeFile(path.join(outside, 'entry.html'), '<!doctype html><html></html>\n');
  await writeFile(path.join(outside, 'runtime.json'), '{"schemaVersion":1}\n');
  await writeFile(path.join(outside, 'state.json'), '{"schemaVersion":1}\n');
  await mkdir(path.join(outside, 'assets'), { recursive: true });

  const validate = await runNodeScript(
    [
      path.join(root, 'skills', 'reo-generative-runtime', 'scripts', 'validate-runtime.mjs'),
      'linked-outside',
    ],
    root
  );
  assert.equal(validate.status, 1, validate.stderr || validate.stdout);
  const report = JSON.parse(validate.stdout) as {
    readonly ok: boolean;
    readonly issues: ReadonlyArray<{ readonly code: string }>;
  };
  assert.equal(report.ok, false);
  assert.deepEqual(
    report.issues.map((issue) => issue.code),
    ['target-not-directory']
  );
});

test('managed reo-works-design skill embeds Reo visual tokens and sandbox limits', () => {
  assertIncludesInOrder(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, [
    '## 模块选择',
    '## 输出顺序',
    '## 核心设计规则',
    '## Reo tokens',
    '## 画框与内容色彩',
    '## 轻量性能规则',
  ]);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /--background: var\(--surface-1\)/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /--foreground: #18181b/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /--card: var\(--surface-2\)/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /--popover: var\(--surface-4\)/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /\[data-theme='dark'\]/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /prefers-color-scheme: dark/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /--radius-md/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /--tracking-heading: 0/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /--font-weight-medium: 500/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /--container-form: 720px/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /--shadow-hero-fill:/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /内容画布可以有自己的创作风格/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /画、游戏画面、封面、地图、数据图形/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /references\/core-design-system\.md/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /references\/svg-and-diagrams\.md/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /普通 Web 网络/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /CDN/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /window\.reo/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /readPlaybackAudio/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /240px 到 520px rail/);
  assert.match(
    DEFAULT_REO_WORKS_DESIGN_SKILL_MD,
    /长 Memory 名、主题串、说明文本必须换行或 ellipsis/
  );
  assert.match(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /不要把所有作品锁死到同一个固定高度/);
  assert.equal(
    DEFAULT_REO_WORKS_DESIGN_SKILL_MD.includes(DEFAULT_REO_WORKS_DESIGN_TOKEN_CSS),
    true
  );
  assert.doesNotMatch(
    DEFAULT_REO_WORKS_DESIGN_SKILL_MD,
    /--color-background-primary|--color-text-primary|--shadow-card|--border-radius-md|c-purple/
  );
  assert.doesNotMatch(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /sendPrompt|cdnjs|unpkg|esm\.sh/);
  assert.doesNotMatch(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /M2\.1|Do not invent `window\.reo`/);
  assert.doesNotMatch(DEFAULT_REO_WORKS_DESIGN_SKILL_MD, /Michaelliv|pi-generative-ui|github\.com/);
  assert.match(
    DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['core-design-system.md'],
    /--background: var\(--surface-1\)/
  );
  assert.match(
    DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['core-design-system.md'],
    /--foreground: #18181b/
  );
  assert.match(
    DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['core-design-system.md'],
    /\[data-theme='dark'\]/
  );
  assert.match(
    DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['core-design-system.md'],
    /--shadow-hero-lift:/
  );
  assert.equal(
    DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['core-design-system.md'].includes(
      DEFAULT_REO_WORKS_DESIGN_TOKEN_CSS
    ),
    true
  );
  assert.doesNotMatch(
    DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['core-design-system.md'],
    /--color-background-primary|--color-text-primary|--shadow-card|--border-radius-md|c-purple/
  );
  assert.match(DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['core-design-system.md'], /Inline-first/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['core-design-system.md'], /240px to 520px/);
  assert.match(
    DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['core-design-system.md'],
    /Long metadata strings in rail widgets must wrap or ellipsize/
  );
  assert.match(
    DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['core-design-system.md'],
    /Seamless frame, expressive content/
  );
  for (const [filename, html] of Object.entries(DEFAULT_REO_WORKS_DESIGN_EXAMPLE_FILES)) {
    assert.equal(
      html.includes(DEFAULT_REO_WORKS_DESIGN_TOKEN_CSS),
      true,
      `${filename} must embed the shared Reo token block`
    );
    assert.match(html, /var\(--background\)/, filename);
    assert.match(html, /\[data-theme='dark'\]/, filename);
    assert.doesNotMatch(
      html,
      /--color-background-primary|--color-text-primary|--shadow-card|--border-radius-md/,
      filename
    );
  }
  assert.match(DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['modules.md'], /diagram/);
  assert.match(DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['modules.md'], /mockup/);
  assert.match(
    DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['interaction-patterns.md'],
    /workspace\.read\(\)\.workspace\.memories/
  );
  assert.match(
    DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['interaction-patterns.md'],
    /readMemoryDetail\(\{ memoryId \}\)/
  );
  assert.doesNotMatch(
    DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['interaction-patterns.md'],
    /do not read live Reo data/i
  );
  assert.match(
    DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['svg-and-diagrams.md'],
    /viewBox="0 0 680 H"/
  );
  assert.match(DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['charts.md'], /native SVG/);
  assert.match(
    DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['mockups-and-art.md'],
    /Creative and art works/
  );
  for (const text of Object.values(DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES)) {
    assert.doesNotMatch(text, /Michaelliv|pi-generative-ui|github\.com/);
  }
});

test('managed reo-doctor skill remains recovery-only guidance', () => {
  assert.match(DEFAULT_REO_DOCTOR_SKILL_MD, /Recovery-only/);
  assert.match(DEFAULT_REO_DOCTOR_SKILL_MD, /Run it only after Reo reports needs-review/);
  assert.match(
    DEFAULT_REO_DOCTOR_SKILL_MD,
    /For ordinary editing, creation, rename or move tasks, use `skills\/reo-edit\/SKILL\.md` first/
  );
  assert.match(DEFAULT_REO_DOCTOR_SKILL_MD, /workspace-relative paths and recovery hints/);
  assert.doesNotMatch(DEFAULT_REO_DOCTOR_SKILL_MD, /before every edit/i);
});

test('open workspace silently restores missing Reo agent managed config', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-agent-config-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Agent config repair',
    description: '',
    createWorkspaceId: () => 'ws_agent_config_repair',
    now: () => '2026-05-26T12:43:00.000Z',
  });
  await rm(path.join(root, 'AGENTS.md'), { force: true });
  await rm(path.join(root, 'skills'), { force: true, recursive: true });

  const opened = await openWorkspaceFiles({ rootPath: root });

  assert.equal(opened.ok, true);
  await assert.rejects(stat(path.join(root, 'AGENTS.md')));
  assert.equal(await readFile(path.join(root, '.reo', 'REO.md'), 'utf8'), DEFAULT_WORKSPACE_REO_MD);
  assert.equal(
    (await readFile(path.join(root, 'skills', 'reo-doctor', 'SKILL.md'), 'utf8')).includes(
      'name: reo-doctor'
    ),
    true
  );
  assert.equal(
    (await readFile(path.join(root, 'skills', 'reo-edit', 'SKILL.md'), 'utf8')).includes(
      'name: reo-edit'
    ),
    true
  );
  assert.equal(
    (await readFile(path.join(root, 'skills', 'reo-cover-image', 'SKILL.md'), 'utf8')).includes(
      'name: reo-cover-image'
    ),
    true
  );
  assert.equal(
    (await readFile(path.join(root, 'skills', 'reo-cover-aesthetic', 'SKILL.md'), 'utf8')).includes(
      'name: reo-cover-aesthetic'
    ),
    true
  );
  assert.equal(
    (await readFile(path.join(root, 'skills', 'reo-works', 'SKILL.md'), 'utf8')).includes(
      'name: reo-works'
    ),
    true
  );
  assert.equal(
    (await readFile(path.join(root, 'skills', 'reo-works-design', 'SKILL.md'), 'utf8')).includes(
      'name: reo-works-design'
    ),
    true
  );
  await stat(path.join(root, 'skills', 'reo-works', 'references', 'file-contract.md'));
  await stat(path.join(root, 'skills', 'reo-works-design', 'references', 'modules.md'));
  await stat(path.join(root, 'skills', 'reo-works-design', 'references', 'svg-and-diagrams.md'));
  await stat(path.join(root, 'skills', 'reo-doctor', 'scripts', 'reo-doctor.mjs'));
});

test('open workspace preserves custom AGENTS content while repairing Reo-owned config', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-custom-agents-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Custom agents',
    description: '',
    createWorkspaceId: () => 'ws_custom_agents',
    now: () => '2026-05-26T12:43:00.000Z',
  });
  const customAgents = '# 用户规则\n\n保留我的长期偏好。\n';
  await writeFile(path.join(root, 'AGENTS.md'), customAgents);
  await mkdir(path.join(root, 'skills', 'user-skill'), { recursive: true });
  await writeFile(path.join(root, 'skills', 'user-skill', 'SKILL.md'), 'user skill stays\n');
  await writeFile(path.join(root, 'skills', 'reo-user-extension.md'), 'user reo extension stays\n');
  await writeFile(
    path.join(root, 'skills', 'reo-edit', 'SKILL.md'),
    'user changed official skill\n'
  );
  await mkdir(path.join(root, 'skills', 'reo-works', 'references'), { recursive: true });
  await writeFile(
    path.join(root, 'skills', 'reo-works', 'references', 'quality-check.md'),
    'old quality check\n'
  );

  const opened = await openWorkspaceFiles({ rootPath: root });

  assert.equal(opened.ok, true);
  const agentsText = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.equal(agentsText, customAgents);
  assert.equal(await readFile(path.join(root, '.reo', 'REO.md'), 'utf8'), DEFAULT_WORKSPACE_REO_MD);
  await stat(path.join(root, 'skills', 'reo-edit', 'SKILL.md'));
  assert.equal(
    await readFile(path.join(root, 'skills', 'reo-edit', 'SKILL.md'), 'utf8'),
    DEFAULT_REO_EDIT_SKILL_MD
  );
  await stat(path.join(root, 'skills', 'reo-cover-image', 'SKILL.md'));
  await stat(path.join(root, 'skills', 'reo-cover-aesthetic', 'SKILL.md'));
  await stat(path.join(root, 'skills', 'reo-works', 'SKILL.md'));
  await stat(path.join(root, 'skills', 'reo-works-design', 'SKILL.md'));
  await stat(path.join(root, 'skills', 'reo-works', 'references', 'runtime-contract-check.md'));
  await assert.rejects(
    stat(path.join(root, 'skills', 'reo-works', 'references', 'quality-check.md'))
  );
  await stat(
    path.join(root, 'skills', 'reo-works-design', 'references', 'interaction-patterns.md')
  );
  await stat(path.join(root, 'skills', 'reo-doctor', 'scripts', 'reo-doctor.mjs'));
  assert.equal(
    await readFile(path.join(root, 'skills', 'user-skill', 'SKILL.md'), 'utf8'),
    'user skill stays\n'
  );
  assert.equal(
    await readFile(path.join(root, 'skills', 'reo-user-extension.md'), 'utf8'),
    'user reo extension stays\n'
  );
});

test('open workspace does not rewrite legacy Reo AGENTS content', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-legacy-agents-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Legacy agents',
    description: '',
    createWorkspaceId: () => 'ws_legacy_agents',
    now: () => '2026-05-26T12:43:00.000Z',
  });
  await writeFile(
    path.join(root, 'AGENTS.md'),
    [
      '# Reo 记忆空间 Agent 入口',
      '',
      '## 读写边界',
      '',
      '如果要精确表达 Tiptap JSON，编辑同级 `content.tiptap.json`：',
      '',
      '- `source.hash` 表示当前 Markdown body 或 audio transcript body 的 hash。',
      '',
      '## 验证建议',
      '',
      '- 对高级格式同时检查 Markdown 和 `content.tiptap.json` 是否存在并表达同一正文。',
      '',
    ].join('\n')
  );
  const beforeHash = await sha256(path.join(root, 'AGENTS.md'));

  const opened = await openWorkspaceFiles({ rootPath: root });

  assert.equal(opened.ok, true);
  const agentsText = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.equal(await sha256(path.join(root, 'AGENTS.md')), beforeHash);
  assert.match(agentsText, /source\.hash/);
  assert.match(agentsText, /如果要精确表达 Tiptap JSON/);
  assert.equal(await readFile(path.join(root, '.reo', 'REO.md'), 'utf8'), DEFAULT_WORKSPACE_REO_MD);
});

test('open workspace replaces official Reo skill path collisions and preserves user skills', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-skill-collision-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Skill collision',
    description: '',
    createWorkspaceId: () => 'ws_skill_collision',
    now: () => '2026-05-26T12:43:00.000Z',
  });
  await rm(path.join(root, 'skills', 'reo-edit'), { force: true, recursive: true });
  await writeFile(path.join(root, 'skills', 'reo-edit'), 'same official skill name\n');
  await mkdir(path.join(root, 'skills', 'reo-user-helper'), { recursive: true });
  await writeFile(path.join(root, 'skills', 'reo-user-helper', 'SKILL.md'), 'user helper\n');

  const opened = await openWorkspaceFiles({ rootPath: root });

  assert.equal(opened.ok, true);
  assert.equal(
    await readFile(path.join(root, 'skills', 'reo-edit', 'SKILL.md'), 'utf8'),
    DEFAULT_REO_EDIT_SKILL_MD
  );
  assert.equal(
    await readFile(path.join(root, 'skills', 'reo-user-helper', 'SKILL.md'), 'utf8'),
    'user helper\n'
  );
});

test('open workspace does not recursively remove user directories at stale managed file names', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-stale-managed-dir-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Stale managed directory',
    description: '',
    createWorkspaceId: () => 'ws_stale_managed_dir',
    now: () => '2026-05-26T12:43:00.000Z',
  });
  const staleRuntimeDirectory = path.join(
    root,
    'skills',
    'reo-generative-runtime',
    'scripts',
    'migrate-runtime.mjs'
  );
  const staleWorksDirectory = path.join(
    root,
    'skills',
    'reo-works',
    'references',
    'quality-check.md'
  );
  await mkdir(staleRuntimeDirectory, { recursive: true });
  await writeFile(path.join(staleRuntimeDirectory, 'user-note.txt'), 'runtime user directory\n');
  await mkdir(staleWorksDirectory, { recursive: true });
  await writeFile(path.join(staleWorksDirectory, 'user-note.txt'), 'works user directory\n');

  const opened = await openWorkspaceFiles({ rootPath: root });

  assert.equal(opened.ok, true);
  assert.equal(
    await readFile(path.join(staleRuntimeDirectory, 'user-note.txt'), 'utf8'),
    'runtime user directory\n'
  );
  assert.equal(
    await readFile(path.join(staleWorksDirectory, 'user-note.txt'), 'utf8'),
    'works user directory\n'
  );
});

test('reo-doctor skill script repairs managed config without overwriting custom AGENTS content', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-doctor-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Doctor script',
    description: '',
    createWorkspaceId: () => 'ws_doctor_script',
    now: () => '2026-05-26T12:43:00.000Z',
  });
  await writeFile(path.join(root, 'AGENTS.md'), '# 用户规则\n\n只修改当前任务需要的文件。\n');
  await rm(path.join(root, '.reo', 'REO.md'), { force: true });
  await rm(path.join(root, 'skills', 'reo-doctor', 'SKILL.md'), { force: true });
  await rm(path.join(root, 'skills', 'reo-edit', 'SKILL.md'), { force: true });
  await rm(path.join(root, 'skills', 'reo-cover-image', 'SKILL.md'), { force: true });
  await rm(path.join(root, 'skills', 'reo-cover-aesthetic', 'SKILL.md'), { force: true });
  await rm(path.join(root, 'skills', 'reo-generative-runtime', 'SKILL.md'), { force: true });
  await rm(path.join(root, 'skills', 'reo-works', 'SKILL.md'), { force: true });
  await rm(path.join(root, 'skills', 'reo-works-design', 'SKILL.md'), { force: true });
  await rm(path.join(root, 'skills', 'reo-generative-runtime', 'references'), {
    force: true,
    recursive: true,
  });
  await rm(path.join(root, 'skills', 'reo-generative-runtime', 'scripts'), {
    force: true,
    recursive: true,
  });
  await rm(path.join(root, 'skills', 'reo-works', 'references'), {
    force: true,
    recursive: true,
  });
  await rm(path.join(root, 'skills', 'reo-works-design', 'references', 'charts.md'), {
    force: true,
  });
  await rm(path.join(root, 'skills', 'reo-works-design', 'examples', 'reactive-binding.html'), {
    force: true,
  });

  const result = spawnSync(
    process.execPath,
    [path.join(root, 'skills', 'reo-doctor', 'scripts', 'reo-doctor.mjs'), '--fix'],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout) as {
    readonly ok: boolean;
    readonly repaired: {
      readonly reoMd: boolean;
      readonly doctorSkill: boolean;
      readonly editSkill: boolean;
      readonly coverImageSkill: boolean;
      readonly coverAestheticSkill: boolean;
      readonly runtimeSkill: boolean;
      readonly runtimeReferences: readonly string[];
      readonly runtimeScripts: readonly string[];
      readonly worksSkill: boolean;
      readonly worksDesignSkill: boolean;
      readonly worksReferences: readonly string[];
      readonly worksDesignReferences: readonly string[];
      readonly worksDesignExamples: readonly string[];
    };
  };
  assert.equal(report.ok, true);
  assert.equal(report.repaired.reoMd, true);
  assert.equal(report.repaired.doctorSkill, true);
  assert.equal(report.repaired.editSkill, true);
  assert.equal(report.repaired.coverImageSkill, true);
  assert.equal(report.repaired.coverAestheticSkill, true);
  assert.equal(report.repaired.runtimeSkill, true);
  assert.deepEqual([...report.repaired.runtimeReferences].sort(), [
    'bridge-api.md',
    'bundle-contract.md',
    'state-and-storage.md',
    'templates.md',
    'validation.md',
  ]);
  assert.deepEqual(
    [...report.repaired.runtimeScripts].sort(),
    Object.keys(DEFAULT_REO_GENERATIVE_RUNTIME_SCRIPT_FILES).sort()
  );
  assert.equal(report.repaired.worksSkill, true);
  assert.equal(report.repaired.worksDesignSkill, true);
  assert.deepEqual([...report.repaired.worksReferences].sort(), [
    'file-contract.md',
    'runtime-contract-check.md',
    'workflows.md',
  ]);
  assert.deepEqual(report.repaired.worksDesignReferences, ['charts.md']);
  assert.deepEqual(report.repaired.worksDesignExamples, ['reactive-binding.html']);
  const agentsText = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.equal(agentsText, '# 用户规则\n\n只修改当前任务需要的文件。\n');
  assert.equal(await readFile(path.join(root, '.reo', 'REO.md'), 'utf8'), DEFAULT_WORKSPACE_REO_MD);
  assert.match(
    await readFile(path.join(root, 'skills', 'reo-doctor', 'SKILL.md'), 'utf8'),
    /^name: reo-doctor/m
  );
  assert.match(
    await readFile(path.join(root, 'skills', 'reo-edit', 'SKILL.md'), 'utf8'),
    /^name: reo-edit/m
  );
  assert.match(
    await readFile(path.join(root, 'skills', 'reo-cover-image', 'SKILL.md'), 'utf8'),
    /^name: reo-cover-image/m
  );
  assert.match(
    await readFile(path.join(root, 'skills', 'reo-cover-aesthetic', 'SKILL.md'), 'utf8'),
    /^name: reo-cover-aesthetic/m
  );
  assert.equal(
    await readFile(path.join(root, 'skills', 'reo-generative-runtime', 'SKILL.md'), 'utf8'),
    DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD
  );
  assert.match(
    await readFile(path.join(root, 'skills', 'reo-works', 'SKILL.md'), 'utf8'),
    /^name: reo-works/m
  );
  assert.match(
    await readFile(
      path.join(root, 'skills', 'reo-generative-runtime', 'scripts', 'validate-runtime.mjs'),
      'utf8'
    ),
    /validate-runtime/
  );
  for (const [filename, expected] of Object.entries(DEFAULT_REO_GENERATIVE_RUNTIME_SCRIPT_FILES)) {
    assert.equal(
      await readFile(
        path.join(root, 'skills', 'reo-generative-runtime', 'scripts', filename),
        'utf8'
      ),
      expected
    );
  }
  const repairedScaffold = spawnSync(
    process.execPath,
    [
      path.join(root, 'skills', 'reo-generative-runtime', 'scripts', 'scaffold-runtime.mjs'),
      'doctor-repaired-work',
      '--title',
      'Doctor repaired work',
      '--template',
      'dashboard',
    ],
    { cwd: root, encoding: 'utf8' }
  );
  assert.equal(repairedScaffold.status, 0, repairedScaffold.stderr || repairedScaffold.stdout);
  const repairedValidate = spawnSync(
    process.execPath,
    [
      path.join(root, 'skills', 'reo-generative-runtime', 'scripts', 'validate-runtime.mjs'),
      'doctor-repaired-work',
    ],
    { cwd: root, encoding: 'utf8' }
  );
  assert.equal(repairedValidate.status, 0, repairedValidate.stderr || repairedValidate.stdout);
  assert.match(
    await readFile(path.join(root, 'skills', 'reo-works-design', 'SKILL.md'), 'utf8'),
    /^name: reo-works-design/m
  );
  assert.match(
    await readFile(
      path.join(root, 'skills', 'reo-works', 'references', 'file-contract.md'),
      'utf8'
    ),
    /kind: artifact/
  );
  assert.match(
    await readFile(
      path.join(root, 'skills', 'reo-works-design', 'references', 'charts.md'),
      'utf8'
    ),
    /native SVG/
  );
  assert.match(
    await readFile(
      path.join(root, 'skills', 'reo-works-design', 'references', 'core-design-system.md'),
      'utf8'
    ),
    /--background: var\(--surface-1\)/
  );
  assert.match(
    await readFile(
      path.join(root, 'skills', 'reo-works-design', 'examples', 'reactive-binding.html'),
      'utf8'
    ),
    /复习强度/
  );
});

test('reo-doctor skill script does not recursively remove stale managed file directories', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-doctor-stale-managed-dir-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Doctor stale managed directory',
    description: '',
    createWorkspaceId: () => 'ws_doctor_stale_managed_dir',
    now: () => '2026-05-26T12:43:00.000Z',
  });
  const staleRuntimeDirectory = path.join(
    root,
    'skills',
    'reo-generative-runtime',
    'scripts',
    'migrate-runtime.mjs'
  );
  const staleWorksDirectory = path.join(
    root,
    'skills',
    'reo-works',
    'references',
    'quality-check.md'
  );
  await mkdir(staleRuntimeDirectory, { recursive: true });
  await writeFile(path.join(staleRuntimeDirectory, 'user-note.txt'), 'runtime user directory\n');
  await mkdir(staleWorksDirectory, { recursive: true });
  await writeFile(path.join(staleWorksDirectory, 'user-note.txt'), 'works user directory\n');

  const result = spawnSync(
    process.execPath,
    [path.join(root, 'skills', 'reo-doctor', 'scripts', 'reo-doctor.mjs'), '--fix'],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(
    await readFile(path.join(staleRuntimeDirectory, 'user-note.txt'), 'utf8'),
    'runtime user directory\n'
  );
  assert.equal(
    await readFile(path.join(staleWorksDirectory, 'user-note.txt'), 'utf8'),
    'works user directory\n'
  );
});

test('reo-doctor skill script reports unresolved needs-review entries', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-doctor-review-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Doctor review',
    description: '',
    createWorkspaceId: () => 'ws_doctor_review',
    now: () => '2026-05-26T12:43:00.000Z',
  });
  await mkdir(path.join(root, '.reo', 'review'), { recursive: true });
  await writeFile(
    path.join(root, '.reo', 'review', 'needs-review.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        updatedAt: '2026-05-27T08:00:00.000Z',
        summary: {
          needsReviewCount: 1,
          markdownCandidateCount: 0,
          tiptapSidecarCount: 1,
        },
        entries: [
          {
            category: 'tiptap-sidecar',
            reason: 'content-conflict',
            objectType: 'segment',
            kind: 'note',
            paths: [
              'memories/mem_review/segments/seg_review/segment.md',
              'memories/mem_review/segments/seg_review/content.tiptap.json',
            ],
          },
        ],
      },
      null,
      2
    )}\n`
  );

  const result = spawnSync(
    process.execPath,
    [path.join(root, 'skills', 'reo-doctor', 'scripts', 'reo-doctor.mjs')],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout) as {
    readonly ok: boolean;
    readonly needsReview?: {
      readonly count: number;
      readonly entries: Array<{
        readonly category: string;
        readonly paths: readonly string[];
        readonly reason: string;
        readonly recoveryHint: string;
      }>;
    };
    readonly issues: Array<{ readonly code: string; readonly path?: string }>;
  };
  assert.equal(report.ok, false);
  assert.equal(report.needsReview?.count, 1);
  assert.deepEqual(report.needsReview?.entries, [
    {
      category: 'tiptap-sidecar',
      kind: 'note',
      objectType: 'segment',
      paths: [
        'memories/mem_review/segments/seg_review/segment.md',
        'memories/mem_review/segments/seg_review/content.tiptap.json',
      ],
      reason: 'content-conflict',
      recoveryHint:
        'Both Markdown and content.tiptap.json changed. Choose one source; do not guess a merge.',
    },
  ]);
  assert.deepEqual(report.issues, [
    {
      code: 'needs-review',
      path: '.reo/review/needs-review.json',
    },
  ]);
});

test('reo-doctor skill script reports orphan object mirrors outside active files and trash', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-doctor-orphan-object-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Doctor orphan object',
    description: '',
    createWorkspaceId: () => 'ws_doctor_orphan_object',
    now: () => '2026-06-05T22:40:00.000Z',
  });
  await mkdir(path.join(root, '.reo', 'objects', 'segments'), { recursive: true });
  await writeFile(
    path.join(root, '.reo', 'objects', 'segments', 'seg_orphan.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'segment',
        workspaceId: 'ws_doctor_orphan_object',
        memoryId: 'mem_missing',
        segmentId: 'seg_orphan',
        kind: 'note',
        createdAt: '2026-06-05T22:40:00.000Z',
        finalizedAt: '2026-06-05T22:40:00.000Z',
        updatedAt: '2026-06-05T22:40:00.000Z',
      },
      null,
      2
    )}\n`
  );
  await writeFile(
    path.join(root, '.reo', 'objects', 'segments', 'seg_in_trash.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'segment',
        workspaceId: 'ws_doctor_orphan_object',
        memoryId: 'mem_missing',
        segmentId: 'seg_in_trash',
        kind: 'note',
        createdAt: '2026-06-05T22:40:00.000Z',
        finalizedAt: '2026-06-05T22:40:00.000Z',
        updatedAt: '2026-06-05T22:40:00.000Z',
      },
      null,
      2
    )}\n`
  );
  await mkdir(path.join(root, '.reo', 'trash', 'segments', 'seg_in_trash'), {
    recursive: true,
  });
  await writeFile(
    path.join(root, '.reo', 'trash', 'segments', 'seg_in_trash', 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { id: 'seg_in_trash', title: 'Trashed segment', kind: 'note' },
      content: '# Trashed segment\n',
    })
  );

  const result = spawnSync(
    process.execPath,
    [path.join(root, 'skills', 'reo-doctor', 'scripts', 'reo-doctor.mjs')],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout) as {
    readonly ok: boolean;
    readonly orphanObjects?: {
      readonly count: number;
      readonly entries: Array<{
        readonly code: string;
        readonly manifestPath: string;
        readonly objectId: string;
        readonly objectType: string;
        readonly recoveryHint: string;
      }>;
    };
    readonly issues: Array<{ readonly code: string; readonly path?: string }>;
  };
  assert.equal(report.ok, false);
  assert.deepEqual(report.orphanObjects, {
    count: 1,
    entries: [
      {
        code: 'orphan-object-mirror',
        manifestPath: '.reo/objects/segments/seg_orphan.json',
        objectId: 'seg_orphan',
        objectType: 'segment',
        recoveryHint:
          'This .reo object mirror has no active semantic file and is not in trash. Preserve user content, then refresh Reo or remove the stale mirror only after confirming the object is gone.',
      },
    ],
  });
  assert.deepEqual(report.issues, [
    {
      code: 'orphan-object-mirror',
      path: '.reo/objects/segments/seg_orphan.json',
    },
  ]);
});

test('reo-doctor skill script falls back for inherited review reasons', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-doctor-review-reason-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Doctor review reason',
    description: '',
    createWorkspaceId: () => 'ws_doctor_review_reason',
    now: () => '2026-05-26T12:43:00.000Z',
  });
  await mkdir(path.join(root, '.reo', 'review'), { recursive: true });
  await writeFile(
    path.join(root, '.reo', 'review', 'needs-review.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        updatedAt: '2026-05-27T08:00:00.000Z',
        summary: {
          needsReviewCount: 1,
          markdownCandidateCount: 0,
          tiptapSidecarCount: 1,
        },
        entries: [
          {
            category: 'tiptap-sidecar',
            reason: '__proto__',
            paths: ['memories/mem_review/segments/seg_review/content.tiptap.json'],
          },
        ],
      },
      null,
      2
    )}\n`
  );

  const result = spawnSync(
    process.execPath,
    [path.join(root, 'skills', 'reo-doctor', 'scripts', 'reo-doctor.mjs')],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout) as {
    readonly needsReview?: {
      readonly entries: Array<{
        readonly reason: string;
        readonly recoveryHint: string;
      }>;
    };
  };
  assert.deepEqual(report.needsReview?.entries, [
    {
      paths: ['memories/mem_review/segments/seg_review/content.tiptap.json'],
      category: 'tiptap-sidecar',
      reason: '__proto__',
      recoveryHint: WORKSPACE_REVIEW_FALLBACK_RECOVERY_HINT,
    },
  ]);
});

test('reo-doctor skill script replaces official skill symlink without touching AGENTS', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-doctor-symlink-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-doctor-outside-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Doctor script symlink',
    description: '',
    createWorkspaceId: () => 'ws_doctor_script_symlink',
    now: () => '2026-05-26T12:43:00.000Z',
  });
  const outsideAgents = path.join(outside, 'outside-agents.md');
  const outsideSkill = path.join(outside, 'outside-skill.md');
  await writeFile(outsideAgents, 'outside agents must stay unchanged\n');
  await writeFile(outsideSkill, 'outside skill must stay unchanged\n');
  await rm(path.join(root, 'AGENTS.md'), { force: true });
  await symlink(outsideAgents, path.join(root, 'AGENTS.md'));
  await rm(path.join(root, 'skills', 'reo-edit', 'SKILL.md'), { force: true });
  await symlink(outsideSkill, path.join(root, 'skills', 'reo-edit', 'SKILL.md'));

  const result = spawnSync(
    process.execPath,
    [path.join(root, 'skills', 'reo-doctor', 'scripts', 'reo-doctor.mjs'), '--fix'],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout) as {
    readonly ok: boolean;
    readonly repaired: {
      readonly reoMd: boolean;
      readonly editSkill: boolean;
    };
    readonly issues: readonly { readonly path: string; readonly code: string }[];
  };
  assert.equal(report.ok, true);
  assert.equal(report.repaired.reoMd, false);
  assert.equal(report.repaired.editSkill, true);
  assert.deepEqual(report.issues, []);
  assert.equal(await readFile(outsideAgents, 'utf8'), 'outside agents must stay unchanged\n');
  assert.equal(await readFile(outsideSkill, 'utf8'), 'outside skill must stay unchanged\n');
  assert.equal(
    await readFile(path.join(root, 'skills', 'reo-edit', 'SKILL.md'), 'utf8'),
    DEFAULT_REO_EDIT_SKILL_MD
  );
});

test('open workspace does not update AGENTS before rejecting unsafe managed skill paths', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-unsafe-skills-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Unsafe skills',
    description: '',
    createWorkspaceId: () => 'ws_unsafe_skills',
    now: () => '2026-05-26T12:43:00.000Z',
  });
  const customAgents = '# 用户规则\n\n不要在失败打开时被改写。\n';
  await writeFile(path.join(root, 'AGENTS.md'), customAgents);
  await rm(path.join(root, 'skills'), { force: true, recursive: true });
  await writeFile(path.join(root, 'skills'), 'not a directory\n');

  const opened = await openWorkspaceFiles({ rootPath: root });

  assert.equal(opened.ok, false);
  assert.equal(await readFile(path.join(root, 'AGENTS.md'), 'utf8'), customAgents);
});

test('corrupt index rebuilds while corrupt workspace metadata blocks writes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '可重建索引',
    description: '',
    createWorkspaceId: () => 'ws_rebuild',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFile(path.join(root, '.reo', 'index.json'), '{not json');

  assert.deepEqual(await openWorkspaceFiles({ rootPath: root }), {
    ok: true,
    snapshot: {
      workspaceId: 'ws_rebuild',
      title: path.basename(root),
      description: '',
      memories: [],
    },
  });

  const corruptRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-corrupt-meta-'));
  await mkdir(path.join(corruptRoot, '.reo'), { recursive: true });
  await writeFile(path.join(corruptRoot, '.reo', 'workspace.json'), '{not json');

  const corrupt = await openWorkspaceFiles({ rootPath: corruptRoot });
  assert.equal(corrupt.ok, false);
  if (!corrupt.ok) {
    assert.equal(corrupt.error.code, 'ERR_WORKSPACE_METADATA_INVALID');
  }
  await assert.rejects(stat(path.join(corruptRoot, 'AGENTS.md')));
});

test('open workspace rejects symlinked workspace metadata', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-metadata-symlink-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-metadata-outside-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '元数据链接',
    description: '',
    createWorkspaceId: () => 'ws_metadata_link',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const outsideMetadata = path.join(outside, 'workspace.json');
  await writeFile(
    outsideMetadata,
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_outside',
      title: 'Outside',
      description: '',
      createdAt: '2026-05-06T13:08:00.000Z',
    })
  );
  await rm(path.join(root, '.reo', 'workspace.json'));
  await symlink(outsideMetadata, path.join(root, '.reo', 'workspace.json'));

  const opened = await openWorkspaceFiles({ rootPath: root });

  assert.equal(opened.ok, false);
  if (!opened.ok) {
    assert.equal(opened.error.code, 'ERR_WORKSPACE_METADATA_INVALID');
  }
});

test('open workspace rejects workspace metadata when .reo changes during read', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-metadata-parent-swap-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '元数据父目录交换',
    description: '',
    createWorkspaceId: () => 'ws_metadata_parent_swap',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  setBeforeWorkspaceJsonNoFollowFinalAssertForTest(async (filePath) => {
    if (path.basename(filePath) !== 'workspace.json') {
      return;
    }
    setBeforeWorkspaceJsonNoFollowFinalAssertForTest(null);
    await rename(path.join(root, '.reo'), path.join(root, '.reo-preserved'));
    await mkdir(path.join(root, '.reo'));
    await writeFile(
      path.join(root, '.reo', 'workspace.json'),
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'ws_replaced',
        title: 'Replaced',
        description: '',
        createdAt: '2026-05-06T13:08:00.000Z',
      })
    );
  });

  try {
    const opened = await openWorkspaceFiles({ rootPath: root });
    assert.equal(opened.ok, false);
    if (!opened.ok) {
      assert.equal(opened.error.code, 'ERR_WORKSPACE_METADATA_INVALID');
    }
  } finally {
    setBeforeWorkspaceJsonNoFollowFinalAssertForTest(null);
  }
});

test('open workspace rebuilds instead of trusting a symlinked index', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-index-symlink-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-index-outside-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '索引链接',
    description: '',
    createWorkspaceId: () => 'ws_index_link',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const outsideIndex = path.join(outside, 'index.json');
  await writeFile(outsideIndex, '{\n  "schemaVersion": 1,\n  "memories": []\n}\n');
  await rm(path.join(root, '.reo', 'index.json'));
  await symlink(outsideIndex, path.join(root, '.reo', 'index.json'));

  const opened = await openWorkspaceFiles({ rootPath: root });

  assert.equal(opened.ok, true);
  const indexEntry = await lstat(path.join(root, '.reo', 'index.json'));
  assert.equal(indexEntry.isSymbolicLink(), false);
  assert.equal(
    await readFile(outsideIndex, 'utf8'),
    '{\n  "schemaVersion": 1,\n  "memories": []\n}\n'
  );
});

test('corrupt index rebuilds finalized memory summaries from workspace files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-rebuild-memories-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '录音索引',
    description: '',
    createWorkspaceId: () => 'ws_rebuild_memories',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_rebuild_memories',
    memoryId: 'mem_20260506_000001',
    segmentId: 'seg_20260506_000001',
    title: '重建录音',
    audio: new Uint8Array([1, 2, 3]),
    durationMs: 12_000,
  });
  await writeFile(path.join(root, '.reo', 'index.json'), '{not json');

  const expectedMemory = {
    memoryId: 'mem_20260506_000001',
    title: '重建录音',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:09:00.000Z',
    segmentCount: 1,
    audioSegmentCount: 1,
    noteSegmentCount: 0,
    artifactSegmentCount: 0,
    audioDurationMs: 12_000,
    audioByteLength: 3,
    hasAudioTranscript: false,
    hasAnyNote: false,
    supplementCount: 0,
    cover: { source: 'default' },
  };
  assert.deepEqual(await openWorkspaceFiles({ rootPath: root }), {
    ok: true,
    snapshot: {
      workspaceId: 'ws_rebuild_memories',
      title: path.basename(root),
      description: '',
      memories: [expectedMemory],
    },
  });
  assert.deepEqual(JSON.parse(await readFile(path.join(root, '.reo', 'index.json'), 'utf8')), {
    schemaVersion: 1,
    memories: [expectedMemory],
  });
});

test('open workspace reconciles a corrupt index from one read model rebuild', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-rebuild-index-once-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '单次索引重建',
    description: '',
    createWorkspaceId: () => 'ws_rebuild_once',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_rebuild_once',
    memoryId: 'mem_rebuild_once',
    segmentId: 'seg_rebuild_once',
    title: '单次索引重建',
    audio: new Uint8Array([1, 2, 3]),
    durationMs: 3000,
  });
  await writeFile(path.join(root, '.reo', 'index.json'), '{not json');

  let readModelRebuilds = 0;
  setBeforeReadModelReaddirForTest(() => {
    readModelRebuilds += 1;
  });

  try {
    const opened = await openWorkspaceFiles({ rootPath: root });

    assert.equal(opened.ok, true);
    assert.equal(readModelRebuilds, 1);
  } finally {
    setBeforeReadModelReaddirForTest(null);
  }
});

test('index snapshot read uses a valid index without scanning finalized memory files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-fast-open-index-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '快速进入',
    description: '',
    createWorkspaceId: () => 'ws_fast_open',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const indexedMemory = {
    memoryId: 'mem_fast_open',
    title: '已索引记忆',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:09:00.000Z',
    segmentCount: 1,
    audioSegmentCount: 1,
    noteSegmentCount: 0,
    artifactSegmentCount: 0,
    audioDurationMs: 3000,
    audioByteLength: 3,
    hasAudioTranscript: false,
    hasAnyNote: false,
    supplementCount: 0,
    cover: { source: 'default' },
  };
  await writeFile(
    path.join(root, '.reo', 'index.json'),
    `${JSON.stringify({ schemaVersion: 1, memories: [indexedMemory] }, null, 2)}\n`
  );
  setBeforeReadModelReaddirForTest(() => {
    throw new Error('open should not rebuild the read model when index is valid');
  });

  try {
    assert.deepEqual(
      await readWorkspaceSnapshotFromIndex({
        rootPath: root,
        workspaceId: 'ws_fast_open',
      }),
      {
        ok: true,
        snapshot: {
          workspaceId: 'ws_fast_open',
          title: path.basename(root),
          description: '',
          memories: [indexedMemory],
        },
      }
    );
  } finally {
    setBeforeReadModelReaddirForTest(null);
  }
});

test('workspace index snapshot reads a valid index without rebuilding finalized memory files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-index-snapshot-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '索引快照',
    description: '',
    createWorkspaceId: () => 'ws_index_snapshot',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const indexedMemory = {
    memoryId: 'mem_index_snapshot',
    title: '索引里的记忆',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:09:00.000Z',
    segmentCount: 1,
    audioSegmentCount: 1,
    noteSegmentCount: 0,
    artifactSegmentCount: 0,
    audioDurationMs: 3000,
    audioByteLength: 3,
    hasAudioTranscript: false,
    hasAnyNote: false,
    supplementCount: 0,
    cover: { source: 'default' },
  };
  await writeFile(
    path.join(root, '.reo', 'index.json'),
    `${JSON.stringify({ schemaVersion: 1, memories: [indexedMemory] }, null, 2)}\n`
  );
  setBeforeReadModelReaddirForTest(() => {
    throw new Error('index snapshot should not rebuild the read model when index is valid');
  });

  try {
    assert.deepEqual(
      await readWorkspaceSnapshotFromIndex({
        rootPath: root,
        workspaceId: 'ws_index_snapshot',
      }),
      {
        ok: true,
        snapshot: {
          workspaceId: 'ws_index_snapshot',
          title: path.basename(root),
          description: '',
          memories: [indexedMemory],
        },
      }
    );
  } finally {
    setBeforeReadModelReaddirForTest(null);
  }
});

test('open workspace fails without replacing index when memories cannot be read', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-unreadable-memories-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '不可读目录',
    description: '',
    createWorkspaceId: () => 'ws_unreadable_memories',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_unreadable_memories',
    memoryId: 'mem_20260506_unreadable',
    segmentId: 'seg_20260506_unreadable',
    title: '不可读录音',
    audio: new Uint8Array([1, 2, 3]),
    durationMs: 3000,
  });
  await openWorkspaceFiles({ rootPath: root });
  const indexPath = path.join(root, '.reo', 'index.json');
  const indexBefore = await readFile(indexPath, 'utf8');

  await chmod(path.join(root, 'memories'), 0o000);
  try {
    const opened = await openWorkspaceFiles({ rootPath: root });
    assert.equal(opened.ok, false);
    if (!opened.ok) {
      assert.equal(opened.error.code, 'ERR_WORKSPACE_OPEN_FAILED');
    }
  } finally {
    await chmod(path.join(root, 'memories'), 0o700);
  }

  assert.equal(await readFile(indexPath, 'utf8'), indexBefore);
});

test('open workspace reconciles a stale valid index from file truth', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-stale-index-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '合法但陈旧索引',
    description: '',
    createWorkspaceId: () => 'ws_stale_index',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_stale_index',
    memoryId: 'mem_20260506_000002',
    segmentId: 'seg_20260506_000002',
    title: '崩溃后录音',
    audio: new Uint8Array([4, 5, 6, 7]),
    durationMs: 34_000,
  });
  await writeFile(
    path.join(root, '.reo', 'index.json'),
    '{\n  "schemaVersion": 1,\n  "memories": []\n}\n'
  );

  const expectedMemory = {
    memoryId: 'mem_20260506_000002',
    title: '崩溃后录音',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:09:00.000Z',
    segmentCount: 1,
    audioSegmentCount: 1,
    noteSegmentCount: 0,
    artifactSegmentCount: 0,
    audioDurationMs: 34_000,
    audioByteLength: 4,
    hasAudioTranscript: false,
    hasAnyNote: false,
    supplementCount: 0,
    cover: { source: 'default' },
  };
  assert.deepEqual(await openWorkspaceFiles({ rootPath: root }), {
    ok: true,
    snapshot: {
      workspaceId: 'ws_stale_index',
      title: path.basename(root),
      description: '',
      memories: [expectedMemory],
    },
  });
  assert.deepEqual(JSON.parse(await readFile(path.join(root, '.reo', 'index.json'), 'utf8')), {
    schemaVersion: 1,
    memories: [expectedMemory],
  });

  assert.deepEqual(
    await readWorkspaceSnapshotFromFileTruth({
      rootPath: root,
      workspaceId: 'ws_stale_index',
    }),
    {
      ok: true,
      snapshot: {
        workspaceId: 'ws_stale_index',
        title: path.basename(root),
        description: '',
        memories: [expectedMemory],
      },
    }
  );
  assert.equal(
    JSON.parse(await readFile(path.join(root, '.reo', 'workspace.json'), 'utf8')).title,
    path.basename(root)
  );
  assert.deepEqual(JSON.parse(await readFile(path.join(root, '.reo', 'index.json'), 'utf8')), {
    schemaVersion: 1,
    memories: [expectedMemory],
  });
});

test('open workspace projects an externally created Memory without Reo manifests', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-external-memory-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '外部写回',
    description: '',
    createWorkspaceId: () => 'ws_external_memory',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const memoryId = 'mem_20260606_external';
  const memoryDirectory = path.join(root, 'memories', `${memoryId}--外部写回`);
  await mkdir(memoryDirectory, { recursive: true });
  await writeFile(
    path.join(memoryDirectory, 'memory.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'memory',
      data: { title: '外部写回' },
      content: '# 外部写回\n\nAgent created this Memory with ordinary files only.\n',
    })
  );
  await writeFile(
    path.join(root, '.reo', 'index.json'),
    '{\n  "schemaVersion": 1,\n  "memories": []\n}\n'
  );

  const opened = await openWorkspaceFiles({ rootPath: root });

  assert.equal(opened.ok, true);
  const [memory] = opened.ok ? opened.snapshot.memories : [];
  assert.ok(memory);
  assert.equal(memory.memoryId, memoryId);
  assert.equal(memory.title, '外部写回');
  assert.equal(typeof memory.createdAt, 'string');
  assert.equal(typeof memory.updatedAt, 'string');
  assert.equal(memory.segmentCount, 0);
  assert.equal(memory.audioSegmentCount, 0);
  assert.equal(memory.noteSegmentCount, 0);
  assert.equal(memory.artifactSegmentCount, 0);
  assert.equal(memory.audioDurationMs, 0);
  assert.equal(memory.audioByteLength, 0);
  assert.equal(memory.hasAudioTranscript, false);
  assert.equal(memory.hasAnyNote, false);
  assert.equal(memory.supplementCount, 0);
  assert.deepEqual(memory.cover, { source: 'default' });
  assert.equal(
    (await readFile(path.join(root, '.reo', 'objects', 'memories', `${memoryId}.json`), 'utf8'))
      .length > 0,
    true
  );
  assert.equal(
    JSON.parse(await readFile(path.join(root, '.reo', 'index.json'), 'utf8')).memories[0].memoryId,
    memoryId
  );
});

test('open workspace reports externally created invalid artifact candidates', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-external-invalid-artifact-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '外部非法作品',
    description: '',
    createWorkspaceId: () => 'ws_external_invalid_artifact',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const memoryId = 'mem_20260606_review';
  const segmentId = 'seg_20260606_missing_entry';
  const memoryDirectory = path.join(root, 'memories', `${memoryId}--外部候选`);
  const segmentDirectory = path.join(memoryDirectory, 'segments', `${segmentId}--缺入口作品`);
  await mkdir(segmentDirectory, { recursive: true });
  await writeFile(
    path.join(memoryDirectory, 'memory.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'memory',
      data: { title: '外部候选' },
      content: '# 外部候选\n',
    })
  );
  await writeFile(
    path.join(segmentDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { id: segmentId, title: '缺入口作品', kind: 'artifact', format: 'html' },
      content: '# 缺入口作品\n',
    })
  );
  await writeFile(
    path.join(root, '.reo', 'index.json'),
    '{\n  "schemaVersion": 1,\n  "memories": []\n}\n'
  );

  const opened = await openWorkspaceFiles({ rootPath: root });

  assert.equal(opened.ok, true);
  if (!opened.ok) {
    throw new Error('open should surface review instead of failing');
  }
  assert.equal(opened.snapshot.review?.needsReviewCount, 1);
  assert.equal(opened.snapshot.review?.markdownCandidateCount, 1);
  const report = await readNeedsReviewReport(root);
  assert.deepEqual(
    report.entries.map((entry) => ({
      category: entry.category,
      paths: entry.paths,
      reason: entry.reason,
    })),
    [
      {
        category: 'markdown-segment',
        paths: [`memories/${memoryId}--外部候选/segments/${segmentId}--缺入口作品/segment.md`],
        reason: 'missing-artifact-entry',
      },
    ]
  );
});

test('workspace snapshot refresh passively serializes note Segment sidecar JSON to Markdown', async () => {
  const root = await initializePassiveSidecarWorkspace();
  const memoryId = 'mem_passive_note_segment';
  const segmentId = 'seg_passive_note_segment';
  const originalBody = 'Original note segment\n';
  await writeMemoryForPassiveSidecarTest({ root, memoryId });
  const segmentDirectory = await writeNoteSegmentForPassiveSidecarTest({
    body: originalBody,
    memoryId,
    root,
    segmentId,
  });
  await writeTiptapContentSidecar({
    bodyMarkdown: originalBody,
    objectDirectory: segmentDirectory,
    tiptapJson: paragraphDoc('Original note segment'),
  });
  const nextTiptapJson = passiveRichDoc('Segment passive');
  await writeExternalSidecarContent({
    objectDirectory: segmentDirectory,
    tiptapJson: nextTiptapJson,
  });

  const snapshot = await readWorkspaceSnapshotFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_passive_sidecar',
  });

  assert.equal(snapshot.ok, true);
  if (!snapshot.ok) {
    throw new Error('snapshot refresh should succeed');
  }
  assert.equal(snapshot.snapshot.memories[0]?.noteSegmentCount, 1);
  const persisted = parseWorkspaceMarkdownObject({
    markdown: await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8'),
    objectType: 'segment',
  });
  assert.equal(persisted.data.title, 'Passive note segment');
  assert.equal('kind' in persisted.data ? persisted.data.kind : undefined, 'note');
  assert.match(persisted.content, /Segment passive highlight/);
  assert.match(persisted.content, /var\(--tt-color-highlight-purple\)/);
  assert.match(persisted.content, /\+\+Segment passive underline\+\+/);
  const sidecar = await readTiptapContentSidecar(segmentDirectory);
  assert.deepEqual(sidecar.content, nextTiptapJson);
  assert.equal(sidecar.source.hash, hashTiptapSourceMarkdown(persisted.content));
  assert.equal(sidecar.contentHash, hashTiptapJsonContent(nextTiptapJson));
  const manifest = JSON.parse(
    await readFile(path.join(root, '.reo', 'objects', 'segments', `${segmentId}.json`), 'utf8')
  ) as { readonly bodyByteLength?: unknown };
  assert.equal(manifest.bodyByteLength, Buffer.byteLength(persisted.content, 'utf8'));
});

test('workspace snapshot refresh passively serializes note Supplement sidecar JSON to Markdown', async () => {
  const root = await initializePassiveSidecarWorkspace();
  const memoryId = 'mem_passive_note_supplement';
  const segmentId = 'seg_passive_note_supplement';
  const supplementId = 'sup_passive_note_supplement';
  const originalSegmentBody = 'Original parent note\n';
  const originalSupplementBody = 'Original note supplement\n';
  await writeMemoryForPassiveSidecarTest({ root, memoryId });
  await writeNoteSegmentForPassiveSidecarTest({
    body: originalSegmentBody,
    memoryId,
    root,
    segmentId,
  });
  const supplementDirectory = await writeNoteSupplementForPassiveSidecarTest({
    body: originalSupplementBody,
    memoryId,
    root,
    segmentId,
    supplementId,
  });
  await writeTiptapContentSidecar({
    bodyMarkdown: originalSupplementBody,
    objectDirectory: supplementDirectory,
    tiptapJson: paragraphDoc('Original note supplement'),
  });
  const nextTiptapJson = passiveRichDoc('Supplement passive');
  await writeExternalSidecarContent({
    objectDirectory: supplementDirectory,
    tiptapJson: nextTiptapJson,
    updateContentHash: true,
  });

  const snapshot = await readWorkspaceSnapshotFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_passive_sidecar',
  });

  assert.equal(snapshot.ok, true);
  if (!snapshot.ok) {
    throw new Error('snapshot refresh should succeed');
  }
  assert.equal(snapshot.snapshot.memories[0]?.supplementCount, 1);
  const persisted = parseWorkspaceMarkdownObject({
    markdown: await readFile(path.join(supplementDirectory, 'supplement.md'), 'utf8'),
    objectType: 'supplement',
  });
  assert.equal(persisted.data.title, 'Passive note supplement');
  assert.equal('kind' in persisted.data ? persisted.data.kind : undefined, 'note');
  assert.match(persisted.content, /Supplement passive highlight/);
  assert.match(persisted.content, /var\(--tt-color-highlight-purple\)/);
  assert.match(persisted.content, /\+\+Supplement passive underline\+\+/);
  const sidecar = await readTiptapContentSidecar(supplementDirectory);
  assert.deepEqual(sidecar.content, nextTiptapJson);
  assert.equal(sidecar.source.hash, hashTiptapSourceMarkdown(persisted.content));
  assert.equal(sidecar.contentHash, hashTiptapJsonContent(nextTiptapJson));
  const manifest = JSON.parse(
    await readFile(
      path.join(root, '.reo', 'objects', 'supplements', `${supplementId}.json`),
      'utf8'
    )
  ) as { readonly bodyByteLength?: unknown };
  assert.equal(manifest.bodyByteLength, Buffer.byteLength(persisted.content, 'utf8'));
});

test('workspace snapshot refresh passively serializes audio Segment transcript sidecar JSON to Markdown', async () => {
  const root = await initializePassiveSidecarWorkspace();
  const memoryId = 'mem_passive_audio_segment';
  const segmentId = 'seg_passive_audio_segment';
  const originalTranscript = 'Original audio transcript';
  await writeMemoryForPassiveSidecarTest({ root, memoryId });
  const segmentDirectory = await writeAudioSegmentForPassiveSidecarTest({
    memoryId,
    root,
    segmentId,
    transcript: originalTranscript,
  });
  await writeTiptapContentSidecar({
    bodyMarkdown: originalTranscript,
    objectDirectory: segmentDirectory,
    tiptapJson: paragraphDoc(originalTranscript),
  });
  const nextTiptapJson = passiveRichDoc('Audio segment passive');
  await writeExternalSidecarContent({
    objectDirectory: segmentDirectory,
    tiptapJson: nextTiptapJson,
  });

  const snapshot = await readWorkspaceSnapshotFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_passive_sidecar',
  });

  assert.equal(snapshot.ok, true);
  if (!snapshot.ok) {
    throw new Error('snapshot refresh should succeed');
  }
  assert.equal(snapshot.snapshot.memories[0]?.audioSegmentCount, 1);
  assert.equal(snapshot.snapshot.memories[0]?.hasAudioTranscript, true);
  const persisted = parseWorkspaceMarkdownObject({
    markdown: await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8'),
    objectType: 'segment',
  });
  assert.equal('kind' in persisted.data ? persisted.data.kind : undefined, 'audio');
  assert.match(persisted.content, /Non transcript context must stay/);
  assert.match(persisted.content, /## Transcript/);
  assert.doesNotMatch(persisted.content, /Original audio transcript/);
  assert.match(persisted.content, /Audio segment passive highlight/);
  assert.match(persisted.content, /var\(--tt-color-highlight-purple\)/);
  assert.match(persisted.content, /\+\+Audio segment passive underline\+\+/);
  const sidecar = await readTiptapContentSidecar(segmentDirectory);
  assert.deepEqual(sidecar.content, nextTiptapJson);
  assert.equal(
    sidecar.source.hash,
    hashTiptapSourceMarkdown(extractSegmentTranscript(persisted.content))
  );
  assert.notEqual(sidecar.source.hash, hashTiptapSourceMarkdown(originalTranscript));
});

test('workspace snapshot refresh passively serializes audio Supplement transcript sidecar JSON to Markdown', async () => {
  const root = await initializePassiveSidecarWorkspace();
  const memoryId = 'mem_passive_audio_supplement';
  const segmentId = 'seg_passive_audio_supplement';
  const supplementId = 'sup_passive_audio_supplement';
  const originalTranscript = 'Original audio supplement transcript';
  await writeMemoryForPassiveSidecarTest({ root, memoryId });
  await writeAudioSegmentForPassiveSidecarTest({
    memoryId,
    root,
    segmentId,
    transcript: 'Parent audio transcript',
  });
  const supplementDirectory = await writeAudioSupplementForPassiveSidecarTest({
    memoryId,
    root,
    segmentId,
    supplementId,
    transcript: originalTranscript,
  });
  await writeTiptapContentSidecar({
    bodyMarkdown: originalTranscript,
    objectDirectory: supplementDirectory,
    tiptapJson: paragraphDoc(originalTranscript),
  });
  const nextTiptapJson = passiveRichDoc('Audio supplement passive');
  await writeExternalSidecarContent({
    objectDirectory: supplementDirectory,
    tiptapJson: nextTiptapJson,
  });

  const snapshot = await readWorkspaceSnapshotFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_passive_sidecar',
  });

  assert.equal(snapshot.ok, true);
  if (!snapshot.ok) {
    throw new Error('snapshot refresh should succeed');
  }
  assert.equal(snapshot.snapshot.memories[0]?.supplementCount, 1);
  const persisted = parseWorkspaceMarkdownObject({
    markdown: await readFile(path.join(supplementDirectory, 'supplement.md'), 'utf8'),
    objectType: 'supplement',
  });
  assert.equal('kind' in persisted.data ? persisted.data.kind : undefined, 'audio');
  assert.match(persisted.content, /Supplement context must stay/);
  assert.match(persisted.content, /## Transcript/);
  assert.doesNotMatch(persisted.content, /Original audio supplement transcript/);
  assert.match(persisted.content, /Audio supplement passive highlight/);
  assert.match(persisted.content, /var\(--tt-color-highlight-purple\)/);
  assert.match(persisted.content, /\+\+Audio supplement passive underline\+\+/);
  const sidecar = await readTiptapContentSidecar(supplementDirectory);
  assert.deepEqual(sidecar.content, nextTiptapJson);
  assert.equal(
    sidecar.source.hash,
    hashTiptapSourceMarkdown(extractSegmentTranscript(persisted.content))
  );
  assert.notEqual(sidecar.source.hash, hashTiptapSourceMarkdown(originalTranscript));
});

test('workspace snapshot refresh preserves simultaneous Markdown and sidecar edits', async () => {
  const root = await initializePassiveSidecarWorkspace();
  const memoryId = 'mem_passive_conflict';
  const segmentId = 'seg_passive_conflict';
  const originalBody = 'Original conflict body\n';
  await writeMemoryForPassiveSidecarTest({ root, memoryId });
  const segmentDirectory = await writeNoteSegmentForPassiveSidecarTest({
    body: originalBody,
    memoryId,
    root,
    segmentId,
  });
  await writeTiptapContentSidecar({
    bodyMarkdown: originalBody,
    objectDirectory: segmentDirectory,
    tiptapJson: paragraphDoc('Original conflict body'),
  });
  const nextTiptapJson = passiveRichDoc('Conflicting sidecar');
  await writeExternalSidecarContent({
    objectDirectory: segmentDirectory,
    tiptapJson: nextTiptapJson,
    updateContentHash: true,
  });
  const markdownChangedOutside = 'Markdown changed outside\n';
  await writeFile(
    path.join(segmentDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title: 'Passive note segment', kind: 'note' },
      content: markdownChangedOutside,
    })
  );

  const snapshot = await readWorkspaceSnapshotFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_passive_sidecar',
  });

  assert.equal(snapshot.ok, true);
  const persisted = parseWorkspaceMarkdownObject({
    markdown: await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8'),
    objectType: 'segment',
  });
  assert.equal(persisted.content, markdownChangedOutside);
  const sidecar = await readTiptapContentSidecar(segmentDirectory);
  assert.deepEqual(sidecar.content, nextTiptapJson);
  assert.notEqual(sidecar.source.hash, hashTiptapSourceMarkdown(persisted.content));

  const report = await readNeedsReviewReport(root);
  const serializedReport = JSON.stringify(report);
  assert.equal(report.summary.needsReviewCount, 1);
  assert.equal(report.summary.tiptapSidecarCount, 1);
  assert.deepEqual(
    report.entries.map((entry) => ({
      category: entry.category,
      kind: entry.kind,
      objectType: entry.objectType,
      paths: entry.paths,
      reason: entry.reason,
    })),
    [
      {
        category: 'tiptap-sidecar',
        kind: 'note',
        objectType: 'segment',
        paths: [
          `memories/${memoryId}/segments/${segmentId}/segment.md`,
          `memories/${memoryId}/segments/${segmentId}/${TIPTAP_CONTENT_SIDECAR_FILE}`,
        ],
        reason: 'content-conflict',
      },
    ]
  );
  assert.equal(snapshot.snapshot.review?.needsReviewCount, 1);
  assert.equal(snapshot.snapshot.review?.tiptapSidecarCount, 1);
  assert.doesNotMatch(serializedReport, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(serializedReport, /Markdown changed outside|Original conflict body/);
});

test('workspace snapshot refresh does not clobber Markdown changed during passive sidecar write', async () => {
  const root = await initializePassiveSidecarWorkspace();
  const memoryId = 'mem_passive_concurrent_markdown';
  const segmentId = 'seg_passive_concurrent_markdown';
  const originalBody = 'Original concurrent body\n';
  const concurrentBody = 'Concurrent Markdown body\n';
  await writeMemoryForPassiveSidecarTest({ root, memoryId });
  const segmentDirectory = await writeNoteSegmentForPassiveSidecarTest({
    body: originalBody,
    memoryId,
    root,
    segmentId,
  });
  await writeTiptapContentSidecar({
    bodyMarkdown: originalBody,
    objectDirectory: segmentDirectory,
    tiptapJson: paragraphDoc('Original concurrent body'),
  });
  const nextTiptapJson = passiveRichDoc('Concurrent sidecar');
  await writeExternalSidecarContent({
    objectDirectory: segmentDirectory,
    tiptapJson: nextTiptapJson,
  });
  setBeforeAtomicWorkspaceFileCommitForTest(() => {
    setBeforeAtomicWorkspaceFileCommitForTest(null);
    writeFileSync(
      path.join(segmentDirectory, 'segment.md'),
      renderWorkspaceMarkdownObject({
        objectType: 'segment',
        data: { title: 'Passive note segment', kind: 'note' },
        content: concurrentBody,
      })
    );
  });

  try {
    const snapshot = await readWorkspaceSnapshotFromFileTruth({
      rootPath: root,
      workspaceId: 'ws_passive_sidecar',
    });

    assert.equal(snapshot.ok, true);
    const persisted = parseWorkspaceMarkdownObject({
      markdown: await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8'),
      objectType: 'segment',
    });
    assert.equal(persisted.content, concurrentBody);
    const sidecar = await readTiptapContentSidecar(segmentDirectory);
    assert.deepEqual(sidecar.content, nextTiptapJson);
    assert.notEqual(sidecar.source.hash, hashTiptapSourceMarkdown(persisted.content));
  } finally {
    setBeforeAtomicWorkspaceFileCommitForTest(null);
  }
});

test('workspace snapshot refresh aborts when passive sidecar write fails', async () => {
  const root = await initializePassiveSidecarWorkspace();
  const memoryId = 'mem_passive_write_failed';
  const segmentId = 'seg_passive_write_failed';
  const originalBody = 'Original write failure body\n';
  await writeMemoryForPassiveSidecarTest({ root, memoryId });
  const segmentDirectory = await writeNoteSegmentForPassiveSidecarTest({
    body: originalBody,
    memoryId,
    root,
    segmentId,
  });
  await writeTiptapContentSidecar({
    bodyMarkdown: originalBody,
    objectDirectory: segmentDirectory,
    tiptapJson: paragraphDoc('Original write failure body'),
  });
  await writeExternalSidecarContent({
    objectDirectory: segmentDirectory,
    tiptapJson: passiveRichDoc('Write failure sidecar'),
  });
  setBeforeAtomicWorkspaceFileCommitForTest(() => {
    setBeforeAtomicWorkspaceFileCommitForTest(null);
    throw new Error('passive write failed');
  });

  try {
    const snapshot = await readWorkspaceSnapshotFromFileTruth({
      rootPath: root,
      workspaceId: 'ws_passive_sidecar',
    });

    assert.equal(snapshot.ok, false);
    if (!snapshot.ok) {
      assert.equal(snapshot.error.code, 'ERR_WORKSPACE_OPEN_FAILED');
      assert.equal(snapshot.error.dataRetention, 'previous-file-preserved');
    }
    const persisted = parseWorkspaceMarkdownObject({
      markdown: await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8'),
      objectType: 'segment',
    });
    assert.equal(persisted.content, originalBody);
  } finally {
    setBeforeAtomicWorkspaceFileCommitForTest(null);
  }
});

test('workspace snapshot refresh preserves invalid and unsupported sidecars', async () => {
  const root = await initializePassiveSidecarWorkspace();
  const memoryId = 'mem_passive_bad_sidecars';
  const invalidSegmentId = 'seg_passive_invalid_sidecar';
  const unsupportedSegmentId = 'seg_passive_unsupported_sidecar';
  const officialAttrSegmentId = 'seg_passive_official_attr_sidecar';
  const invalidBody = 'Invalid sidecar Markdown stays\n';
  const unsupportedBody = 'Unsupported sidecar Markdown stays\n';
  const officialAttrBody = 'Official attr Markdown stays\n';
  await writeMemoryForPassiveSidecarTest({ root, memoryId });
  const invalidSegmentDirectory = await writeNoteSegmentForPassiveSidecarTest({
    body: invalidBody,
    memoryId,
    root,
    segmentId: invalidSegmentId,
    title: 'Invalid sidecar segment',
  });
  const unsupportedSegmentDirectory = await writeNoteSegmentForPassiveSidecarTest({
    body: unsupportedBody,
    memoryId,
    root,
    segmentId: unsupportedSegmentId,
    title: 'Unsupported sidecar segment',
  });
  const officialAttrSegmentDirectory = await writeNoteSegmentForPassiveSidecarTest({
    body: officialAttrBody,
    memoryId,
    root,
    segmentId: officialAttrSegmentId,
    title: 'Official attr sidecar segment',
  });
  await writeTiptapContentSidecar({
    bodyMarkdown: invalidBody,
    objectDirectory: invalidSegmentDirectory,
    tiptapJson: paragraphDoc('Invalid sidecar Markdown stays'),
  });
  await writeTiptapContentSidecar({
    bodyMarkdown: unsupportedBody,
    objectDirectory: unsupportedSegmentDirectory,
    tiptapJson: paragraphDoc('Unsupported sidecar Markdown stays'),
  });
  await writeTiptapContentSidecar({
    bodyMarkdown: officialAttrBody,
    objectDirectory: officialAttrSegmentDirectory,
    tiptapJson: paragraphDoc('Official attr Markdown stays'),
  });
  await writeFile(
    path.join(invalidSegmentDirectory, TIPTAP_CONTENT_SIDECAR_FILE),
    '{ invalid json\n'
  );
  await writeExternalSidecarContent({
    objectDirectory: unsupportedSegmentDirectory,
    tiptapJson: unsupportedTableDoc(),
  });
  await writeExternalSidecarContent({
    objectDirectory: officialAttrSegmentDirectory,
    tiptapJson: unsupportedOfficialAttrDoc(),
  });

  const snapshot = await readWorkspaceSnapshotFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_passive_sidecar',
  });

  assert.equal(snapshot.ok, true);
  if (!snapshot.ok) {
    throw new Error('snapshot refresh should succeed');
  }
  assert.equal(snapshot.snapshot.memories[0]?.noteSegmentCount, 3);
  const invalidPersisted = parseWorkspaceMarkdownObject({
    markdown: await readFile(path.join(invalidSegmentDirectory, 'segment.md'), 'utf8'),
    objectType: 'segment',
  });
  assert.equal(invalidPersisted.content, invalidBody);
  assert.equal(
    await readFile(path.join(invalidSegmentDirectory, TIPTAP_CONTENT_SIDECAR_FILE), 'utf8'),
    '{ invalid json\n'
  );
  const unsupportedPersisted = parseWorkspaceMarkdownObject({
    markdown: await readFile(path.join(unsupportedSegmentDirectory, 'segment.md'), 'utf8'),
    objectType: 'segment',
  });
  assert.equal(unsupportedPersisted.content, unsupportedBody);
  const unsupportedSidecar = await readTiptapContentSidecar(unsupportedSegmentDirectory);
  assert.deepEqual(unsupportedSidecar.content, unsupportedTableDoc());
  const officialAttrPersisted = parseWorkspaceMarkdownObject({
    markdown: await readFile(path.join(officialAttrSegmentDirectory, 'segment.md'), 'utf8'),
    objectType: 'segment',
  });
  assert.equal(officialAttrPersisted.content, officialAttrBody);
  const officialAttrSidecar = await readTiptapContentSidecar(officialAttrSegmentDirectory);
  assert.deepEqual(officialAttrSidecar.content, unsupportedOfficialAttrDoc());

  const report = await readNeedsReviewReport(root);
  assert.equal(report.summary.needsReviewCount, 3);
  assert.equal(report.summary.tiptapSidecarCount, 3);
  assert.deepEqual(
    report.entries.map((entry) => ({
      category: entry.category,
      paths: entry.paths,
      reason: entry.reason,
    })),
    [
      {
        category: 'tiptap-sidecar',
        paths: [
          `memories/${memoryId}/segments/${invalidSegmentId}/segment.md`,
          `memories/${memoryId}/segments/${invalidSegmentId}/${TIPTAP_CONTENT_SIDECAR_FILE}`,
        ],
        reason: 'invalid-sidecar',
      },
      {
        category: 'tiptap-sidecar',
        paths: [
          `memories/${memoryId}/segments/${officialAttrSegmentId}/segment.md`,
          `memories/${memoryId}/segments/${officialAttrSegmentId}/${TIPTAP_CONTENT_SIDECAR_FILE}`,
        ],
        reason: 'unsupported-tiptap-content',
      },
      {
        category: 'tiptap-sidecar',
        paths: [
          `memories/${memoryId}/segments/${unsupportedSegmentId}/segment.md`,
          `memories/${memoryId}/segments/${unsupportedSegmentId}/${TIPTAP_CONTENT_SIDECAR_FILE}`,
        ],
        reason: 'unsupported-tiptap-content',
      },
    ]
  );
  assert.equal(snapshot.snapshot.review?.needsReviewCount, 3);
  assert.equal(snapshot.snapshot.review?.tiptapSidecarCount, 3);
  assert.equal(snapshot.snapshot.review?.markdownCandidateCount, 0);
});

test('workspace snapshot refresh clears stale needs-review report when clean', async () => {
  const root = await initializePassiveSidecarWorkspace();
  await mkdir(path.join(root, '.reo', 'review'), { recursive: true });
  await writeFile(
    path.join(root, '.reo', 'review', 'needs-review.json'),
    '{"schemaVersion":1,"summary":{"needsReviewCount":1,"markdownCandidateCount":0,"tiptapSidecarCount":1},"entries":[]}\n'
  );
  await writeFile(path.join(root, '.reo', 'review', 'needs-review.md'), '# stale\n');

  const snapshot = await readWorkspaceSnapshotFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_passive_sidecar',
  });

  assert.equal(snapshot.ok, true);
  if (!snapshot.ok) {
    throw new Error('snapshot refresh should succeed');
  }
  assert.equal(snapshot.snapshot.review, undefined);
  await assert.rejects(readFile(path.join(root, '.reo', 'review', 'needs-review.json'), 'utf8'), {
    code: 'ENOENT',
  });
  await assert.rejects(readFile(path.join(root, '.reo', 'review', 'needs-review.md'), 'utf8'), {
    code: 'ENOENT',
  });
});

test('workspace snapshot refresh writes duplicate and ambiguous Markdown candidate review entries', async () => {
  const root = await initializePassiveSidecarWorkspace();
  const memoryId = 'mem_markdown_candidate_review';
  const segmentId = 'seg_markdown_candidate_review';
  await writeMemoryForPassiveSidecarTest({ root, memoryId, title: '候选检查' });
  for (const directoryName of ['重复一', '重复二'] as const) {
    const segmentDirectory = path.join(root, 'memories', memoryId, 'segments', directoryName);
    await mkdir(segmentDirectory, { recursive: true });
    await writeFile(
      path.join(segmentDirectory, 'segment.md'),
      renderWorkspaceMarkdownObject({
        objectType: 'segment',
        data: { id: segmentId, title: directoryName, kind: 'note' },
        content: `${directoryName}正文不应进入报告\n`,
      })
    );
  }
  const ambiguousDirectory = path.join(root, 'memories', memoryId, 'segments', '混合候选');
  await mkdir(ambiguousDirectory, { recursive: true });
  await writeFile(path.join(ambiguousDirectory, 'segment.md'), '正文不应进入报告\n');
  await writeFile(path.join(ambiguousDirectory, 'supplement.md'), '补充正文不应进入报告\n');

  const snapshot = await readWorkspaceSnapshotFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_passive_sidecar',
  });

  assert.equal(snapshot.ok, true);
  if (!snapshot.ok) {
    throw new Error('snapshot refresh should succeed');
  }
  const report = await readNeedsReviewReport(root);
  const serializedReport = JSON.stringify(report);
  assert.equal(snapshot.snapshot.review?.needsReviewCount, 2);
  assert.equal(snapshot.snapshot.review?.markdownCandidateCount, 2);
  assert.deepEqual(
    report.entries.map((entry) => ({
      category: entry.category,
      paths: entry.paths,
      reason: entry.reason,
    })),
    [
      {
        category: 'markdown-segment',
        paths: [
          `memories/${memoryId}/segments/混合候选/segment.md`,
          `memories/${memoryId}/segments/混合候选/supplement.md`,
        ],
        reason: 'ambiguous-candidate',
      },
      {
        category: 'markdown-segment',
        paths: [
          `memories/${memoryId}/segments/重复一/segment.md`,
          `memories/${memoryId}/segments/重复二/segment.md`,
        ],
        reason: 'duplicate-id',
      },
    ]
  );
  assert.doesNotMatch(serializedReport, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(serializedReport, /正文不应进入报告|补充正文不应进入报告/);
});

test('workspace snapshot refresh writes duplicate and ambiguous Markdown supplement review entries', async () => {
  const root = await initializePassiveSidecarWorkspace();
  const memoryId = 'mem_markdown_supplement_candidate_review';
  const segmentId = 'seg_markdown_supplement_candidate_review';
  const supplementId = 'sup_markdown_candidate_review';
  await writeMemoryForPassiveSidecarTest({ root, memoryId, title: '补充候选检查' });
  await writeNoteSegmentForPassiveSidecarTest({
    body: '父片段正文\n',
    memoryId,
    root,
    segmentId,
  });
  const supplementsDirectory = path.join(
    root,
    'memories',
    memoryId,
    'segments',
    segmentId,
    'supplements'
  );
  for (const [directoryName, title] of [
    ['sup_dir_one', '重复补充一'],
    ['sup_dir_two', '重复补充二'],
  ] as const) {
    const supplementDirectory = path.join(supplementsDirectory, directoryName);
    await mkdir(supplementDirectory, { recursive: true });
    await writeFile(
      path.join(supplementDirectory, 'supplement.md'),
      renderWorkspaceMarkdownObject({
        objectType: 'supplement',
        data: { id: supplementId, title, kind: 'note' },
        content: `${title}正文不应进入报告\n`,
      })
    );
  }
  const ambiguousDirectory = path.join(supplementsDirectory, '混合补充候选');
  await mkdir(ambiguousDirectory, { recursive: true });
  await writeFile(path.join(ambiguousDirectory, 'segment.md'), '片段正文不应进入报告\n');
  await writeFile(path.join(ambiguousDirectory, 'supplement.md'), '补充正文不应进入报告\n');

  const snapshot = await readWorkspaceSnapshotFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_passive_sidecar',
  });

  assert.equal(snapshot.ok, true);
  if (!snapshot.ok) {
    throw new Error('snapshot refresh should succeed');
  }
  const report = await readNeedsReviewReport(root);
  const serializedReport = JSON.stringify(report);
  assert.equal(snapshot.snapshot.review?.needsReviewCount, 2);
  assert.equal(snapshot.snapshot.review?.markdownCandidateCount, 2);
  assert.deepEqual(
    report.entries.map((entry) => ({
      category: entry.category,
      paths: entry.paths,
      reason: entry.reason,
    })),
    [
      {
        category: 'markdown-supplement',
        paths: [
          `memories/${memoryId}/segments/${segmentId}/supplements/混合补充候选/segment.md`,
          `memories/${memoryId}/segments/${segmentId}/supplements/混合补充候选/supplement.md`,
        ],
        reason: 'ambiguous-candidate',
      },
      {
        category: 'markdown-supplement',
        paths: [
          `memories/${memoryId}/segments/${segmentId}/supplements/sup_dir_one/supplement.md`,
          `memories/${memoryId}/segments/${segmentId}/supplements/sup_dir_two/supplement.md`,
        ],
        reason: 'duplicate-id',
      },
    ]
  );
  assert.doesNotMatch(serializedReport, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(
    serializedReport,
    /正文不应进入报告|补充正文不应进入报告|重复补充一|重复补充二/
  );
});

test('needs-review report write does not create review files after lock loss', async () => {
  const root = await initializePassiveSidecarWorkspace();

  await assert.rejects(
    writeWorkspaceNeedsReviewReport({
      assertUsable: () => {
        throw new Error('workspace lock lost');
      },
      entries: [
        {
          category: 'tiptap-sidecar',
          kind: 'note',
          objectType: 'segment',
          paths: ['memories/mem_1/segments/seg_1/segment.md'],
          reason: 'content-conflict',
        },
      ],
      rootPath: root,
    }),
    /workspace lock lost/
  );

  await assert.rejects(stat(path.join(root, '.reo', 'review')), { code: 'ENOENT' });
});

test('needs-review report clear preserves stale files after lock loss', async () => {
  const root = await initializePassiveSidecarWorkspace();
  await mkdir(path.join(root, '.reo', 'review'), { recursive: true });
  await writeFile(path.join(root, '.reo', 'review', 'needs-review.json'), '{"stale":true}\n');
  await writeFile(path.join(root, '.reo', 'review', 'needs-review.md'), '# stale\n');

  await assert.rejects(
    writeWorkspaceNeedsReviewReport({
      assertUsable: () => {
        throw new Error('workspace lock lost');
      },
      entries: [],
      rootPath: root,
    }),
    /workspace lock lost/
  );

  assert.equal(
    await readFile(path.join(root, '.reo', 'review', 'needs-review.json'), 'utf8'),
    '{"stale":true}\n'
  );
  assert.equal(
    await readFile(path.join(root, '.reo', 'review', 'needs-review.md'), 'utf8'),
    '# stale\n'
  );
});

test('needs-review Markdown report escapes unusual relative paths', async () => {
  const root = await initializePassiveSidecarWorkspace();
  const unusualPath = 'memories/mem_1/segments/seg_1--`tick\nnext/segment.md';

  await writeWorkspaceNeedsReviewReport({
    entries: [
      {
        category: 'markdown-segment',
        objectType: 'segment',
        paths: [unusualPath],
        reason: 'ambiguous-candidate',
      },
    ],
    rootPath: root,
  });

  const markdown = await readFile(path.join(root, '.reo', 'review', 'needs-review.md'), 'utf8');
  assert.match(markdown, /\\u0060tick\\nnext/);
  assert.doesNotMatch(markdown, /`tick/);
});

test('needs-review Markdown report includes conservative recovery hints', async () => {
  const root = await initializePassiveSidecarWorkspace();

  await writeWorkspaceNeedsReviewReport({
    entries: [
      {
        category: 'tiptap-sidecar',
        kind: 'note',
        objectType: 'segment',
        paths: [
          'memories/mem_hint/segments/seg_conflict/segment.md',
          'memories/mem_hint/segments/seg_conflict/content.tiptap.json',
        ],
        reason: 'content-conflict',
      },
      {
        category: 'tiptap-sidecar',
        kind: 'note',
        objectType: 'segment',
        paths: ['memories/mem_hint/segments/seg_invalid/content.tiptap.json'],
        reason: 'invalid-sidecar',
      },
      {
        category: 'tiptap-sidecar',
        kind: 'note',
        objectType: 'segment',
        paths: ['memories/mem_hint/segments/seg_unsupported/content.tiptap.json'],
        reason: 'unsupported-tiptap-content',
      },
      {
        category: 'tiptap-sidecar',
        kind: 'note',
        objectType: 'supplement',
        paths: [
          'memories/mem_hint/segments/seg_hint/supplements/sup_markdown_write/supplement.md',
          'memories/mem_hint/segments/seg_hint/supplements/sup_markdown_write/content.tiptap.json',
        ],
        reason: 'markdown-write-required',
      },
      {
        category: 'markdown-segment',
        objectType: 'segment',
        paths: [
          'memories/mem_hint/segments/seg_duplicate_first/segment.md',
          'memories/mem_hint/segments/seg_duplicate_second/segment.md',
        ],
        reason: 'duplicate-id',
      },
      {
        category: 'markdown-supplement',
        objectType: 'supplement',
        paths: ['memories/mem_hint/segments/seg_hint/supplements/ambiguous/supplement.md'],
        reason: 'ambiguous-candidate',
      },
    ],
    rootPath: root,
  });

  const markdown = await readFile(path.join(root, '.reo', 'review', 'needs-review.md'), 'utf8');
  assert.match(
    markdown,
    /Both Markdown and content\.tiptap\.json changed\. Choose one source; do not guess a merge\./
  );
  assert.match(markdown, /Fix content\.tiptap\.json to valid Reo Tiptap sidecar JSON/);
  assert.match(markdown, /Simplify content\.tiptap\.json to Reo's durable Tiptap profile/);
  assert.match(markdown, /could not write the Markdown mirror in this read path/);
  assert.match(markdown, /Keep exactly one object with this id/);
  assert.match(markdown, /Make this candidate one clear object shape/);
  assert.doesNotMatch(markdown, /\/Users\//);
  assert.doesNotMatch(markdown, /workspace-handle/);
  assert.doesNotMatch(markdown, /source\.hash|contentHash/);

  const report = (await readNeedsReviewReport(root)) as {
    readonly entries: Array<Record<string, unknown>>;
  };
  assert.equal(
    report.entries.some((entry) => 'recoveryHint' in entry),
    false
  );
  for (const entry of report.entries) {
    assert.deepEqual(
      Object.keys(entry).sort(),
      ['category', 'kind', 'objectType', 'paths', 'reason'].filter((key) => key in entry).sort()
    );
  }
});

test('needs-review report skips rewriting unchanged entries', async () => {
  const root = await initializePassiveSidecarWorkspace();
  const entry = {
    category: 'tiptap-sidecar' as const,
    kind: 'note' as const,
    objectType: 'segment' as const,
    paths: ['memories/mem_1/segments/seg_1/segment.md'],
    reason: 'content-conflict' as const,
  };

  await writeWorkspaceNeedsReviewReport({
    entries: [entry],
    rootPath: root,
  });
  const reportPath = path.join(root, '.reo', 'review', 'needs-review.json');
  const report = await readNeedsReviewReport(root);
  await writeFile(
    reportPath,
    `${JSON.stringify(
      {
        ...report,
        updatedAt: '2026-05-27T00:00:00.000Z',
      },
      null,
      2
    )}\n`
  );

  await writeWorkspaceNeedsReviewReport({
    entries: [entry],
    rootPath: root,
  });

  assert.equal((await readNeedsReviewReport(root)).updatedAt, '2026-05-27T00:00:00.000Z');
});

test('open workspace preserves the existing index when memories root changes before reconciliation persist', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-reconcile-swap-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Open reconcile swap',
    description: '',
    createWorkspaceId: () => 'ws_open_reconcile_swap',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_open_reconcile_swap',
    memoryId: 'mem_open_reconcile_swap',
    segmentId: 'seg_open_reconcile_swap',
    title: 'Open reconcile swap',
    audio: new Uint8Array([1, 2, 3]),
    durationMs: 3000,
  });
  const previousIndex = await readFile(path.join(root, '.reo', 'index.json'), 'utf8');
  let reconciliationStarted = false;
  setBeforeWorkspaceIndexReconciliationPersistForTest(async () => {
    reconciliationStarted = true;
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
    await rename(path.join(root, 'memories'), path.join(root, 'memories-preserved'));
    await mkdir(path.join(root, 'memories'));
  });

  try {
    const opened = await openWorkspaceFiles({ rootPath: root });
    assert.equal(opened.ok, false);
    if (!opened.ok) {
      assert.equal(opened.error.code, 'ERR_WORKSPACE_OPEN_FAILED');
      assert.equal(opened.error.dataRetention, 'previous-file-preserved');
    }
  } finally {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
  }
  assert.equal(reconciliationStarted, true);
  assert.equal(await readFile(path.join(root, '.reo', 'index.json'), 'utf8'), previousIndex);
});

test('workspace snapshot refresh preserves the existing index when memories root changes before reconciliation persist', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-snapshot-reconcile-swap-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Snapshot reconcile swap',
    description: '',
    createWorkspaceId: () => 'ws_snapshot_reconcile_swap',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_snapshot_reconcile_swap',
    memoryId: 'mem_snapshot_reconcile_swap',
    segmentId: 'seg_snapshot_reconcile_swap',
    title: 'Snapshot reconcile swap',
    audio: new Uint8Array([1, 2, 3]),
    durationMs: 3000,
  });
  const previousIndex = await readFile(path.join(root, '.reo', 'index.json'), 'utf8');
  setBeforeWorkspaceIndexReconciliationPersistForTest(async () => {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
    await rename(path.join(root, 'memories'), path.join(root, 'memories-preserved'));
    await mkdir(path.join(root, 'memories'));
  });

  try {
    const snapshot = await readWorkspaceSnapshotFromFileTruth({
      rootPath: root,
      workspaceId: 'ws_snapshot_reconcile_swap',
    });
    assert.equal(snapshot.ok, false);
  } finally {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
  }
  assert.equal(await readFile(path.join(root, '.reo', 'index.json'), 'utf8'), previousIndex);
});

test('workspace title mirror repair does not rebuild memory file truth', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'reo-title-mirror-repair-'));
  const root = path.join(parent, 'Renamed title');
  await mkdir(root, { recursive: true });
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Title reconcile swap',
    description: '',
    createWorkspaceId: () => 'ws_title_reconcile_swap',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_title_reconcile_swap',
    memoryId: 'mem_title_reconcile_swap',
    segmentId: 'seg_title_reconcile_swap',
    title: 'Title reconcile swap',
    audio: new Uint8Array([1, 2, 3]),
    durationMs: 3000,
  });
  await writeFile(path.join(root, '.reo', 'index.json'), '{not json');
  const previousIndex = '{not json';
  setBeforeWorkspaceIndexReconciliationPersistForTest(async () => {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
    throw new Error('workspace title mirror repair should not rebuild memory file truth');
  });

  try {
    const repaired = await repairWorkspaceTitleMirrorFromRootName({
      rootPath: root,
      workspaceId: 'ws_title_reconcile_swap',
    });
    assert.equal(repaired.ok, true);
    if (repaired.ok) {
      assert.equal(repaired.title, 'Renamed title');
    }
  } finally {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
  }
  assert.equal(await readFile(path.join(root, '.reo', 'index.json'), 'utf8'), previousIndex);
  assert.equal(
    JSON.parse(await readFile(path.join(root, '.reo', 'workspace.json'), 'utf8')).title,
    'Renamed title'
  );
});

test('workspace root rename commits the folder before metadata mirror writes', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'reo-root-rename-commit-'));
  const root = path.join(parent, '生活记录');
  const renamedRoot = path.join(parent, '生活记');
  await mkdir(root, { recursive: true });
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '生活记录',
    description: '',
    createWorkspaceId: () => 'ws_root_rename_commit',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  let usable = true;
  let relocatedRoot: string | null = null;
  setBeforeAtomicWorkspaceFileCommitForTest(() => {
    usable = false;
    setBeforeAtomicWorkspaceFileCommitForTest(null);
  });

  try {
    const renamed = await renameWorkspaceRootFromFileTruth({
      rootPath: root,
      workspaceId: 'ws_root_rename_commit',
      title: '生活记',
      assertWorkspaceUsable: () =>
        usable
          ? { ok: true as const }
          : {
              ok: false as const,
              error: {
                code: 'ERR_WORKSPACE_LOCK_LOST',
                dataRetention: 'none-written',
                message: 'Workspace lock was lost',
              },
            },
      relocateWorkspaceRoot: (nextCanonicalRoot) => {
        relocatedRoot = nextCanonicalRoot;
        return { ok: true };
      },
    });

    assert.equal(renamed.ok, false);
    if (!renamed.ok) {
      assert.equal(renamed.error.code, 'ERR_WORKSPACE_LOCK_LOST');
      assert.equal(renamed.error.dataRetention, 'file-written-index-stale');
    }
  } finally {
    setBeforeAtomicWorkspaceFileCommitForTest(null);
  }

  await assert.rejects(stat(root), { code: 'ENOENT' });
  assert.equal((await stat(renamedRoot)).isDirectory(), true);
  assert.equal(relocatedRoot, await realpath(renamedRoot));
  assert.equal(
    JSON.parse(await readFile(path.join(renamedRoot, '.reo', 'workspace.json'), 'utf8')).title,
    '生活记录'
  );
});

test('workspace root rename reports stale state after post-move finalization failure', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'reo-root-rename-finalize-'));
  const root = path.join(parent, '生活记录');
  const renamedRoot = path.join(parent, '生活记');
  await mkdir(root, { recursive: true });
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '生活记录',
    description: '',
    createWorkspaceId: () => 'ws_root_rename_finalize',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  let relocatedRoot: string | null = null;
  setBeforeWorkspaceRootRenameFinalizeForTest(() => {
    setBeforeWorkspaceRootRenameFinalizeForTest(null);
    throw new Error('parent directory fsync failed');
  });

  try {
    const renamed = await renameWorkspaceRootFromFileTruth({
      rootPath: root,
      workspaceId: 'ws_root_rename_finalize',
      title: '生活记',
      relocateWorkspaceRoot: (nextCanonicalRoot) => {
        relocatedRoot = nextCanonicalRoot;
        return { ok: true };
      },
    });

    assert.equal(renamed.ok, false);
    if (!renamed.ok) {
      assert.equal(renamed.error.code, 'ERR_WORKSPACE_UPDATE_FAILED');
      assert.equal(renamed.error.dataRetention, 'file-written-index-stale');
    }
  } finally {
    setBeforeWorkspaceRootRenameFinalizeForTest(null);
  }

  await assert.rejects(stat(root), { code: 'ENOENT' });
  assert.equal((await stat(renamedRoot)).isDirectory(), true);
  assert.equal(relocatedRoot, await realpath(renamedRoot));
  assert.equal(
    JSON.parse(await readFile(path.join(renamedRoot, '.reo', 'workspace.json'), 'utf8')).title,
    '生活记录'
  );
});

test('workspace root rename preserves both roots when target appears after final preflight', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'reo-root-rename-race-'));
  const root = path.join(parent, '旧空间');
  const conflictingRoot = path.join(parent, '新空间');
  await mkdir(root, { recursive: true });
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '旧空间',
    description: '',
    createWorkspaceId: () => 'ws_root_rename_race',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  setBeforeWorkspaceRootRenameCommitForTest(() => {
    setBeforeWorkspaceRootRenameCommitForTest(null);
    mkdirSync(conflictingRoot);
  });

  try {
    const renamed = await renameWorkspaceRootFromFileTruth({
      rootPath: root,
      workspaceId: 'ws_root_rename_race',
      title: '新空间',
      relocateWorkspaceRoot: () => {
        throw new Error('rename should not relocate after conflict');
      },
    });

    assert.equal(renamed.ok, false);
    if (!renamed.ok) {
      assert.equal(renamed.error.code, 'ERR_WORKSPACE_ALREADY_EXISTS');
      assert.equal(renamed.error.dataRetention, 'previous-file-preserved');
    }
  } finally {
    setBeforeWorkspaceRootRenameCommitForTest(null);
  }

  assert.equal((await stat(root)).isDirectory(), true);
  assert.equal((await stat(conflictingRoot)).isDirectory(), true);
  assert.equal(
    JSON.parse(await readFile(path.join(root, '.reo', 'workspace.json'), 'utf8')).title,
    '旧空间'
  );
});

test('workspace root rename conflict does not rebuild the memory index', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'reo-root-rename-index-conflict-'));
  const root = path.join(parent, '旧空间');
  const conflictingRoot = path.join(parent, '新空间');
  await mkdir(root, { recursive: true });
  await mkdir(conflictingRoot);
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '旧空间',
    description: '',
    createWorkspaceId: () => 'ws_root_rename_index_conflict',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFile(path.join(root, '.reo', 'index.json'), '{not json');

  const renamed = await renameWorkspaceRootFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_root_rename_index_conflict',
    title: '新空间',
    relocateWorkspaceRoot: () => {
      throw new Error('rename should not relocate after conflict');
    },
  });

  assert.equal(renamed.ok, false);
  if (!renamed.ok) {
    assert.equal(renamed.error.code, 'ERR_WORKSPACE_ALREADY_EXISTS');
    assert.equal(renamed.error.dataRetention, 'previous-file-preserved');
  }
  assert.equal(await readFile(path.join(root, '.reo', 'index.json'), 'utf8'), '{not json');
});

test('workspace root rename supports case-only title changes on case-insensitive filesystems', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'reo-root-rename-case-'));
  const probe = path.join(parent, 'case-probe');
  await mkdir(probe);
  const caseInsensitive = await stat(path.join(parent, 'CASE-PROBE')).then(
    () => true,
    () => false
  );
  if (!caseInsensitive) {
    return;
  }

  const root = path.join(parent, 'caseonly');
  await mkdir(root, { recursive: true });
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'caseonly',
    description: '',
    createWorkspaceId: () => 'ws_root_rename_case',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  const renamed = await renameWorkspaceRootFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_root_rename_case',
    title: 'CASEONLY',
    relocateWorkspaceRoot: () => ({ ok: true }),
  });

  assert.equal(renamed.ok, true);
  if (renamed.ok) {
    assert.equal(renamed.snapshot.title, 'CASEONLY');
  }
  assert.equal((await readdir(parent)).includes('CASEONLY'), true);
  assert.equal(
    JSON.parse(await readFile(path.join(parent, 'CASEONLY', '.reo', 'workspace.json'), 'utf8'))
      .title,
    'CASEONLY'
  );
});

test('workspace snapshot refresh uses root folder basename when metadata title is stale', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'reo-root-title-stale-'));
  const root = path.join(parent, '生活记呀啊');
  await mkdir(root, { recursive: true });
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '生活记录',
    description: '',
    createWorkspaceId: () => 'ws_root_title_stale',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const previousIndex = await readFile(path.join(root, '.reo', 'index.json'), 'utf8');

  const refreshed = await readWorkspaceSnapshotFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_root_title_stale',
  });

  assert.equal(refreshed.ok, true);
  if (refreshed.ok) {
    assert.equal(refreshed.snapshot.title, '生活记呀啊');
  }
  assert.equal(
    JSON.parse(await readFile(path.join(root, '.reo', 'workspace.json'), 'utf8')).title,
    '生活记呀啊'
  );
  assert.equal(await readFile(path.join(root, '.reo', 'index.json'), 'utf8'), previousIndex);
});

test('open workspace uses root folder basename when metadata title is stale', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'reo-open-root-title-stale-'));
  const root = path.join(parent, '外部改名后的空间');
  await mkdir(root, { recursive: true });
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '旧空间名',
    description: '',
    createWorkspaceId: () => 'ws_open_root_title_stale',
    now: () => '2026-05-27T06:30:00.000Z',
  });
  const previousIndex = await readFile(path.join(root, '.reo', 'index.json'), 'utf8');

  const opened = await openWorkspaceFiles({ rootPath: root });

  assert.equal(opened.ok, true);
  if (opened.ok) {
    assert.equal(opened.snapshot.title, '外部改名后的空间');
  }
  assert.equal(
    JSON.parse(await readFile(path.join(root, '.reo', 'workspace.json'), 'utf8')).title,
    '外部改名后的空间'
  );
  assert.equal(await readFile(path.join(root, '.reo', 'index.json'), 'utf8'), previousIndex);
});

test('open workspace reports lock lost before target revalidation errors', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-pre-lock-lost-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Open pre lock lost',
    description: '',
    createWorkspaceId: () => 'ws_open_pre_lock_lost',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await rename(path.join(root, '.reo'), path.join(root, '.reo-preserved'));
  await mkdir(path.join(root, '.reo'));

  const opened = await openWorkspaceFiles({
    rootPath: root,
    assertWorkspaceUsable: () => ({
      ok: false as const,
      error: {
        code: 'ERR_WORKSPACE_LOCK_LOST',
        dataRetention: 'none-written',
        message: 'Workspace lock was lost',
      },
    }),
  });

  assert.equal(opened.ok, false);
  if (!opened.ok) {
    assert.equal(opened.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
});

test('initialize workspace does not write AGENTS when lock is lost inside atomic write', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-init-atomic-lock-lost-'));
  let usable = true;
  setAfterAtomicWorkspaceFileTempOpenForTest(() => {
    usable = false;
    setAfterAtomicWorkspaceFileTempOpenForTest(null);
  });

  try {
    const initialized = await initializeWorkspaceFiles({
      rootPath: root,
      title: 'Init atomic lock lost',
      description: '',
      createWorkspaceId: () => 'ws_init_atomic_lock_lost',
      now: () => '2026-05-06T13:08:00.000Z',
      assertWorkspaceUsable: () =>
        usable
          ? { ok: true as const }
          : {
              ok: false as const,
              error: {
                code: 'ERR_WORKSPACE_LOCK_LOST',
                dataRetention: 'none-written',
                message: 'Workspace lock was lost',
              },
            },
    });
    assert.equal(initialized.ok, false);
    if (!initialized.ok) {
      assert.equal(initialized.error.code, 'ERR_WORKSPACE_LOCK_LOST');
      assert.equal(initialized.error.dataRetention, 'none-written');
    }
  } finally {
    setAfterAtomicWorkspaceFileTempOpenForTest(null);
  }

  await assert.rejects(stat(path.join(root, 'AGENTS.md')));
});

test('open workspace does not create drafts when lock identity is lost during drafts ensure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-drafts-lock-lost-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Open drafts lock lost',
    description: '',
    createWorkspaceId: () => 'ws_open_drafts_lock_lost',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await rm(path.join(root, '.reo', 'drafts'), { force: true, recursive: true });
  let usable = true;
  setAfterWorkspaceReoDirectoryCheckForTest(async () => {
    setAfterWorkspaceReoDirectoryCheckForTest(null);
    usable = false;
    await rename(path.join(root, '.reo'), path.join(root, '.reo-preserved'));
    await mkdir(path.join(root, '.reo'));
  });

  try {
    const opened = await openWorkspaceFiles({
      rootPath: root,
      assertWorkspaceUsable: () =>
        usable
          ? { ok: true as const }
          : {
              ok: false as const,
              error: {
                code: 'ERR_WORKSPACE_LOCK_LOST',
                dataRetention: 'none-written',
                message: 'Workspace lock was lost',
              },
            },
    });
    assert.equal(opened.ok, false);
    if (!opened.ok) {
      assert.equal(opened.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
  } finally {
    setAfterWorkspaceReoDirectoryCheckForTest(null);
  }
  await assert.rejects(stat(path.join(root, '.reo', 'drafts')));
});

test('workspace snapshot refresh computes replacement after a metadata refresh', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-reconcile-current-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Open reconcile current',
    description: '',
    createWorkspaceId: () => 'ws_open_reconcile_current',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_open_reconcile_current',
    memoryId: 'mem_open_reconcile_current',
    segmentId: 'seg_open_reconcile_current',
    title: 'Open reconcile current',
    audio: new Uint8Array([1, 2, 3]),
    durationMs: 3000,
  });
  setBeforeWorkspaceIndexReconciliationPersistForTest(async () => {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
    await writeFile(
      path.join(
        root,
        'memories',
        'mem_open_reconcile_current',
        'segments',
        'seg_open_reconcile_current',
        'segment.md'
      ),
      renderWorkspaceMarkdownObject({
        objectType: 'segment',
        data: { title: 'Open reconcile current', kind: 'audio' },
        content: '# Open reconcile current\n\n## Transcript\n\nOpen-time transcript\n',
      })
    );
  });

  try {
    const snapshot = await readWorkspaceSnapshotFromFileTruth({
      rootPath: root,
      workspaceId: 'ws_open_reconcile_current',
    });
    assert.equal(snapshot.ok, true);
    if (snapshot.ok) {
      assert.equal(snapshot.snapshot.memories[0]?.hasAudioTranscript, true);
    }
  } finally {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
  }
  const index = JSON.parse(await readFile(path.join(root, '.reo', 'index.json'), 'utf8'));
  assert.equal(index.memories[0].hasAudioTranscript, true);
});

test('open workspace recreates missing managed directories before returning ready', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-managed-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '托管目录',
    description: '',
    createWorkspaceId: () => 'ws_open_managed',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await rm(path.join(root, '.reo', 'drafts'), { force: true, recursive: true });
  await rm(path.join(root, 'memories'), { force: true, recursive: true });

  const opened = await openWorkspaceFiles({ rootPath: root });

  assert.equal(opened.ok, true);
  await stat(path.join(root, '.reo', 'drafts', 'segments'));
  await stat(path.join(root, 'memories'));
});

test('workspace index update does not persist reconciliation before update succeeds', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-index-update-failure-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '更新失败索引',
    description: '',
    createWorkspaceId: () => 'ws_index_update_failure',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_index_update_failure',
    memoryId: 'mem_20260506_000003',
    segmentId: 'seg_20260506_000003',
    title: '不应提前写入',
    audio: new Uint8Array([8, 9]),
    durationMs: 5_000,
  });
  await writeFile(
    path.join(root, '.reo', 'index.json'),
    '{\n  "schemaVersion": 1,\n  "memories": []\n}\n'
  );

  await assert.rejects(
    updateWorkspaceIndex(root, () => {
      throw new Error('Index update failed');
    }),
    /Index update failed/
  );

  assert.deepEqual(JSON.parse(await readFile(path.join(root, '.reo', 'index.json'), 'utf8')), {
    schemaVersion: 1,
    memories: [],
  });
});

test('index rebuild ignores symlinked segment markdown files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-markdown-presence-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-markdown-outside-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Markdown presence',
    description: '',
    createWorkspaceId: () => 'ws_markdown_presence',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_markdown_presence',
    memoryId: 'mem_20260506_markdown_presence',
    segmentId: 'seg_20260506_markdown_presence',
    title: 'Markdown presence',
    audio: new Uint8Array([1]),
    durationMs: 1000,
  });
  const recordingDirectory = path.join(
    root,
    'memories',
    'mem_20260506_markdown_presence',
    'segments',
    'seg_20260506_markdown_presence'
  );
  await writeFile(
    path.join(outside, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title: 'outside', kind: 'audio' },
      content: '# outside\n\n## Transcript\n\noutside transcript\n',
    })
  );
  await rm(path.join(recordingDirectory, 'segment.md'));
  await symlink(path.join(outside, 'segment.md'), path.join(recordingDirectory, 'segment.md'));

  const opened = await readWorkspaceSnapshotFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_markdown_presence',
  });

  assert.equal(opened.ok, true);
  if (opened.ok) {
    assert.equal(opened.snapshot.memories[0]?.segmentCount, 0);
    assert.equal(opened.snapshot.memories[0]?.supplementCount, 0);
  }
});

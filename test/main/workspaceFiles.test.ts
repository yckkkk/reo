import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
import type { JSONContent } from '@tiptap/core';
import {
  DEFAULT_WORKSPACE_AGENTS_MD,
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
import { writeWorkspaceNeedsReviewReport } from '../../src/main/workspaceReviewReport.js';
import {
  setAfterAtomicWorkspaceFileTempOpenForTest,
  setBeforeAtomicWorkspaceFileCommitForTest,
} from '../../src/main/atomicWorkspaceFile.js';
import {
  extractSegmentTranscript,
  setBeforeReadModelReaddirForTest,
} from '../../src/main/memoryFiles.js';
import { setAfterWorkspaceReoDirectoryCheckForTest } from '../../src/main/workspacePaths.js';

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

test('existing AGENTS.md conflict does not write any workspace files', async () => {
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

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_AGENTS_CONFLICT');
  }
  assert.equal(await sha256(agentsPath), beforeHash);
  await assert.rejects(stat(path.join(root, '.reo')));
});

test('dangling AGENTS.md symlink conflict does not write workspace files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-dangling-agents-'));
  await symlink(path.join(root, 'missing-user-agents.md'), path.join(root, 'AGENTS.md'));

  const result = await initializeWorkspaceFiles({
    rootPath: root,
    title: '会议记录',
    description: '产品讨论',
    createWorkspaceId: () => 'ws_conflict',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_AGENTS_CONFLICT');
    assert.equal(result.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(root, '.reo')));
  await assert.rejects(stat(path.join(root, 'memories')));
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
  assert.deepEqual((await readdir(root)).sort(), ['.reo', 'AGENTS.md', 'memories', 'skills']);
  const agentsText = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.equal(agentsText, DEFAULT_WORKSPACE_AGENTS_MD);
  assert.match(agentsText, /Codex/);
  assert.match(agentsText, /核心实体/);
  assert.match(agentsText, /不需要离开当前记忆空间查询 Reo 仓库源码/);
  assert.match(agentsText, /skills\/reo-edit\/SKILL\.md/);
  assert.match(agentsText, /skills\/reo-doctor\/SKILL\.md/);
  assert.match(agentsText, /<!-- reo-managed:agent-entry:start v\d+ -->/);
  assert.doesNotMatch(agentsText, /普通文字/);
  assert.doesNotMatch(agentsText, /var\(--tt-color-highlight-blue\)/);
  assert.doesNotMatch(agentsText, /source\.hash/);
  assert.deepEqual((await readdir(path.join(root, 'skills'))).sort(), ['reo-doctor', 'reo-edit']);
  assert.deepEqual((await readdir(path.join(root, 'skills', 'reo-edit'))).sort(), ['SKILL.md']);
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
    'drafts',
    'index.json',
    'workspace.json',
  ]);
  assert.deepEqual(await readdir(path.join(root, '.reo', 'drafts')), ['segments']);
  for (const forbidden of ['photos', 'videos', 'files', 'films']) {
    await assert.rejects(stat(path.join(root, forbidden)));
  }
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
  assert.equal(await readFile(path.join(root, 'AGENTS.md'), 'utf8'), DEFAULT_WORKSPACE_AGENTS_MD);
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
  await stat(path.join(root, 'skills', 'reo-doctor', 'scripts', 'reo-doctor.mjs'));
});

test('open workspace preserves custom AGENTS content while adding the Reo managed block', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-custom-agents-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Custom agents',
    description: '',
    createWorkspaceId: () => 'ws_custom_agents',
    now: () => '2026-05-26T12:43:00.000Z',
  });
  await writeFile(path.join(root, 'AGENTS.md'), '# 用户规则\n\n保留我的长期偏好。\n');
  await rm(path.join(root, 'skills'), { force: true, recursive: true });

  const opened = await openWorkspaceFiles({ rootPath: root });

  assert.equal(opened.ok, true);
  const agentsText = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.match(agentsText, /# 用户规则/);
  assert.match(agentsText, /保留我的长期偏好/);
  assert.match(agentsText, /<!-- reo-managed:agent-entry:start v\d+ -->/);
  assert.match(agentsText, /skills\/reo-edit\/SKILL\.md/);
  assert.equal((agentsText.match(/reo-managed:agent-entry:start/g) ?? []).length, 1);
  await stat(path.join(root, 'skills', 'reo-edit', 'SKILL.md'));
  await stat(path.join(root, 'skills', 'reo-doctor', 'scripts', 'reo-doctor.mjs'));
});

test('open workspace upgrades known legacy Reo AGENTS template instead of preserving slow-path guidance', async () => {
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

  const opened = await openWorkspaceFiles({ rootPath: root });

  assert.equal(opened.ok, true);
  const agentsText = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.equal(agentsText, DEFAULT_WORKSPACE_AGENTS_MD);
  assert.doesNotMatch(agentsText, /source\.hash/);
  assert.doesNotMatch(agentsText, /如果要精确表达 Tiptap JSON/);
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
  await rm(path.join(root, 'skills', 'reo-doctor', 'SKILL.md'), { force: true });
  await rm(path.join(root, 'skills', 'reo-edit', 'SKILL.md'), { force: true });

  const result = spawnSync(
    process.execPath,
    [path.join(root, 'skills', 'reo-doctor', 'scripts', 'reo-doctor.mjs'), '--fix'],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout) as {
    readonly ok: boolean;
    readonly repaired: {
      readonly agentsMd: boolean;
      readonly doctorSkill: boolean;
      readonly editSkill: boolean;
    };
  };
  assert.equal(report.ok, true);
  assert.equal(report.repaired.agentsMd, true);
  assert.equal(report.repaired.doctorSkill, true);
  assert.equal(report.repaired.editSkill, true);
  const agentsText = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.match(agentsText, /只修改当前任务需要的文件/);
  assert.match(agentsText, /<!-- reo-managed:agent-entry:start v\d+ -->/);
  assert.match(
    await readFile(path.join(root, 'skills', 'reo-doctor', 'SKILL.md'), 'utf8'),
    /^name: reo-doctor/m
  );
  assert.match(
    await readFile(path.join(root, 'skills', 'reo-edit', 'SKILL.md'), 'utf8'),
    /^name: reo-edit/m
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
    },
  ]);
  assert.deepEqual(report.issues, [
    {
      code: 'needs-review',
      path: '.reo/review/needs-review.json',
    },
  ]);
});

test('reo-doctor skill script does not overwrite symlink targets while repairing managed config', async () => {
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
      readonly agentsMd: boolean;
      readonly editSkill: boolean;
    };
    readonly issues: readonly { readonly path: string; readonly code: string }[];
  };
  assert.equal(report.ok, false);
  assert.equal(report.repaired.agentsMd, false);
  assert.equal(report.repaired.editSkill, false);
  assert.deepEqual(report.issues.map((issue) => [issue.path, issue.code]).sort(), [
    ['AGENTS.md', 'not-file'],
    ['skills/reo-edit/SKILL.md', 'not-file'],
  ]);
  assert.equal(await readFile(outsideAgents, 'utf8'), 'outside agents must stay unchanged\n');
  assert.equal(await readFile(outsideSkill, 'utf8'), 'outside skill must stay unchanged\n');
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
    audioDurationMs: 12_000,
    audioByteLength: 3,
    hasAudioTranscript: false,
    hasAnyNote: false,
    supplementCount: 0,
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

test('open workspace uses a valid index without scanning finalized memory files', async () => {
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
    audioDurationMs: 3000,
    audioByteLength: 3,
    hasAudioTranscript: false,
    hasAnyNote: false,
    supplementCount: 0,
  };
  await writeFile(
    path.join(root, '.reo', 'index.json'),
    `${JSON.stringify({ schemaVersion: 1, memories: [indexedMemory] }, null, 2)}\n`
  );
  setBeforeReadModelReaddirForTest(() => {
    throw new Error('open should not rebuild the read model when index is valid');
  });

  try {
    assert.deepEqual(await openWorkspaceFiles({ rootPath: root }), {
      ok: true,
      snapshot: {
        workspaceId: 'ws_fast_open',
        title: path.basename(root),
        description: '',
        memories: [indexedMemory],
      },
    });
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
    audioDurationMs: 3000,
    audioByteLength: 3,
    hasAudioTranscript: false,
    hasAnyNote: false,
    supplementCount: 0,
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

test('open workspace uses stale valid index and snapshot refresh reconciles file truth', async () => {
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
    audioDurationMs: 34_000,
    audioByteLength: 4,
    hasAudioTranscript: false,
    hasAnyNote: false,
    supplementCount: 0,
  };
  assert.deepEqual(await openWorkspaceFiles({ rootPath: root }), {
    ok: true,
    snapshot: {
      workspaceId: 'ws_stale_index',
      title: path.basename(root),
      description: '',
      memories: [],
    },
  });
  assert.deepEqual(JSON.parse(await readFile(path.join(root, '.reo', 'index.json'), 'utf8')), {
    schemaVersion: 1,
    memories: [],
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

test('open workspace returns valid index without reconciliation before returning ready', async () => {
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
    assert.equal(opened.ok, true);
  } finally {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
  }
  assert.equal(reconciliationStarted, false);
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

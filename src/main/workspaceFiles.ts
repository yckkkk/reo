import { spawnSync } from 'node:child_process';
import { lstatSync, realpathSync, renameSync } from 'node:fs';
import { lstat, mkdir, opendir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  writeWorkspaceFileAtomic,
  writeWorkspaceFileNoReplaceAtomic,
  writeWorkspaceJsonAtomic,
} from './atomicWorkspaceFile.js';
import {
  assertSameCurrentDirectoryIdentity as assertSameCurrentDirectory,
  assertSameDirectoryIdentitySync as assertSameDirectoryPath,
  readSafeDirectoryIdentitySync as readDirectoryIdentitySync,
  sameDirectoryIdentity,
  type DirectoryIdentity,
} from './directoryIdentity.js';
import {
  rebuildMemoryIndex,
  rebuildWorkspaceReadModel,
  recoverRecordingFinalizeTransactions,
  replaceWorkspaceIndex,
  updateWorkspaceIndexFromCurrent,
  type MemorySummary,
} from './memoryFiles.js';
import {
  checkWorkspaceDraftsDirectory,
  checkWorkspaceMemoriesDirectory,
  checkWorkspaceReoDirectory,
  createNewWorkspaceRootDirectory,
  ensureWorkspaceDraftsDirectory,
  ensureWorkspaceMemoriesDirectory,
  getWorkspaceIndexPath,
  getWorkspaceMetadataPath,
  resolveWorkspaceRoot,
} from './workspacePaths.js';
import {
  WORKSPACE_REVIEW_FALLBACK_RECOVERY_HINT,
  WORKSPACE_REVIEW_RECOVERY_HINTS,
  writeWorkspaceNeedsReviewReport,
} from './workspaceReviewReport.js';
import {
  workspaceError,
  workspaceMemorySummarySchema,
  type WorkspaceErrorEnvelope,
  type WorkspaceReviewSummary,
  type WorkspaceSnapshot,
} from '../workspace-contract/workspace-contract.js';
import { REO_TIPTAP_HIGHLIGHT_COLOR_VALUES } from '../tiptap-markdown/tiptapHighlightColors.js';
import { isSafeWorkspaceDirectoryName } from '../workspace-contract/workspace-name.js';
import { readBoundedJsonNoFollow } from './workspaceJsonFile.js';
import {
  fsyncCurrentWorkspaceDirectoryBestEffort,
  runInWorkspaceDirectorySync,
} from './workspaceDirectoryTransactions.js';

const WORKSPACE_SCHEMA_VERSION = 1;
const MAX_WORKSPACE_JSON_BYTES = 1_048_576;
const EMPTY_WORKSPACE_IGNORED_ENTRIES = new Set(['.DS_Store']);
const EMPTY_WORKSPACE_LOCK_REO_ENTRIES = new Set(['workspace.lock', 'workspace.lock.lock']);
const WORKSPACE_ROOT_RENAME_TIMEOUT_MS = 5000;
const DARWIN_MOVE_ITEM_NO_REPLACE_SCRIPT =
  'function run(argv) { ObjC.import("Foundation"); const ok = $.NSFileManager.defaultManager.moveItemAtPathToPathError(argv[0], argv[1], null); if (!ok) throw new Error("move failed"); }';
const WORKSPACE_AGENTS_MANAGED_BLOCK_START = '<!-- reo-managed:agent-entry:start v1 -->';
const WORKSPACE_AGENTS_MANAGED_BLOCK_END = '<!-- reo-managed:agent-entry:end -->';
const DEFAULT_WORKSPACE_AGENTS_MANAGED_BLOCK = [
  WORKSPACE_AGENTS_MANAGED_BLOCK_START,
  '## Reo 是什么',
  '',
  'Reo 是一个 agent-native 的本地记忆空间。人类、Codex 和其他 agent 都可以把它当作普通文件夹读写；Reo 负责把合法文件改动重新投影回应用界面。',
  '',
  '这个入口的目标是降低判断成本，不是限制能力。Agent 可以编辑任何文件；一般任务应优先读写用户语义文件，复杂一致性由 Reo 在打开、刷新、保存时收敛。',
  '',
  '## 普通任务默认路径',
  '',
  '- 普通任务默认在 `memories/` 下改用户语义文件和目录。',
  '- 按任务需要可以编辑 Markdown、同节点 `content.tiptap.json`、附件和普通对象文件；不要把能力限制成 Markdown-only。',
  '- 先读目标 `memory.md`、`segment.md`、`supplement.md` 和附近目录名；必要时再读 `skills/reo-edit/SKILL.md`。',
  '- 普通编辑、创建、重命名和移动任务不需要离开当前记忆空间查询 Reo 仓库源码、全局记忆或历史文档；当前 `AGENTS.md`、`skills/reo-edit/SKILL.md` 和目标文件通常已经足够。',
  '- 不要为了普通内容任务推理 hash、sidecar、manifest、index 或 lock；先完成用户可见的文件改动。',
  '- 验证直接文件效果后停止；Reo 会在打开、刷新或保存时收敛可确定的技术镜像。',
  '',
  '## 需要检查时',
  '',
  '- 只有 Reo 明确提示 needs-review、缺失托管配置、重复 id、sidecar/mirror 冲突，或用户明确要求诊断时，才读取 `skills/reo-doctor/SKILL.md`。',
  '- 诊断入口是 `node skills/reo-doctor/scripts/reo-doctor.mjs`。',
  '- 按 doctor 和 `.reo/review/needs-review.md` 的 workspace-relative 信息与 recovery hint 修复；不要猜测合并，不要删除用户内容。',
  '',
  '## 核心实体',
  '',
  '- Memory space：当前文件夹本身，是一个可被 Finder、编辑器和 agent 打开的 Reo 记忆空间。',
  '- Memory：`memories/` 下的一组长期主题或语义容器。',
  '- Segment：Memory 内的正文片段，可以是 note、audio 或未来更多类型。',
  '- SegmentSupplement：挂在某个 Segment 下的补充内容。',
  '- `.reo/`：Reo 的技术完整性层，保存索引、manifest、草稿、回收站、lock 和恢复信息。',
  '- `skills/`：给 agent 使用的工作流技能，不是用户语义内容本身。',
  '',
  '## 文件层',
  '',
  '- `memories/` 保存用户语义内容，是普通编辑和创建任务的默认工作区。',
  '- Memory 使用 `memory.md`，Segment 使用 `segment.md`，SegmentSupplement 使用 `supplement.md`。',
  '- `content.tiptap.json` 是同一正文的富结构载体，由 Reo 与编辑器维护。',
  '- 普通 `.json`、`.html` 或未被对象合同识别的文件不会自动成为 Reo 对象。',
  '- 目录 basename 是用户可见名称的一部分；对象身份由稳定 id 承载。',
  '',
  '## 安全边界',
  '',
  '- 不要创建 symlink，不要移动 `.reo/workspace.lock*`，不要删除不属于当前任务的文件。',
  '- 如果文件缺字段或名称不完整，Reo 会做确定性补全；无法判断的冲突保留内容并进入 needs-review。',
  '- 遇到 Reo 报错或不确定恢复路径时，停止猜测并使用 `reo-doctor`。',
  WORKSPACE_AGENTS_MANAGED_BLOCK_END,
].join('\n');
export const DEFAULT_WORKSPACE_AGENTS_MD = `# Reo 记忆空间 Agent 入口\n\n${DEFAULT_WORKSPACE_AGENTS_MANAGED_BLOCK}\n`;
export const DEFAULT_REO_EDIT_SKILL_MD =
  [
    '---',
    'name: reo-edit',
    'description: Use when editing, creating, renaming, moving, or organizing files inside a Reo memory space, including Memory, Segment, SegmentSupplement, Markdown, HTML rich text marks, titles, and directory names.',
    '---',
    '',
    '# Reo Edit',
    '',
    'Use this skill for normal Reo memory-space file work. The goal is to edit files directly and let Reo reconcile deterministic structure later.',
    '',
    '## Quick Start',
    '',
    'For ordinary edit, create, rename, move or organize tasks:',
    '',
    '1. Read the target `memory.md`, `segment.md` or `supplement.md` and nearby directory names.',
    '2. Apply the requested change to ordinary files and directories under `memories/`.',
    '3. Preserve existing stable ids; add simple frontmatter ids only for new Segment or SegmentSupplement objects.',
    '4. Verify direct file effects, then stop.',
    '',
    'Ordinary tasks may edit Markdown, same-node `content.tiptap.json`, attachments and ordinary object files when the requested change needs them. Do not reduce Reo work to Markdown-only.',
    '',
    'Do not read Reo repo source, global agent memories, `.reo`, hash fields, manifests or sidecars for ordinary tasks. Use those only when the user asks for low-level repair/testing or Reo reports an explicit conflict.',
    '',
    '## Stop Rules',
    '',
    '- After direct file verification, stop.',
    '- Do not inspect Reo repo source, global memories, `.reo`, hashes, manifests, index or lock files for ordinary tasks.',
    '- Do not run `reo-doctor` unless Reo reports needs-review, missing managed config, duplicate ids, sidecar conflicts, mirror issues, or the user explicitly asks for diagnosis.',
    '- Do not maintain `.reo`, `source.hash`, `contentHash`, manifest mirrors or `.reo/index.json`; Reo owns deterministic convergence.',
    '- You may edit any file when the task requires it; the non-default boundary is Reo-owned technical mirrors, not file extension.',
    '',
    '## Common File Operations',
    '',
    '| Task | Normal action |',
    '| --- | --- |',
    '| Edit Memory text | Edit `memories/<memory>/memory.md`. |',
    '| Edit Segment text | Edit `memories/<memory>/segments/<segment>/segment.md`. |',
    '| Edit Supplement text | Edit `memories/<memory>/segments/<segment>/supplements/<supplement>/supplement.md`. |',
    '| Rename Memory | Rename the Memory directory basename and update `memory.md` title/frontmatter. |',
    '| Rename Segment | Rename the Segment directory basename and update `segment.md` title/frontmatter. |',
    '| Rename Supplement | Rename the Supplement directory basename and update `supplement.md` title/frontmatter. |',
    '| Move Segment | Move the whole Segment directory under another Memory `segments/` directory. |',
    '| Move Supplement | Move the whole Supplement directory under another Segment `supplements/` directory. |',
    '',
    'Keep stable ids in directory prefixes and Markdown frontmatter when they already exist. For a new object, use a clear deterministic id prefix such as `mem_agent_<slug>`, `seg_agent_<slug>` or `sup_agent_<slug>`.',
    '',
    '## Minimal Shapes',
    '',
    'Memory:',
    '',
    '```markdown',
    '---',
    'title: My Memory',
    '---',
    '# My Memory',
    '',
    'Body text.',
    '```',
    '',
    'Note Segment:',
    '',
    '```markdown',
    '---',
    'id: seg_agent_example',
    'title: My Segment',
    'kind: note',
    '---',
    '# My Segment',
    '',
    'Body text.',
    '```',
    '',
    'Note Supplement:',
    '',
    '```markdown',
    '---',
    'id: sup_agent_example',
    'title: My Supplement',
    'kind: note',
    '---',
    '# My Supplement',
    '',
    'Body text.',
    '```',
    '',
    '## Rich Text Markdown',
    '',
    'Use the Reo Markdown profile: standard Markdown/GFM plus Tiptap-compatible HTML and a few Reo profile marks that the editor can roundtrip.',
    '',
    'For ordinary tasks, edit Markdown in `memory.md`, `segment.md` or `supplement.md`. Reo will reconcile matching `content.tiptap.json` later.',
    '',
    '| Format | Shortest path | Notes |',
    '| --- | --- | --- |',
    '| Heading | `# Heading` through `###### Heading` | Toolbar exposes H1-H4; file/profile can carry H1-H6. |',
    '| Bold | `**text**` | Standard Markdown. |',
    '| Italic | `*text*` | Standard Markdown. |',
    '| Strike | `~~text~~` | GFM. |',
    '| Inline code | `` `code` `` | Standard Markdown. |',
    '| Highlight | `==text==` | No color. |',
    '| Colored highlight | `<mark data-color="var(--tt-color-highlight-blue)" style="background-color: var(--tt-color-highlight-blue); color: inherit">text</mark>` | Use only Reo toolbar highlight tokens. |',
    '| Underline | `++text++` or `<u>text</u>` | Reo profile mark. |',
    '| Superscript | `<sup>text</sup>` | HTML-compatible Markdown. |',
    '| Subscript | `<sub>text</sub>` | HTML-compatible Markdown. |',
    '| Link | `[text](https://example.com)` | Use http or https URLs. |',
    '| Bullet list | `- item` | GFM/Markdown. |',
    '| Ordered list | `1. item` | GFM/Markdown. |',
    '| Task list | `- [ ] task` and `- [x] done` | GFM task list. |',
    '| Fenced code block | fenced block with optional language | See example below. |',
    '| Blockquote | `> quote` | Standard Markdown. |',
    '| Alignment | `<p style="text-align: center">text</p>` or aligned heading HTML | Supports left, center, right and justify. |',
    '',
    '````markdown',
    '## Heading',
    '',
    '**Bold**, *italic*, ~~strike~~, `inline code`, ++underline++.',
    '',
    '==Plain highlight==',
    '',
    '<mark data-color="var(--tt-color-highlight-blue)" style="background-color: var(--tt-color-highlight-blue); color: inherit">Blue highlight</mark>',
    '',
    '<sup>superscript</sup> <sub>subscript</sub>',
    '',
    '[Link](https://example.com)',
    '',
    '> Blockquote',
    '',
    '```ts',
    'const value = 1',
    '```',
    '',
    '- [ ] Todo',
    '- [x] Done',
    '',
    '<p style="text-align: center">Centered paragraph</p>',
    '````',
    '',
    '## Expert Tiptap JSON',
    '',
    'Use Expert Tiptap JSON only when the user asks for exact rich structure or Markdown cannot express the requested mark precisely.',
    'If exact rich structure is easier in JSON, edit only the `content` field in the same-node `content.tiptap.json`.',
    'Do not maintain `source.hash` or `contentHash`; Reo recalculates or validates those fields when it reconciles the Markdown and sidecar.',
    'Only content that can serialize back through the Reo Markdown profile is accepted automatically. Unknown nodes, unknown marks, arbitrary CSS colors and unsafe link attrs stay in review instead of being silently written to Markdown.',
    '',
    'Supported toolbar highlight colors:',
    '',
    ...REO_TIPTAP_HIGHLIGHT_COLOR_VALUES.map((value) => `- \`${value}\``),
  ].join('\n') + '\n';
export const DEFAULT_REO_DOCTOR_SKILL_MD =
  [
    '---',
    'name: reo-doctor',
    'description: Use when a Reo memory space has missing config, sidecar or mirror errors, duplicate ids, needs-review items, or the agent is unsure whether direct file edits left the space consistent.',
    '---',
    '',
    '# Reo Doctor',
    '',
    'Recovery-only: do not run this skill before ordinary edits. For ordinary editing, creation, rename or move tasks, use `skills/reo-edit/SKILL.md` first.',
    'Run it only after Reo reports needs-review, missing managed config, duplicate ids, sidecar conflicts, mirror issues, or when the user explicitly asks for diagnosis.',
    '',
    'Default rule: do not spend time reasoning about Reo internals unless a Reo error, missing config, duplicate id, sidecar conflict, mirror issue or needs-review state appears.',
    '',
    '## Quick Check',
    '',
    'From the memory space root, run:',
    '',
    '```bash',
    'node skills/reo-doctor/scripts/reo-doctor.mjs',
    '```',
    '',
    'To apply deterministic safe repairs:',
    '',
    '```bash',
    'node skills/reo-doctor/scripts/reo-doctor.mjs --fix',
    '```',
    '',
    'The script repairs Reo managed `AGENTS.md` blocks and managed skill files, then reports unresolved issues. It must preserve user-written content in `AGENTS.md`.',
    'When `.reo/review/needs-review.json` exists, the script prints the unresolved entries with workspace-relative paths and recovery hints.',
    '',
    '## Boundaries',
    '',
    '- Deterministic missing managed config can be repaired.',
    '- Duplicate ids, conflicting sidecar changes, ambiguous parentage and user content conflicts must be reported instead of guessed.',
    '- Do not delete semantic files during repair unless the user explicitly asks.',
  ].join('\n') + '\n';
export const DEFAULT_REO_DOCTOR_SCRIPT_MJS =
  [
    '#!/usr/bin/env node',
    "import { constants } from 'node:fs';",
    "import { lstat, mkdir, open, readFile } from 'node:fs/promises';",
    "import path from 'node:path';",
    '',
    "const START = '<!-- reo-managed:agent-entry:start v1 -->';",
    "const END = '<!-- reo-managed:agent-entry:end -->';",
    `const DEFAULT_AGENTS_MD = ${JSON.stringify(DEFAULT_WORKSPACE_AGENTS_MD)};`,
    `const MANAGED_BLOCK = ${JSON.stringify(DEFAULT_WORKSPACE_AGENTS_MANAGED_BLOCK)};`,
    `const DOCTOR_SKILL_MD = ${JSON.stringify(DEFAULT_REO_DOCTOR_SKILL_MD)};`,
    `const EDIT_SKILL_MD = ${JSON.stringify(DEFAULT_REO_EDIT_SKILL_MD)};`,
    `const RECOVERY_HINTS = ${JSON.stringify(WORKSPACE_REVIEW_RECOVERY_HINTS)};`,
    `const FALLBACK_RECOVERY_HINT = ${JSON.stringify(WORKSPACE_REVIEW_FALLBACK_RECOVERY_HINT)};`,
    'const NOFOLLOW = constants.O_NOFOLLOW ?? 0;',
    '',
    'const fix = process.argv.includes("--fix");',
    'const root = process.cwd();',
    'const report = { ok: true, mode: fix ? "fix" : "check", repaired: { agentsMd: false, doctorSkill: false, editSkill: false }, issues: [] };',
    '',
    'async function readRegularText(filePath) {',
    '  try {',
    '    const stats = await lstat(filePath);',
    '    if (!stats.isFile()) {',
    '      report.ok = false;',
    '      report.issues.push({ path: path.relative(root, filePath), code: "not-file" });',
    '      return { status: "unsafe" };',
    '    }',
    '    return { status: "file", text: await readFile(filePath, "utf8") };',
    '  } catch (error) {',
    '    if (error && error.code === "ENOENT") return { status: "missing" };',
    '    throw error;',
    '  }',
    '}',
    '',
    'function isLegacyReoAgentsTemplate(current) {',
    '  const firstManagedBlockIndex = current.indexOf(START);',
    '  const legacyPrefix = firstManagedBlockIndex >= 0 ? current.slice(0, firstManagedBlockIndex) : current;',
    '  return legacyPrefix.trimStart().startsWith("# Reo 记忆空间 Agent 入口") && legacyPrefix.includes("## 读写边界") && legacyPrefix.includes("如果要精确表达 Tiptap JSON") && legacyPrefix.includes("source.hash") && legacyPrefix.includes("## 验证建议");',
    '}',
    '',
    'function upsertManagedBlock(readResult) {',
    '  if (readResult.status === "unsafe") return null;',
    '  const current = readResult.status === "file" ? readResult.text : null;',
    '  if (current === null || current.trim().length === 0 || isLegacyReoAgentsTemplate(current)) return DEFAULT_AGENTS_MD;',
    '  const start = current.indexOf(START);',
    '  const end = current.indexOf(END);',
    '  if (start >= 0 && end >= start) {',
    '    return `${current.slice(0, start)}${MANAGED_BLOCK}${current.slice(end + END.length)}`.replace(/\\n*$/, "\\n");',
    '  }',
    '  return `${current.trimEnd()}\\n\\n${MANAGED_BLOCK}\\n`;',
    '}',
    '',
    'async function writeRegularText(filePath, readResult, next) {',
    '  if (readResult.status === "unsafe") return false;',
    '  if (!fix) return true;',
    '  const flags = readResult.status === "missing" ? constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | NOFOLLOW : constants.O_WRONLY | constants.O_TRUNC | NOFOLLOW;',
    '  let handle;',
    '  try {',
    '    handle = await open(filePath, flags, 0o666);',
    '    await handle.writeFile(next);',
    '    return true;',
    '  } catch (error) {',
    '    report.ok = false;',
    '    report.issues.push({ path: path.relative(root, filePath), code: error && error.code ? `write-${error.code}` : "write-failed" });',
    '    return false;',
    '  } finally {',
    '    await handle?.close();',
    '  }',
    '}',
    '',
    'async function ensureDirectory(directoryPath) {',
    '  try {',
    '    const stats = await lstat(directoryPath);',
    '    if (!stats.isDirectory()) {',
    '      report.ok = false;',
    '      report.issues.push({ path: path.relative(root, directoryPath), code: "not-directory" });',
    '      return false;',
    '    }',
    '    return true;',
    '  } catch (error) {',
    '    if (!error || error.code !== "ENOENT") throw error;',
    '    if (fix) await mkdir(directoryPath);',
    '    return fix;',
    '  }',
    '}',
    '',
    'function isSafeRelativePath(value) {',
    '  return typeof value === "string" && value.length > 0 && !path.isAbsolute(value) && !value.split(/[\\\\/]+/).includes("..");',
    '}',
    '',
    'function recoveryHintForReason(reason) {',
    '  return Object.prototype.hasOwnProperty.call(RECOVERY_HINTS, reason) ? RECOVERY_HINTS[reason] : FALLBACK_RECOVERY_HINT;',
    '}',
    '',
    'function sanitizeReviewEntry(entry) {',
    '  if (!entry || typeof entry !== "object") return null;',
    '  if (typeof entry.category !== "string" || typeof entry.reason !== "string") return null;',
    '  if (!Array.isArray(entry.paths) || entry.paths.length === 0) return null;',
    '  const paths = entry.paths.filter(isSafeRelativePath);',
    '  if (paths.length !== entry.paths.length) return null;',
    '  const recoveryHint = recoveryHintForReason(entry.reason);',
    '  return { category: entry.category, reason: entry.reason, recoveryHint, paths, ...(typeof entry.objectType === "string" ? { objectType: entry.objectType } : {}), ...(typeof entry.kind === "string" ? { kind: entry.kind } : {}) };',
    '}',
    '',
    'async function readNeedsReviewReport() {',
    '  const reportPath = path.join(root, ".reo", "review", "needs-review.json");',
    '  const current = await readRegularText(reportPath);',
    '  if (current.status === "missing" || current.status === "unsafe") return;',
    '  try {',
    '    const parsed = JSON.parse(current.text);',
    '    const rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];',
    '    const entries = rawEntries.map(sanitizeReviewEntry);',
    '    if (entries.some((entry) => entry === null)) {',
    '      report.ok = false;',
    '      report.issues.push({ path: ".reo/review/needs-review.json", code: "needs-review-invalid" });',
    '      return;',
    '    }',
    '    if (entries.length > 0) {',
    '      report.ok = false;',
    '      report.needsReview = { count: entries.length, entries };',
    '      report.issues.push({ path: ".reo/review/needs-review.json", code: "needs-review" });',
    '    }',
    '  } catch {',
    '    report.ok = false;',
    '    report.issues.push({ path: ".reo/review/needs-review.json", code: "needs-review-invalid" });',
    '  }',
    '}',
    '',
    'async function main() {',
    '  const agentsPath = path.join(root, "AGENTS.md");',
    '  const currentAgents = await readRegularText(agentsPath);',
    '  const nextAgents = upsertManagedBlock(currentAgents);',
    '  if (nextAgents !== null && (currentAgents.status !== "file" || currentAgents.text !== nextAgents)) {',
    '    report.repaired.agentsMd = true;',
    '    await writeRegularText(agentsPath, currentAgents, nextAgents);',
    '  }',
    '',
    '  const skillsDir = path.join(root, "skills");',
    '  const doctorDir = path.join(skillsDir, "reo-doctor");',
    '  const editDir = path.join(skillsDir, "reo-edit");',
    '  let doctorDirOk = false;',
    '  let editDirOk = false;',
    '  if (await ensureDirectory(skillsDir)) {',
    '    doctorDirOk = await ensureDirectory(doctorDir);',
    '    editDirOk = await ensureDirectory(editDir);',
    '  }',
    '',
    '  if (doctorDirOk) {',
    '    const doctorSkillPath = path.join(doctorDir, "SKILL.md");',
    '    const currentDoctorSkill = await readRegularText(doctorSkillPath);',
    '    if (currentDoctorSkill.status !== "unsafe" && (currentDoctorSkill.status !== "file" || currentDoctorSkill.text !== DOCTOR_SKILL_MD)) {',
    '      report.repaired.doctorSkill = true;',
    '      await writeRegularText(doctorSkillPath, currentDoctorSkill, DOCTOR_SKILL_MD);',
    '    }',
    '  }',
    '',
    '  if (editDirOk) {',
    '    const editSkillPath = path.join(editDir, "SKILL.md");',
    '    const currentEditSkill = await readRegularText(editSkillPath);',
    '    if (currentEditSkill.status !== "unsafe" && (currentEditSkill.status !== "file" || currentEditSkill.text !== EDIT_SKILL_MD)) {',
    '      report.repaired.editSkill = true;',
    '      await writeRegularText(editSkillPath, currentEditSkill, EDIT_SKILL_MD);',
    '    }',
    '  }',
    '',
    '  await readNeedsReviewReport();',
    '',
    '  console.log(JSON.stringify(report, null, 2));',
    '}',
    '',
    'main().catch((error) => {',
    '  console.error(error && error.stack ? error.stack : String(error));',
    '  process.exit(1);',
    '});',
  ].join('\n') + '\n';

const workspaceMetadataSchema = z
  .object({
    schemaVersion: z.literal(WORKSPACE_SCHEMA_VERSION),
    workspaceId: z.string().min(1),
    title: z.string(),
    description: z.string(),
    createdAt: z.string(),
  })
  .strict();

const workspaceIndexSchema = z
  .object({
    schemaVersion: z.literal(WORKSPACE_SCHEMA_VERSION),
    memories: z.array(workspaceMemorySummarySchema),
  })
  .strict();

type WorkspaceMetadata = z.infer<typeof workspaceMetadataSchema>;
type WorkspaceIndex = z.infer<typeof workspaceIndexSchema>;

interface InitializeWorkspaceFilesOptions {
  readonly rootPath: string;
  readonly title: string;
  readonly description: string;
  readonly createWorkspaceId: () => string;
  readonly now: () => string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

interface OpenWorkspaceFilesOptions {
  readonly rootPath: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

interface RenameWorkspaceRootTitleOptions {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly relocateWorkspaceRoot: (
    canonicalRoot: string
  ) => { readonly ok: true } | WorkspaceErrorEnvelope;
}

interface RepairWorkspaceTitleMirrorOptions {
  readonly rootPath: string;
  readonly workspaceId?: string | undefined;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

interface ReadWorkspaceSnapshotOptions {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

type MaybePromise<T> = T | Promise<T>;
type AssertWorkspaceUsable = () => { readonly ok: true } | WorkspaceErrorEnvelope;

class WorkspaceOpenAborted extends Error {
  readonly envelope: WorkspaceErrorEnvelope;

  constructor(envelope: WorkspaceErrorEnvelope) {
    super(envelope.error.message);
    this.envelope = envelope;
  }
}

function assertWorkspaceUsable(assertUsable: AssertWorkspaceUsable | undefined): void {
  const usable = assertUsable?.();
  if (usable && !usable.ok) {
    throw new WorkspaceOpenAborted(usable);
  }
}

let beforeWorkspaceJsonNoFollowFinalAssertForTest:
  | ((filePath: string) => MaybePromise<void>)
  | null = null;

type WorkspaceFilesResult =
  | {
      readonly ok: true;
      readonly snapshot: WorkspaceSnapshot;
    }
  | WorkspaceErrorEnvelope;

type WorkspaceRootRenameResult =
  | {
      readonly ok: true;
      readonly canonicalRoot: string;
      readonly snapshot: WorkspaceSnapshot;
    }
  | WorkspaceErrorEnvelope;

type WorkspaceTitleMirrorRepairResult =
  | {
      readonly ok: true;
      readonly workspaceId: string;
      readonly title: string;
      readonly description: string;
    }
  | WorkspaceErrorEnvelope;

export type WorkspaceInitializeTarget =
  | {
      readonly ok: true;
      readonly canonicalRoot: string;
    }
  | WorkspaceErrorEnvelope;

export type WorkspaceValidatedOpenTarget =
  | {
      readonly ok: true;
      readonly canonicalRoot: string;
      readonly metadata: WorkspaceMetadata;
      readonly rootIdentity: DirectoryIdentity;
    }
  | WorkspaceErrorEnvelope;

export type WorkspaceOpenTarget =
  | ({
      readonly ok: true;
      readonly kind: 'existing';
      readonly canonicalRoot: string;
    } & Omit<Extract<WorkspaceValidatedOpenTarget, { readonly ok: true }>, 'ok' | 'canonicalRoot'>)
  | {
      readonly ok: true;
      readonly kind: 'empty';
      readonly canonicalRoot: string;
    }
  | WorkspaceErrorEnvelope;

export function setBeforeWorkspaceJsonNoFollowFinalAssertForTest(
  hook: ((filePath: string) => MaybePromise<void>) | null
): void {
  beforeWorkspaceJsonNoFollowFinalAssertForTest = hook;
}

let beforeWorkspaceIndexReconciliationPersistForTest: (() => MaybePromise<void>) | null = null;

export function setBeforeWorkspaceIndexReconciliationPersistForTest(
  hook: (() => MaybePromise<void>) | null
): void {
  beforeWorkspaceIndexReconciliationPersistForTest = hook;
}

let beforeWorkspaceRootRenameCommitForTest: (() => void) | null = null;

export function setBeforeWorkspaceRootRenameCommitForTest(hook: (() => void) | null): void {
  beforeWorkspaceRootRenameCommitForTest = hook;
}

let beforeWorkspaceRootRenameFinalizeForTest: (() => void) | null = null;

export function setBeforeWorkspaceRootRenameFinalizeForTest(hook: (() => void) | null): void {
  beforeWorkspaceRootRenameFinalizeForTest = hook;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function workspaceAlreadyExists(): WorkspaceErrorEnvelope {
  return workspaceError(
    'ERR_WORKSPACE_ALREADY_EXISTS',
    'Workspace directory already exists',
    'previous-file-preserved'
  );
}

function workspaceInvalidFolderName(): WorkspaceErrorEnvelope {
  return workspaceError(
    'ERR_WORKSPACE_INVALID_REQUEST',
    'Workspace folder name is invalid',
    'previous-file-preserved'
  );
}

function workspaceErrorAfterRootRename(error: WorkspaceErrorEnvelope): WorkspaceErrorEnvelope {
  return workspaceError(error.error.code, error.error.message, 'file-written-index-stale');
}

function targetDirectoryIdentityForRename(
  targetName: string
): DirectoryIdentity | 'exists-with-different-identity' | null {
  try {
    const entry = lstatSync(targetName);
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      return 'exists-with-different-identity';
    }
    return { dev: entry.dev, ino: entry.ino };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function assertWorkspaceRootRenameTargetAvailable(
  targetName: string,
  sourceIdentity: DirectoryIdentity
): void {
  const targetIdentity = targetDirectoryIdentityForRename(targetName);
  if (
    targetIdentity !== null &&
    (targetIdentity === 'exists-with-different-identity' ||
      !sameDirectoryIdentity(targetIdentity, sourceIdentity))
  ) {
    throw new WorkspaceOpenAborted(workspaceAlreadyExists());
  }
}

type WorkspaceRootMoveResult =
  | {
      readonly ok: true;
      readonly canonicalRoot: string;
    }
  | WorkspaceErrorEnvelope;

function workspaceRootMoveFailed(): WorkspaceErrorEnvelope {
  return workspaceError(
    'ERR_WORKSPACE_UPDATE_FAILED',
    'Workspace title could not be updated',
    'previous-file-preserved'
  );
}

function workspaceRootPostMoveFailed(): WorkspaceErrorEnvelope {
  return workspaceError(
    'ERR_WORKSPACE_UPDATE_FAILED',
    'Workspace title could not be updated',
    'file-written-index-stale'
  );
}

function renameDirectoryNoReplaceSync({
  parentDirectory,
  sourceName,
  targetName,
  sourceIdentity,
}: {
  readonly parentDirectory: string;
  readonly sourceName: string;
  readonly targetName: string;
  readonly sourceIdentity: DirectoryIdentity;
}): void {
  const sourcePath = path.join(parentDirectory, sourceName);
  const targetPath = path.join(parentDirectory, targetName);
  const result =
    process.platform === 'darwin'
      ? spawnSync(
          '/usr/bin/osascript',
          ['-l', 'JavaScript', '-e', DARWIN_MOVE_ITEM_NO_REPLACE_SCRIPT, sourcePath, targetPath],
          {
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: WORKSPACE_ROOT_RENAME_TIMEOUT_MS,
            windowsHide: true,
          }
        )
      : process.platform === 'linux'
        ? spawnSync('/bin/mv', ['-T', '-n', sourcePath, targetPath], {
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: WORKSPACE_ROOT_RENAME_TIMEOUT_MS,
            windowsHide: true,
          })
        : null;

  if (result === null) {
    throw new Error('No no-replace directory rename primitive is available on this platform');
  }

  const sourceAfter = targetDirectoryIdentityForRename(sourceName);
  const targetAfter = targetDirectoryIdentityForRename(targetName);
  if (
    !result.error &&
    result.status === 0 &&
    targetAfter !== null &&
    targetAfter !== 'exists-with-different-identity' &&
    sameDirectoryIdentity(targetAfter, sourceIdentity)
  ) {
    return;
  }

  const nestedSourceAfter = targetDirectoryIdentityForRename(path.join(targetName, sourceName));
  if (
    sourceAfter === null &&
    nestedSourceAfter !== null &&
    nestedSourceAfter !== 'exists-with-different-identity' &&
    sameDirectoryIdentity(nestedSourceAfter, sourceIdentity)
  ) {
    renameSync(path.join(targetName, sourceName), sourceName);
    throw new WorkspaceOpenAborted(workspaceAlreadyExists());
  }
  if (
    sourceAfter !== null &&
    sourceAfter !== 'exists-with-different-identity' &&
    sameDirectoryIdentity(sourceAfter, sourceIdentity) &&
    targetAfter !== null &&
    (targetAfter === 'exists-with-different-identity' ||
      !sameDirectoryIdentity(targetAfter, sourceIdentity))
  ) {
    throw new WorkspaceOpenAborted(workspaceAlreadyExists());
  }
  if (
    sourceAfter !== null &&
    sourceAfter !== 'exists-with-different-identity' &&
    sameDirectoryIdentity(sourceAfter, sourceIdentity) &&
    targetAfter === null &&
    !result.error &&
    result.status === 0
  ) {
    throw new WorkspaceOpenAborted(workspaceAlreadyExists());
  }
  if (result.error) {
    throw result.error;
  }
  throw new Error(result.stderr || 'Workspace root directory could not be renamed');
}

function moveWorkspaceRootDirectory({
  canonicalRoot,
  targetName,
  expectedRootIdentity,
  assertWorkspaceUsable: assertUsable,
}: {
  readonly canonicalRoot: string;
  readonly targetName: string;
  readonly expectedRootIdentity: DirectoryIdentity;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): WorkspaceRootMoveResult {
  const sourceName = path.basename(canonicalRoot);
  const parentDirectory = path.dirname(canonicalRoot);
  const parentIdentity = readDirectoryIdentitySync(parentDirectory);
  const previousCwd = process.cwd();
  try {
    process.chdir(parentDirectory);
    assertSameCurrentDirectory(parentIdentity);
    assertSameDirectoryPath(sourceName, expectedRootIdentity, 'Workspace root path changed');
    assertWorkspaceRootRenameTargetAvailable(targetName, expectedRootIdentity);
    assertWorkspaceUsable(assertUsable);
    assertSameCurrentDirectory(parentIdentity);
    assertSameDirectoryPath(parentDirectory, parentIdentity);
    assertSameDirectoryPath(sourceName, expectedRootIdentity, 'Workspace root path changed');
    assertWorkspaceRootRenameTargetAvailable(targetName, expectedRootIdentity);
    if (sourceName !== targetName) {
      beforeWorkspaceRootRenameCommitForTest?.();
      renameDirectoryNoReplaceSync({
        parentDirectory,
        sourceName,
        targetName,
        sourceIdentity: expectedRootIdentity,
      });
    }
    return { ok: true, canonicalRoot: path.join(parentDirectory, targetName) };
  } catch (error) {
    if (error instanceof WorkspaceOpenAborted) {
      return error.envelope;
    }
    return workspaceRootMoveFailed();
  } finally {
    process.chdir(previousCwd);
  }
}

function finalizeWorkspaceRootDirectoryRename({
  canonicalRoot,
  expectedRootIdentity,
}: {
  readonly canonicalRoot: string;
  readonly expectedRootIdentity: DirectoryIdentity;
}): WorkspaceRootMoveResult {
  const targetName = path.basename(canonicalRoot);
  const parentDirectory = path.dirname(canonicalRoot);
  const parentIdentity = readDirectoryIdentitySync(parentDirectory);
  try {
    return runInWorkspaceDirectorySync(
      { directory: parentDirectory, directoryIdentity: parentIdentity },
      () => {
        beforeWorkspaceRootRenameFinalizeForTest?.();
        assertSameCurrentDirectory(parentIdentity);
        assertSameDirectoryPath(targetName, expectedRootIdentity, 'Workspace root target changed');
        fsyncCurrentWorkspaceDirectoryBestEffort();
        return { ok: true, canonicalRoot: realpathSync(targetName) };
      }
    );
  } catch {
    return workspaceRootPostMoveFailed();
  }
}

function snapshotFrom(
  metadata: WorkspaceMetadata,
  index: WorkspaceIndex,
  review?: WorkspaceReviewSummary
): WorkspaceSnapshot {
  return {
    workspaceId: metadata.workspaceId,
    title: metadata.title,
    description: metadata.description,
    memories: index.memories,
    ...(review ? { review } : {}),
  };
}

async function repairWorkspaceTitleMetadataMirror({
  canonicalRoot,
  metadata,
  assertWorkspaceUsable: assertUsable,
}: {
  readonly canonicalRoot: string;
  readonly metadata: WorkspaceMetadata;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<WorkspaceMetadata> {
  const rootTitle = path.basename(canonicalRoot);
  if (metadata.title === rootTitle) {
    return metadata;
  }

  const nextMetadata = { ...metadata, title: rootTitle };
  await writeWorkspaceJsonAtomic(getWorkspaceMetadataPath(canonicalRoot), nextMetadata, () =>
    assertWorkspaceUsable(assertUsable)
  );
  assertWorkspaceUsable(assertUsable);
  return nextMetadata;
}

function sameMemorySummaries(
  first: readonly MemorySummary[],
  second: readonly MemorySummary[]
): boolean {
  if (first.length !== second.length) {
    return false;
  }

  return first.every((memory, index) => {
    const other = second[index];
    return (
      other !== undefined &&
      memory.memoryId === other.memoryId &&
      memory.title === other.title &&
      memory.createdAt === other.createdAt &&
      memory.updatedAt === other.updatedAt &&
      memory.segmentCount === other.segmentCount &&
      memory.audioSegmentCount === other.audioSegmentCount &&
      memory.noteSegmentCount === other.noteSegmentCount &&
      memory.audioDurationMs === other.audioDurationMs &&
      memory.audioByteLength === other.audioByteLength &&
      memory.hasAudioTranscript === other.hasAudioTranscript &&
      memory.hasAnyNote === other.hasAnyNote &&
      memory.supplementCount === other.supplementCount
    );
  });
}

function upsertWorkspaceAgentsManagedBlock(current: string | null): string {
  if (current === null || current.trim().length === 0) {
    return DEFAULT_WORKSPACE_AGENTS_MD;
  }

  const firstManagedBlockIndex = current.indexOf(WORKSPACE_AGENTS_MANAGED_BLOCK_START);
  const legacyPrefix =
    firstManagedBlockIndex >= 0 ? current.slice(0, firstManagedBlockIndex) : current;
  if (
    legacyPrefix.trimStart().startsWith('# Reo 记忆空间 Agent 入口') &&
    legacyPrefix.includes('## 读写边界') &&
    legacyPrefix.includes('如果要精确表达 Tiptap JSON') &&
    legacyPrefix.includes('source.hash') &&
    legacyPrefix.includes('## 验证建议')
  ) {
    return DEFAULT_WORKSPACE_AGENTS_MD;
  }

  const startIndex = current.indexOf(WORKSPACE_AGENTS_MANAGED_BLOCK_START);
  const endIndex = current.indexOf(WORKSPACE_AGENTS_MANAGED_BLOCK_END);
  if (startIndex >= 0 && endIndex >= startIndex) {
    return `${current.slice(0, startIndex)}${DEFAULT_WORKSPACE_AGENTS_MANAGED_BLOCK}${current.slice(endIndex + WORKSPACE_AGENTS_MANAGED_BLOCK_END.length)}`.replace(
      /\n*$/,
      '\n'
    );
  }

  return `${current.trimEnd()}\n\n${DEFAULT_WORKSPACE_AGENTS_MANAGED_BLOCK}\n`;
}

async function readOptionalRegularTextFile(filePath: string): Promise<string | null> {
  try {
    const stats = await lstat(filePath);
    if (!stats.isFile()) {
      throw new Error('Managed Reo config path is not a regular file');
    }
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function ensureManagedDirectory(
  directoryPath: string,
  assertUsable: AssertWorkspaceUsable | undefined
): Promise<void> {
  try {
    const stats = await lstat(directoryPath);
    if (!stats.isDirectory()) {
      throw new Error('Managed Reo config path is not a directory');
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      assertWorkspaceUsable(assertUsable);
      await mkdir(directoryPath);
      assertWorkspaceUsable(assertUsable);
      return;
    }
    throw error;
  }
}

async function writeManagedFileIfChanged({
  filePath,
  current,
  next,
  assertUsable,
}: {
  readonly filePath: string;
  readonly current: string | null;
  readonly next: string;
  readonly assertUsable: AssertWorkspaceUsable | undefined;
}): Promise<void> {
  if (current === next) {
    return;
  }
  assertWorkspaceUsable(assertUsable);
  if (current === null) {
    await writeWorkspaceFileNoReplaceAtomic(filePath, next, () =>
      assertWorkspaceUsable(assertUsable)
    );
  } else {
    await writeWorkspaceFileAtomic(filePath, next, () => assertWorkspaceUsable(assertUsable));
  }
  assertWorkspaceUsable(assertUsable);
}

async function ensureWorkspaceManagedAgentConfig(
  canonicalRoot: string,
  assertUsable: AssertWorkspaceUsable | undefined
): Promise<void> {
  const agentsPath = path.join(canonicalRoot, 'AGENTS.md');
  const currentAgents = await readOptionalRegularTextFile(agentsPath);
  const skillsDirectory = path.join(canonicalRoot, 'skills');
  const editDirectory = path.join(skillsDirectory, 'reo-edit');
  const doctorDirectory = path.join(skillsDirectory, 'reo-doctor');
  const scriptsDirectory = path.join(doctorDirectory, 'scripts');
  await ensureManagedDirectory(skillsDirectory, assertUsable);
  await ensureManagedDirectory(editDirectory, assertUsable);
  await ensureManagedDirectory(doctorDirectory, assertUsable);
  await ensureManagedDirectory(scriptsDirectory, assertUsable);

  const editSkillPath = path.join(editDirectory, 'SKILL.md');
  const currentEditSkill = await readOptionalRegularTextFile(editSkillPath);
  const skillPath = path.join(doctorDirectory, 'SKILL.md');
  const currentDoctorSkill = await readOptionalRegularTextFile(skillPath);
  const scriptPath = path.join(scriptsDirectory, 'reo-doctor.mjs');
  const currentDoctorScript = await readOptionalRegularTextFile(scriptPath);

  await writeManagedFileIfChanged({
    filePath: agentsPath,
    current: currentAgents,
    next: upsertWorkspaceAgentsManagedBlock(currentAgents),
    assertUsable,
  });
  await writeManagedFileIfChanged({
    filePath: editSkillPath,
    current: currentEditSkill,
    next: DEFAULT_REO_EDIT_SKILL_MD,
    assertUsable,
  });

  await writeManagedFileIfChanged({
    filePath: skillPath,
    current: currentDoctorSkill,
    next: DEFAULT_REO_DOCTOR_SKILL_MD,
    assertUsable,
  });
  await writeManagedFileIfChanged({
    filePath: scriptPath,
    current: currentDoctorScript,
    next: DEFAULT_REO_DOCTOR_SCRIPT_MJS,
    assertUsable,
  });
}

export async function validateWorkspaceInitializeTarget(
  rootPath: string
): Promise<WorkspaceInitializeTarget> {
  const canonicalRoot = await resolveWorkspaceRoot(rootPath);
  if (typeof canonicalRoot !== 'string') {
    return canonicalRoot;
  }

  if (await exists(path.join(canonicalRoot, 'AGENTS.md'))) {
    return workspaceError(
      'ERR_WORKSPACE_AGENTS_CONFLICT',
      'Workspace already contains AGENTS.md',
      'none-written'
    );
  }

  const reoDirectory = await checkWorkspaceReoDirectory(canonicalRoot);
  if (typeof reoDirectory !== 'string') {
    return reoDirectory;
  }
  const draftsDirectory = await checkWorkspaceDraftsDirectory(canonicalRoot);
  if (typeof draftsDirectory !== 'string') {
    return draftsDirectory;
  }
  const memoriesDirectory = await checkWorkspaceMemoriesDirectory(canonicalRoot);
  if (typeof memoriesDirectory !== 'string') {
    return memoriesDirectory;
  }

  return { ok: true, canonicalRoot };
}

export async function createWorkspaceInitializeTargetInParent(
  parentPath: string,
  folderName: string
): Promise<WorkspaceInitializeTarget> {
  const canonicalParent = await resolveWorkspaceRoot(parentPath);
  if (typeof canonicalParent !== 'string') {
    return canonicalParent;
  }

  const createdRoot = await createNewWorkspaceRootDirectory(canonicalParent, folderName);
  if (typeof createdRoot !== 'string') {
    return createdRoot;
  }

  return { ok: true, canonicalRoot: createdRoot };
}

async function readMetadata(canonicalRoot: string): Promise<WorkspaceMetadata | null> {
  return readWorkspaceJsonNoFollow(
    getWorkspaceMetadataPath(canonicalRoot),
    workspaceMetadataSchema
  );
}

async function validateWorkspaceOpenCanonicalTarget(
  canonicalRoot: string
): Promise<WorkspaceValidatedOpenTarget> {
  const reoDirectory = await checkWorkspaceReoDirectory(canonicalRoot);
  if (typeof reoDirectory !== 'string') {
    return reoDirectory;
  }
  const draftsDirectory = await checkWorkspaceDraftsDirectory(canonicalRoot);
  if (typeof draftsDirectory !== 'string') {
    return draftsDirectory;
  }
  const memoriesDirectory = await checkWorkspaceMemoriesDirectory(canonicalRoot);
  if (typeof memoriesDirectory !== 'string') {
    return memoriesDirectory;
  }

  const metadata = await readMetadata(canonicalRoot);
  if (!metadata) {
    return workspaceError(
      'ERR_WORKSPACE_METADATA_INVALID',
      'Workspace metadata is invalid',
      'none-written'
    );
  }

  try {
    return {
      ok: true,
      canonicalRoot,
      metadata,
      rootIdentity: readDirectoryIdentitySync(canonicalRoot),
    };
  } catch {
    return workspaceError(
      'ERR_WORKSPACE_METADATA_INVALID',
      'Workspace metadata is invalid',
      'none-written'
    );
  }
}

export async function validateWorkspaceOpenTarget(
  rootPath: string
): Promise<WorkspaceValidatedOpenTarget> {
  const canonicalRoot = await resolveWorkspaceRoot(rootPath);
  if (typeof canonicalRoot !== 'string') {
    return canonicalRoot;
  }

  return validateWorkspaceOpenCanonicalTarget(canonicalRoot);
}

export async function validateWorkspaceOpenTargetWorkspaceId({
  rootPath,
  workspaceId,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
}): Promise<WorkspaceInitializeTarget> {
  const target = await validateWorkspaceOpenTarget(rootPath);
  if (!target.ok) {
    return target;
  }

  if (target.metadata.workspaceId !== workspaceId) {
    return workspaceError(
      'ERR_WORKSPACE_METADATA_INVALID',
      'Workspace metadata is invalid',
      'previous-file-preserved'
    );
  }

  return target;
}

export async function validateEmptyWorkspaceOpenCanonicalTarget(
  canonicalRoot: string
): Promise<WorkspaceInitializeTarget> {
  try {
    const directory = await opendir(canonicalRoot);
    for await (const entry of directory) {
      if (!EMPTY_WORKSPACE_IGNORED_ENTRIES.has(entry.name)) {
        return workspaceError(
          'ERR_WORKSPACE_METADATA_INVALID',
          'Workspace metadata is invalid',
          'none-written'
        );
      }
    }
  } catch {
    return workspaceError(
      'ERR_WORKSPACE_METADATA_INVALID',
      'Workspace metadata is invalid',
      'none-written'
    );
  }

  return { ok: true, canonicalRoot };
}

async function isLockOnlyReoDirectory(reoDirectoryPath: string): Promise<boolean> {
  const stats = await lstat(reoDirectoryPath);
  if (!stats.isDirectory()) {
    return false;
  }

  const directory = await opendir(reoDirectoryPath);
  let hasWorkspaceLock = false;
  for await (const entry of directory) {
    if (!EMPTY_WORKSPACE_LOCK_REO_ENTRIES.has(entry.name)) {
      return false;
    }
    if (entry.name === 'workspace.lock' && !entry.isFile()) {
      return false;
    }
    if (entry.name === 'workspace.lock.lock' && !entry.isDirectory()) {
      return false;
    }
    hasWorkspaceLock ||= entry.name === 'workspace.lock';
  }

  return hasWorkspaceLock;
}

export async function validateEmptyWorkspaceOpenCanonicalTargetAfterLock(
  canonicalRoot: string
): Promise<WorkspaceInitializeTarget> {
  try {
    const directory = await opendir(canonicalRoot);
    for await (const entry of directory) {
      if (EMPTY_WORKSPACE_IGNORED_ENTRIES.has(entry.name)) {
        continue;
      }
      if (
        entry.name === '.reo' &&
        (await isLockOnlyReoDirectory(path.join(canonicalRoot, entry.name)))
      ) {
        continue;
      }
      return workspaceError(
        'ERR_WORKSPACE_METADATA_INVALID',
        'Workspace metadata is invalid',
        'none-written'
      );
    }
  } catch {
    return workspaceError(
      'ERR_WORKSPACE_METADATA_INVALID',
      'Workspace metadata is invalid',
      'none-written'
    );
  }

  return { ok: true, canonicalRoot };
}

export async function removeLockOnlyReoDirectory(canonicalRoot: string): Promise<void> {
  const reoDirectoryPath = path.join(canonicalRoot, '.reo');
  const lockOnly = await isLockOnlyReoDirectory(reoDirectoryPath).catch(() => false);
  if (lockOnly) {
    await rm(reoDirectoryPath, { force: true, recursive: true });
  }
}

export async function classifyWorkspaceOpenTarget(rootPath: string): Promise<WorkspaceOpenTarget> {
  const canonicalRoot = await resolveWorkspaceRoot(rootPath);
  if (typeof canonicalRoot !== 'string') {
    return canonicalRoot;
  }

  const existingTarget = await validateWorkspaceOpenCanonicalTarget(canonicalRoot);
  if (existingTarget.ok) {
    return { ...existingTarget, kind: 'existing' };
  }

  const emptyTarget = await validateEmptyWorkspaceOpenCanonicalTarget(canonicalRoot);
  if (emptyTarget.ok) {
    return { ...emptyTarget, kind: 'empty' };
  }

  return existingTarget;
}

async function readOrRebuildIndex(
  canonicalRoot: string,
  {
    persistReconciliation = true,
    assertBeforePersist,
    rebuiltMemories,
  }: {
    readonly persistReconciliation?: boolean;
    readonly assertBeforePersist?: () => Promise<void>;
    readonly rebuiltMemories?: readonly MemorySummary[];
  } = {}
): Promise<WorkspaceIndex> {
  const parsedIndex = await readWorkspaceJsonNoFollow(
    getWorkspaceIndexPath(canonicalRoot),
    workspaceIndexSchema
  );

  if (parsedIndex && !rebuiltMemories) {
    return parsedIndex;
  }

  let memories = [
    ...(rebuiltMemories ?? (await rebuildMemoryIndex(canonicalRoot, { persist: false }))),
  ];
  if (parsedIndex && sameMemorySummaries(parsedIndex.memories, memories)) {
    return parsedIndex;
  }

  if (persistReconciliation) {
    const shouldRebuildDuringPersist = beforeWorkspaceIndexReconciliationPersistForTest !== null;
    memories = [
      ...(await replaceWorkspaceIndex(
        canonicalRoot,
        shouldRebuildDuringPersist
          ? async () => rebuildMemoryIndex(canonicalRoot, { persist: false })
          : () => memories,
        async () => {
          await beforeWorkspaceIndexReconciliationPersistForTest?.();
          await assertBeforePersist?.();
        }
      )),
    ];
  }
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    memories,
  };
}

export async function initializeWorkspaceFiles({
  rootPath,
  title,
  description,
  createWorkspaceId,
  now,
  assertWorkspaceUsable: assertUsable,
}: InitializeWorkspaceFilesOptions): Promise<WorkspaceFilesResult> {
  let canonicalRoot: string;
  try {
    assertWorkspaceUsable(assertUsable);
    const target = await validateWorkspaceInitializeTarget(rootPath);
    if (!target.ok) {
      assertWorkspaceUsable(assertUsable);
      return target;
    }
    canonicalRoot = target.canonicalRoot;
    assertWorkspaceUsable(assertUsable);
    const draftsDirectory = await ensureWorkspaceDraftsDirectory(canonicalRoot, assertUsable);
    if (typeof draftsDirectory !== 'string') {
      return draftsDirectory;
    }
    assertWorkspaceUsable(assertUsable);
    const memoriesDirectory = await ensureWorkspaceMemoriesDirectory(canonicalRoot, assertUsable);
    if (typeof memoriesDirectory !== 'string') {
      return memoriesDirectory;
    }
    assertWorkspaceUsable(assertUsable);
  } catch (error) {
    if (error instanceof WorkspaceOpenAborted) {
      return error.envelope;
    }
    return workspaceError(
      'ERR_WORKSPACE_INIT_FAILED',
      'Workspace could not be initialized',
      'previous-file-preserved'
    );
  }

  const metadata = {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    workspaceId: createWorkspaceId(),
    title,
    description,
    createdAt: now(),
  } satisfies z.infer<typeof workspaceMetadataSchema>;
  const index = {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    memories: [],
  } satisfies z.infer<typeof workspaceIndexSchema>;

  try {
    assertWorkspaceUsable(assertUsable);
    await ensureWorkspaceManagedAgentConfig(canonicalRoot, assertUsable);
    assertWorkspaceUsable(assertUsable);
    await writeWorkspaceJsonAtomic(getWorkspaceMetadataPath(canonicalRoot), metadata, () =>
      assertWorkspaceUsable(assertUsable)
    );
    assertWorkspaceUsable(assertUsable);
    await writeWorkspaceJsonAtomic(getWorkspaceIndexPath(canonicalRoot), index, () =>
      assertWorkspaceUsable(assertUsable)
    );
  } catch (error) {
    if (error instanceof WorkspaceOpenAborted) {
      return error.envelope;
    }
    throw error;
  }

  return {
    ok: true,
    snapshot: snapshotFrom(metadata, index),
  };
}

export async function openWorkspaceFiles({
  rootPath,
  assertWorkspaceUsable: assertUsable,
}: OpenWorkspaceFilesOptions): Promise<WorkspaceFilesResult> {
  let index: WorkspaceIndex;
  let metadata: WorkspaceMetadata;
  try {
    assertWorkspaceUsable(assertUsable);
    const target = await validateWorkspaceOpenTarget(rootPath);
    if (!target.ok) {
      assertWorkspaceUsable(assertUsable);
      return target;
    }
    const { canonicalRoot } = target;
    metadata = target.metadata;
    assertWorkspaceUsable(assertUsable);
    const draftsDirectory = await ensureWorkspaceDraftsDirectory(canonicalRoot, assertUsable);
    if (typeof draftsDirectory !== 'string') {
      return draftsDirectory;
    }
    assertWorkspaceUsable(assertUsable);
    const memoriesDirectory = await ensureWorkspaceMemoriesDirectory(canonicalRoot, assertUsable);
    if (typeof memoriesDirectory !== 'string') {
      return memoriesDirectory;
    }
    assertWorkspaceUsable(assertUsable);
    await ensureWorkspaceManagedAgentConfig(canonicalRoot, assertUsable);
    assertWorkspaceUsable(assertUsable);
    await recoverRecordingFinalizeTransactions(canonicalRoot, {
      assertWorkspaceUsable: () => assertWorkspaceUsable(assertUsable),
    });
    assertWorkspaceUsable(assertUsable);
    index = await readOrRebuildIndex(canonicalRoot, {
      assertBeforePersist: async () => assertWorkspaceUsable(assertUsable),
    });
    assertWorkspaceUsable(assertUsable);
    metadata = await repairWorkspaceTitleMetadataMirror({
      canonicalRoot,
      metadata,
      ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
    });
    assertWorkspaceUsable(assertUsable);
  } catch (error) {
    if (error instanceof WorkspaceOpenAborted) {
      return error.envelope;
    }
    return workspaceError(
      'ERR_WORKSPACE_OPEN_FAILED',
      'Workspace could not be opened',
      'previous-file-preserved'
    );
  }
  return {
    ok: true,
    snapshot: snapshotFrom(metadata, index),
  };
}

export async function repairWorkspaceTitleMirrorFromRootName({
  rootPath,
  workspaceId,
  assertWorkspaceUsable: assertUsable,
}: RepairWorkspaceTitleMirrorOptions): Promise<WorkspaceTitleMirrorRepairResult> {
  try {
    assertWorkspaceUsable(assertUsable);
    const target = await validateWorkspaceOpenTarget(rootPath);
    if (!target.ok) {
      assertWorkspaceUsable(assertUsable);
      return target;
    }

    const { canonicalRoot } = target;
    const metadata = target.metadata;
    assertWorkspaceUsable(assertUsable);
    if (workspaceId !== undefined && metadata.workspaceId !== workspaceId) {
      return workspaceError(
        'ERR_WORKSPACE_METADATA_INVALID',
        'Workspace metadata is invalid',
        'previous-file-preserved'
      );
    }

    const nextMetadata = await repairWorkspaceTitleMetadataMirror({
      canonicalRoot,
      metadata,
      ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
    });
    return {
      ok: true,
      workspaceId: nextMetadata.workspaceId,
      title: nextMetadata.title,
      description: nextMetadata.description,
    };
  } catch (error) {
    if (error instanceof WorkspaceOpenAborted) {
      return error.envelope;
    }
    return workspaceError(
      'ERR_WORKSPACE_UPDATE_FAILED',
      'Workspace title could not be updated',
      'previous-file-preserved'
    );
  }
}

export async function renameWorkspaceRootFromFileTruth({
  rootPath,
  workspaceId,
  title,
  assertWorkspaceUsable: assertUsable,
  relocateWorkspaceRoot,
}: RenameWorkspaceRootTitleOptions): Promise<WorkspaceRootRenameResult> {
  if (!isSafeWorkspaceDirectoryName(title)) {
    return workspaceInvalidFolderName();
  }

  try {
    assertWorkspaceUsable(assertUsable);
    const target = await validateWorkspaceOpenTarget(rootPath);
    if (!target.ok) {
      assertWorkspaceUsable(assertUsable);
      return target;
    }
    const { canonicalRoot, rootIdentity } = target;
    const metadata = target.metadata;
    assertWorkspaceUsable(assertUsable);
    if (metadata.workspaceId !== workspaceId) {
      return workspaceError(
        'ERR_WORKSPACE_METADATA_INVALID',
        'Workspace metadata is invalid',
        'previous-file-preserved'
      );
    }

    const moved = moveWorkspaceRootDirectory({
      canonicalRoot,
      targetName: title,
      expectedRootIdentity: rootIdentity,
      ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
    });
    if (!moved.ok) {
      return moved;
    }

    let nextCanonicalRoot = moved.canonicalRoot;
    try {
      const relocated = relocateWorkspaceRoot(nextCanonicalRoot);
      if (!relocated.ok) {
        return workspaceErrorAfterRootRename(relocated);
      }
    } catch {
      return workspaceRootPostMoveFailed();
    }

    const finalized = finalizeWorkspaceRootDirectoryRename({
      canonicalRoot: nextCanonicalRoot,
      expectedRootIdentity: rootIdentity,
    });
    if (!finalized.ok) {
      return finalized;
    }
    if (finalized.canonicalRoot !== nextCanonicalRoot) {
      try {
        const relocated = relocateWorkspaceRoot(finalized.canonicalRoot);
        if (!relocated.ok) {
          return workspaceErrorAfterRootRename(relocated);
        }
      } catch {
        return workspaceRootPostMoveFailed();
      }
      nextCanonicalRoot = finalized.canonicalRoot;
    }
    nextCanonicalRoot = finalized.canonicalRoot;

    const nextMetadata = { ...metadata, title };
    try {
      await writeWorkspaceJsonAtomic(
        getWorkspaceMetadataPath(nextCanonicalRoot),
        nextMetadata,
        () => assertWorkspaceUsable(assertUsable)
      );
    } catch (error) {
      if (error instanceof WorkspaceOpenAborted) {
        return workspaceErrorAfterRootRename(error.envelope);
      }
      return workspaceError(
        'ERR_WORKSPACE_UPDATE_FAILED',
        'Workspace title could not be updated',
        'file-written-index-stale'
      );
    }

    let index: WorkspaceIndex;
    try {
      index = await readOrRebuildIndex(nextCanonicalRoot, {
        assertBeforePersist: async () => assertWorkspaceUsable(assertUsable),
      });
      assertWorkspaceUsable(assertUsable);
    } catch (error) {
      if (error instanceof WorkspaceOpenAborted) {
        return workspaceErrorAfterRootRename(error.envelope);
      }
      return workspaceError(
        'ERR_WORKSPACE_UPDATE_FAILED',
        'Workspace title could not be updated',
        'file-written-index-stale'
      );
    }

    return {
      ok: true,
      canonicalRoot: nextCanonicalRoot,
      snapshot: snapshotFrom(nextMetadata, index),
    };
  } catch (error) {
    if (error instanceof WorkspaceOpenAborted) {
      return error.envelope;
    }
    return workspaceError(
      'ERR_WORKSPACE_UPDATE_FAILED',
      'Workspace title could not be updated',
      'previous-file-preserved'
    );
  }
}

export async function readWorkspaceSnapshotFromFileTruth({
  rootPath,
  workspaceId,
  assertWorkspaceUsable: assertUsable,
}: ReadWorkspaceSnapshotOptions): Promise<WorkspaceFilesResult> {
  try {
    assertWorkspaceUsable(assertUsable);
    const target = await validateWorkspaceOpenTarget(rootPath);
    if (!target.ok) {
      assertWorkspaceUsable(assertUsable);
      return target;
    }

    const { canonicalRoot } = target;
    let metadata = target.metadata;
    assertWorkspaceUsable(assertUsable);
    if (metadata.workspaceId !== workspaceId) {
      return workspaceError(
        'ERR_WORKSPACE_METADATA_INVALID',
        'Workspace metadata is invalid',
        'previous-file-preserved'
      );
    }

    metadata = await repairWorkspaceTitleMetadataMirror({
      canonicalRoot,
      metadata,
      ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
    });
    const readModel = await rebuildWorkspaceReadModel(canonicalRoot, {
      ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
      passiveTiptapSidecarReconcile: true,
    });
    assertWorkspaceUsable(assertUsable);
    const index = await readOrRebuildIndex(canonicalRoot, {
      assertBeforePersist: async () => {
        assertWorkspaceUsable(assertUsable);
        await readModel.assertMemoriesRootCurrent();
      },
      rebuiltMemories: readModel.memories,
    });
    const review = await writeWorkspaceNeedsReviewReport({
      ...(assertUsable ? { assertUsable: () => assertWorkspaceUsable(assertUsable) } : {}),
      entries: readModel.reviewEntries,
      rootPath: canonicalRoot,
    });
    assertWorkspaceUsable(assertUsable);
    return {
      ok: true,
      snapshot: snapshotFrom(metadata, index, review),
    };
  } catch (error) {
    if (error instanceof WorkspaceOpenAborted) {
      return error.envelope;
    }
    return workspaceError(
      'ERR_WORKSPACE_OPEN_FAILED',
      'Workspace snapshot could not be read',
      'previous-file-preserved'
    );
  }
}

export async function readWorkspaceSnapshotFromIndex({
  rootPath,
  workspaceId,
  assertWorkspaceUsable: assertUsable,
}: ReadWorkspaceSnapshotOptions): Promise<WorkspaceFilesResult> {
  try {
    assertWorkspaceUsable(assertUsable);
    const target = await validateWorkspaceOpenTarget(rootPath);
    if (!target.ok) {
      assertWorkspaceUsable(assertUsable);
      return target;
    }

    const { canonicalRoot } = target;
    let metadata = target.metadata;
    assertWorkspaceUsable(assertUsable);
    if (metadata.workspaceId !== workspaceId) {
      return workspaceError(
        'ERR_WORKSPACE_METADATA_INVALID',
        'Workspace metadata is invalid',
        'previous-file-preserved'
      );
    }

    metadata = await repairWorkspaceTitleMetadataMirror({
      canonicalRoot,
      metadata,
      ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
    });
    assertWorkspaceUsable(assertUsable);

    const index = await readWorkspaceJsonNoFollow(
      getWorkspaceIndexPath(canonicalRoot),
      workspaceIndexSchema
    );
    if (!index) {
      return readWorkspaceSnapshotFromFileTruth({
        rootPath,
        workspaceId,
        ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
      });
    }

    assertWorkspaceUsable(assertUsable);
    return {
      ok: true,
      snapshot: snapshotFrom(metadata, index),
    };
  } catch (error) {
    if (error instanceof WorkspaceOpenAborted) {
      return error.envelope;
    }
    return workspaceError(
      'ERR_WORKSPACE_OPEN_FAILED',
      'Workspace snapshot could not be read',
      'previous-file-preserved'
    );
  }
}

async function readWorkspaceJsonNoFollow<T>(
  filePath: string,
  schema: z.ZodType<T>
): Promise<T | null> {
  const result = await readBoundedJsonNoFollow({
    beforeFinalAssert: () => beforeWorkspaceJsonNoFollowFinalAssertForTest?.(filePath),
    filePath,
    maxBytes: MAX_WORKSPACE_JSON_BYTES,
    schema,
  });
  return result.status === 'ok' ? result.value : null;
}

export async function updateWorkspaceIndex(
  rootPath: string,
  update: (memories: readonly MemorySummary[]) => readonly MemorySummary[]
): Promise<void> {
  await updateWorkspaceIndexFromCurrent(rootPath, update);
}

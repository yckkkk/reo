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
  checkWorkspaceWidgetsDirectory,
  checkWorkspaceReoDirectory,
  createNewWorkspaceRootDirectory,
  ensureWorkspaceDraftsDirectory,
  ensureWorkspaceMemoriesDirectory,
  ensureWorkspaceWidgetsDirectory,
  getWorkspaceIndexPath,
  getWorkspaceMetadataPath,
  resolveWorkspaceRoot,
} from './workspacePaths.js';
import {
  WORKSPACE_REVIEW_FALLBACK_RECOVERY_HINT,
  WORKSPACE_REVIEW_RECOVERY_HINTS,
  writeWorkspaceNeedsReviewReport,
  type WorkspaceReviewEntryInput,
} from './workspaceReviewReport.js';
import {
  workspaceError,
  workspaceWidgetTabOrderItemSchema,
  workspaceMemorySummarySchema,
  type WorkspaceWidgetProjection,
  type WorkspaceErrorEnvelope,
  type WorkspaceReviewSummary,
  type WorkspaceSnapshot,
} from '../workspace-contract/workspace-contract.js';
import { REO_TIPTAP_HIGHLIGHT_COLOR_VALUES } from '../tiptap-markdown/tiptapHighlightColors.js';
import { isSafeWorkspaceDirectoryName } from '../workspace-contract/workspace-name.js';
import { readBoundedJsonNoFollow } from './workspaceJsonFile.js';
import {
  readWorkspaceWidgetsFromFileTruth,
  workspaceWidgetOrderFromMetadata,
} from './workspaceWidgets.js';
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
  '- 封面生成、替换、默认模板切换、恢复默认或验证任务先读 `skills/reo-cover-image/SKILL.md`；需要审美判断时再读 `skills/reo-cover-aesthetic/SKILL.md`。',
  '- 创建或更新作品片段、作品补充时先读 `skills/reo-works/SKILL.md` 与 `skills/reo-works/references/`；作品运行时 bundle、模板、状态和验证由 `skills/reo-generative-runtime/SKILL.md`、`skills/reo-generative-runtime/references/` 和 `skills/reo-generative-runtime/scripts/` 承担。',
  '- 创建或更新右侧栏 Widget 时使用 `widgets/` 下的 Widget 目录；先读 `skills/reo-generative-runtime/SKILL.md`、`skills/reo-generative-runtime/references/` 和 `skills/reo-generative-runtime/scripts/`。',
  '- 创建或更新作品时，用户未指定风格默认按 `skills/reo-works-design/SKILL.md` 和 `skills/reo-works-design/references/` 的 Reo 视觉变量和参考模块；用户明确指定风格时仍用该 skill 对齐布局、交互和 runtime 边界。',
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
  '- Segment：Memory 内的正文片段，可以是 note、audio 或作品。',
  '- SegmentSupplement：挂在某个 Segment 下的补充内容。',
  '- Widget：`widgets/` 下挂载到右侧 rail 的独立小工具，不属于某个 Memory、Segment 或 Supplement。',
  '- `.reo/`：Reo 的技术完整性层，保存索引、manifest、草稿、回收站、lock 和恢复信息。',
  '- `skills/`：给 agent 使用的工作流技能，不是用户语义内容本身；当前托管入口包括 `reo-edit`、`reo-cover-image`、`reo-cover-aesthetic`、`reo-generative-runtime`、`reo-works`、`reo-works-design` 和 `reo-doctor`。',
  '',
  '## 文件层',
  '',
  '- `memories/` 保存用户语义内容，是普通编辑和创建任务的默认工作区。',
  '- Memory 使用 `memory.md`，Segment 使用 `segment.md`，SegmentSupplement 使用 `supplement.md`。',
  '- `content.tiptap.json` 是同一正文的富结构载体，由 Reo 与编辑器维护。',
  '- 作品对象使用 `kind: artifact`、`format: html`；运行时 bundle 是同目录 `entry.html`、`runtime.json`、`state.json` 和 `assets/`。',
  '- 右侧栏 Widget 使用 `widgets/<widget-directory>/widget.md`，frontmatter 必须包含 `id`、`title`、`kind: widget`、`format: html`、`mount: workspace-rail`；运行时 bundle 是同目录 `entry.html`、`runtime.json`、`state.json` 和 `assets/`。',
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
    'Keep stable ids in directory prefixes and Markdown frontmatter when they already exist. For a new Segment, generate an id matching `seg_YYYYMMDDHHMMSS_8hex`; for a new Supplement, generate an id matching `sup_YYYYMMDDHHMMSS_8hex`. Use the same id as the directory prefix and Markdown frontmatter id.',
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
    'id: seg_20260604024800_a1b2c3d4',
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
    'id: sup_20260604024900_d4c3b2a1',
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
export const DEFAULT_REO_COVER_IMAGE_SKILL_MD =
  [
    '---',
    'name: reo-cover-image',
    'description: 用于 Reo 记忆空间中的 Memory 或 Segment 封面生成、替换、默认模板切换、恢复默认和刷新验证。',
    '---',
    '',
    '# Reo Cover Image',
    '',
    '用于 Reo 封面图片任务。工作目录应是当前记忆空间 root。',
    '',
    '## 快速开始',
    '',
    '1. 如果用户给了明确对象目录或 manifest 路径，直接使用该路径。',
    '2. 自定义封面：把最终图片写入目标对象自己的 `cover/` 目录。',
    '3. 默认模板：只写对应对象 manifest 的 `defaultCoverTemplateId`。',
    '4. 直接验证文件效果，然后停止。Reo 负责 snapshot refresh 和投影。',
    '',
    '需要先判断或提升封面审美时，使用 `skills/reo-cover-aesthetic/SKILL.md`。',
    '',
    '## 目标路径',
    '',
    '- Memory 封面：`memories/<memory-directory>/cover/`。',
    '- Segment 封面：`memories/<memory-directory>/segments/<segment-directory>/cover/`。',
    '- Memory 默认模板 manifest：`.reo/objects/memories/<memoryId>.json`。',
    '- Segment 默认模板 manifest：`.reo/objects/segments/<segmentId>.json`。',
    '- 如果用户说“列表项”“记忆封面”“Memory rail”，通常是 Memory 封面。',
    '- 如果用户说“片段”“横向片段”“Segment poster”，通常是 Segment 封面。',
    '',
    '## 替换或创建自定义封面',
    '',
    '- 如果目标 `cover/` 不存在，创建普通目录。',
    '- 把选定封面图片放入该目录。当前合法格式是 PNG、JPEG 和 WebP。',
    '- Reo 使用 `cover/` 中按文件名排序的第一个合法普通图片文件；如果用户只期望一个封面，使用 `cover.png` 这类稳定文件名，或移除旧候选图。',
    '- 不要创建 symlink、嵌套 cover 目录、隐藏临时文件或不支持的格式。',
    '- 自定义封面任务不要编辑 `.reo/index.json`、manifest、lock、`.reo/trash` 或协议 URL。Reo 会重新计算 cover projection。',
    '',
    '## 生成封面',
    '',
    '- 使用可用的图片生成工具或用户提供的提示词生成位图封面。',
    '- 生成图像应让画面内容自然铺满整个画布，主体在紧凑尺寸下仍可辨认，边缘被 UI 裁切时也不影响主题。',
    '- Segment poster 封面上会叠加标题、waveform/file icon 和 meta；图片仍应清晰铺满，不要在图中预留文字胶囊、按钮、暗框或空白 UI 区。',
    '- 不要在图片内部绘制边框、白边、相框、卡片、圆角容器、海报留白或模拟 Memory rail 的外壳；Reo 界面会自己裁切和加圆角。',
    '- 避免嵌入文字、logo、二维码、UI chrome、路径名、凭证，或任何用户没有要求纪念的内容。',
    '- 如果生成多个候选，除非用户明确要求保留变体，只把最终选定图片放入 `cover/`。',
    '',
    '## 切换随机默认图片',
    '',
    '- 用户要求通过 Reo app 操作时，使用对应对象 More 菜单项 `切换随机默认图片`。',
    '- 用户要求文件操作或给出 manifest 路径时，读取目标对象 manifest，把顶层 `defaultCoverTemplateId` 改成 `cover-01` 到 `cover-13` 中的目标值，然后验证 JSON 仍可解析。',
    '- 如果用户已经给出 manifest 路径，只改那个文件、那个字段。',
    '- 不写图片文件，不要编辑 `.reo/index.json`。自定义 `cover/` 仍会优先展示。',
    '',
    '## 恢复默认封面',
    '',
    '- 用户要求通过 Reo app 操作时，使用对应对象 More 菜单项 `恢复随机默认图片`。',
    '- 纯文件操作时，只有用户明确要求恢复默认封面，才移除或移动目标对象自己的 `cover/` 目录。',
    '- 不要写入默认封面文件。默认封面内置在 Reo，不存放在记忆空间内。',
    '',
    '## 验证',
    '',
    '- 自定义封面：确认 `cover/` 是普通目录，首个合法图片是普通 PNG、JPEG 或 WebP，且没有 symlink。',
    '- 默认模板：确认目标 manifest JSON 可解析，`defaultCoverTemplateId` 是目标模板 id。',
    '- 如果 Reo 正在打开该记忆空间，等待文件真源刷新；不要编辑 `.reo/index.json` 强制刷新。',
  ].join('\n') + '\n';
export const DEFAULT_REO_COVER_AESTHETIC_SKILL_MD =
  [
    '---',
    'name: reo-cover-aesthetic',
    'description: 用于创建、判断或改进 Reo Memory 与 Segment 封面提示词或生成图，尤其用于避免泛用、内嵌边框、文字过多、UI 化或低质量封面。',
    '---',
    '',
    '# Reo Cover Aesthetic',
    '',
    '这是基于开源 `aesthetic` skill 优化后的 Reo 封面审美 skill。它应该独立工作，不要求 agent 再安装其它 skill。',
    '',
    '## 使用场景',
    '',
    '适用：',
    '- 为 Reo Memory 或 Segment 生成、重写或评估封面提示词。',
    '- 判断候选封面是否足够美观、是否适合紧凑 Memory rail 或 Segment poster。',
    '- 发现封面像截图、海报、卡片、相框、白边图或泛用素材，需要重新收敛。',
    '- 用户只给了标题、片段内容或简短上下文，需要把它转成有审美方向的视觉提示词。',
    '',
    '## 核心框架：四阶段方法',
    '',
    '### 1. BEAUTIFUL：理解审美',
    '',
    '审美标准来自高质量参考，不来自 agent 的第一反应。先从 Memory/Segment 标题、附近内容和用户意图提炼：主题、情绪、材质、光线、色彩、空间层次和视觉节奏。需要参考时，优先参考真实高质量摄影、插画、编辑视觉或产品内已有封面，而不是生成一个泛用背景。',
    '',
    '### 2. RIGHT：适配 Reo 封面',
    '',
    '封面是 Memory 或 Segment 的视觉身份，不是 UI 截图或装饰卡片。它必须在很小的 rail/poster 尺寸下仍然成立：主体清楚，层次明确，边缘自然延展，不能依赖可读文字、logo 或路径名。',
    '',
    '### 3. SATISFYING：紧凑尺寸的丰富度',
    '',
    '优秀封面在紧凑尺寸下仍有可感知的质感：明确的明暗关系、不过度均匀的背景、可识别的主体轮廓、克制但有变化的色彩。避免只用渐变、噪点、抽象线条或单一色块糊弄。',
    '',
    '### 4. PEAK：用记忆讲故事',
    '',
    '封面应该暗示这个 Memory 或 Segment 的独特语境。把抽象主题落到具体视觉：地点、物件、光线、材料、季节、动作痕迹或作品气质。不要把标题文字画进图里来解释主题。',
    '',
    '## Reo 封面规则',
    '',
    '- 图片内容必须自然铺满整个画布。不要生成画中画、内嵌边框、白边、相框、圆角矩形、卡片、海报留白、Polaroid、mockup 或任何模拟 UI 容器的外壳。',
    '- 不要让提示词包含 `border`、`frame`、`framed`、`card`、`poster with margin`、`white background`、`polaroid`、`mockup`、`UI screenshot` 这类会诱导内嵌边框的词，除非用户明确要这种纪念物本身。',
    '- 如果候选图里出现内部边框、白色留边、相框或卡片容器，直接判定不合格并重生成。',
    '- 不要嵌入可读文字、logo、二维码、路径名、凭证、应用 UI chrome 或工具界面。',
    '- 画面主体应位于中部可识别区域，但边缘也要有自然延展；Reo UI 会负责裁切、圆角和列表项外形。',
    '- Segment poster 上方会叠加标题，下方会叠加 waveform/file icon 和 meta；不要把这些 UI 预先画进封面，也不要在图中做胶囊底、暗框或留白。',
    '- 文件落位和恢复默认仍然按 `skills/reo-cover-image/SKILL.md` 执行。',
    '',
    '## 提示词结构',
    '',
    '最终提示词应包含：对象主题、情绪、视觉媒介、主体、环境、光线、材质、色彩关系、层次、full-bleed 约束和负面约束。',
    '',
    '推荐结构：',
    '',
    '`Full-bleed [medium] of [subject and setting], [mood], [lighting], [materials/textures], [color relationship], clear central subject, natural detail to every edge, no text, no logo, no border, no frame, no white margin, no card, no UI mockup.`',
    '',
    '## 评估清单',
    '',
    '- 审美质量至少达到 7/10；如果第一张只是可用但普通，继续优化提示词。',
    '- 在 80px 左右仍能看出主体或氛围。',
    '- 没有图片内部边框、白边、相框、卡片或 UI 容器。',
    '- 不依赖文字解释主题。',
    '- 色彩、光线和材质服务 Memory 或 Segment 的语义，而不是套一个通用风格。',
    '',
    '## 输出',
    '',
    '输出最终封面提示词或候选选择，并简短说明为什么它符合 Reo cover rules。之后使用 `skills/reo-cover-image/SKILL.md` 完成文件落位。',
  ].join('\n') + '\n';

export const DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD =
  [
    '---',
    'name: reo-generative-runtime',
    'description: Shared Reo generative runtime skill for building small local Web app bundles used by works and workspace rail widgets. Use for entry.html/runtime.json/state.json/assets, widget.md, window.reo bridge, state, templates, network, scaffold and validation.',
    '---',
    '',
    '# Reo Generative Runtime',
    '',
    'Use this skill whenever you create or update a Reo runtime object. A runtime object is a small local Web app bundle owned by the user. Works and workspace rail widgets are current consumers of the same runtime contract.',
    '',
    '## Runtime Bundle',
    '',
    'A valid runtime bundle lives beside the object Markdown file and uses four stable entries:',
    '',
    '- `entry.html`: the runnable HTML app entry.',
    '- `runtime.json`: description, entry, template family, state stores and bridge needs.',
    '- `state.json`: user-visible state stores that agents can inspect and edit.',
    '- `assets/`: local images, CSS, JS, fonts or data files copied into the bundle.',
    '',
    'For workspace rail widgets, the object directory is `widgets/<widget-directory>/`. The object Markdown file is `widget.md`; its frontmatter must contain only stable widget contract fields such as `id`, `title`, `kind: widget`, `format: html` and `mount: workspace-rail`. Do not add `workspaceId` or raw paths to `widget.md`.',
    '',
    'Read `references/bundle-contract.md` before writing files.',
    '',
    '## State',
    '',
    '`state.json` is the durable agent-readable state file. Runtime code may read and write it through `window.reo.state` with a version/baseline contract. If a work or widget needs to remember user actions, progress, preferences, check-ins, filters or todo items, write that durable state to `state.json`; browser storage such as localStorage and IndexedDB is only a fast UI cache or compatibility cache. State writes update the running work or widget through the returned state/version; they do not reload the host iframe.',
    '',
    'Read `references/state-and-storage.md` for store naming, versioning and merge rules.',
    '',
    '## Bridge',
    '',
    'To use Reo data, state, UI, mutation or agent prompt actions, explicitly load `reo-render://vendor/reo-render/bridge.js` from `entry.html`. This provides `window.reo` inside the iframe. Do not invent any other host bridge. Memory summaries expose `memoryId`, not `id`; when iterating `workspace.memories`, use `const memoryId = memory.memoryId` before calling `selectMemory` or `readMemoryDetail`. Workspace rail widgets may call `window.reo.ui.selectMemory({ memoryId })` to switch the main content Memory; this does not switch away from the widget tab.',
    '',
    'Read `references/bridge-api.md` before using `window.reo`.',
    '',
    '## Web Capability',
    '',
    '普通 Web 网络 is allowed. You may use remote HTTP/HTTPS resources, CDN libraries, WebSocket endpoints and browser APIs available inside an iframe. Do not use Node, Electron, raw filesystem paths, `file://`, symlinks or hidden editor temp files. If a third-party API blocks browser CORS, explain that to the user or use a different browser-compatible source.',
    '',
    '## Templates',
    '',
    'Choose a template family to move fast, then adapt it freely. Useful families include report, explainer, dashboard, editor, spaced review, todo, game, gallery, map, prototype and data tool. Templates are starting points, not capability limits.',
    '',
    'Read `references/templates.md` before choosing structure.',
    '',
    '## Responsive Layout',
    '',
    'Runtime layouts must survive narrow iframes and right rail widgets. For flex/grid text containers, set `min-width: 0`; for single-line labels use `display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`; for long identifiers or free text use `overflow-wrap: anywhere`. Never let titles, ids, URLs or generated prose create horizontal overflow.',
    '',
    '## Scripts',
    '',
    '- Scaffold a runnable bundle in an existing target object directory: `node skills/reo-generative-runtime/scripts/scaffold-runtime.mjs <target-directory> --title "标题" --template dashboard`.',
    '- Validate a bundle can run: `node skills/reo-generative-runtime/scripts/validate-runtime.mjs <target-directory>`.',
    '- Inspect a bundle summary: `node skills/reo-generative-runtime/scripts/inspect-runtime.mjs <target-directory>`.',
    '',
    'Validation is about file contract and runnability. It does not judge content quality, network choices or user intent.',
  ].join('\n') + '\n';

const DEFAULT_REO_GENERATIVE_RUNTIME_BUNDLE_CONTRACT_REFERENCE_MD =
  [
    '# Reo runtime bundle contract',
    '',
    'Use this reference for every Reo runtime object.',
    '',
    '## Required files',
    '',
    'A runtime bundle contains:',
    '',
    '- `entry.html` as the only HTML entry Reo loads.',
    '- `runtime.json` as description and launch metadata.',
    '- `state.json` as visible agent-editable state.',
    '- `assets/` for local resources.',
    '',
    '## Markdown object contract',
    '',
    'Works and workspace rail widgets use Markdown frontmatter to become Reo objects.',
    '',
    'Work Segment:',
    '',
    '```markdown',
    '---',
    'id: seg_20260604024800_a1b2c3d4',
    'title: 间隔复习表',
    'kind: artifact',
    'format: html',
    '---',
    '# 间隔复习表',
    '',
    'Agent-created runtime work. Entry: `entry.html`.',
    '```',
    '',
    'For new supplements, use the same artifact fields in `supplement.md` with a `sup_YYYYMMDDHHMMSS_8hex` id. Existing Reo objects may use older valid ids; when creating new objects, do not invent placeholder ids like `seg_agent_*` or `sup_agent_*`.',
    '',
    'Workspace rail Widget:',
    '',
    '```markdown',
    '---',
    'id: wdg_20260605075957_755b96e2',
    'title: Workspace 总览',
    'kind: widget',
    'format: html',
    'mount: workspace-rail',
    '---',
    '# Workspace 总览',
    '',
    'Right rail widget. Entry: `entry.html`.',
    '```',
    '',
    'For new widgets, create `widgets/<wdg_YYYYMMDDHHMMSS_8hex--Readable-title>/widget.md` with the same `wdg_` id as the directory prefix. Keep `widget.md` frontmatter strict: do not add `workspaceId`, raw paths, state, cache, preview or `.reo` fields.',
    '',
    '## runtime.json',
    '',
    'Minimum shape:',
    '',
    '```json',
    '{',
    '  "schemaVersion": 1,',
    '  "title": "间隔复习表",',
    '  "entry": "entry.html",',
    '  "template": "spaced-review",',
    '  "state": { "schemaVersion": 1, "stores": ["ui", "data", "progress", "draft"] },',
    '  "bridge": { "needs": ["state"] }',
    '}',
    '```',
    '',
    '`runtime.json` is not a permission approval file. It describes intent and helps future agents update the work.',
    '',
    'If the work uses Reo runtime APIs, add the vendor bridge script before your own script:',
    '',
    '```html',
    '<script src="reo-render://vendor/reo-render/bridge.js"></script>',
    '```',
    '',
    '## Assets',
    '',
    '- Put local resources under `assets/` and reference them with relative URLs such as `assets/chart-data.json`.',
    '- Do not reference absolute paths, `file://`, symlinks, editor temp files or files outside the object directory.',
    '- Keep direct assets ordinary files. Avoid very large base64 blobs in `entry.html`.',
  ].join('\n') + '\n';

const DEFAULT_REO_GENERATIVE_RUNTIME_STATE_REFERENCE_MD =
  [
    '# Reo runtime state and storage',
    '',
    'Use this reference when the work or widget has user interaction, checkboxes, filters, drafts, progress or generated data.',
    '',
    '## state.json',
    '',
    'Default shape:',
    '',
    '```json',
    '{',
    '  "schemaVersion": 1,',
    '  "stores": {',
    '    "ui": {},',
    '    "data": {},',
    '    "progress": {},',
    '    "draft": {}',
    '  }',
    '}',
    '```',
    '',
    'Use named stores so future agents can update one area without guessing the whole app. Keep values JSON-serializable.',
    '',
    '## Runtime state bridge',
    '',
    '`window.reo.state.read()` returns `{ state, version, source }`.',
    '`window.reo.state.write(nextState, { baselineVersion })` writes `state.json` through Reo. If another agent edited the file first, Reo returns a stale result with the current state/version; reread and merge deliberately.',
    '',
    'Minimal pattern:',
    '',
    '```js',
    'const snapshot = await window.reo.state.read();',
    'const next = { ...snapshot.state, stores: { ...snapshot.state.stores, ui: { done: true } } };',
    'const saved = await window.reo.state.write(next, { baselineVersion: snapshot.version });',
    '```',
    '',
    '## Browser persistence',
    '',
    'Each runtime object has its own origin, so localStorage and IndexedDB are isolated per object. Use browser storage for fast UI cache when helpful. Do not use browser storage as the only long-term state for check-ins, todo items, progress or user preferences; keep `state.json` as the visible durable state that users and agents can inspect and modify.',
    '',
    'Writing `state.json` through `window.reo.state.write` does not reload the host iframe. Update the DOM from the returned result. Reo reloads the iframe when `entry.html`, `runtime.json` or `assets/` change, and the user can manually reload from the work or widget tab More menu with “刷新页面”.',
    '',
    '## Agent updates',
    '',
    'When an agent updates data, it should edit `state.json` and `entry.html` together if the entry embeds a static copy of the data. Preserve unknown store keys unless the user asks for a reset.',
  ].join('\n') + '\n';

const DEFAULT_REO_GENERATIVE_RUNTIME_BRIDGE_REFERENCE_MD =
  [
    '# Reo runtime bridge API',
    '',
    'Use this reference when a work or widget needs live Reo context, durable state, host UI coordination, typed product writes or agent prompt actions.',
    '',
    '## Setup',
    '',
    'Add this script before your own runtime script:',
    '',
    '```html',
    '<script src="reo-render://vendor/reo-render/bridge.js"></script>',
    '```',
    '',
    'The script creates `window.reo`. All methods return Promises. On Reo errors, the Promise rejects with `error.code` and `error.message`.',
    '',
    '## API groups',
    '',
    '- `window.reo.state.read()` and `window.reo.state.write(state, { baselineVersion })` for `state.json`.',
    '- `window.reo.workspace.read()` for current workspace summary, all Memory summaries, current Memory summary, target identity and current object projection.',
    '- `window.reo.content.readMemoryDetail()` for the current Memory detail, or `window.reo.content.readMemoryDetail({ memoryId })` after reading `workspace.memories` when a work needs another Memory detail.',
    '- `window.reo.content.readCurrentObject()` for the current Reo object projection without raw paths.',
    '- `window.reo.mutations.updateTitle({ title })` for the current work title.',
    '- `window.reo.ui.requestFullscreen()` to ask the host preview to expand.',
    '- `window.reo.ui.selectMemory({ memoryId })` for workspace rail widgets that need to switch the main content Memory after reading `workspace.memories`; this keeps the widget tab active and does not make the widget become Memory content.',
    '- `window.reo.agent.copyPrompt({ action })` to copy a Reo-built agent prompt. Use `action: "create-supplement"` from a work Segment; otherwise omit action to update the current work.',
    '',
    '## Workspace Memory ids',
    '',
    '`window.reo.workspace.read()` returns Memory summaries with `memoryId`. Use that exact field for selection and detail reads:',
    '',
    '```js',
    'const snapshot = await window.reo.workspace.read();',
    'for (const memory of snapshot.workspace.memories) {',
    '  const memoryId = memory.memoryId;',
    '  button.dataset.memoryId = memoryId;',
    '  button.addEventListener("click", () => window.reo.ui.selectMemory({ memoryId }));',
    '}',
    '```',
    '',
    'Do not use `memory.id`; that field is not part of the runtime workspace summary contract.',
    '',
    '## Boundaries',
    '',
    '- Do not call Electron, Node, preload internals or raw filesystem paths.',
    '- Do not invent methods outside documented `window.reo` groups.',
    '- Reo bridge mutations are typed product actions, not a generic file bridge.',
    '- Artifact works cannot write arbitrary note bodies through `window.reo`; use agent prompt actions when a work needs a broader Reo content edit.',
    '- Workspace rail widgets cannot create, rename, reorder or delete widgets through `window.reo`; use agent prompt actions and the workspace file contract for broader edits.',
    '- Network, CDN and browser APIs are allowed; browser CORS rules still apply.',
    '',
    'Reo does not provide a runtime key, token or hidden value store for works or widgets. If a runtime object needs user-provided values, keep that behavior explicit inside the user-owned files and agent instructions.',
  ].join('\n') + '\n';

const DEFAULT_REO_GENERATIVE_RUNTIME_TEMPLATES_REFERENCE_MD =
  [
    '# Reo runtime templates',
    '',
    'Pick one dominant template family. Do not combine everything into one work.',
    '',
    '- report: structured narrative with sections, evidence and short conclusions.',
    '- explainer: step-by-step concept explanation with small interactive controls.',
    '- dashboard: metric cards, chart/table and action list.',
    '- editor: focused text, checklist, rubric or planning surface.',
    '- spaced review: schedule table, due states, review controls and progress store.',
    '- todo: task list with `state.json` persistence and visible progress.',
    '- game: small local learning or reflection game with bounded state.',
    '- gallery: image/media grid or timeline using copied local assets.',
    '- map: conceptual, geographic or relationship map.',
    '- prototype: product UI mockup or clickable flow.',
    '- data tool: filter, sort, calculator or converter grounded in Memory data.',
    '',
    'Start with the closest family, ship a runnable bundle, then add only the interactions the user asked for.',
    '',
    '## Responsive text',
    '',
    'Right rail widgets are narrow. Put `min-width: 0` on flex/grid text columns and any parent that should shrink. Single-line titles, memory names, counters and menu labels should use `display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`. Long ids, URLs or user text that may not contain spaces should use `overflow-wrap: anywhere` instead of forcing horizontal scroll.',
  ].join('\n') + '\n';

const DEFAULT_REO_GENERATIVE_RUNTIME_VALIDATION_REFERENCE_MD =
  [
    '# Reo runtime validation',
    '',
    'Validation answers whether this bundle can run in Reo.',
    '',
    '## Required checks',
    '',
    '- `entry.html`, `runtime.json` and `state.json` exist.',
    '- `runtime.json` and `state.json` parse as JSON.',
    '- `entry.html` is a complete HTML document with useful visible content.',
    '- Local files are under `assets/` and referenced by relative URLs.',
    '- No `file://`, absolute local path, symlink, `.reo/` dependency or editor temp file is required.',
    '- If `entry.html` uses `window.reo`, it also loads `reo-render://vendor/reo-render/bridge.js`.',
    '- Narrow embeds do not have horizontal text overflow; flex/grid text containers can shrink with `min-width: 0`, single-line labels ellipsize, and long unbroken text can wrap.',
    '- The work or widget stays light enough for future agent edits.',
    '',
    'Run `node skills/reo-generative-runtime/scripts/validate-runtime.mjs <target-directory>` before ending a runtime task. This check validates runnability; it does not review taste, content quality, network choices or user choices.',
  ].join('\n') + '\n';

export const DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES = {
  'bundle-contract.md': DEFAULT_REO_GENERATIVE_RUNTIME_BUNDLE_CONTRACT_REFERENCE_MD,
  'bridge-api.md': DEFAULT_REO_GENERATIVE_RUNTIME_BRIDGE_REFERENCE_MD,
  'state-and-storage.md': DEFAULT_REO_GENERATIVE_RUNTIME_STATE_REFERENCE_MD,
  'templates.md': DEFAULT_REO_GENERATIVE_RUNTIME_TEMPLATES_REFERENCE_MD,
  'validation.md': DEFAULT_REO_GENERATIVE_RUNTIME_VALIDATION_REFERENCE_MD,
} as const;

export const DEFAULT_REO_WORKS_DESIGN_TOKEN_CSS =
  [
    ':root {',
    '  --color-background-primary: #ffffff;',
    '  --color-background-secondary: #f7f7f5;',
    '  --color-background-tertiary: #f1f0ed;',
    '  --color-background-info: #e6f1fb;',
    '  --color-background-danger: #fcebeb;',
    '  --color-background-success: #eaf3de;',
    '  --color-background-warning: #faeeda;',
    '  --color-text-primary: #2c2c2a;',
    '  --color-text-secondary: #5f5e5a;',
    '  --color-text-tertiary: #888780;',
    '  --color-text-info: #0c447c;',
    '  --color-text-danger: #791f1f;',
    '  --color-text-success: #27500a;',
    '  --color-text-warning: #633806;',
    '  --color-border-tertiary: rgba(44, 44, 42, 0.15);',
    '  --color-border-secondary: rgba(44, 44, 42, 0.3);',
    '  --color-border-primary: rgba(44, 44, 42, 0.4);',
    '  --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
    '  --font-serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;',
    '  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;',
    '  --border-radius-md: 8px;',
    '  --border-radius-lg: 12px;',
    '  --border-radius-xl: 16px;',
    '}',
    '@media (prefers-color-scheme: dark) {',
    '  :root {',
    '    --color-background-primary: #191918;',
    '    --color-background-secondary: #242421;',
    '    --color-background-tertiary: #2c2c2a;',
    '    --color-background-info: #0c447c;',
    '    --color-background-danger: #791f1f;',
    '    --color-background-success: #27500a;',
    '    --color-background-warning: #633806;',
    '    --color-text-primary: #f1efe8;',
    '    --color-text-secondary: #d3d1c7;',
    '    --color-text-tertiary: #b4b2a9;',
    '    --color-text-info: #b5d4f4;',
    '    --color-text-danger: #f7c1c1;',
    '    --color-text-success: #c0dd97;',
    '    --color-text-warning: #fac775;',
    '    --color-border-tertiary: rgba(241, 239, 232, 0.16);',
    '    --color-border-secondary: rgba(241, 239, 232, 0.3);',
    '    --color-border-primary: rgba(241, 239, 232, 0.42);',
    '  }',
    '}',
  ].join('\n') + '\n';

const DEFAULT_REO_WORKS_DESIGN_TOKEN_CSS_MARKDOWN_LINES = [
  '```css',
  ...DEFAULT_REO_WORKS_DESIGN_TOKEN_CSS.trimEnd().split('\n'),
  '```',
];

export const DEFAULT_REO_GENERATIVE_RUNTIME_SCAFFOLD_SCRIPT_MJS =
  [
    '#!/usr/bin/env node',
    "import { lstat, mkdir, open, realpath } from 'node:fs/promises';",
    "import path from 'node:path';",
    '',
    'function argValue(name, fallback) {',
    '  const index = process.argv.indexOf(name);',
    '  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;',
    '}',
    '',
    'const targetArg = process.argv[2];',
    'if (!targetArg || targetArg.startsWith("--")) {',
    '  console.error("Usage: scaffold-runtime.mjs <target-directory> --title <title> --template <family>");',
    '  process.exit(1);',
    '}',
    '',
    'const root = process.cwd();',
    'const rootReal = await realpath(root);',
    'const target = path.resolve(root, targetArg);',
    'const relative = path.relative(root, target);',
    '',
    'function isInsideRoot(realPath) {',
    '  const realRelative = path.relative(rootReal, realPath);',
    '  return !realRelative.startsWith("..") && !path.isAbsolute(realRelative);',
    '}',
    '',
    'async function nearestExistingAncestor(start) {',
    '  let current = start;',
    '  while (true) {',
    '    try {',
    '      await lstat(current);',
    '      return current;',
    '    } catch (error) {',
    '      if (!error || error.code !== "ENOENT") throw error;',
    '      const parent = path.dirname(current);',
    '      if (parent === current) throw error;',
    '      current = parent;',
    '    }',
    '  }',
    '}',
    '',
    'async function assertSafeTarget() {',
    '  if (relative.startsWith("..") || path.isAbsolute(relative) || relative.split(path.sep).includes(".reo")) {',
    '    throw new Error("Target must be inside the memory space and outside .reo.");',
    '  }',
    '  const ancestor = await nearestExistingAncestor(target);',
    '  if (!isInsideRoot(await realpath(ancestor))) {',
    '    throw new Error("Target must stay inside the memory space.");',
    '  }',
    '  try {',
    '    const stats = await lstat(target);',
    '    if (stats.isSymbolicLink()) throw new Error("Target must not be a symlink.");',
    '    if (!stats.isDirectory()) throw new Error("Target must be a directory.");',
    '    if (!isInsideRoot(await realpath(target))) throw new Error("Target must stay inside the memory space.");',
    '  } catch (error) {',
    '    if (!error || error.code !== "ENOENT") throw error;',
    '  }',
    '}',
    '',
    'try {',
    '  await assertSafeTarget();',
    '} catch (error) {',
    '  console.error(error instanceof Error ? error.message : "Target must be inside the memory space and outside .reo.");',
    '  process.exit(1);',
    '}',
    '',
    'const title = argValue("--title", path.basename(target));',
    'const template = argValue("--template", "custom");',
    'await mkdir(path.join(target, "assets"), { recursive: true });',
    'try {',
    '  await assertSafeTarget();',
    '} catch (error) {',
    '  console.error(error instanceof Error ? error.message : "Target must be inside the memory space and outside .reo.");',
    '  process.exit(1);',
    '}',
    '',
    'async function writeNoReplace(filePath, text) {',
    '  let handle;',
    '  try {',
    '    handle = await open(filePath, "wx");',
    '    await handle.writeFile(text);',
    '  } catch (error) {',
    '    if (error && error.code === "EEXIST") return false;',
    '    throw error;',
    '  } finally {',
    '    await handle?.close();',
    '  }',
    '  return true;',
    '}',
    '',
    'function templateConfig(name) {',
    '  const key = String(name || "custom").toLowerCase();',
    '  const configs = {',
    '    report: { id: "report", heading: "报告", summary: "把材料整理成清楚的段落、证据和下一步。", sections: ["重点", "证据", "下一步"] },',
    '    explainer: { id: "explainer", heading: "解释器", summary: "用一个小例子把概念讲清楚。", sections: ["这个是什么", "为什么重要", "试试看"] },',
    '    dashboard: { id: "dashboard", heading: "看板", summary: "用指标、列表和行动项快速看全局。", sections: ["指标", "趋势", "行动"] },',
    '    editor: { id: "editor", heading: "编辑器", summary: "留下一个可以继续填写和整理的工作区。", sections: ["草稿", "检查", "完成"] },',
    '    "spaced-review": { id: "spaced-review", heading: "复习表", summary: "安排今天、明天和本周要回顾的内容。", sections: ["今天", "明天", "本周"] },',
    '    todo: { id: "todo", heading: "待办", summary: "记录下一步，并能在作品里勾选完成。", sections: ["今天", "以后", "完成"] },',
    '    game: { id: "game", heading: "小游戏", summary: "用一个轻量互动帮助回顾和判断。", sections: ["问题", "选择", "结果"] },',
    '    gallery: { id: "gallery", heading: "画廊", summary: "用一组卡片保存可继续扩展的材料。", sections: ["片段", "主题", "补充"] },',
    '    map: { id: "map", heading: "地图", summary: "把关系、阶段或路径放到同一张图上。", sections: ["起点", "连接", "终点"] },',
    '    prototype: { id: "prototype", heading: "原型", summary: "做一个可点击的简单流程。", sections: ["入口", "步骤", "结果"] },',
    '    "data-tool": { id: "data-tool", heading: "数据工具", summary: "输入一个数字或文本，马上看到计算结果。", sections: ["输入", "计算", "结果"] },',
    '    custom: { id: "custom", heading: "作品", summary: "一个可以被 agent 继续改写的本地 Web app。", sections: ["内容", "状态", "下一步"] },',
    '  };',
    '  return configs[key] || configs.custom;',
    '}',
    '',
    'function initialState(config) {',
    '  if (config.id === "todo") {',
    '    return { schemaVersion: 1, stores: { ui: { filter: "all" }, data: { items: [] }, progress: { completed: 0 }, draft: { text: "" } } };',
    '  }',
    '  return { schemaVersion: 1, stores: { ui: { selected: config.sections[0] }, data: { sections: config.sections }, progress: {}, draft: {} } };',
    '}',
    '',
    'function escapeHtml(value) {',
    '  return String(value).replace(/[&<>"\']/g, function (char) {',
    '    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\"": "&quot;", "\'": "&#39;" }[char];',
    '  });',
    '}',
    '',
    'function bodyForTemplate(config) {',
    '  if (config.id === "todo") {',
    '    return `<form id="todo-form" class="toolbar"><input id="todo-input" placeholder="写下一件事"><button type="submit">新增一项</button></form><ul id="todo-list" class="list"></ul>`;',
    '  }',
    '  if (config.id === "dashboard") {',
    '    return `<div class="metrics"><div><span>已整理</span><strong>3</strong></div><div><span>待处理</span><strong>2</strong></div><div><span>下一步</span><strong>1</strong></div></div>`;',
    '  }',
    '  return `<div class="grid">${config.sections.map(function (section) { return `<section class="panel"><h2>${escapeHtml(section)}</h2><p>把和「${escapeHtml(section)}」有关的内容放在这里，后续可以继续改写。</p></section>`; }).join("")}</div>`;',
    '}',
    '',
    `const BASE_CSS = ${JSON.stringify(DEFAULT_REO_WORKS_DESIGN_TOKEN_CSS)};`,
    '',
    'function styleCss() {',
    '  return BASE_CSS + `body{margin:0;font-family:var(--font-sans);background:var(--color-background-primary);color:var(--color-text-primary);padding:24px;line-height:1.6}main{max-width:820px;margin:0 auto}h1{font-size:22px;font-weight:500;margin:0 0 8px}h2{font-size:16px;font-weight:500;margin:0 0 6px}.lead{color:var(--color-text-secondary);margin:0 0 16px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.panel,.metrics>div{background:var(--color-background-secondary);border-radius:var(--border-radius-lg);padding:16px}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}.metrics span{display:block;color:var(--color-text-secondary);font-size:13px}.metrics strong{font-size:24px;font-weight:500}.toolbar{display:flex;gap:8px;margin:16px 0}.toolbar input{flex:1;min-width:0;border:0;background:var(--color-background-secondary);color:var(--color-text-primary);border-radius:var(--border-radius-md);padding:10px 12px}.toolbar input::placeholder{color:var(--color-text-tertiary)}.toolbar button,.list button{border:0;border-radius:var(--border-radius-md);background:var(--color-text-primary);color:var(--color-background-primary);padding:10px 12px}.list{list-style:none;padding:0;margin:0;display:grid;gap:8px}.list li{display:flex;align-items:center;justify-content:space-between;background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:10px 12px}`;',
    '}',
    '',
    'function entryHtml(title, config) {',
    '  return `<!doctype html>\\n<html lang="zh-CN">\\n<head>\\n  <meta charset="utf-8">\\n  <meta name="viewport" content="width=device-width, initial-scale=1">\\n  <title>${escapeHtml(title)}</title>\\n  <style>${styleCss()}</style>\\n</head>\\n<body data-template="${config.id}">\\n  <main>\\n    <h1>${escapeHtml(title)}</h1>\\n    <p class="lead">${escapeHtml(config.summary)}</p>\\n    ${bodyForTemplate(config)}\\n  </main>\\n  <script src="reo-render://vendor/reo-render/bridge.js"></script>\\n  <script>\\n    (function(){\\n      var currentVersion = null;\\n      var state = { schemaVersion: 1, stores: { data: { items: [] } } };\\n      function items(){ return ((state.stores || {}).data || {}).items || []; }\\n      function render(){ var list = document.getElementById("todo-list"); if (!list) return; list.textContent = ""; items().forEach(function(item, index){ var row = document.createElement("li"); var label = document.createElement("span"); var button = document.createElement("button"); label.textContent = String(item && item.text ? item.text : ""); button.type = "button"; button.setAttribute("data-index", String(index)); button.textContent = item && item.done ? "已完成" : "完成"; row.appendChild(label); row.appendChild(button); list.appendChild(row); }); }\\n      function save(next){ if (!window.reo || !currentVersion) { state = next; render(); return Promise.resolve(); } return window.reo.state.write(next, { baselineVersion: currentVersion }).then(function(result){ if (result.status === "saved") { state = result.state; currentVersion = result.version; } else if (result.status === "stale") { state = result.currentState; currentVersion = result.currentVersion; } render(); }).catch(function(){ state = next; render(); }); }\\n      window.reo?.state?.read?.().then(function(snapshot){ state = snapshot.state || state; currentVersion = snapshot.version; render(); }).catch(render);\\n      document.addEventListener("submit", function(event){ if (event.target && event.target.id === "todo-form") { event.preventDefault(); var input = document.getElementById("todo-input"); var text = input && input.value ? input.value.trim() : ""; if (!text) return; if (input) input.value = ""; var next = Object.assign({}, state, { stores: Object.assign({}, state.stores, { data: { items: items().concat([{ text: text, done: false }]) } }) }); void save(next); } });\\n      document.addEventListener("click", function(event){ var button = event.target && event.target.closest ? event.target.closest("[data-index]") : null; if (!button) return; var index = Number(button.getAttribute("data-index")); var nextItems = items().map(function(item, itemIndex){ return itemIndex === index ? Object.assign({}, item, { done: !item.done }) : item; }); var next = Object.assign({}, state, { stores: Object.assign({}, state.stores, { data: { items: nextItems }, progress: { completed: nextItems.filter(function(item){ return item.done; }).length } }) }); void save(next); });\\n    })();\\n  </script>\\n</body>\\n</html>\\n`;',
    '}',
    '',
    'const config = templateConfig(template);',
    'const runtimeManifest = {',
    '  schemaVersion: 1,',
    '  title,',
    '  entry: "entry.html",',
    '  template: config.id,',
    '  state: { schemaVersion: 1, stores: ["ui", "data", "progress", "draft"] },',
    '  bridge: { needs: ["state"] },',
    '};',
    'await writeNoReplace(path.join(target, "runtime.json"), `${JSON.stringify(runtimeManifest, null, 2)}\\n`);',
    'await writeNoReplace(path.join(target, "state.json"), `${JSON.stringify(initialState(config), null, 2)}\\n`);',
    'await writeNoReplace(path.join(target, "entry.html"), entryHtml(title, config));',
    'console.log(JSON.stringify({ ok: true, target: relative || ".", template: config.id }, null, 2));',
  ].join('\n') + '\n';

export const DEFAULT_REO_GENERATIVE_RUNTIME_VALIDATE_SCRIPT_MJS =
  [
    '#!/usr/bin/env node',
    "import { lstat, readFile, readdir, realpath } from 'node:fs/promises';",
    "import path from 'node:path';",
    '',
    'const toolName = "validate-runtime";',
    'const targetArg = process.argv[2] ?? ".";',
    'const root = process.cwd();',
    'const rootReal = await realpath(root);',
    'const target = path.resolve(root, targetArg);',
    'const relative = path.relative(root, target);',
    'const issues = [];',
    'let targetUsable = true;',
    '',
    'function add(code, file, message) { issues.push({ code, file, message }); }',
    'function lexicalInsideRoot() { return !relative.startsWith("..") && !path.isAbsolute(relative); }',
    'function realInsideRoot(realPath) {',
    '  const realRelative = path.relative(rootReal, realPath);',
    '  return !realRelative.startsWith("..") && !path.isAbsolute(realRelative);',
    '}',
    'function validateInlineScripts(html) {',
    '  const pattern = /<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi;',
    '  let match;',
    '  while ((match = pattern.exec(html)) !== null) {',
    '    const attrs = match[1] || "";',
    '    const source = match[2] || "";',
    '    const typeMatch = attrs.match(/\\btype\\s*=\\s*["\\\']?([^"\\\'\\s>]+)/i);',
    '    const type = typeMatch ? typeMatch[1].split(";")[0].trim().toLowerCase() : "";',
    '    if (/\\bsrc\\s*=/i.test(attrs) || source.trim().length === 0) continue;',
    '    if (type && type !== "text/javascript" && type !== "application/javascript") continue;',
    '    try {',
    '      new Function(source);',
    '    } catch (error) {',
    '      add("entry-script-syntax", "entry.html", `Inline script must parse: ${error && error.message ? error.message : String(error)}.`);',
    '      return;',
    '    }',
    '  }',
    '}',
    '',
    'async function readRequired(fileName) {',
    '  const filePath = path.join(target, fileName);',
    '  try {',
    '    const stats = await lstat(filePath);',
    '    if (!stats.isFile() || stats.isSymbolicLink()) { add("not-file", fileName, "Expected an ordinary file."); return null; }',
    '    return await readFile(filePath, "utf8");',
    '  } catch (error) {',
    '    add("missing", fileName, "Required runtime file is missing.");',
    '    return null;',
    '  }',
    '}',
    '',
    'if (!lexicalInsideRoot() || relative.split(path.sep).includes(".reo")) {',
    '  add("target-outside-root", targetArg, "Target must be inside the memory space and outside .reo.");',
    '  targetUsable = false;',
    '} else {',
    '  try {',
    '    const stats = await lstat(target);',
    '    if (!stats.isDirectory() || stats.isSymbolicLink()) {',
    '      add("target-not-directory", targetArg, "Target must be an ordinary directory.");',
    '      targetUsable = false;',
    '    } else if (!realInsideRoot(await realpath(target))) {',
    '      add("target-outside-root", targetArg, "Target must stay inside the memory space.");',
    '      targetUsable = false;',
    '    }',
    '  } catch {',
    '    add("target-missing", targetArg, "Target directory is missing.");',
    '    targetUsable = false;',
    '  }',
    '}',
    '',
    'const entry = targetUsable ? await readRequired("entry.html") : null;',
    'const runtime = targetUsable ? await readRequired("runtime.json") : null;',
    'const state = targetUsable ? await readRequired("state.json") : null;',
    '',
    'if (entry && !/<!doctype html>/i.test(entry)) add("entry-not-html-document", "entry.html", "entry.html should be a complete HTML document.");',
    'if (entry && /file:\\/\\//i.test(entry)) add("file-url", "entry.html", "Copy local resources into assets/ instead of using file://.");',
    'if (entry && /window\\.reo\\b/.test(entry) && !/reo-render:\\/\\/vendor\\/reo-render\\/bridge\\.js/.test(entry)) add("bridge-script-missing", "entry.html", "Load reo-render://vendor/reo-render/bridge.js before using window.reo.");',
    'if (entry) validateInlineScripts(entry);',
    'for (const [fileName, text] of [["runtime.json", runtime], ["state.json", state]]) {',
    '  if (!text) continue;',
    '  try { JSON.parse(text); } catch { add("invalid-json", fileName, "File must parse as JSON."); }',
    '}',
    '',
    'if (targetUsable) {',
    '  try {',
    '    const assetsDir = path.join(target, "assets");',
    '    const stats = await lstat(assetsDir);',
    '    if (!stats.isDirectory() || stats.isSymbolicLink()) add("assets-not-directory", "assets", "assets/ must be an ordinary directory.");',
    '    else {',
    '      for (const entry of await readdir(assetsDir, { withFileTypes: true })) {',
    '        if (!entry.isFile()) add("asset-not-file", `assets/${entry.name}`, "Assets must be ordinary direct files.");',
    '      }',
    '    }',
    '  } catch {',
    '    add("missing-assets", "assets", "Create assets/ even when it is empty.");',
    '  }',
    '}',
    '',
    'const report = { ok: issues.length === 0, tool: toolName, target: relative || ".", issues };',
    'console.log(JSON.stringify(report, null, 2));',
    'process.exit(issues.length === 0 ? 0 : 1);',
  ].join('\n') + '\n';

export const DEFAULT_REO_GENERATIVE_RUNTIME_INSPECT_SCRIPT_MJS =
  [
    '#!/usr/bin/env node',
    "import { lstat, readFile, readdir, realpath } from 'node:fs/promises';",
    "import path from 'node:path';",
    '',
    'const targetArg = process.argv[2] ?? ".";',
    'const root = process.cwd();',
    'const rootReal = await realpath(root);',
    'const target = path.resolve(root, targetArg);',
    'const relative = path.relative(root, target);',
    '',
    'function insideRoot(realPath) {',
    '  const realRelative = path.relative(rootReal, realPath);',
    '  return !realRelative.startsWith("..") && !path.isAbsolute(realRelative);',
    '}',
    '',
    'async function readText(fileName) {',
    '  try {',
    '    const filePath = path.join(target, fileName);',
    '    const stats = await lstat(filePath);',
    '    return stats.isFile() && !stats.isSymbolicLink() ? await readFile(filePath, "utf8") : null;',
    '  } catch {',
    '    return null;',
    '  }',
    '}',
    '',
    'let ok = true;',
    'try {',
    '  const stats = await lstat(target);',
    '  ok = !relative.startsWith("..") && !path.isAbsolute(relative) && !relative.split(path.sep).includes(".reo") && stats.isDirectory() && !stats.isSymbolicLink() && insideRoot(await realpath(target));',
    '} catch {',
    '  ok = false;',
    '}',
    '',
    'const entry = ok ? await readText("entry.html") : null;',
    'const runtimeText = ok ? await readText("runtime.json") : null;',
    'const stateText = ok ? await readText("state.json") : null;',
    'let runtime = null;',
    'let state = null;',
    'try { runtime = runtimeText ? JSON.parse(runtimeText) : null; } catch {}',
    'try { state = stateText ? JSON.parse(stateText) : null; } catch {}',
    'let assets = [];',
    'try { assets = (await readdir(path.join(target, "assets"), { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name).sort(); } catch {}',
    'const report = {',
    '  ok: ok && !!entry && !!runtime && !!state,',
    '  tool: "inspect-runtime",',
    '  target: relative || ".",',
    '  title: runtime && typeof runtime.title === "string" ? runtime.title : null,',
    '  template: runtime && typeof runtime.template === "string" ? runtime.template : null,',
    '  usesBridge: !!entry && /reo-render:\\/\\/vendor\\/reo-render\\/bridge\\.js/.test(entry),',
    '  files: { entry: !!entry, runtime: !!runtime, state: !!state, assets },',
    '};',
    'console.log(JSON.stringify(report, null, 2));',
    'process.exit(report.ok ? 0 : 1);',
  ].join('\n') + '\n';

export const DEFAULT_REO_WORKS_SKILL_MD =
  [
    '---',
    'name: reo-works',
    'description: 用于在 Reo 记忆空间中创建或更新 agent-created 作品片段和作品补充；作品以 artifact 合同保存，首个格式是 html。',
    '---',
    '',
    '# Reo Works',
    '',
    '用于创建或更新 Reo 作品。作品是 agent 基于当前 Memory、Segment、Supplement 或用户提供材料生成的轻量视觉/交互产物，例如复习表、复盘看板、解释器、对照卡片、图表、diagram、原型或创意页面。',
    '',
    '## 渐进读取',
    '',
    '先读本文件判断目标，再只读取需要的 reference：',
    '',
    '- `references/file-contract.md`：新建或更新作品片段、作品补充的落文件合同。',
    '- `references/workflows.md`：从 Reo prompt、Memory 数据和既有作品推进创建/更新的步骤。',
    '- `references/runtime-contract-check.md`：提交前的文件合同、runtime bundle 和 Reo 投影检查。',
    '- 运行时 bundle、状态、模板和脚本先读 `skills/reo-generative-runtime/SKILL.md`。',
    '- 用户未指定风格时默认按 `reo-works-design` 的 Reo 视觉变量和参考模块；用户明确指定风格时仍继续读 `skills/reo-works-design/SKILL.md` 对齐布局、交互和 runtime 边界。',
    '',
    '## 使用场景',
    '',
    '- 用户要求新建作品、生成界面、生成 dashboard、复习表、图表、diagram、mockup、互动解释器或创意页面。',
    '- 用户从 Reo 的作品入口复制 prompt，要求你在当前记忆空间内落文件。',
    '- 用户要求更新已有作品，让作品反映新的片段、笔记、录音转录或记忆数据。',
    '',
    '如果目标不清楚，先用 2-4 个问题确认目标、受众、数据来源、更新频率和交互复杂度。目标足够明确时，先给 3 个方向供用户选择；用户已经指定方向时直接执行。',
    '',
    '## 创建作品片段',
    '',
    '1. 从 prompt 中读取目标 Memory 目录和建议标题；必要时读取该 Memory 下的 `memory.md`、相关 `segment.md`、`supplement.md` 和普通数据文件。',
    '2. 生成 Reo Segment id：`seg_YYYYMMDDHHMMSS_8hex`，例如 `seg_20260604024800_a1b2c3d4`；目录名前缀和 `segment.md` frontmatter 必须使用同一个 id。',
    '3. 在 `memories/<memory-directory>/segments/` 下创建一个清楚命名的 Segment 目录，例如 `seg_20260604024800_a1b2c3d4--间隔复习表`。',
    '4. 写入 `segment.md`，frontmatter 必须包含稳定 `id`、`title`、`kind: artifact`、`format: html`。',
    '5. 按 `skills/reo-generative-runtime/SKILL.md` 写入同目录 runtime bundle：`entry.html`、`runtime.json`、`state.json`、`assets/`。',
    '6. 可先运行 `node skills/reo-generative-runtime/scripts/scaffold-runtime.mjs <segment-directory> --title "标题" --template <family>`，再把 scaffold 改成用户需要的作品。',
    '',
    '最小形态：',
    '',
    '```markdown',
    '---',
    'id: seg_20260604024800_a1b2c3d4',
    'title: 间隔复习表',
    'kind: artifact',
    'format: html',
    '---',
    '# 间隔复习表',
    '',
    'Agent-created runtime work. Entry: `entry.html`.',
    '```',
    '',
    '## 创建作品补充',
    '',
    '1. 从 prompt 中读取目标 Segment 目录。',
    '2. 生成 Reo Supplement id：`sup_YYYYMMDDHHMMSS_8hex`，例如 `sup_20260604024900_d4c3b2a1`；目录名前缀和 `supplement.md` frontmatter 必须使用同一个 id。',
    '3. 在目标 Segment 的 `supplements/` 下创建一个清楚命名的 Supplement 目录，例如 `sup_20260604024900_d4c3b2a1--复习补充`。',
    '4. 写入 `supplement.md`，frontmatter 必须包含稳定 `id`、`title`、`kind: artifact`、`format: html`。',
    '5. 按 `skills/reo-generative-runtime/SKILL.md` 写入同目录 runtime bundle：`entry.html`、`runtime.json`、`state.json`、`assets/`。',
    '',
    '最小形态：',
    '',
    '```markdown',
    '---',
    'id: sup_20260604024900_d4c3b2a1',
    'title: 复习补充',
    'kind: artifact',
    'format: html',
    '---',
    '# 复习补充',
    '',
    'Agent-created runtime work supplement. Entry: `entry.html`.',
    '```',
    '',
    '## 更新作品',
    '',
    '- 先读取目标 `segment.md` 或 `supplement.md`，确认它是 `kind: artifact`、`format: html`。',
    '- 读取同目录 `entry.html`、`runtime.json`、`state.json` 和 prompt 指定的数据来源。',
    '- 保留稳定 id 和对象目录；除非用户要求重命名，否则不要改 title 或目录 basename。',
    '- 更新 HTML、state 或 assets 时保持轻量，删除不再需要的 `assets/` 旧文件；不要编辑 `.reo/index.json`、manifest、lock 或 hash 字段。',
    '',
    '## 文件合同',
    '',
    '- 用户可见类型名是作品；文件合同字段是 `kind: artifact` 和 `format: html`。',
    '- 新建 Segment id 使用 `seg_YYYYMMDDHHMMSS_8hex`；新建 Supplement id 使用 `sup_YYYYMMDDHHMMSS_8hex`。已有 Reo 对象可能使用更早的合法 id；新作品不要发明 `seg_agent_*` / `sup_agent_*` 这类占位 id。',
    '- 运行入口统一是 `entry.html`；Segment 和 Supplement 不再使用不同入口名。',
    '- `runtime.json` 描述作品意图、模板、state stores 和未来 bridge needs；它不是权限审批文件。',
    '- `state.json` 是用户和 agent 可查看、可修改的状态文件；打卡、待办、进度、偏好和需要下次打开仍记得的用户操作结果必须写入 `state.json`，localStorage/IndexedDB 只能作为快速 UI cache 或兼容缓存，不能作为唯一长期状态。',
    '- Reo 会计算入口 bytes/hash 并收敛 manifest；agent 不写 `.reo/objects`。',
    '- 本地资源放在 `assets/`；不要创建 symlink，不要引用 absolute path 或 `file://`。',
    '- 不要创建空白占位作品；只有当 HTML 入口已经表达用户可见价值时才落文件。',
    '',
    '## 设计与交互',
    '',
    '- 用户未指定风格时默认按 `reo-works-design` 的 Reo 视觉变量和参考模块。',
    '- 视觉、图表、diagram、dashboard、mockup 和交互控件先读 `skills/reo-works-design/SKILL.md` 及其 `references/`。',
    '- 作品内可以有 DOM 交互、过滤、排序、计算、切换、表单、下载和普通 Web 网络。',
    '- 作品需要 Reo state、content、mutation、fullscreen 或 agent prompt action 时，使用 `window.reo` documented bridge；不要发明其他宿主 API。',
    '- 如果使用第三方库，优先选择浏览器/CDN 可直接运行的方式；第三方 API 是否可用取决于浏览器 CORS。',
    '',
    '## 验证',
    '',
    '- 确认 `segment.md`/`supplement.md` frontmatter 可读，且同目录 runtime bundle 存在。',
    '- 运行 `node skills/reo-generative-runtime/scripts/validate-runtime.mjs <target-directory>`。',
    '- 确认入口 HTML 不包含凭证明文、绝对路径或本机私有路径。',
    '- 确认所有屏幕上的数字都经过 `Math.round()`、`.toFixed()` 或 `Intl.NumberFormat`。',
    '- 直接验证文件效果后停止；Reo 会在打开、刷新或保存时投影作品。',
  ].join('\n') + '\n';
export const DEFAULT_REO_WORKS_DESIGN_SKILL_MD =
  [
    '---',
    'name: reo-works-design',
    'description: 用于 Reo 作品的视觉、交互、图表、diagram、mockup、dashboard 和轻量 app 设计；内置 Reo 视觉变量、模块、复杂度预算和沙箱边界。',
    '---',
    '',
    '# Reo Works Design',
    '',
    '用于把 Reo 作品做成轻量、清楚、能长期留在记忆空间里的视觉/交互产物。输出目标是 runtime bundle 的 `entry.html`、`runtime.json`、`state.json` 和 `assets/`，不是普通说明文。',
    '',
    '## 渐进读取',
    '',
    '先读本文件选模块，再按作品类型读取 reference。不要一次性打开所有文件，除非作品确实跨多个模块。',
    '',
    '- `references/core-design-system.md`：Reo 作品视觉变量、排版、颜色、深色模式和 runtime 边界。',
    '- `references/modules.md`：diagram、mockup、interactive、chart、art 和 dashboard 的选择规则。',
    '- `references/interaction-patterns.md`：局部控件、计算、筛选、排序、stepper 和轻量 app 交互。',
    '- `references/svg-and-diagrams.md`：SVG viewBox、文字、箭头、flowchart、structural 和 illustrative diagram。',
    '- `references/charts.md`：原生 SVG/CSS 图表、dashboard metric、数字格式和本地 vendor 边界。',
    '- `references/mockups-and-art.md`：UI mockup、data record、creative/art 表达和不要做的装饰。',
    '',
    '## 模块选择',
    '',
    '- `diagram`：流程图、结构图、解释性 SVG、系统关系。',
    '- `mockup`：界面原型、表单、卡片、设置页、dashboard。',
    '- `interactive`：带 sliders、buttons、filters、live calculations 的互动解释器。',
    '- `chart`：小型数据可视化、趋势、分布、对比。',
    '- `art`：插画、生成艺术、创意表达。',
    '',
    '选择最接近的模块，不要把所有能力塞进一个作品。一个作品只能有一个主目标；需要更多深度时拆成作品补充。',
    '',
    '复杂度预算：',
    '- Diagram box subtitle 不超过 5 个词；细节放到作品下方或后续补充，不塞进框内。',
    '- Diagram 最多 2 个主要色阶；如果颜色表达状态或类别，加 1 行 legend。',
    '- 横向 tier 最多 4 个大节点；5 个以上要缩小、换行或拆成 overview/detail。',
    '- 交互控件最多 3 个核心输入；超过 3 个要分组或拆作品。',
    '',
    '## 输出顺序',
    '',
    '- HTML 文件使用完整轻量文档：`<!doctype html>`、`<meta charset="utf-8">`、`<meta name="viewport" ...>`、短 `<style>`、内容 DOM、最后放 `<script>`。',
    '- CSS 尽量短；组件内部可以用 inline style 保证首屏稳定。',
    '- JS 放在最后，先让静态内容可读，再增强交互。',
    '- 不写代码注释、隐藏模板区、空 tab、空 carousel 或默认 `display: none` 的大量内容。',
    '',
    '## 核心设计规则',
    '',
    '- 作品应像 Reo 内容区里的自然表达：扁平、紧凑、清楚，不做营销页。',
    '- 外层背景保持透明或 `var(--color-background-primary)`；不要用深色/彩色外层背景吞掉宿主界面。',
    '- 不使用渐变、发光、模糊、装饰阴影、噪点、霓虹或大面积单色主题。',
    '- 字体小于 11px 禁止；正文默认 16px、line-height 1.7；常规权重 400，强调权重 500。',
    '- 标题建议 h1 22px、h2 18px、h3 16px，全部 500 weight。',
    '- 文案使用句子式大小写；不要全大写，不要用 emoji 表达状态或图标。',
    '- 显示在彩色底上的文字必须使用同色阶的深色 stop，不使用黑色或通用灰色。',
    '- 圆角：普通元素 `var(--border-radius-md)`，卡片 `var(--border-radius-lg)`；单边 border 不加圆角。',
    '- 表格列多时使用 `table-layout: fixed` 或横向包裹；grid 使用 `minmax(0, 1fr)` 防止撑破。',
    '- 所有显示数字必须格式化，避免浮点噪声出现在界面。',
    '',
    '## Reo tokens',
    '',
    '每个作品 HTML 的 `<style>` 开头应包含必要 token。可以裁剪未使用变量，但不要改变量名。',
    '',
    ...DEFAULT_REO_WORKS_DESIGN_TOKEN_CSS_MARKDOWN_LINES,
    '',
    '常用组件 token：',
    '- Border：`0.5px solid var(--color-border-tertiary)`，强调可用 `var(--color-border-secondary)`。',
    '- Card：`background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-lg); padding: 1rem 1.25rem;`。',
    '- Metric card：`background: var(--color-background-secondary); border-radius: var(--border-radius-md); padding: 1rem;`，label 13px，value 24px/500。',
    '- Focus ring：只用 `box-shadow: 0 0 0 2px var(--color-border-primary)`。',
    '',
    '## 色阶',
    '',
    '使用 9 个固定色阶。颜色表达类别或物理含义，不按顺序彩虹循环。通用分类优先 `c-purple`、`c-teal`、`c-coral`、`c-pink`；结构中性用 `c-gray`；信息/成功/警告/危险才使用 blue/green/amber/red。',
    '',
    '| Class | 50 | 100 | 200 | 400 | 600 | 800 | 900 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| `c-purple` | #EEEDFE | #CECBF6 | #AFA9EC | #7F77DD | #534AB7 | #3C3489 | #26215C |',
    '| `c-teal` | #E1F5EE | #9FE1CB | #5DCAA5 | #1D9E75 | #0F6E56 | #085041 | #04342C |',
    '| `c-coral` | #FAECE7 | #F5C4B3 | #F0997B | #D85A30 | #993C1D | #712B13 | #4A1B0C |',
    '| `c-pink` | #FBEAF0 | #F4C0D1 | #ED93B1 | #D4537E | #993556 | #72243E | #4B1528 |',
    '| `c-gray` | #F1EFE8 | #D3D1C7 | #B4B2A9 | #888780 | #5F5E5A | #444441 | #2C2C2A |',
    '| `c-blue` | #E6F1FB | #B5D4F4 | #85B7EB | #378ADD | #185FA5 | #0C447C | #042C53 |',
    '| `c-green` | #EAF3DE | #C0DD97 | #97C459 | #639922 | #3B6D11 | #27500A | #173404 |',
    '| `c-amber` | #FAEEDA | #FAC775 | #EF9F27 | #BA7517 | #854F0B | #633806 | #412402 |',
    '| `c-red` | #FCEBEB | #F7C1C1 | #F09595 | #E24B4A | #A32D2D | #791F1F | #501313 |',
    '',
    'Light mode quick pick：50 fill、600 stroke、800 title、600 subtitle。Dark mode quick pick：800 fill、200 stroke、100 title、200 subtitle。',
    '',
    'SVG text classes：',
    '- `.t`：primary text。',
    '- `.ts`：secondary text。',
    '- `.th`：heading text。',
    '- 彩色 group 使用 `.c-purple` 等类名，并在同 group 内分别给 shape 和 text 指定对应 stop。',
    '',
    '## 组件模板',
    '',
    'Interactive explainer：顶部放 1-3 个控制，下面放核心结果和可视化。Sliders 设置合适 `step`，输出值必须格式化。',
    '',
    'Comparison：使用 `display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px;`。每个选项一个 card，推荐项只用边框或小 badge 强调。',
    '',
    'Dashboard：先放 2-4 个 metric cards，再放 chart/列表；不要把整页再包一层大卡片。',
    '',
    'Data record：单个有边界的对象可以用一张 raised card；不要卡片套卡片。',
    '',
    'Diagram：SVG 默认 `rx="4"`；只有真正 pill 标签才用更大圆角。连接线少而清楚，节点文字短。',
    '',
    '## 沙箱边界',
    '',
    '- 普通 Web 网络、CDN、远程图片、远程字体、`fetch`、XHR、WebSocket、表单和下载可以使用；第三方 API 仍受浏览器 CORS 限制。',
    '- 可以使用 inline CSS、inline JS、data/blob 图片、网络资源，或 `assets/` 下的本地资源。',
    '- 不使用 Node、Electron、raw filesystem path、`file://`、symlink 或 `.reo/` 内部文件。',
    '- 不存储凭证、绝对路径、本机用户名、token 或用户没有要求展示的隐私内容。',
    '',
    '## 轻量性能规则',
    '',
    '- 首屏 HTML 目标小于 200KB；复杂作品优先拆为作品补充。',
    '- 避免每帧重排、无限动画、大量 DOM 节点、大图片和大 base64。',
    '- 事件监听器只绑需要交互的控件；没有必要不要使用 animation loop。',
    '- 如果使用 canvas，固定 wrapper 高度并按设备像素比控制绘制，不要让 canvas 自动撑破布局。',
    '- 数据更新优先使用 `window.reo.state` 写入 `state.json`，或由 agent 后续重写 `state.json` / `entry.html`；快速 UI cache 可用 browser storage。',
  ].join('\n') + '\n';

export const DEFAULT_REO_WORKS_FILE_CONTRACT_REFERENCE_MD =
  [
    '# Reo works file contract',
    '',
    'Use this reference when creating or updating Reo work segments and work supplements.',
    '',
    '## Object names',
    '',
    '- User-facing type name: 作品.',
    '- File contract fields: `kind: artifact` and `format: html`.',
    '- Segment and Supplement runtime entry file: `entry.html` in the same object directory as `segment.md` or `supplement.md`.',
    '- Runtime metadata and state files: `runtime.json` and `state.json`.',
    '- Local resources directory: `assets/`.',
    '- Reo owns `.reo/objects`, `.reo/index.json`, lock files, hashes and preview versions. Agents do not write those files.',
    '',
    '## New work Segment',
    '',
    'Create one directory under `memories/<memory>/segments/`. Generate a Segment id with the Reo pattern `seg_YYYYMMDDHHMMSS_8hex`, then use the same id as the directory prefix and frontmatter id. Example: `seg_20260604024800_a1b2c3d4--复习地图`.',
    '',
    '```markdown',
    '---',
    'id: seg_20260604024800_a1b2c3d4',
    'title: 复习地图',
    'kind: artifact',
    'format: html',
    '---',
    '# 复习地图',
    '',
    'Agent-created runtime work. Entry: `entry.html`.',
    '```',
    '',
    '## New work Supplement',
    '',
    'Create one directory under `memories/<memory>/segments/<segment>/supplements/`. Generate a Supplement id with the Reo pattern `sup_YYYYMMDDHHMMSS_8hex`, then use the same id as the directory prefix and frontmatter id. Example: `sup_20260604024900_d4c3b2a1--风险面板`.',
    '',
    '```markdown',
    '---',
    'id: sup_20260604024900_d4c3b2a1',
    'title: 风险面板',
    'kind: artifact',
    'format: html',
    '---',
    '# 风险面板',
    '',
    'Agent-created runtime work supplement. Entry: `entry.html`.',
    '```',
    '',
    '## HTML entry requirements',
    '',
    '- Write a complete HTML document: `<!doctype html>`, `<html>`, `<head>`, `<meta charset="utf-8">`, viewport meta, `<style>`, content, optional `<script>` at the end.',
    '- Do not create a blank placeholder. The first saved version must render useful visible content.',
    '- Keep the entry under 1 MiB. Aim under 200 KiB for the first version.',
    '- Prefer inline CSS and JS for small works. If local assets are needed, place ordinary files under `assets/`.',
    '- Do not create symlinks, absolute paths, `file://`, local usernames, tokens or hidden dependency on editor temp files.',
    '',
    '## Update requirements',
    '',
    '- Preserve the existing stable id and object directory.',
    '- New Segment ids should use `seg_YYYYMMDDHHMMSS_8hex`; new Supplement ids should use `sup_YYYYMMDDHHMMSS_8hex`; do not invent placeholder ids.',
    '- Preserve title and basename unless the user asks to rename the work.',
    '- Read current `entry.html`, `runtime.json` and `state.json` before editing so you keep useful interaction and remove stale data deliberately.',
    '- Delete no-longer-used `assets/` files only when you can prove they belong to this work.',
    '- Do not force refresh by editing `.reo/index.json` or manifests. Reo refreshes from file truth.',
  ].join('\n') + '\n';

export const DEFAULT_REO_WORKS_WORKFLOWS_REFERENCE_MD =
  [
    '# Reo works workflows',
    '',
    'Use this reference after `SKILL.md` when the user copied a Reo prompt or asks for a concrete work.',
    '',
    '## Create from Reo prompt',
    '',
    '1. Read the prompt target: workspace-relative Memory path, Segment path, or Supplement path.',
    '2. Read only the relevant local data first: `memory.md`, nearby `segment.md`, `supplement.md`, transcripts, note bodies and any data file the user named.',
    '3. Decide the product form before writing: diagram, dashboard, interactive explainer, chart, mockup, comparison, data record or creative expression.',
    '4. Read `skills/reo-generative-runtime/SKILL.md`; optionally scaffold the bundle before replacing scaffold content.',
    '5. If the user did not specify a style, default to `reo-works-design` visual variables and modules; for visual or interaction complexity, read the specific design reference.',
    '6. Create the Markdown contract and runtime bundle in one object directory.',
    '7. Run `node skills/reo-generative-runtime/scripts/validate-runtime.mjs <target-directory>`.',
    '',
    '## Update an existing work',
    '',
    '1. Read target `segment.md` or `supplement.md`; confirm `kind: artifact` and `format: html`.',
    '2. Read the current `entry.html`, `runtime.json` and `state.json`.',
    '3. Read the user-named sources and the nearby Memory/Segment context.',
    '4. Update data, labels and interaction states while preserving the useful visual structure.',
    '5. Add a visible freshness signal only when useful, such as updated date, source count or data range.',
    '6. Verify that stale copied numbers, labels and unused assets are removed.',
    '',
    '## Choosing scope',
    '',
    '- One work should have one main job. If it needs a second job, create a work supplement.',
    '- Use a work Segment for a standalone expression of a Memory.',
    '- Use a work Supplement for a lens, alternate view, exercise, chart or prototype attached to an existing Segment.',
    '- Ask at most 2-4 questions only when target, audience, data source or desired form is genuinely ambiguous.',
    '- If the user already provided a direction, execute instead of offering options.',
    '',
    '## Useful work forms',
    '',
    '- Spaced review table that can be regenerated from note dates or transcript topics.',
    '- Learning map that turns scattered segments into a sequence.',
    '- Risk board or decision matrix from notes and supplements.',
    '- Interactive explainer with sliders or filters for a concept in the Memory.',
    '- Lightweight dashboard with metric cards, chart and short action list.',
    '- UI mockup or prototype derived from product notes.',
    '- Visual poem, diagrammatic illustration or creative collage grounded in the Memory content.',
  ].join('\n') + '\n';

export const DEFAULT_REO_WORKS_RUNTIME_CONTRACT_REFERENCE_MD =
  [
    '# Reo works runtime contract check',
    '',
    'Run this deterministic contract check before ending a works task.',
    '',
    '## File check',
    '',
    '- `segment.md` or `supplement.md` frontmatter parses and includes `id`, `title`, `kind: artifact`, `format: html`.',
    '- `entry.html`, `runtime.json`, `state.json` and `assets/` exist in the same directory.',
    '- Run `node skills/reo-generative-runtime/scripts/validate-runtime.mjs <target-directory>`.',
    '- Local assets, if any, are ordinary files under `assets/` and are referenced with relative paths only.',
    '- No `.reo/objects`, `.reo/index.json`, lock, draft or review file was edited for normal creation/update.',
    '',
    '## Runtime check',
    '',
    '- HTML renders useful static content before any script runs.',
    '- Scripts are optional and bounded to the current document.',
    '- Ordinary Web network, CDN libraries, remote fonts/images and browser `fetch`/XHR are allowed when useful.',
    '- No Node, Electron, raw filesystem paths, `file://`, symlinks or `.reo/` internals.',
    '- `window.reo` usage loads `reo-render://vendor/reo-render/bridge.js` before work code.',
    '- `state.json` is a JSON object and remains readable after agent edits.',
    '',
    '## Projection check',
    '',
    '- Reopen or refresh Reo and confirm the object appears as an artifact Segment or Supplement.',
    '- If Reo reports a runtime fault, fix the missing/invalid bundle file instead of editing `.reo`.',
    '- Do not create or edit `.reo/objects`, `.reo/index.json`, locks, drafts or review files for normal creation/update.',
  ].join('\n') + '\n';

export const DEFAULT_REO_WORKS_DESIGN_CORE_REFERENCE_MD =
  [
    '# Reo works core design system',
    '',
    'Use this reference for every visual Reo work.',
    '',
    '## Philosophy',
    '',
    '- Seamless: the work should feel like a natural part of Reo content, not an embedded website.',
    '- Flat: solid surfaces, no gradients, mesh, noise, blur, glow or decorative shadow.',
    '- Compact: show the essential visual object inline; do not build a marketing page.',
    '- Content first: labels, controls and visuals should serve the Memory data or user intent.',
    '',
    '## HTML structure',
    '',
    '- Reo requires complete HTML documents, not fragments.',
    '- Put CSS before content and scripts last so static content is useful immediately.',
    '- Keep CSS short and explicit; use inline style only when it improves first-paint stability.',
    '- Avoid comments, dead template blocks, hidden tab panels, empty carousel slides and unused CSS.',
    '',
    '## Typography',
    '',
    '- Font stack: `var(--font-sans)` with system fallbacks.',
    '- Body: 16px, weight 400, line-height 1.7.',
    '- h1: 22px, h2: 18px, h3: 16px, all weight 500.',
    '- Two weights only: 400 and 500.',
    '- Never use font-size below 11px.',
    '- Use sentence case; avoid all caps and title-case labels.',
    '',
    '## Required token block',
    '',
    'Start each work with these variables and crop unused selectors only after the design is stable.',
    '',
    ...DEFAULT_REO_WORKS_DESIGN_TOKEN_CSS_MARKDOWN_LINES,
    '',
    '## Color ramps',
    '',
    'Use color to encode meaning, not sequence. Prefer purple, teal, coral and pink for categories; reserve blue, green, amber and red for info, success, warning and danger semantics.',
    '',
    '| Class | 50 | 100 | 200 | 400 | 600 | 800 | 900 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| `c-purple` | #EEEDFE | #CECBF6 | #AFA9EC | #7F77DD | #534AB7 | #3C3489 | #26215C |',
    '| `c-teal` | #E1F5EE | #9FE1CB | #5DCAA5 | #1D9E75 | #0F6E56 | #085041 | #04342C |',
    '| `c-coral` | #FAECE7 | #F5C4B3 | #F0997B | #D85A30 | #993C1D | #712B13 | #4A1B0C |',
    '| `c-pink` | #FBEAF0 | #F4C0D1 | #ED93B1 | #D4537E | #993556 | #72243E | #4B1528 |',
    '| `c-gray` | #F1EFE8 | #D3D1C7 | #B4B2A9 | #888780 | #5F5E5A | #444441 | #2C2C2A |',
    '| `c-blue` | #E6F1FB | #B5D4F4 | #85B7EB | #378ADD | #185FA5 | #0C447C | #042C53 |',
    '| `c-green` | #EAF3DE | #C0DD97 | #97C459 | #639922 | #3B6D11 | #27500A | #173404 |',
    '| `c-amber` | #FAEEDA | #FAC775 | #EF9F27 | #BA7517 | #854F0B | #633806 | #412402 |',
    '| `c-red` | #FCEBEB | #F7C1C1 | #F09595 | #E24B4A | #A32D2D | #791F1F | #501313 |',
    '',
    'Text on colored fills must use the dark stop from the same ramp, not black or generic gray. If a colored box has title and subtitle, use different stops so hierarchy is visible.',
    '',
    '## Sandbox boundaries',
    '',
    '- 普通 Web 网络、CDN libraries、remote fonts/images、`fetch`、XHR and module imports are allowed when useful.',
    '- Use documented `window.reo` bridge calls when the work needs Reo state, content, UI, mutations or agent prompt actions.',
    '- Browser storage is allowed per runtime object origin. Keep agent-readable state in `state.json` when future updates need it.',
    '- Never depend on Node, Electron, raw filesystem paths, `file://`, symlinks or `.reo/` internals.',
  ].join('\n') + '\n';

export const DEFAULT_REO_WORKS_DESIGN_MODULES_REFERENCE_MD =
  [
    '# Reo works design modules',
    '',
    'Pick the closest module. A work can combine modules, but one module should own the main structure.',
    '',
    '## Module chooser',
    '',
    '- `diagram`: flowcharts, structure maps, causal maps, mental models and explanatory SVG.',
    '- `mockup`: product UI, forms, settings, dashboards, cards, mobile screens and faux dialogs.',
    '- `interactive`: sliders, buttons, filters, sort, live calculations, stepper explanations and small local apps.',
    '- `chart`: trends, distributions, comparisons, progress, timelines and metric dashboards.',
    '- `art`: creative expression, illustration, generative pattern, visual poem or mood grounded in the Memory.',
    '- `comparison`: option cards, tradeoff boards, decision matrices and recommendation panels.',
    '- `data record`: a single bounded object such as receipt, profile, summary sheet or case file.',
    '',
    '## Complexity budget',
    '',
    '- One work has one main goal. Split extra goals into work supplements.',
    '- Interactive controls: at most 3 core inputs unless grouped into a clear stepper.',
    '- Diagram box subtitles: at most 5 words.',
    '- Diagram colors: at most 2 primary ramps plus gray; if colors encode meaning, add a one-line legend.',
    '- Horizontal diagram tier: at most 4 boxes at full width. Five or more boxes should wrap, shrink or become multiple diagrams.',
    '- Dashboard metrics: 2-4 metric cards before chart/list content.',
    '',
    '## Layout defaults',
    '',
    '- Editorial explanation: no card wrapper; let content flow naturally.',
    '- Bounded object: one raised card wraps the object.',
    '- Dashboard: metric cards first, chart/list below, no full-page outer card.',
    '- Comparison: responsive card grid using `repeat(auto-fit, minmax(160px, 1fr))`.',
    '- Stepper: one visible panel, position dots or compact pills, next/previous buttons in normal flow.',
    '- Mock dialog: normal-flow faux viewport, never `position: fixed`.',
    '',
    '## When nothing fits',
    '',
    '- If it explains a concept, default to an interactive explainer or diagram.',
    '- If it summarizes evidence, default to dashboard, comparison or data record.',
    '- If it expresses a mood or creative synthesis, default to art, but keep it grounded in Memory content.',
  ].join('\n') + '\n';

export const DEFAULT_REO_WORKS_DESIGN_INTERACTIONS_REFERENCE_MD =
  [
    '# Reo works interaction patterns',
    '',
    'Use this reference for lightweight app behavior inside a Reo work.',
    '',
    '## Allowed local interactions',
    '',
    '- Buttons that toggle local views or advance a stepper.',
    '- Sliders and number inputs with formatted live results.',
    '- Selects, checkboxes and segmented controls for filters or modes.',
    '- Sort and filter controls over data already embedded in the HTML.',
    '- Inline calculations, small simulations, scorecards and review schedules.',
    '- SVG element hover/click when it only changes local state.',
    '',
    '## Disallowed interactions',
    '',
    '- No invented chat bridge, prompt sending API or host mutation API outside documented `window.reo`.',
    '- No Node/Electron access, raw filesystem paths, `file://`, symlink dependency or `.reo/` internals.',
    '- No unbounded background polling or animation loops.',
    '',
    '## Interaction structure',
    '',
    '- Static content must still make sense before JS runs.',
    '- Keep controls above the visualization they affect.',
    '- Show current values next to sliders and format them.',
    '- Keep event listeners attached only to actual controls.',
    '- Avoid animation loops. If a transition helps, use CSS transitions under 200ms.',
    '- Never hide most of the content in tabs. If there are many modes, use a stepper or stacked sections.',
    '',
    '## Numeric output',
    '',
    '- Counts: integer with `Intl.NumberFormat`.',
    '- Percentages: one decimal at most unless precision matters.',
    '- Money: sign before currency for negative values, e.g. `-$5M`.',
    '- Slider values: set `step` so the browser emits sensible values.',
    '- Every computed number that reaches the screen must pass through a formatter.',
    '',
    '## Data update model',
    '',
    'Works can read the whole workspace summary through `window.reo.workspace.read().workspace.memories`, then call `window.reo.content.readMemoryDetail({ memoryId })` for the Memory details they need. This keeps dashboards and data tools live without exposing raw paths, `.reo/` internals or a generic filesystem bridge.',
  ].join('\n') + '\n';

export const DEFAULT_REO_WORKS_DESIGN_SVG_DIAGRAMS_REFERENCE_MD =
  [
    '# Reo works SVG and diagrams',
    '',
    'Use this reference for SVG diagrams and inline SVG inside interactive HTML.',
    '',
    '## SVG setup',
    '',
    '- Use `width="100%"` and `viewBox="0 0 680 H"` for diagram SVG.',
    '- Keep x coordinates between 0 and 680; safe content area is roughly x=40..640.',
    '- Compute H from the bottom-most shape/text plus 20-40px buffer.',
    '- Never use negative x or y.',
    '- Do not shrink the viewBox width to fit narrow content; center narrow content in the 680 coordinate system.',
    '- One diagram object should have one complete SVG, not multiple partial SVGs.',
    '',
    '## Text rules',
    '',
    '- SVG text never wraps automatically. Use explicit `tspan` or shorten the label.',
    '- Use 14px for node labels and 12px for subtitles/arrow labels.',
    '- Every text element needs a class or explicit fill. Never rely on inherited black.',
    '- Put text inside boxes or legends; floating labels usually collide.',
    '- Check width from longest label before drawing the box: title chars times about 8px, subtitle chars times about 7px, plus padding.',
    '',
    '## Flowcharts',
    '',
    '- Prefer one direction: top-down or left-right.',
    '- Keep to 4-5 nodes per diagram.',
    '- Arrows must not cross unrelated boxes or labels; use L-shaped paths when direct lines collide.',
    '- Connector paths must include `fill="none"`.',
    '- Keep same-content nodes the same height.',
    '- Cycles should usually be steppers or a short return marker, not crowded rings.',
    '',
    '## Structural diagrams',
    '',
    '- Use large rounded rects as containers and smaller rects as regions.',
    '- Keep 20px padding inside containers and 16px gap between inner regions.',
    '- Max 2-3 nesting levels.',
    '- Use distinct but meaningful ramps for nested regions; same ramp on parent and child flattens hierarchy.',
    '',
    '## Illustrative diagrams',
    '',
    '- Use an illustrative diagram when the user needs intuition, not a reference map.',
    '- Draw the mechanism, not decorative icons about the mechanism.',
    '- Prefer simple shapes and recognizable silhouettes.',
    '- If the real system has a control, consider an interactive HTML version with inline SVG.',
    '- Avoid arbitrary metaphors that do not teach the mechanism.',
  ].join('\n') + '\n';

export const DEFAULT_REO_WORKS_DESIGN_CHARTS_REFERENCE_MD =
  [
    '# Reo works charts',
    '',
    'Use this reference for charts, dashboards and data visualization.',
    '',
    '## Default approach',
    '',
    '- Prefer native SVG, CSS bars, tables with fixed layout or small inline canvas code when that is enough.',
    '- Remote chart libraries and CDN scripts are allowed when they materially reduce complexity.',
    '- Keep small chart data embedded in the HTML or `state.json`; larger local data can live under `assets/`.',
    '',
    '## Chart structure',
    '',
    '- Put 2-4 metric cards above the chart when summary numbers matter.',
    '- Use custom legends in HTML: small square, label and value/percentage.',
    '- Use color to encode categories or status, not rainbow order.',
    '- For categorical values, include the value in labels or legend.',
    '- For time series, keep axis labels readable and avoid unnecessary grid decoration.',
    '',
    '## Canvas rules',
    '',
    '- Put canvas in a wrapper with explicit height and `position: relative`.',
    '- Do not rely on canvas CSS height alone.',
    '- Scale drawing by device pixel ratio.',
    '- Avoid animation loops for static charts.',
    '',
    '## Table and grid overflow',
    '',
    '- Use `table-layout: fixed` or a controlled horizontal wrapper for many columns.',
    '- Use `minmax(0, 1fr)` in grid columns when child content might overflow.',
    '- Do not use nested scroll for normal cards or dashboards.',
    '',
    '## Number formatting',
    '',
    '- Format every displayed number.',
    '- Use `Intl.NumberFormat` for counts and currency.',
    '- Use `.toFixed(1)` or `.toFixed(2)` for controlled decimals.',
    '- Never allow raw JS float artifacts in labels, tooltips or slider readouts.',
  ].join('\n') + '\n';

export const DEFAULT_REO_WORKS_DESIGN_MOCKUPS_AND_ART_REFERENCE_MD =
  [
    '# Reo works mockups and art',
    '',
    'Use this reference for UI mockups, data records and creative works.',
    '',
    '## Mockups',
    '',
    '- Contained mockups such as mobile screens, small components, cards and faux dialogs can sit on a subtle secondary surface.',
    '- Full dashboards, settings pages and data tables should fill the available width without another outer card.',
    '- Faux dialogs must be normal-flow viewports, not `position: fixed` overlays.',
    '- Use real controls and labels, not explanatory text about the controls.',
    '- Keep UI chrome minimal; the work lives inside Reo, so do not draw browser windows or unrelated app frames unless the user asks for a product mockup.',
    '',
    '## Data records',
    '',
    '- Use one raised card for a bounded object.',
    '- Put identity/header at top, attributes below, and avoid card-in-card nesting.',
    '- Use 13px muted labels and 15-16px primary values.',
    '- Add status badges only when they carry real meaning.',
    '',
    '## Creative and art works',
    '',
    '- Art must still express the Memory, Segment or user intent. Do not make generic wallpaper.',
    '- Prefer SVG shapes, pattern repetition, editorial composition or data-driven visual metaphors.',
    '- Avoid gradients, glow, noise and large decorative backgrounds unless the user explicitly asked for an art piece and readability is still safe.',
    '- Do not embed private source text just to make an artwork feel detailed.',
    '- If the art needs interaction, use small local controls that reveal structure or change composition.',
  ].join('\n') + '\n';

export const DEFAULT_REO_WORKS_REFERENCE_FILES = {
  'file-contract.md': DEFAULT_REO_WORKS_FILE_CONTRACT_REFERENCE_MD,
  'workflows.md': DEFAULT_REO_WORKS_WORKFLOWS_REFERENCE_MD,
  'runtime-contract-check.md': DEFAULT_REO_WORKS_RUNTIME_CONTRACT_REFERENCE_MD,
} as const;

export const DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES = {
  'core-design-system.md': DEFAULT_REO_WORKS_DESIGN_CORE_REFERENCE_MD,
  'modules.md': DEFAULT_REO_WORKS_DESIGN_MODULES_REFERENCE_MD,
  'interaction-patterns.md': DEFAULT_REO_WORKS_DESIGN_INTERACTIONS_REFERENCE_MD,
  'svg-and-diagrams.md': DEFAULT_REO_WORKS_DESIGN_SVG_DIAGRAMS_REFERENCE_MD,
  'charts.md': DEFAULT_REO_WORKS_DESIGN_CHARTS_REFERENCE_MD,
  'mockups-and-art.md': DEFAULT_REO_WORKS_DESIGN_MOCKUPS_AND_ART_REFERENCE_MD,
} as const;

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
    "import { lstat, mkdir, open, readFile, rm } from 'node:fs/promises';",
    "import path from 'node:path';",
    '',
    "const START = '<!-- reo-managed:agent-entry:start v1 -->';",
    "const END = '<!-- reo-managed:agent-entry:end -->';",
    `const DEFAULT_AGENTS_MD = ${JSON.stringify(DEFAULT_WORKSPACE_AGENTS_MD)};`,
    `const MANAGED_BLOCK = ${JSON.stringify(DEFAULT_WORKSPACE_AGENTS_MANAGED_BLOCK)};`,
    `const DOCTOR_SKILL_MD = ${JSON.stringify(DEFAULT_REO_DOCTOR_SKILL_MD)};`,
    `const EDIT_SKILL_MD = ${JSON.stringify(DEFAULT_REO_EDIT_SKILL_MD)};`,
    `const COVER_IMAGE_SKILL_MD = ${JSON.stringify(DEFAULT_REO_COVER_IMAGE_SKILL_MD)};`,
    `const COVER_AESTHETIC_SKILL_MD = ${JSON.stringify(DEFAULT_REO_COVER_AESTHETIC_SKILL_MD)};`,
    `const RUNTIME_SKILL_MD = ${JSON.stringify(DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD)};`,
    `const RUNTIME_REFERENCE_FILES = ${JSON.stringify(DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES)};`,
    `const RUNTIME_SCRIPT_FILES = ${JSON.stringify({
      'inspect-runtime.mjs': DEFAULT_REO_GENERATIVE_RUNTIME_INSPECT_SCRIPT_MJS,
      'scaffold-runtime.mjs': DEFAULT_REO_GENERATIVE_RUNTIME_SCAFFOLD_SCRIPT_MJS,
      'validate-runtime.mjs': DEFAULT_REO_GENERATIVE_RUNTIME_VALIDATE_SCRIPT_MJS,
    })};`,
    `const WORKS_SKILL_MD = ${JSON.stringify(DEFAULT_REO_WORKS_SKILL_MD)};`,
    `const WORKS_DESIGN_SKILL_MD = ${JSON.stringify(DEFAULT_REO_WORKS_DESIGN_SKILL_MD)};`,
    `const WORKS_REFERENCE_FILES = ${JSON.stringify(DEFAULT_REO_WORKS_REFERENCE_FILES)};`,
    `const WORKS_DESIGN_REFERENCE_FILES = ${JSON.stringify(DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES)};`,
    `const RECOVERY_HINTS = ${JSON.stringify(WORKSPACE_REVIEW_RECOVERY_HINTS)};`,
    `const FALLBACK_RECOVERY_HINT = ${JSON.stringify(WORKSPACE_REVIEW_FALLBACK_RECOVERY_HINT)};`,
    'const NOFOLLOW = constants.O_NOFOLLOW ?? 0;',
    '',
    'const fix = process.argv.includes("--fix");',
    'const root = process.cwd();',
    'const report = { ok: true, mode: fix ? "fix" : "check", repaired: { agentsMd: false, doctorSkill: false, editSkill: false, coverImageSkill: false, coverAestheticSkill: false, runtimeSkill: false, runtimeReferences: [], runtimeScripts: [], worksSkill: false, worksDesignSkill: false, worksReferences: [], worksDesignReferences: [] }, issues: [] };',
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
    'async function repairManagedTextFiles(directoryPath, files, repairedKey) {',
    '  for (const [filename, expected] of Object.entries(files)) {',
    '    const filePath = path.join(directoryPath, filename);',
    '    const current = await readRegularText(filePath);',
    '    if (current.status !== "unsafe" && (current.status !== "file" || current.text !== expected)) {',
    '      report.repaired[repairedKey].push(filename);',
    '      await writeRegularText(filePath, current, expected);',
    '    }',
    '  }',
    '}',
    '',
    'async function removeManagedRegularFile(directoryPath, filename, repairedKey) {',
    '  const filePath = path.join(directoryPath, filename);',
    '  const current = await readRegularText(filePath);',
    '  if (current.status !== "file") return;',
    '  report.repaired[repairedKey].push(filename);',
    '  if (fix) await rm(filePath, { force: true });',
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
    '  const coverImageDir = path.join(skillsDir, "reo-cover-image");',
    '  const coverAestheticDir = path.join(skillsDir, "reo-cover-aesthetic");',
    '  const runtimeDir = path.join(skillsDir, "reo-generative-runtime");',
    '  const worksDir = path.join(skillsDir, "reo-works");',
    '  const worksDesignDir = path.join(skillsDir, "reo-works-design");',
    '  const runtimeReferencesDir = path.join(runtimeDir, "references");',
    '  const runtimeScriptsDir = path.join(runtimeDir, "scripts");',
    '  const worksReferencesDir = path.join(worksDir, "references");',
    '  const worksDesignReferencesDir = path.join(worksDesignDir, "references");',
    '  let doctorDirOk = false;',
    '  let editDirOk = false;',
    '  let coverImageDirOk = false;',
    '  let coverAestheticDirOk = false;',
    '  let runtimeDirOk = false;',
    '  let worksDirOk = false;',
    '  let worksDesignDirOk = false;',
    '  let runtimeReferencesDirOk = false;',
    '  let runtimeScriptsDirOk = false;',
    '  let worksReferencesDirOk = false;',
    '  let worksDesignReferencesDirOk = false;',
    '  if (await ensureDirectory(skillsDir)) {',
    '    doctorDirOk = await ensureDirectory(doctorDir);',
    '    editDirOk = await ensureDirectory(editDir);',
    '    coverImageDirOk = await ensureDirectory(coverImageDir);',
    '    coverAestheticDirOk = await ensureDirectory(coverAestheticDir);',
    '    runtimeDirOk = await ensureDirectory(runtimeDir);',
    '    worksDirOk = await ensureDirectory(worksDir);',
    '    worksDesignDirOk = await ensureDirectory(worksDesignDir);',
    '    if (runtimeDirOk) runtimeReferencesDirOk = await ensureDirectory(runtimeReferencesDir);',
    '    if (runtimeDirOk) runtimeScriptsDirOk = await ensureDirectory(runtimeScriptsDir);',
    '    if (worksDirOk) worksReferencesDirOk = await ensureDirectory(worksReferencesDir);',
    '    if (worksDesignDirOk) worksDesignReferencesDirOk = await ensureDirectory(worksDesignReferencesDir);',
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
    '  if (coverImageDirOk) {',
    '    const coverImageSkillPath = path.join(coverImageDir, "SKILL.md");',
    '    const currentCoverImageSkill = await readRegularText(coverImageSkillPath);',
    '    if (currentCoverImageSkill.status !== "unsafe" && (currentCoverImageSkill.status !== "file" || currentCoverImageSkill.text !== COVER_IMAGE_SKILL_MD)) {',
    '      report.repaired.coverImageSkill = true;',
    '      await writeRegularText(coverImageSkillPath, currentCoverImageSkill, COVER_IMAGE_SKILL_MD);',
    '    }',
    '  }',
    '',
    '  if (coverAestheticDirOk) {',
    '    const coverAestheticSkillPath = path.join(coverAestheticDir, "SKILL.md");',
    '    const currentCoverAestheticSkill = await readRegularText(coverAestheticSkillPath);',
    '    if (currentCoverAestheticSkill.status !== "unsafe" && (currentCoverAestheticSkill.status !== "file" || currentCoverAestheticSkill.text !== COVER_AESTHETIC_SKILL_MD)) {',
    '      report.repaired.coverAestheticSkill = true;',
    '      await writeRegularText(coverAestheticSkillPath, currentCoverAestheticSkill, COVER_AESTHETIC_SKILL_MD);',
    '    }',
    '  }',
    '',
    '  if (runtimeDirOk) {',
    '    const runtimeSkillPath = path.join(runtimeDir, "SKILL.md");',
    '    const currentRuntimeSkill = await readRegularText(runtimeSkillPath);',
    '    if (currentRuntimeSkill.status !== "unsafe" && (currentRuntimeSkill.status !== "file" || currentRuntimeSkill.text !== RUNTIME_SKILL_MD)) {',
    '      report.repaired.runtimeSkill = true;',
    '      await writeRegularText(runtimeSkillPath, currentRuntimeSkill, RUNTIME_SKILL_MD);',
    '    }',
    '  }',
    '',
    '  if (worksDirOk) {',
    '    const worksSkillPath = path.join(worksDir, "SKILL.md");',
    '    const currentWorksSkill = await readRegularText(worksSkillPath);',
    '    if (currentWorksSkill.status !== "unsafe" && (currentWorksSkill.status !== "file" || currentWorksSkill.text !== WORKS_SKILL_MD)) {',
    '      report.repaired.worksSkill = true;',
    '      await writeRegularText(worksSkillPath, currentWorksSkill, WORKS_SKILL_MD);',
    '    }',
    '  }',
    '',
    '  if (worksDesignDirOk) {',
    '    const worksDesignSkillPath = path.join(worksDesignDir, "SKILL.md");',
    '    const currentWorksDesignSkill = await readRegularText(worksDesignSkillPath);',
    '    if (currentWorksDesignSkill.status !== "unsafe" && (currentWorksDesignSkill.status !== "file" || currentWorksDesignSkill.text !== WORKS_DESIGN_SKILL_MD)) {',
    '      report.repaired.worksDesignSkill = true;',
    '      await writeRegularText(worksDesignSkillPath, currentWorksDesignSkill, WORKS_DESIGN_SKILL_MD);',
    '    }',
    '  }',
    '',
    '  if (runtimeReferencesDirOk) {',
    '    await repairManagedTextFiles(runtimeReferencesDir, RUNTIME_REFERENCE_FILES, "runtimeReferences");',
    '  }',
    '',
    '  if (runtimeScriptsDirOk) {',
    '    await repairManagedTextFiles(runtimeScriptsDir, RUNTIME_SCRIPT_FILES, "runtimeScripts");',
    '    await removeManagedRegularFile(runtimeScriptsDir, "migrate-runtime.mjs", "runtimeScripts");',
    '  }',
    '',
    '  if (worksReferencesDirOk) {',
    '    await repairManagedTextFiles(worksReferencesDir, WORKS_REFERENCE_FILES, "worksReferences");',
    '    await removeManagedRegularFile(worksReferencesDir, "quality-check.md", "worksReferences");',
    '  }',
    '',
    '  if (worksDesignReferencesDirOk) {',
    '    await repairManagedTextFiles(worksDesignReferencesDir, WORKS_DESIGN_REFERENCE_FILES, "worksDesignReferences");',
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
    widgetTabOrder: z.array(workspaceWidgetTabOrderItemSchema).optional(),
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
  review?: WorkspaceReviewSummary,
  widgets: readonly WorkspaceWidgetProjection[] = []
): WorkspaceSnapshot {
  return {
    workspaceId: metadata.workspaceId,
    title: metadata.title,
    description: metadata.description,
    memories: index.memories,
    ...(widgets.length > 0 ? { widgets: [...widgets] } : {}),
    ...(review ? { review } : {}),
  };
}

async function readSnapshotWidgets({
  canonicalRoot,
  metadata,
}: {
  readonly canonicalRoot: string;
  readonly metadata: WorkspaceMetadata;
}): Promise<{
  readonly widgets: readonly WorkspaceWidgetProjection[];
  readonly reviewEntries: readonly WorkspaceReviewEntryInput[];
}> {
  return readWorkspaceWidgetsFromFileTruth({
    widgetTabOrder: workspaceWidgetOrderFromMetadata(metadata),
    rootPath: canonicalRoot,
    workspaceId: metadata.workspaceId,
  });
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
  const writtenMetadata = await writeWorkspaceMetadataPreservingWidgetTabOrder({
    canonicalRoot,
    metadata: nextMetadata,
    ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
  });
  assertWorkspaceUsable(assertUsable);
  return writtenMetadata;
}

async function writeWorkspaceMetadataPreservingWidgetTabOrder({
  canonicalRoot,
  metadata,
  assertWorkspaceUsable: assertUsable,
}: {
  readonly canonicalRoot: string;
  readonly metadata: WorkspaceMetadata;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<WorkspaceMetadata> {
  assertWorkspaceUsable(assertUsable);
  const latestMetadata = await readMetadata(canonicalRoot);
  const metadataToWrite =
    latestMetadata?.widgetTabOrder === undefined
      ? metadata
      : { ...metadata, widgetTabOrder: latestMetadata.widgetTabOrder };
  await writeWorkspaceJsonAtomic(getWorkspaceMetadataPath(canonicalRoot), metadataToWrite, () =>
    assertWorkspaceUsable(assertUsable)
  );
  return metadataToWrite;
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
    const memoryCover = memory.cover ?? { source: 'default' };
    const otherCover = other?.cover ?? { source: 'default' };
    return (
      other !== undefined &&
      memory.memoryId === other.memoryId &&
      memory.title === other.title &&
      memory.createdAt === other.createdAt &&
      memory.updatedAt === other.updatedAt &&
      memory.segmentCount === other.segmentCount &&
      memory.audioSegmentCount === other.audioSegmentCount &&
      memory.noteSegmentCount === other.noteSegmentCount &&
      memory.artifactSegmentCount === other.artifactSegmentCount &&
      memory.audioDurationMs === other.audioDurationMs &&
      memory.audioByteLength === other.audioByteLength &&
      memory.hasAudioTranscript === other.hasAudioTranscript &&
      memory.hasAnyNote === other.hasAnyNote &&
      memory.supplementCount === other.supplementCount &&
      memoryCover.source === otherCover.source &&
      ((memoryCover.source === 'default' &&
        otherCover.source === 'default' &&
        memoryCover.templateId === otherCover.templateId) ||
        (memoryCover.source === 'custom' &&
          otherCover.source === 'custom' &&
          memoryCover.filename === otherCover.filename &&
          memoryCover.version === otherCover.version))
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

async function writeManagedReferenceFiles(
  directoryPath: string,
  files: Readonly<Record<string, string>>,
  assertUsable: AssertWorkspaceUsable | undefined
): Promise<void> {
  for (const [filename, next] of Object.entries(files)) {
    const filePath = path.join(directoryPath, filename);
    const current = await readOptionalRegularTextFile(filePath);
    await writeManagedFileIfChanged({ filePath, current, next, assertUsable });
  }
}

async function removeManagedRegularFileIfPresent(
  filePath: string,
  assertUsable: AssertWorkspaceUsable | undefined
): Promise<void> {
  try {
    const stats = await lstat(filePath);
    if (!stats.isFile()) {
      return;
    }
    assertWorkspaceUsable(assertUsable);
    await rm(filePath, { force: true });
    assertWorkspaceUsable(assertUsable);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
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
  const coverImageDirectory = path.join(skillsDirectory, 'reo-cover-image');
  const coverAestheticDirectory = path.join(skillsDirectory, 'reo-cover-aesthetic');
  const runtimeDirectory = path.join(skillsDirectory, 'reo-generative-runtime');
  const worksDirectory = path.join(skillsDirectory, 'reo-works');
  const worksDesignDirectory = path.join(skillsDirectory, 'reo-works-design');
  const runtimeReferencesDirectory = path.join(runtimeDirectory, 'references');
  const runtimeScriptsDirectory = path.join(runtimeDirectory, 'scripts');
  const worksReferencesDirectory = path.join(worksDirectory, 'references');
  const worksDesignReferencesDirectory = path.join(worksDesignDirectory, 'references');
  const scriptsDirectory = path.join(doctorDirectory, 'scripts');
  await ensureManagedDirectory(skillsDirectory, assertUsable);
  await ensureManagedDirectory(editDirectory, assertUsable);
  await ensureManagedDirectory(doctorDirectory, assertUsable);
  await ensureManagedDirectory(coverImageDirectory, assertUsable);
  await ensureManagedDirectory(coverAestheticDirectory, assertUsable);
  await ensureManagedDirectory(runtimeDirectory, assertUsable);
  await ensureManagedDirectory(worksDirectory, assertUsable);
  await ensureManagedDirectory(worksDesignDirectory, assertUsable);
  await ensureManagedDirectory(runtimeReferencesDirectory, assertUsable);
  await ensureManagedDirectory(runtimeScriptsDirectory, assertUsable);
  await ensureManagedDirectory(worksReferencesDirectory, assertUsable);
  await ensureManagedDirectory(worksDesignReferencesDirectory, assertUsable);
  await ensureManagedDirectory(scriptsDirectory, assertUsable);

  const editSkillPath = path.join(editDirectory, 'SKILL.md');
  const currentEditSkill = await readOptionalRegularTextFile(editSkillPath);
  const coverImageSkillPath = path.join(coverImageDirectory, 'SKILL.md');
  const currentCoverImageSkill = await readOptionalRegularTextFile(coverImageSkillPath);
  const coverAestheticSkillPath = path.join(coverAestheticDirectory, 'SKILL.md');
  const currentCoverAestheticSkill = await readOptionalRegularTextFile(coverAestheticSkillPath);
  const runtimeSkillPath = path.join(runtimeDirectory, 'SKILL.md');
  const currentRuntimeSkill = await readOptionalRegularTextFile(runtimeSkillPath);
  const worksSkillPath = path.join(worksDirectory, 'SKILL.md');
  const currentWorksSkill = await readOptionalRegularTextFile(worksSkillPath);
  const worksDesignSkillPath = path.join(worksDesignDirectory, 'SKILL.md');
  const currentWorksDesignSkill = await readOptionalRegularTextFile(worksDesignSkillPath);
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
    filePath: coverImageSkillPath,
    current: currentCoverImageSkill,
    next: DEFAULT_REO_COVER_IMAGE_SKILL_MD,
    assertUsable,
  });
  await writeManagedFileIfChanged({
    filePath: coverAestheticSkillPath,
    current: currentCoverAestheticSkill,
    next: DEFAULT_REO_COVER_AESTHETIC_SKILL_MD,
    assertUsable,
  });
  await writeManagedFileIfChanged({
    filePath: runtimeSkillPath,
    current: currentRuntimeSkill,
    next: DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD,
    assertUsable,
  });
  await writeManagedFileIfChanged({
    filePath: worksSkillPath,
    current: currentWorksSkill,
    next: DEFAULT_REO_WORKS_SKILL_MD,
    assertUsable,
  });
  await writeManagedFileIfChanged({
    filePath: worksDesignSkillPath,
    current: currentWorksDesignSkill,
    next: DEFAULT_REO_WORKS_DESIGN_SKILL_MD,
    assertUsable,
  });
  await writeManagedReferenceFiles(
    runtimeReferencesDirectory,
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES,
    assertUsable
  );
  await writeManagedReferenceFiles(
    runtimeScriptsDirectory,
    {
      'inspect-runtime.mjs': DEFAULT_REO_GENERATIVE_RUNTIME_INSPECT_SCRIPT_MJS,
      'scaffold-runtime.mjs': DEFAULT_REO_GENERATIVE_RUNTIME_SCAFFOLD_SCRIPT_MJS,
      'validate-runtime.mjs': DEFAULT_REO_GENERATIVE_RUNTIME_VALIDATE_SCRIPT_MJS,
    },
    assertUsable
  );
  await removeManagedRegularFileIfPresent(
    path.join(runtimeScriptsDirectory, 'migrate-runtime.mjs'),
    assertUsable
  );
  await writeManagedReferenceFiles(
    worksReferencesDirectory,
    DEFAULT_REO_WORKS_REFERENCE_FILES,
    assertUsable
  );
  await removeManagedRegularFileIfPresent(
    path.join(worksReferencesDirectory, 'quality-check.md'),
    assertUsable
  );
  await writeManagedReferenceFiles(
    worksDesignReferencesDirectory,
    DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES,
    assertUsable
  );

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
  const widgetsDirectory = await checkWorkspaceWidgetsDirectory(canonicalRoot);
  if (typeof widgetsDirectory !== 'string') {
    return widgetsDirectory;
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
  const widgetsDirectory = await checkWorkspaceWidgetsDirectory(canonicalRoot);
  if (typeof widgetsDirectory !== 'string') {
    return widgetsDirectory;
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
    const widgetsDirectory = await ensureWorkspaceWidgetsDirectory(canonicalRoot, assertUsable);
    if (typeof widgetsDirectory !== 'string') {
      return widgetsDirectory;
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
    snapshot: snapshotFrom(metadata, index, undefined, []),
  };
}

export async function openWorkspaceFiles({
  rootPath,
  assertWorkspaceUsable: assertUsable,
}: OpenWorkspaceFilesOptions): Promise<WorkspaceFilesResult> {
  let index: WorkspaceIndex;
  let metadata: WorkspaceMetadata;
  let canonicalRoot: string;
  try {
    assertWorkspaceUsable(assertUsable);
    const target = await validateWorkspaceOpenTarget(rootPath);
    if (!target.ok) {
      assertWorkspaceUsable(assertUsable);
      return target;
    }
    canonicalRoot = target.canonicalRoot;
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
    const widgetsDirectory = await ensureWorkspaceWidgetsDirectory(canonicalRoot, assertUsable);
    if (typeof widgetsDirectory !== 'string') {
      return widgetsDirectory;
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
  const widgets = await readSnapshotWidgets({ canonicalRoot, metadata });
  return {
    ok: true,
    snapshot: snapshotFrom(metadata, index, undefined, widgets.widgets),
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
      await writeWorkspaceMetadataPreservingWidgetTabOrder({
        canonicalRoot: nextCanonicalRoot,
        metadata: nextMetadata,
        ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
      });
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

    const widgets = await readSnapshotWidgets({
      canonicalRoot: nextCanonicalRoot,
      metadata: nextMetadata,
    });
    return {
      ok: true,
      canonicalRoot: nextCanonicalRoot,
      snapshot: snapshotFrom(nextMetadata, index, undefined, widgets.widgets),
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
    const widgets = await readSnapshotWidgets({ canonicalRoot, metadata });
    const review = await writeWorkspaceNeedsReviewReport({
      ...(assertUsable ? { assertUsable: () => assertWorkspaceUsable(assertUsable) } : {}),
      entries: [...readModel.reviewEntries, ...widgets.reviewEntries],
      rootPath: canonicalRoot,
    });
    assertWorkspaceUsable(assertUsable);
    return {
      ok: true,
      snapshot: snapshotFrom(metadata, index, review, widgets.widgets),
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
    const widgets = await readSnapshotWidgets({ canonicalRoot, metadata });
    return {
      ok: true,
      snapshot: snapshotFrom(metadata, index, undefined, widgets.widgets),
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

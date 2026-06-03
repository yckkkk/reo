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
  '- 封面生成、替换、默认模板切换、恢复默认或验证任务先读 `skills/reo-cover-image/SKILL.md`；需要审美判断时再读 `skills/reo-cover-aesthetic/SKILL.md`。',
  '- 创建或更新作品片段、作品补充时先读 `skills/reo-works/SKILL.md`，并按该 skill 指引读取 `skills/reo-works/references/` 中的文件合同、工作流和验证清单。',
  '- 需要视觉、交互、图表、diagram、dashboard、mockup 或 token 约束时再读 `skills/reo-works-design/SKILL.md`，并按该 skill 指引读取 `skills/reo-works-design/references/` 中的设计模块。',
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
  '- `.reo/`：Reo 的技术完整性层，保存索引、manifest、草稿、回收站、lock 和恢复信息。',
  '- `skills/`：给 agent 使用的工作流技能，不是用户语义内容本身；当前托管入口包括 `reo-edit`、`reo-cover-image`、`reo-cover-aesthetic`、`reo-works`、`reo-works-design` 和 `reo-doctor`。',
  '',
  '## 文件层',
  '',
  '- `memories/` 保存用户语义内容，是普通编辑和创建任务的默认工作区。',
  '- Memory 使用 `memory.md`，Segment 使用 `segment.md`，SegmentSupplement 使用 `supplement.md`。',
  '- `content.tiptap.json` 是同一正文的富结构载体，由 Reo 与编辑器维护。',
  '- 作品对象使用 `kind: artifact`、`format: html`，入口文件是同目录 `segment.html` 或 `supplement.html`。',
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
    '- `references/quality-check.md`：提交前的文件、隐私、轻量性能和 Reo 投影检查。',
    '- 需要视觉、交互、图表、diagram、dashboard、mockup 或创意表达时，继续读 `skills/reo-works-design/SKILL.md`。',
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
    '2. 在 `memories/<memory-directory>/segments/` 下创建一个清楚命名的 Segment 目录。',
    '3. 写入 `segment.md`，frontmatter 必须包含稳定 `id`、`title`、`kind: artifact`、`format: html`。',
    '4. 同目录写入 `segment.html`，必须是完整 HTML 文档，能在 iframe 中独立渲染。',
    '5. 需要资源时优先内联；如果拆文件，只放同目录 sibling asset，不要写到 `.reo/`。',
    '',
    '最小形态：',
    '',
    '```markdown',
    '---',
    'id: seg_agent_review_schedule',
    'title: 间隔复习表',
    'kind: artifact',
    'format: html',
    '---',
    '# 间隔复习表',
    '',
    'Agent-created work. Entry: `segment.html`.',
    '```',
    '',
    '## 创建作品补充',
    '',
    '1. 从 prompt 中读取目标 Segment 目录。',
    '2. 在目标 Segment 的 `supplements/` 下创建一个清楚命名的 Supplement 目录。',
    '3. 写入 `supplement.md`，frontmatter 必须包含稳定 `id`、`title`、`kind: artifact`、`format: html`。',
    '4. 同目录写入 `supplement.html`，必须是完整 HTML 文档。',
    '',
    '最小形态：',
    '',
    '```markdown',
    '---',
    'id: sup_agent_review_schedule',
    'title: 复习补充',
    'kind: artifact',
    'format: html',
    '---',
    '# 复习补充',
    '',
    'Agent-created work supplement. Entry: `supplement.html`.',
    '```',
    '',
    '## 更新作品',
    '',
    '- 先读取目标 `segment.md` 或 `supplement.md`，确认它是 `kind: artifact`、`format: html`。',
    '- 读取同目录 `segment.html` 或 `supplement.html`，再读取 prompt 指定的数据来源。',
    '- 保留稳定 id 和对象目录；除非用户要求重命名，否则不要改 title 或目录 basename。',
    '- 更新 HTML 时保持轻量，删除不再需要的同目录旧 asset；不要编辑 `.reo/index.json`、manifest、lock 或 hash 字段。',
    '',
    '## 文件合同',
    '',
    '- 用户可见类型名是作品；文件合同字段是 `kind: artifact` 和 `format: html`。',
    '- Segment 入口文件必须叫 `segment.html`；Supplement 入口文件必须叫 `supplement.html`。',
    '- Reo 会计算入口 bytes/hash 并收敛 manifest；agent 不写 `.reo/objects`。',
    '- 作品可以包含同目录 `.css`、`.js`、`.svg`、`.png`、`.jpg`、`.jpeg`、`.webp`、`.gif`、`.woff`、`.woff2`，但优先少文件、少 bytes。',
    '- 不要创建 symlink，不要引用 absolute path，不要依赖外部网络请求。',
    '- 不要创建空白占位作品；只有当 HTML 入口已经表达用户可见价值时才落文件。',
    '',
    '## 设计与交互',
    '',
    '- 视觉、图表、diagram、dashboard、mockup 和交互控件先读 `skills/reo-works-design/SKILL.md` 及其 `references/`。',
    '- 作品内可以有局部 DOM 交互、过滤、排序、计算和切换；不要依赖 parent window、top navigation、弹窗或跨窗口通信。',
    '- 如果需要第三方库，只使用 Reo 已提供的本地 `reo-artifact://vendor/<package>/<file>` 资源；没有本地 vendor 时用原生 HTML/CSS/JS 或 SVG。',
    '',
    '## 验证',
    '',
    '- 确认 `segment.md`/`supplement.md` frontmatter 可读，且同目录入口 HTML 存在。',
    '- 确认入口 HTML 不依赖外部网络，不包含凭证、绝对路径或本机私有路径。',
    '- 确认所有屏幕上的数字都经过 `Math.round()`、`.toFixed()` 或 `Intl.NumberFormat`。',
    '- 直接验证文件效果后停止；Reo 会在打开、刷新或保存时投影作品。',
  ].join('\n') + '\n';
export const DEFAULT_REO_WORKS_DESIGN_SKILL_MD =
  [
    '---',
    'name: reo-works-design',
    'description: 用于 Reo 作品的视觉、交互、图表、diagram、mockup、dashboard 和轻量 app 设计；内置 Reo tokens、模块、复杂度预算和沙箱边界。',
    '---',
    '',
    '# Reo Works Design',
    '',
    '用于把 Reo 作品做成轻量、清楚、能长期留在记忆空间里的视觉/交互产物。输出目标是 `segment.html` 或 `supplement.html`，不是普通说明文。',
    '',
    '## 渐进读取',
    '',
    '先读本文件选模块，再按作品类型读取 reference。不要一次性打开所有文件，除非作品确实跨多个模块。',
    '',
    '- `references/core-design-system.md`：Reo 作品 tokens、排版、颜色、深色模式和沙箱边界。',
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
    '```css',
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
    '    --color-text-primary: #f1efe8;',
    '    --color-text-secondary: #d3d1c7;',
    '    --color-text-tertiary: #b4b2a9;',
    '    --color-border-tertiary: rgba(241, 239, 232, 0.16);',
    '    --color-border-secondary: rgba(241, 239, 232, 0.3);',
    '    --color-border-primary: rgba(241, 239, 232, 0.42);',
    '  }',
    '}',
    '```',
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
    '- 禁止外部网络请求；`fetch`、XHR、跨站图片、远程字体和远程脚本都不要写。',
    '- 可以使用 inline CSS、inline JS、data/blob 图片，或同目录 sibling asset。',
    '- 不使用 `window.top`、`window.parent`、弹窗、下载、表单提交、导航或跨窗口通信。',
    '- 不存储凭证、绝对路径、本机用户名、token 或用户没有要求展示的隐私内容。',
    '',
    '## 轻量性能规则',
    '',
    '- 首屏 HTML 目标小于 200KB；复杂作品优先拆为作品补充。',
    '- 避免每帧重排、无限动画、大量 DOM 节点、大图片和大 base64。',
    '- 事件监听器只绑需要交互的控件；没有必要不要使用 animation loop。',
    '- 如果使用 canvas，固定 wrapper 高度并按设备像素比控制绘制，不要让 canvas 自动撑破布局。',
    '- 数据更新由 agent 后续重写作品文件完成；当前 M1 作品不直接读取 Reo live data API。',
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
    '- Segment entry file: `segment.html` in the same Segment directory as `segment.md`.',
    '- Supplement entry file: `supplement.html` in the same Supplement directory as `supplement.md`.',
    '- Reo owns `.reo/objects`, `.reo/index.json`, lock files, hashes and preview versions. Agents do not write those files.',
    '',
    '## New work Segment',
    '',
    'Create one directory under `memories/<memory>/segments/`. Use a stable id prefix and a readable basename, for example `seg_agent_review_map--复习地图`.',
    '',
    '```markdown',
    '---',
    'id: seg_agent_review_map',
    'title: 复习地图',
    'kind: artifact',
    'format: html',
    '---',
    '# 复习地图',
    '',
    'Agent-created work. Entry: `segment.html`.',
    '```',
    '',
    '## New work Supplement',
    '',
    'Create one directory under `memories/<memory>/segments/<segment>/supplements/`. Use a stable id prefix and a readable basename, for example `sup_agent_risk_panel--风险面板`.',
    '',
    '```markdown',
    '---',
    'id: sup_agent_risk_panel',
    'title: 风险面板',
    'kind: artifact',
    'format: html',
    '---',
    '# 风险面板',
    '',
    'Agent-created work supplement. Entry: `supplement.html`.',
    '```',
    '',
    '## HTML entry requirements',
    '',
    '- Write a complete HTML document: `<!doctype html>`, `<html>`, `<head>`, `<meta charset="utf-8">`, viewport meta, `<style>`, content, optional `<script>` at the end.',
    '- Do not create a blank placeholder. The first saved version must render useful visible content.',
    '- Keep the entry under 1 MiB. Aim under 200 KiB for the first version.',
    '- Prefer inline CSS and JS. If assets are needed, place only safe sibling assets next to the entry.',
    '- Allowed sibling asset types: `.css`, `.js`, `.svg`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.woff`, `.woff2`.',
    '- Do not create symlinks, absolute paths, external network URLs, local usernames, tokens or hidden dependency on editor temp files.',
    '',
    '## Update requirements',
    '',
    '- Preserve the existing stable id and object directory.',
    '- Preserve title and basename unless the user asks to rename the work.',
    '- Read current HTML before editing so you keep useful interaction and remove stale data deliberately.',
    '- Delete no-longer-used sibling assets only when you can prove they belong to this work.',
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
    '4. If the form has visual or interaction complexity, read `skills/reo-works-design/SKILL.md` and the specific design reference.',
    '5. Create the Markdown contract and HTML entry in one object directory.',
    '6. Re-read the files you wrote and verify the entry does not rely on network, parent window APIs or `.reo` internals.',
    '',
    '## Update an existing work',
    '',
    '1. Read target `segment.md` or `supplement.md`; confirm `kind: artifact` and `format: html`.',
    '2. Read the current `segment.html` or `supplement.html`.',
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

export const DEFAULT_REO_WORKS_QUALITY_REFERENCE_MD =
  [
    '# Reo works quality check',
    '',
    'Run this check before ending a works task.',
    '',
    '## File check',
    '',
    '- `segment.md` or `supplement.md` frontmatter parses and includes `id`, `title`, `kind: artifact`, `format: html`.',
    '- `segment.html` or `supplement.html` exists in the same directory.',
    '- Sibling assets, if any, are ordinary files and are referenced with relative paths only.',
    '- No `.reo/objects`, `.reo/index.json`, lock, draft or review file was edited for normal creation/update.',
    '',
    '## Preview check',
    '',
    '- HTML renders useful static content before any script runs.',
    '- Scripts are optional, local and bounded to the current document.',
    '- No `window.top`, `window.parent`, popups, downloads, external navigation, remote fonts, remote scripts, remote images, `fetch` or XHR.',
    '- No nested scroll containers unless the user explicitly requested a constrained table; prefer content that grows in normal flow.',
    '- No fixed-position UI. Mock dialogs should be normal-flow faux viewports.',
    '',
    '## Visual check',
    '',
    '- Flat, compact, content-first presentation; no landing-page hero.',
    '- No gradients, glows, blur effects, decorative shadows, noisy backgrounds or emoji-dependent status.',
    '- Text stays readable in light and dark mode.',
    '- Every displayed number is rounded or formatted with `Intl.NumberFormat`, `.toFixed()` or `Math.round()`.',
    '- Grid uses `minmax(0, 1fr)` when content might overflow; tables use fixed layout or a controlled wrapper.',
    '',
    '## Privacy check',
    '',
    '- Do not reveal absolute paths, local usernames, API keys, token fragments or hidden system metadata.',
    '- Summarize sensitive source material instead of copying it when the work only needs trends or structure.',
    '- Keep the work lightweight enough that future agent rewrites can update it directly.',
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
    '```css',
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
    '  --color-border-tertiary: rgba(44,44,42,0.15);',
    '  --color-border-secondary: rgba(44,44,42,0.3);',
    '  --color-border-primary: rgba(44,44,42,0.4);',
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
    '    --color-text-primary: #f1efe8;',
    '    --color-text-secondary: #d3d1c7;',
    '    --color-text-tertiary: #b4b2a9;',
    '    --color-border-tertiary: rgba(241,239,232,0.16);',
    '    --color-border-secondary: rgba(241,239,232,0.3);',
    '    --color-border-primary: rgba(241,239,232,0.42);',
    '  }',
    '}',
    '```',
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
    '- No external network. No CDN, remote fonts, remote images, `fetch`, XHR or module imports.',
    '- No host bridge. Do not use `sendPrompt`, `openLink`, `window.top`, `window.parent`, popups or cross-window messaging.',
    '- No storage dependency. If state is interactive, keep it in DOM variables and derive it from visible controls.',
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
    '- No chat bridge or prompt sending.',
    '- No external links, navigation, downloads or popups.',
    '- No network calls or remote libraries.',
    '- No persistent localStorage/sessionStorage dependency.',
    '- No parent window communication.',
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
    'Current works do not read live Reo data APIs. To update a work, the user copies an update prompt and an agent rewrites the HTML from the latest files.',
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
    '- Prefer native SVG, CSS bars, tables with fixed layout or small inline canvas code.',
    '- Do not use remote Chart.js or remote Mermaid. Reo artifact CSP has no network.',
    '- If Reo provides a local vendor resource, reference it as `reo-artifact://vendor/<package>/<file>`; otherwise use native code.',
    '- Keep chart data embedded in the HTML unless the user explicitly asked for sibling JSON.',
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
  'quality-check.md': DEFAULT_REO_WORKS_QUALITY_REFERENCE_MD,
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
    "import { lstat, mkdir, open, readFile } from 'node:fs/promises';",
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
    'const report = { ok: true, mode: fix ? "fix" : "check", repaired: { agentsMd: false, doctorSkill: false, editSkill: false, coverImageSkill: false, coverAestheticSkill: false, worksSkill: false, worksDesignSkill: false, worksReferences: [], worksDesignReferences: [] }, issues: [] };',
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
    '  const worksDir = path.join(skillsDir, "reo-works");',
    '  const worksDesignDir = path.join(skillsDir, "reo-works-design");',
    '  const worksReferencesDir = path.join(worksDir, "references");',
    '  const worksDesignReferencesDir = path.join(worksDesignDir, "references");',
    '  let doctorDirOk = false;',
    '  let editDirOk = false;',
    '  let coverImageDirOk = false;',
    '  let coverAestheticDirOk = false;',
    '  let worksDirOk = false;',
    '  let worksDesignDirOk = false;',
    '  let worksReferencesDirOk = false;',
    '  let worksDesignReferencesDirOk = false;',
    '  if (await ensureDirectory(skillsDir)) {',
    '    doctorDirOk = await ensureDirectory(doctorDir);',
    '    editDirOk = await ensureDirectory(editDir);',
    '    coverImageDirOk = await ensureDirectory(coverImageDir);',
    '    coverAestheticDirOk = await ensureDirectory(coverAestheticDir);',
    '    worksDirOk = await ensureDirectory(worksDir);',
    '    worksDesignDirOk = await ensureDirectory(worksDesignDir);',
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
    '  if (worksReferencesDirOk) {',
    '    await repairManagedTextFiles(worksReferencesDir, WORKS_REFERENCE_FILES, "worksReferences");',
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
  const worksDirectory = path.join(skillsDirectory, 'reo-works');
  const worksDesignDirectory = path.join(skillsDirectory, 'reo-works-design');
  const worksReferencesDirectory = path.join(worksDirectory, 'references');
  const worksDesignReferencesDirectory = path.join(worksDesignDirectory, 'references');
  const scriptsDirectory = path.join(doctorDirectory, 'scripts');
  await ensureManagedDirectory(skillsDirectory, assertUsable);
  await ensureManagedDirectory(editDirectory, assertUsable);
  await ensureManagedDirectory(doctorDirectory, assertUsable);
  await ensureManagedDirectory(coverImageDirectory, assertUsable);
  await ensureManagedDirectory(coverAestheticDirectory, assertUsable);
  await ensureManagedDirectory(worksDirectory, assertUsable);
  await ensureManagedDirectory(worksDesignDirectory, assertUsable);
  await ensureManagedDirectory(worksReferencesDirectory, assertUsable);
  await ensureManagedDirectory(worksDesignReferencesDirectory, assertUsable);
  await ensureManagedDirectory(scriptsDirectory, assertUsable);

  const editSkillPath = path.join(editDirectory, 'SKILL.md');
  const currentEditSkill = await readOptionalRegularTextFile(editSkillPath);
  const coverImageSkillPath = path.join(coverImageDirectory, 'SKILL.md');
  const currentCoverImageSkill = await readOptionalRegularTextFile(coverImageSkillPath);
  const coverAestheticSkillPath = path.join(coverAestheticDirectory, 'SKILL.md');
  const currentCoverAestheticSkill = await readOptionalRegularTextFile(coverAestheticSkillPath);
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
    worksReferencesDirectory,
    DEFAULT_REO_WORKS_REFERENCE_FILES,
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

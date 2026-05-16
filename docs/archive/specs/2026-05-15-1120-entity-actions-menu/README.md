# 实体 More 菜单 Shell 动作扩展

## 时间

2026-05-15 11:20 America/Los_Angeles

## 目标

把记忆空间、Memory、Segment 和 SegmentSupplement 四类实体的 More 菜单从"只承担重命名/删除"扩展为"承认目录是身份边界"的统一动作面板：用默认应用打开语义文件、在访达中显示目录、复制目录的相对/绝对路径，与重命名和删除/移除并置。

## 范围

四个实体类型 × 六个 UI surface：

| 入口                                      | 实体         | 现有条目      | 目标条目 |
| ----------------------------------------- | ------------ | ------------- | -------- |
| AppShell sidebar memory-space row         | Memory Space | 重命名 + 移除 | 5 项     |
| WorkspaceTitlebar memory-space breadcrumb | Memory Space | 重命名        | 5 项     |
| WorkspaceTitlebar Memory breadcrumb       | Memory       | 重命名        | 6 项     |
| MemoryRail Memory card                    | Memory       | 重命名 + 删除 | 6 项     |
| MemoryStudio Segment card                 | Segment      | 重命名 + 删除 | 6 项     |
| MemoryStudio SegmentSupplement tab        | Supplement   | 重命名 + 删除 | 6 项     |

## 菜单结构

三组，组间用 `DropdownMenuSeparator`：

| 组  | 条目           | Memory Space | Memory      | Segment      | Supplement      |
| --- | -------------- | ------------ | ----------- | ------------ | --------------- |
| 1   | 用默认应用打开 | AGENTS.md    | memory.md   | segment.md   | supplement.md   |
| 1   | 在访达中显示   | root 目录    | memory 目录 | segment 目录 | supplement 目录 |
| 2   | 复制相对路径   | —            | rel         | rel          | rel             |
| 2   | 复制绝对路径   | abs          | abs         | abs          | abs             |
| 3   | 重命名         | √            | √           | √            | √               |
| 3   | 末项           | 移除         | 删除        | 删除         | 删除            |

记忆空间无"复制相对路径"（root 自身没有相对锚）；"复制绝对路径"在记忆空间独立成组保留两项分组的视觉结构，组 2 退化为单条。

## 文案统一

菜单项不再带"记忆"/"记忆空间"后缀。实体语义由 menu trigger 上下文承载，已有的「重命名记忆」「重命名记忆空间」「删除记忆」「移除记忆空间」缩为「重命名」「删除」「移除」。

## 认知分析与设计决策

### 路径不离开 Main Process

`docs/current/electron.md` 既有硬线：renderer 不持有 raw path、selection token、file path 或 handle internals。复制路径动作通过 `clipboard.writeText` 在 main 内直接写系统剪贴板，IPC response 只是 `{ ok: true }`。Renderer 永不持有路径字符串。

### 用默认应用打开

`shell.openPath(path)` 直接以系统默认应用打开目标 `.md` 文件，macOS 没有程序化 Open With 选择器。菜单文案确定为「用默认应用打开」，避免「打开方式…」暗示后续面板。

### 在访达中显示

`shell.showItemInFolder(dir)` 在 Finder 中打开父目录并尝试选中目标目录，让用户看到同级实体。

### 路径目标 = 目录

「在访达中显示」与「复制相对/绝对路径」均指向实体**目录**（基于 Reo "目录是身份边界" 模型，`<id>--<title>` 命名），不指向语义 `.md`。「用默认应用打开」指向语义 `.md`。

### 6 个入口保留

WorkspaceTitlebar 上的 Memory Space More 与 Memory More 不与 sidebar/rail 上对应 More 合并：窄视口下 MemoryRail 默认折叠为 overlay，去掉 titlebar More 会让"当前 Memory 重命名"需要先展开 rail；UX 代价高于双 surface 维护成本。两处 More 通过共享同一 entity-typed menu 组件保证条目对齐。

## IPC 面

新增 15 个 channel，per-entity-per-action 拆分，与现有 `updateMemoryTitle / updateSegmentTitle / updateSegmentSupplementTitle / deleteSegment / restoreSegment` 同节拍：

| Channel                                       | Identity payload                                                  | Main 动作                                       |
| --------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| `workspace:revealMemorySpaceInFinder`         | `workspaceId`                                                     | `shell.showItemInFolder(rootAbsolute)`          |
| `workspace:revealMemoryInFinder`              | `workspaceHandle, workspaceId, memoryId`                          | `shell.showItemInFolder(memoryDirAbsolute)`     |
| `workspace:revealSegmentInFinder`             | `workspaceHandle, workspaceId, memoryId, segmentId`               | `shell.showItemInFolder(segmentDirAbsolute)`    |
| `workspace:revealSegmentSupplementInFinder`   | `workspaceHandle, workspaceId, memoryId, segmentId, supplementId` | `shell.showItemInFolder(supplementDirAbsolute)` |
| `workspace:openMemorySpaceAgentsFile`         | `workspaceId`                                                     | `shell.openPath(agentsFileAbsolute)`            |
| `workspace:openMemoryDocument`                | `workspaceHandle, workspaceId, memoryId`                          | `shell.openPath(memoryMdAbsolute)`              |
| `workspace:openSegmentDocument`               | `workspaceHandle, workspaceId, memoryId, segmentId`               | `shell.openPath(segmentMdAbsolute)`             |
| `workspace:openSegmentSupplementDocument`     | `workspaceHandle, workspaceId, memoryId, segmentId, supplementId` | `shell.openPath(supplementMdAbsolute)`          |
| `workspace:copyMemorySpaceAbsolutePath`       | `workspaceId`                                                     | `clipboard.writeText(rootAbsolute)`             |
| `workspace:copyMemoryAbsolutePath`            | `workspaceHandle, workspaceId, memoryId`                          | `clipboard.writeText(memoryDirAbsolute)`        |
| `workspace:copySegmentAbsolutePath`           | `workspaceHandle, workspaceId, memoryId, segmentId`               | `clipboard.writeText(segmentDirAbsolute)`       |
| `workspace:copySegmentSupplementAbsolutePath` | `workspaceHandle, workspaceId, memoryId, segmentId, supplementId` | `clipboard.writeText(supplementDirAbsolute)`    |
| `workspace:copyMemoryRelativePath`            | `workspaceHandle, workspaceId, memoryId`                          | `clipboard.writeText(memoryDirRelative)`        |
| `workspace:copySegmentRelativePath`           | `workspaceHandle, workspaceId, memoryId, segmentId`               | `clipboard.writeText(segmentDirRelative)`       |
| `workspace:copySegmentSupplementRelativePath` | `workspaceHandle, workspaceId, memoryId, segmentId, supplementId` | `clipboard.writeText(supplementDirRelative)`    |

**所有 channel 的 response payload 都是 `{ ok: true }`**。错误信封走现有 typed error 模型，**无 `dataRetention`**（只读 OS 调用没有半成功状态）。

active-workspace 的 12 个 channel 复用现有 `requireHandle` + sender + handle + `workspaceId` + lock usability 校验堆栈；记忆空间的 3 个 channel 不要求 workspace 已打开，但必须校验 sender、registry root、root ownership `workspaceId` 与 root usability。

## Main 内 `EntityPathResolver`

内部 helper，不进 preload、不导出 IPC：

```
resolveMemorySpacePaths(workspaceId)         → { rootAbsolute, agentsFileAbsolute }
resolveMemoryPaths(handle, wsId, memoryId)              → { directoryAbsolute, documentAbsolute }
resolveSegmentPaths(handle, wsId, mId, sId)             → { directoryAbsolute, documentAbsolute }
resolveSegmentSupplementPaths(handle, wsId, mId, sId, supId) → { directoryAbsolute, documentAbsolute }
```

- Memory / Segment / Supplement 解析复用现有 `.reo/objects/<kind>/<id>.json` manifest 定位逻辑（已在 update title / delete handler 中实现）。
- Memory Space 解析复用 registry root resolution（已在 `removeMemorySpace` 中实现）。
- 相对路径 = `path.relative(handle.canonicalRoot, directoryAbsolute)`，使用 POSIX 风格分隔符。
- Path containment：解析结果必须在 canonical workspace root 内；越界返回 `ERR_WORKSPACE_UNSAFE_PATH`。

## 错误模型

| Error code                                         | 来源                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| `ERR_WORKSPACE_ROOT_MISSING` (existing)            | registry root 不存在                                                    |
| `ERR_WORKSPACE_MEMORY_NOT_FOUND` (new)             | `.reo/objects/memories/<id>.json` 缺失或解析失败                        |
| `ERR_WORKSPACE_SEGMENT_NOT_FOUND` (new)            | parent memory 下 segmentId manifest 缺失                                |
| `ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND` (new) | parent segment 下 supplementId manifest 缺失                            |
| `ERR_MEMORY_SPACE_AGENTS_FILE_MISSING` (new)       | root 下 `AGENTS.md` 不存在（仅 `openMemorySpaceAgentsFile`）            |
| `ERR_ENTITY_DOCUMENT_MISSING` (new)                | `memory.md` / `segment.md` / `supplement.md` 缺失（仅 `open*Document`） |
| `ERR_WORKSPACE_METADATA_INVALID` (existing)        | registry root 的 `.reo/workspace.json.workspaceId` 与 request 不匹配    |
| `ERR_WORKSPACE_UNSAFE_PATH` (existing pattern)     | path 越出 canonical root                                                |
| `ERR_SHELL_OPEN_FAILED` (new)                      | `shell.openPath` 返回非空错误字符串，或 `shell.showItemInFolder` 抛错   |
| `ERR_CLIPBOARD_WRITE_FAILED` (new)                 | `clipboard.writeText` 抛错                                              |

Renderer 收到错误统一通过 root error toast 显示。

## Renderer 共享组件

四个 feature-local entity-typed wrapper，放 `src/renderer/src/workspace/`：

```
MemorySpaceActionsMenu.tsx          5 项 (memory-space 入口，无 rel-path)
MemoryActionsMenu.tsx               6 项
SegmentActionsMenu.tsx              6 项
SegmentSupplementActionsMenu.tsx    6 项
```

- 每个 wrapper 只接受对应 `actionIdentity`、owner 动作和 UI 状态 props；受控菜单使用 `open` / `onOpenChange`，自定义触发器使用 `trigger` / `triggerLabel`。
- 4 个新动作通过 `window.reoWorkspace.*` 在组件内直接触发；`onRename` / `onDelete`（或 `onRemove`）由 owner 传入，因为对应 Dialog 状态归 owner。
- 内部使用 `DropdownMenuGroup` × 3 + `DropdownMenuSeparator` 表达三组。
- 不做 generic kind-driven action menu 抽象；4 个 typed 组件 clarity 优先。

## 成功 / 失败反馈

| 动作              | 成功                      | 失败             |
| ----------------- | ------------------------- | ---------------- |
| 复制相对/绝对路径 | root toast `已复制路径`   | root error toast |
| 在访达中显示      | 静默（Finder 自取焦点）   | root error toast |
| 用默认应用打开    | 静默（默认 app 自取焦点） | root error toast |

复制动作有显式 toast 是因为剪贴板写入对用户不可见；其他两动作的副作用本身就是可见反馈。

## 图标

- 现有「重命名」（`PencilLine`）和「删除」/「移除」（`Trash2`）沿用。
- 4 个新条目带图标：`ExternalLink` 表达默认应用打开，`FolderOpen` 表达访达显示，`Copy` 表达复制路径。组间分隔线可见但不额外扩大菜单垂直节奏。

## 文档同批更新

按 CLAUDE.md 硬红线：

- `docs/current/electron.md` — 新 IPC channel 字典追加 15 条；EntityPathResolver 声明为 main 内部不暴露；明确"复制路径动作 renderer 永不持有 raw path（main 写剪贴板）"硬约束；7 个新增 typed error code 入字典。
- `docs/current/frontend.md` — 6 surface 的 More 菜单条目表；菜单文案统一规则（不带"记忆"/"记忆空间"后缀）；4 个 entity-typed menu 组件登记；"复制路径动作不进入 navigator.clipboard"反映。
- `docs/current/flow.md` — 新动作是无 transaction 只读 OS 调用；active-workspace channel 仍需 `requireHandle` + lock usability 一致性。
- `docs/current/data.md` — 明确"新动作不进入 TanStack Query 缓存层"，避免误改。

## TDD 切入

1. **RED**：`EntityPathResolver` 单元测试覆盖 4 实体 × `{解析成功, manifest 缺失, AGENTS.md 缺失（仅 memory space）, document 缺失, unsafe path}` 各场景。
2. **RED**：15 个 IPC handler 各自的 contract 测试覆盖 `{sender 校验失败, handle 校验失败 (active path), resolver 失败, shell/clipboard 调用成功, shell.openPath 返回非空错误字符串, clipboard.writeText 抛错}`。
3. **RED**：4 个 entity-typed menu 组件渲染测试覆盖 `{条目列表与分组, separator 出现位置, 点击触发对应 bridge 方法, 成功 toast (复制), 失败 toast, 已有重命名/删除 entry 仍工作}`。
4. **RED**：6 个 surface 的 integration 测试覆盖 `{trigger 可见性规则, 菜单 open/close, 动作分发, dialog open 互不污染}`。
5. **GREEN** 按上述顺序最小实现；**REFACTOR** 后重跑各级保护测试。
6. 同批更新 4 份 `docs/current/*`。

## 成功标准

- 6 个 surface 上的 More 菜单条目数与本 spec 表一致，文案统一为「重命名」「删除」/「移除」与 4 个新项。
- 复制路径动作的剪贴板内容由 main 写入，renderer 测试断言中**找不到任何 raw path 字符串**经过 renderer state、props、Query 缓存或 DOM。
- 用默认应用打开在 macOS 上能用系统默认 Markdown 应用打开目标 `.md` / `AGENTS.md`。
- 在访达中显示调用 macOS Finder reveal；运行时证据必须记录 renderer 是否收到错误。若当前环境无法取得可采信 Finder selection 探针，不得宣称已视觉确认选中目录。
- 复制相对路径使用 POSIX 分隔符，且永远是 `path.relative(workspace root, entity dir)` 的结果。
- 错误场景产生 typed error 并对应 root toast。
- `npm run verify:quick` 通过。
- `npm run build` 通过（电信号/protocol/CSP 未变，但 IPC surface 改了，build 是契约一致性的最后兜底）。
- 运行时视觉证据（截图 + Finder 反应 + 剪贴板粘贴）进入 spec evidence。

## 验证清单

- [x] targeted main tests（`EntityPathResolver` + 15 IPC handler）
- [x] targeted renderer tests（4 menu 组件 + 6 surface integration）
- [x] `npm run typecheck`
- [x] `npm run test:main`
- [x] `npm run test:renderer`
- [x] `npm run lint`
- [x] `npm run format:check`
- [x] `npm run verify:quick`
- [x] `npm run build`
- [x] 运行时视觉证据：六个 surface 各一张截图 + 复制路径粘贴样本 + Finder reveal 执行记录；Finder selection 未取得可采信外部探针，因此不声明视觉确认

## 约束

- 产品未发布，不写任何兼容旧菜单文案的 alias、过渡 prop 或 fallback。删除菜单项时同步删除对应文案。
- 不创建 generic kind-driven action menu 抽象；4 个 typed 组件分开。
- 不引入新的 IPC generic invoke / generic command bus；每动作每实体一个独立 channel。
- 不在 preload 暴露 `clipboard` 或 `shell` 任何方法；只暴露已有 narrow 产品方法。
- 不让 renderer 持有任何 raw path 字符串。
- 不为本 slice 引入 Zustand store、新 Query key 或新 React Hook Form。

## 当前证据

- 命令验证：`npm run typecheck`、`npm run test:main`、`npm run test:renderer`、`npm run lint`、`npm run format:check`、`npm run verify:quick`、`npm run build` 均通过。
- 运行时证据：见 [verification.md](verification.md)。已记录 `npm start` 启动证据、六个 surface 的菜单截图、复制路径剪贴板样本和缺失文件 error toast。
- Finder 选中目录样本未取得可采信外部探针；verification 中明确不把该项声明为视觉确认。

# AI-ready Dogfood

创建：2026-06-06 04:58 America/Los_Angeles
状态：archived

## 目标

验证 Reo 记忆空间在真实外部 agent 文件写回场景下是否足够 AI-ready。重点不是再证明单元测试能跑，而是让 agent 只依赖记忆空间内的 `.reo/REO.md`、root `AGENTS.md` 指针和官方 skills 完成创建、更新、诊断与恢复。

## 范围

- 使用真实 dogfood 记忆空间，不修改用户已有工作空间。
- 覆盖普通 Memory / Segment / SegmentSupplement 编辑。
- 覆盖作品 Segment 创建、作品 Supplement 更新、Workspace Widget 创建与更新。
- 覆盖用户自带 root `AGENTS.md` 和用户自带 skills 不被 Reo 打开、修复或升级流程覆盖。
- 覆盖 `reo-doctor` 对缺失托管入口、官方 skills 和 needs-review 诊断的恢复路径。
- 针对作品展示尺寸，采用软目标：提示 agent 优先让 inline preview 首屏可读、避免无意义长滚动；复杂作品可以用内部分区、摘要首屏、展开预览或受控滚动承载，不写死单个像素尺寸。

## 非目标

- 不实现 Reo 内嵌 AI。
- 不新增 schedule、自动整理或 agent runtime。
- 不把一次性 dogfood 证据写入 `docs/current/*`。
- 不要求所有复杂作品都完整塞进 inline preview 的首屏。

## 成功标准

- 外部 agent 文件写回后，Reo 能在打开、刷新或 focused read 中投影合法内容。
- 复制提示词路径仍然引导 agent 读取 `.reo/REO.md`，并能创建或更新目标文件。
- 用户 root `AGENTS.md` 与非官方同名 skills 保持 byte-for-byte 不变。
- 官方同名 Reo skills 和 `.reo/REO.md` 能随当前 Reo 版本更新。
- 作品和 Widget bundle 通过 runtime validator，且实际 iframe 可运行。
- 发现的 prompt/skill 缺口被最小修复，并由 focused tests 或真实 dogfood 证据覆盖。

## 验证记录

### 真实外部写回

- Dogfood 空间：`/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/AI-ready Dogfood 2026-06-06`。
- 外部 Codex 在该空间内创建了 1 个 Memory、1 个 note Segment、1 个 note Supplement、1 个 artifact Segment、1 个 artifact Supplement 和 1 个 workspace rail Widget。
- 外部 agent 没有修改 `.reo/`、根 `AGENTS.md` 或用户自带 `skills/user-reading-coach/SKILL.md`。
- 用户文件 hash 保持不变：
  - `AGENTS.md`: `a1401aea23a8b6c58343085dfd291616efa91e1bebfeb1a17976866e71c0f38a`
  - `skills/user-reading-coach/SKILL.md`: `7690eba3174bf292bebf9831d57e0664da3d8dba0c6d5095317b128f9259dbbd`

### 发现与修复

- 发现：旧 `openWorkspaceFiles` 会信任合法但陈旧的 `.reo/index.json`，导致外部 agent 新增 Memory 后首次打开仍不可见；`readWorkspaceSnapshotFromFileTruth` 可以投影成功。
- 修复：打开 workspace 时先从当前文件真源重建 Memory read model，再用 index reconciler 持久化 `.reo/index.json`；显式 `readWorkspaceSnapshotFromIndex` 保留为缓存快读路径。
- 外部 review 发现：open 路径重建 read model 后只使用 memories，没有把外部非法候选的 needs-review entries 写入 `.reo/review/*` 或返回 `snapshot.review`。
- 修复：open 路径现在合并 Memory 和 Widget review entries，写入 needs-review report，并把 summary 放入 snapshot；新增非法 artifact 候选首次 open 回归测试。
- `verify:quick` 发现旧测试仍保护“open 使用合法 index 快读”；该断言与新文件真源 open 合同冲突。已改为验证 memories root 在 reconciliation persist 前变化时 open 失败并保留旧 index。
- 发现：复制提示词和 runtime/design skills 缺少作品展示尺寸软目标。已加入“inline preview 先展示摘要、主要控件和核心结果；复杂内容可用 sections、内部滚动、全屏或补充承载；Widget 覆盖 240px 到 520px rail”的指导。
- 发现：外部 agent 会把“未使用 file://”这类说明文字写进 runtime HTML，validator 会保守拦截。已提示不要把本机文件 URL scheme 示例、机器路径或用户名写进用户可见 runtime 文案。

### 命令验证

- `node skills/reo-generative-runtime/scripts/validate-runtime.mjs <artifact segment>`: `ok: true`
- `node skills/reo-generative-runtime/scripts/validate-runtime.mjs <artifact supplement>`: `ok: true`
- `node skills/reo-generative-runtime/scripts/validate-runtime.mjs <widget>`: `ok: true`
- `node skills/reo-doctor/scripts/reo-doctor.mjs`: `ok: true`, `issues: []`
- `openWorkspaceFiles` 真实打开 dogfood 空间后投影：1 Memory、2 Segment、2 Supplement、1 Widget。
- `npm run dev` 真实启动：`scripts/run-dev.mjs`、`electron-vite dev`、Electron app 均在运行，renderer dev server `http://localhost:5183/` 返回 HTTP 200。
- Electron 窗口截图：`.tmp/ai-ready-dogfood-screenshots/electron-dev-all-displays.png`，Reo 窗口标题、左侧导航和记忆空间列表可见。
- Chrome CDP 实际渲染检查：artifact Segment 在 360/900 宽度、artifact Supplement 在 360/900 宽度、Widget 在 240/520 宽度均 `horizontalOverflow: false`，runtime targets 无 console error，`ok: true`。
- Focused tests:
  - `workspaceFiles.test.ts`: open stale index、external Memory without manifests、managed templates、doctor repair。
  - `workspaceFiles.test.ts`: external invalid artifact candidate first open 写入 needs-review report 并返回 review summary。
  - `workspaceIpc.test.ts`: 全部 `copyNeedsReviewAgentPrompt|copyArtifactAgentPrompt|copyWidgetAgentPrompt` 路径，共 17 个用例通过。
  - `workspaceBridgeSurface.test.ts`: preload bridge 的 copy prompt channel surface 通过。
- `npm run verify:quick`: passed。包含 `typecheck:quick`、`test:main`、`test:renderer:quick`、`lint:strict`、`format:check`。

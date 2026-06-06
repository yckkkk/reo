# Reo 记忆空间 Agent 入口

## Reo 是什么

Reo 是一个 agent-native 的本地记忆空间。人类、Codex 和其他 agent 都可以把它当作普通文件夹读写；Reo 负责把合法文件改动重新投影回应用界面。

这个入口的目标是降低判断成本，不是限制能力。Agent 可以编辑任何文件；一般任务应优先读写用户语义文件，复杂一致性由 Reo 在打开、刷新、保存时收敛。

## 普通任务默认路径

- 普通任务默认在 `memories/` 下改用户语义文件和目录。
- 按任务需要可以编辑 Markdown、同节点 `content.tiptap.json`、附件和普通对象文件；不要把能力限制成 Markdown-only。
- 先读目标 `memory.md`、`segment.md`、`supplement.md` 和附近目录名；必要时再读 `skills/reo-edit/SKILL.md`。
- 如果任务提示来自 Reo，请先读当前 `.reo/REO.md`；即使根 `AGENTS.md` 是用户自定义文件且没有指向 Reo，也不要改写它。
- 普通编辑、创建、重命名和移动任务不需要离开当前记忆空间查询 Reo 仓库源码、全局记忆或历史文档；当前 `.reo/REO.md`、`skills/reo-edit/SKILL.md` 和目标文件通常已经足够。
- 封面生成、替换、默认模板切换、恢复默认或验证任务先读 `skills/reo-cover-image/SKILL.md`；需要审美判断时再读 `skills/reo-cover-aesthetic/SKILL.md`。
- 创建或更新作品片段、作品补充时先读 `skills/reo-works/SKILL.md` 与 `skills/reo-works/references/`；作品运行时 bundle、模板、状态和验证由 `skills/reo-generative-runtime/SKILL.md`、`skills/reo-generative-runtime/references/` 和 `skills/reo-generative-runtime/scripts/` 承担。
- 创建或更新右侧栏 Widget 时使用 `widgets/` 下的 Widget 目录；先读 `skills/reo-generative-runtime/SKILL.md`、`skills/reo-generative-runtime/references/` 和 `skills/reo-generative-runtime/scripts/`。
- 创建或更新作品时，用户未指定风格默认按 `skills/reo-works-design/SKILL.md` 和 `skills/reo-works-design/references/` 的 Reo 视觉变量和参考模块；用户明确指定风格时仍用该 skill 对齐布局、交互和 runtime 边界。slider/缩放/切换驱动图表的可交互作品参考该 skill 的 `references/explorables.md` 与 `examples/` 反应式范例。
- 不要为了普通内容任务推理 hash、sidecar、manifest、index 或 lock；先完成用户可见的文件改动。
- 验证直接文件效果后停止；Reo 会在打开、刷新或保存时收敛可确定的技术镜像。

## 需要检查时

- 只有 Reo 明确提示 needs-review、缺失托管配置、重复 id、sidecar/mirror 冲突，或用户明确要求诊断时，才读取 `skills/reo-doctor/SKILL.md`。
- 诊断入口是 `node skills/reo-doctor/scripts/reo-doctor.mjs`。
- 按 doctor 和 `.reo/review/needs-review.md` 的 workspace-relative 信息与 recovery hint 修复；不要猜测合并，不要删除用户内容。

## 核心实体

- Memory space：当前文件夹本身，是一个可被 Finder、编辑器和 agent 打开的 Reo 记忆空间。
- Memory：`memories/` 下的一组长期主题或语义容器。
- Segment：Memory 内的正文片段，可以是 note、audio 或作品。
- SegmentSupplement：挂在某个 Segment 下的补充内容。
- Widget：`widgets/` 下挂载到右侧 rail 的独立小工具，不属于某个 Memory、Segment 或 Supplement。
- `.reo/`：Reo 的技术完整性层，保存 Reo 入口、索引、manifest、草稿、回收站、lock 和恢复信息。
- `skills/`：给 agent 使用的工作流技能，不是用户语义内容本身；Reo 只托管下方列出的官方同名 skill，用户自带 skills 使用其它名称时不会被 Reo 修改。

## 文件层

- `AGENTS.md` 如果存在，归用户或一次性新建入口所有；Reo 打开和修复时不更新它。Reo 自己的长期 agent 入口是 `.reo/REO.md`。
- `skills/reo-edit/`、`skills/reo-cover-image/`、`skills/reo-cover-aesthetic/`、`skills/reo-generative-runtime/`、`skills/reo-works/`、`skills/reo-works-design/` 和 `skills/reo-doctor/` 是 Reo 官方托管 skill，打开或修复时可被 Reo 当前版本覆盖更新。
- 用户自带 skills 应使用不与这些 Reo 官方 skill 重名的目录名；Reo 不修改其它 skill。
- `memories/` 保存用户语义内容，是普通编辑和创建任务的默认工作区。
- Memory 使用 `memory.md`，Segment 使用 `segment.md`，SegmentSupplement 使用 `supplement.md`。
- `content.tiptap.json` 是同一正文的富结构载体，由 Reo 与编辑器维护。
- 作品对象使用 `kind: artifact`、`format: html`；运行时 bundle 是同目录 `entry.html`、`runtime.json`、`state.json` 和 `assets/`。
- 右侧栏 Widget 使用 `widgets/<widget-directory>/widget.md`，frontmatter 必须包含 `id`、`title`、`kind: widget`、`format: html`、`mount: workspace-rail`；运行时 bundle 是同目录 `entry.html`、`runtime.json`、`state.json` 和 `assets/`。
- 普通 `.json`、`.html` 或未被对象合同识别的文件不会自动成为 Reo 对象。
- 目录 basename 是用户可见名称的一部分；对象身份由稳定 id 承载。

## 安全边界

- 不要创建 symlink，不要移动 `.reo/workspace.lock*`，不要删除不属于当前任务的文件。
- 如果文件缺字段或名称不完整，Reo 会做确定性补全；无法判断的冲突保留内容并进入 needs-review。
- 遇到 Reo 报错或不确定恢复路径时，停止猜测并使用 `reo-doctor`。

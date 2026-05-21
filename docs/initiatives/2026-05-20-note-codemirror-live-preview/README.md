# Initiative — Note CodeMirror 6 Live Preview 编辑器

- 创建：2026-05-20 America/Los_Angeles
- 类型：产品/代码开发 active initiative（跨 session）
- 状态：active
- 长期决策：`docs/decisions/0007-note-editor-codemirror-live-preview.md`
- 可行性来源：`docs/archive/specs/2026-05-20-2336-note-live-preview-editor-spike/`

## 终极目标

把 Reo Note 编辑器从当前的单一 markdown-first textarea 升级为基于 CodeMirror 6 的完整笔记编辑与预览能力，包含 Obsidian 风格 Live Preview 编辑态：Markdown 字符串是唯一真源，光标所在行/块显示 raw Markdown，其它区域渲染为接近富文本的预览（标题、列表、引用、代码块、链接、图片）。

## 完成条件

全部满足才视为 initiative 完成：

1. 生产 CSP 下 CM6 运行时样式不被拦截，安全基线不放松（Stage 0）。
2. note 编辑改用 CM6（替换 textarea），实现 Obsidian 式自动保存（新建即建 segment.md、防抖 auto-write、无保存按钮、**删除** note draft/finalize 与冲突弹窗）、studio 内联编辑、点击文本区从左侧展开 Markdown 格式工具栏、三入口同一 CM6 实例、paste/drop 附件、visibilitychange 重载；真机生产 CSP 下真实 CM6 样式生效（Stage 1）。
3. Live Preview 编辑态生效：active block raw + 其它 block 预览，覆盖标题/列表/引用/代码块/链接，使用 Reo design token（Stage 2）。
4. 图片 `![alt](attachments/…)` 渲染为 `reo-attachment://` 预览 widget，paste/drop 接入现有附件保存，body markdown 真源不变（Stage 3）。
5. （可选）`MarkdownContentSurface` 只读态复用同一套 read-only decoration，达成编辑/只读视觉一致（Stage 4）。
6. 全程不引入第二语义真源，不创建 `note.md` / `notes/`，不新增 standalone 图片上传按钮，不重做 Memory Studio 页面。（注：Stage A 决定的 Markdown 格式工具栏是**已实现、功能性**的编辑面，不属于被禁止的「未实现占位 toolbar」。）

## 不在本 initiative 范围

- KaTeX / 数学、Mermaid / 图表、标题折叠、表格编辑增强（超当前范围；如需另立 spec）。
- 多模态 Segment（photo/video/imported_file/html）、widget runtime、Gallery。
- Reo runtime 内嵌 AI。

## 阶段与 spec 映射

每个 stage 是一个独立可验证 spec 工作单元（每 session 只推进一个），按 memory 约定每阶段过 subagent `/review` + `/ycksimplify`（`/simplify`），行为变更走真实 TDD。

| Stage | 工作单元 | 当前 spec |
| --- | --- | --- |
| 0 | CM6-ready style-nonce CSP 基线（前置硬阻断，无 CM6 依赖） | `docs/specs/2026-05-20-2348-cm6-style-nonce-csp-baseline/`（active） |
| A | 保存模型 + 编辑面设计决策 | **已决策**（`docs/decisions/0007` Stage A 节，2026-05-21 锁定） |
| 1 | 装 `@codemirror/*` + 按 Stage A 决策实现 CM6 编辑器（studio 内联 + stage FAB + 沉浸式展开同一实例 + 新保存模型） | 待建 |
| 2 | Live Preview decorations（active block raw + 预览） | 待建 |
| 3 | 图片 widget + 共享 `reo-attachment://` 映射 helper | 待建 |
| 4 | （可选）只读态统一 | 待建 |

里程碑进度见 `tasks.md`，阶段拆解依据见 `plan.md`。

## 新增需求（2026-05-20 补充，Stage A 已于 2026-05-21 决策）

以下需求并入本 initiative，已在 `docs/decisions/0007` Stage A 节锁定，据此定义 Stage 1+：

- **Memory Studio 正文内联编辑**：正文区点击即就地 CM6 编辑，不必先展开沉浸式态。
- **点击文本区从左侧展开 Markdown 格式工具栏**：动画上像从红色 FAB 展开，但与 FAB 功能无关；红色 FAB 保持现有 录音/笔记 speed dial 不变。
- **保存模型 = Obsidian 式全自动保存**：新建即建 `segment.md`、防抖 auto-write、无保存按钮、无 note draft/finalize 两段式。
- **外部修改 = Obsidian 式监听 + 自动重载**：去 baseline-hash 冲突弹窗；优先复用现有 visibility/focus re-read，live `fs.watch` 为可选后续（需另行设计 electron/flow/data）。
- **三编辑入口同一 CM6 实例**（studio 内联 / 沉浸式展开 / 格式工具栏）。

排序：Stage 0（CSP nonce）不受影响、保持可直接执行；**Stage 1 spec 在 Stage 0 收口后创建**（遵守「同一时间只有一个 active spec」），并据 0007 Stage A 节细化保存模型与编辑面。

## 收口硬门槛：subagent /review + /ycksimplify

- **每个实现 stage 收口前，必须让执行代码任务的 AI 运行 subagent 进行 `/review` 与 `/ycksimplify`（`/simplify`）并处理其发现**，否则不得标记 stage 完成。这是硬门槛，不是可选项（见 memory `phase-gate-review-simplify`）。
- 每个 spec 的执行步骤与验收必须显式列出该 `/review` + `/ycksimplify`（`/simplify`）步骤。

## 关键约束提醒

- 必须先完成 Stage 0；未解决生产 CSP nonce 不得安装 CM6 或进入编辑器实现（CM6 在 dev 因 `unsafe-inline` 可运行，会掩盖生产拦截）。
- `@codemirror/*` 依赖只能在 Stage 1 实现时安装（Reo「实现对应能力才装包」纪律）。
- 每个 stage 收口时把仍有效的长期事实压回 `docs/current/*`，证据移入 `docs/archive/specs/*`，并更新本 initiative `tasks.md`。

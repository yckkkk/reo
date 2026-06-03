# Spec：Agent-created Works First Slice

创建：2026-06-03 06:30 America/Los_Angeles
状态：已完成；归档为 M1 first slice 执行证据
所属 initiative：`docs/initiatives/2026-06-03-agent-created-works/`

## 意图

记录 Reo 的第一个 agent-created 作品切片：产品命名、实体落点、prompt-bridge 创建/更新语义、静态 HTML 沙箱边界、文件合同、实施顺序，以及 Reo 管理的生成 skill。

## 背景

用户想在录音、笔记之外新增第三类片段。最初说法是 `html`，但真实产品含义不是文件格式，而是 agent 基于 Memory 数据生成的视觉/交互产物：报告、复盘、教学反馈、复习表快照、原型、dashboard、创意页面，或其他由 agent 发挥的表达。

同时，用户指出“一个静态 HTML 不能解决会随记忆曲线更新的小 app”。因此本 spec 区分两个生命周期：

- **作品**：阶段性产物，由外部 agent 创建或更新，落在 Segment / SegmentSupplement。
- **Widget / 小应用**：长期数据绑定工具，由未来 host data bridge 驱动，作为 Workspace / Memory sibling。

## 已对齐决策

- 用户可见名：`作品`。
- Durable 产品类型：`artifact`。
- 首个渲染格式：`html`。
- 首个 runtime 深度：静态沙箱预览。
- FAB 入口：`作品`，作用域是当前 Memory。
- 补充入口：内容 tab rail 补充菜单增加 `作品补充`，作用域是 selected Segment。
- 创建语义：Reo 只复制 prompt；不弹意图输入框，不创建空对象。
- 更新语义：已有作品 More action 复制“让 Agent 更新作品”的 prompt。
- skill owner：Reo 管理的记忆空间 skill，不是硬编码长 prompt。
- skill flow：brief / grill -> 三个方向 -> 用户选择 -> 生成文件。
- 内部生成式 UI 源材料已直接复制改写为 Reo-native 作品 skill 群，吸收 prompt、模块、模板、token 系统和 complexity budget。
- 最终安装到记忆空间的 skills 不暴露外部来源，也不要求用户的 agent 再去参考外部项目。

## 首个切片产品合同

作品片段出现在当前 Memory 的 Segment 列表中，和录音、笔记同级。作品补充出现在 selected Segment 的内容 tab rail 中。

首个切片只通过外部 agent 创建和更新：

1. 用户点击 `作品` 或 `作品补充`。
2. Reo 让 main 复制一个带目标上下文的 prompt 到剪贴板。
3. 用户把 prompt 粘贴给 Codex / Claude 类外部 agent。
4. agent 读取 Reo 管理的 `reo-works` 与 `reo-works-design` skills。
5. skill 在需求不明确时先 grill；否则提出三个方向并等待用户选择。
6. agent 按文件合同写入作品。
7. Reo 通过文件真源刷新和 watcher 投影作品。

## 文件合同

作品 Segment 节点位于 `memories/<memory>/segments/<segmentDirectory>/`：

```text
segments/<segmentDirectory>/
  segment.md          # frontmatter: id, kind: artifact, format: html, title
  segment.html        # 渲染入口，完整 HTML 文档
  <assets...>         # 可选 sibling 资产，只读服务，不是独立 Reo 对象
```

作品 SegmentSupplement 同形：

```text
supplements/<supplementDirectory>/
  supplement.md       # frontmatter: id, kind: artifact, format: html, title
  supplement.html     # 渲染入口，完整 HTML 文档
  <assets...>         # 可选 sibling 资产
```

合同要点：

- `html` 不作为用户可见类型名，也不作为 durable 产品类型；它只写在 `format`。
- payload 一致性 = 入口 HTML 文件存在、可读、位于节点目录内。
- sibling 资产只属于该作品目录，由只读协议服务；不进入 `.reo/index.json`，不是独立对象，不单独 GC。
- manifest 由 Reo 确定性收敛，镜像 `kind: artifact`、`format: html`、入口 bytes/hash 等技术字段；agent 不写 `.reo/objects`。
- 字段级当前合同见 `docs/current/data.md` 和 `docs/current/flow.md`。

## 创建与更新 Prompt-bridge

- FAB 第三个 action：`作品`，写当前 Memory 顶层。
- 内容 tab rail 补充菜单：`作品补充`，写 selected Segment。
- 点击后通过窄 IPC 让 main 构造 prompt 并写系统剪贴板；renderer 不持有完整 prompt 文本、raw path 或可读文件列表。
- toast：提示用户 prompt 已复制，可粘贴给 agent。
- 无弹层、无占位对象；作品只有在 agent 写入文件并被 Reo 文件真源投影后出现。
- 已有作品 More action 提供“让 Agent 更新作品”，prompt 应带上当前作品 identity、相对位置、文件合同和更新约束。

## 渲染与沙箱

首个切片只支持 isolated read-only preview。

允许：

- 外部 agent 生成的完整 HTML / CSS / JS。
- 作品内部局部 DOM 交互。
- inline SVG、Canvas 和小型本地 sibling 资产。
- 内容区内联预览和全屏查看。

不允许：

- Reo 数据 API。
- `postMessage` command bridge。
- host RPC。
- 网络、CDN、analytics、tracking pixel。
- localStorage、cookies、持久化 app state。
- 文件系统、IPC、Node 或 Electron API。
- 内嵌 AI 或计划任务。

实现首选：

- main 注册只读 `reo-artifact://` 协议，按显式 workspace/entity identity 服务入口 HTML、同目录 sibling 资产和 Reo-managed `_vendor/*`。
- handler no-follow 读取，拒绝越界、symlink、raw path、非 GET 和非 active workspace。
- renderer 使用 `<iframe sandbox="allow-scripts">`；不加 `allow-same-origin`、`allow-top-navigation`、`allow-popups`。
- CSP 由协议 handler 统一下发：`default-src 'none'`、`connect-src 'none'`，脚本/样式/图片/字体只允许 inline、data 或 `reo-artifact:` 的必要子集。
- 作品文件重写后，watcher 触发内容重新投影或重载 iframe。

## Skill 草案

Reo-managed skill 草案已迁移为记忆空间托管 `skills/reo-works/SKILL.md` 与 `skills/reo-works-design/SKILL.md`。

skill 必须吸收三类方法：

- `$grill-me`：在需求不明确或方向冲突时，一次只问一个关键问题。
- Product Design brief：先确认产品目标、受众、交互密度和视觉方向，再生成。
- 内部生成式 UI 源材料：直接复制改写 prompt、模板、token 系统、complexity budget 和设计规则，落到 Reo 的作品模型、本地文件真源和静态沙箱约束。

## Success Criteria

- 后续实现不再把用户可见名从 `html` 改成别的；唯一用户可见名是 `作品`。
- 文件合同以 `artifact + format: html` 为 durable 模型。
- 静态作品和 Widget 的生命周期边界清楚，M1 不引入活数据桥。
- M1 实施计划覆盖安全协议、sandbox attrs、recognition、prompt-copy IPC、UI surface 和 visual verification。
- 作品 skill 群草案足够让外部 agent 创建有用作品，而不是只生成空壳 HTML。

## Non-goals

- 本 spec 不实现 Widget、Gallery、自动生成、内嵌 AI 或 scheduled regeneration。
- 本 spec 不放松 Electron sandbox、contextIsolation、nodeIntegration、CSP、permission 或 navigation 边界。

## 验证方式

M1 实施命中 Electron 安全、文件合同、recognition、IPC/prompt 边界，必须执行真实 TDD：

- RED 阶段必须先真实运行并失败。
- 断言面向安全/文件/外部行为，不绑定无意义 DOM class。
- GREEN 后再做 focused tests、运行时视觉验证和最终 `npm run verify:quick`。

具体实施拆分见 `plan.md`；执行证据写入 `implementation-notes.md`。

## 关联

- initiative：`docs/initiatives/2026-06-03-agent-created-works/`
- implementation plan：`plan.md`
- research：`research.md`
- skill draft：`reo-artifact-skill-draft.md`（已迁移为 `reo-works` / `reo-works-design`）
- ADR：`docs/decisions/0006-agent-native-carrier-and-generative-ui.md`、`0002-electron-build-and-security-baseline.md`、`0003-local-memory-workspace.md`
- current：`docs/current/product.md`、`data.md`、`flow.md`、`electron.md`、`frontend.md`、`roadmap.md`

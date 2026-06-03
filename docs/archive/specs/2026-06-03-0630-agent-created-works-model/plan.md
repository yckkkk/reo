# Plan：Agent-created Works First Slice

分阶段执行，一次推进一个阶段。每个阶段进入下一阶段前必须有 focused 验证；高风险安全、文件、识别、IPC 边界先写会真实失败的 RED，再 GREEN。

## Phase 0 - 设计融合

- 融合两套 AI 草稿。
- 保留 `agent-created-works` 为唯一 active initiative。
- 保留本 spec 为唯一 active spec。
- 修正命名：用户面 `作品`，durable 产品类型 `artifact`，首个 `format: html`。
- 吸收沙箱 preview、`reo-artifact://`、文件识别、prompt-bridge、visual verification 和 TDD 计划。

完成门槛：initiative index 只指向 `2026-06-03-agent-created-works`，并行草稿被删除。

## Phase 1 - 文件合同与 Recognition

- `src/workspace-contract`：扩展 Segment / SegmentSupplement discriminated union，加入 `artifact` variant 和 `format: html`。
- 扩展 review report 类型、snapshot summary、Memory detail projection 和 renderer type guard，避免 `audio | note` 字面量散落成漏改点。
- Memory summary 新增 `artifactSegmentCount`；`hasAnyNote` 仍只表示 note，不把 artifact 当 note；如 UI 需要作品 presence，新增显式 `hasAnyArtifact` 或只读 count。
- Segment projection 新增 artifact variant：`type: 'artifact'`、`format: 'html'`、`entryByteLength`、`entryHash`、`previewVersion`、`contentTitle?`、`cover?`、`supplements`、`contentTabOrder?`。
- SegmentSupplement projection 新增 artifact variant：`type: 'artifact'`、`format: 'html'`、`entryByteLength`、`entryHash`、`previewVersion`。
- main finalized read model 与浅层候选识别接受合法作品对象。
- payload 一致性：入口 `segment.html` / `supplement.html` 存在、可读、位于节点目录内。
- manifest 由 Reo 收敛，镜像 `kind: artifact`、`format: html`、入口 bytes/hash。
- duplicate id、缺入口、unsafe path、混合对象形态进入 needs-review 或被拒绝，不进入正常投影。
- 跨父级移动修复复用现有身份和 parent mirror 规则。

TDD target：

- 合法作品识别。
- 缺入口拒绝。
- duplicate / unsafe 进入 needs-review。
- 跨父级移动修复不破坏 parent mirror。

## Phase 2 - 隔离预览能力

- main 注册只读 `reo-artifact://` 协议候选，参照但不混用 `reo-attachment://`。
- 协议按 active workspace handle、entity identity 和 containment 服务入口 HTML、同目录 sibling 资产和 `_vendor/*`。
- no-follow 读取；拒绝 symlink、越界、raw path、非 GET、非 active workspace。
- 为入口 HTML 与 sibling 资产设置安全 byte cap，防止 agent 写入超大文件导致 main process 一次性读爆内存；这不是作品轻量的产品门禁，是协议读取安全边界。
- URL shape 不暴露 absolute path：
  - Segment entry：`reo-artifact://<workspaceId>/segments/<segmentId>/segment.html?v=<entryHash>`
  - Segment sibling：`reo-artifact://<workspaceId>/segments/<segmentId>/<assetRelativePath>?v=<entryHash>`
  - Supplement entry：`reo-artifact://<workspaceId>/segments/<segmentId>/supplements/<supplementId>/supplement.html?v=<entryHash>`
  - Supplement sibling：`reo-artifact://<workspaceId>/segments/<segmentId>/supplements/<supplementId>/<assetRelativePath>?v=<entryHash>`
  - Vendor：`reo-artifact://<workspaceId>/_vendor/<package>/<file>?v=<appVersionOrVendorHash>`
- MIME allowlist：`text/html`、`text/css`、`text/javascript`、`application/javascript`、`image/svg+xml`、`image/png`、`image/jpeg`、`image/webp`、`image/gif`、`font/woff`、`font/woff2`。其它类型返回 404。
- Cache policy：user artifact entry 和 sibling assets 使用 `Cache-Control: no-store`；Reo-managed `_vendor/*` 可使用 immutable versioned cache。
- Artifact response CSP 精确写死：`default-src 'none'; script-src 'unsafe-inline' reo-artifact:; style-src 'unsafe-inline' reo-artifact:; img-src reo-artifact: data: blob:; font-src reo-artifact:; media-src reo-artifact: data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'`。
- app shell CSP 同步允许 `<iframe src="reo-artifact://...">`：production/dev `frame-src` 必须加入 `reo-artifact:`，但 `connect-src` 仍不得加入该 scheme。
- renderer 新增作品 preview primitive：`<iframe sandbox="allow-scripts">`，无 `allow-same-origin`、无 top navigation、无 popups。
- opaque sandbox 不能让 parent 读取 iframe DOM 高度；inline 预览必须使用稳定 viewport，填充当前内容编辑框区域，expanded 预览填充 `ImmersiveWorkspaceSurface`。不要设计依赖内容自动测高的方案。

TDD target：

- 协议越界、symlink、raw path 拒绝。
- 超过 byte cap 的入口或资产被拒绝，返回可诊断失败态。
- CSP 头正确。
- app shell CSP 只把 `reo-artifact:` 放入 `frame-src`，不放入 `connect-src`。
- MIME allowlist、cache policy 和 URL shape 精确。
- 外联请求被阻断。
- iframe sandbox attributes 正确。

## Phase 3 - 渲染 Surface

- 作品 Segment 主内容 tab 内联渲染 iframe。
- 作品 Supplement 在 selected Segment 的内容 tab rail 中渲染。
- 默认 tab label 为 `作品`，可按现有内容标题机制重命名。
- 全屏查看复用现有沉浸式内容 surface；同一作品 URL 放大渲染。
- Segment card 和 tab glyph 使用 Reo 现有图标系统，首选 lucide `AppWindow`。
- 空、失败、加载状态符合 Memory Studio craft 门槛。
- preview container 不套卡片；它占用当前文本编辑框区域，expanded 占用同一沉浸式 surface。
- iframe `src` 或 React `key` 使用 `previewVersion` / `entryHash`，外部 agent 重写 `segment.html` 或 `supplement.html` 后必须重新加载，不依赖 TanStack Query 持有 HTML bytes。

验证：

- targeted component / typecheck。
- 运行时视觉验证：内容区、全屏、浅色/深色、失败态截图或测量证据写入 `implementation-notes.md`。

## Phase 4 - 作品 Skill 群

- 将 `reo-artifact-skill-draft.md` 整理成记忆空间作品 skill 群；最终落地为 `skills/reo-works/` 与 `skills/reo-works-design/`。
- 打开/刷新时静默 upsert，保留用户自定义；同时更新 `AGENTS.md` managed block，让 agent 能从 Reo 入口发现作品 skill 群。
- `reo-doctor` repair 路径同步理解作品 skill 群：缺失 managed skill、缺失 scripts 或 AGENTS managed block 漂移时能报告并修复。
- split skills 如果启用，必须作为 first-class managed paths 出现在 initialize/open/upsert/test 合同中，不做散落文件。
- 直接复制改写内部生成式 UI 基线的 prompt、模块、模板、token 系统、complexity budget 和设计规则，形成 Reo 自有 skill 内容。
- skill 群必须嵌入具体 token reference：CSS variables、semantic states、radius scale、typography、color ramps/classes、SVG text classes、light/dark 映射。
- 最终写入记忆空间的 skills 不提外部项目，不要求用户 agent 再去读 GitHub；用户只看到 Reo 自己的作品生成能力。
- 加入 grill / Product Design brief / 三方向生成 workflow。
- 不复制 CDN、外部窗口、streaming runtime、DOM diff runtime、RPC 或外联能力；Chart.js 等库如需支持，只通过 Reo 本地 `_vendor/*` 和 `reo-artifact://` 提供。

验证：

- upsert 行为不覆盖用户修改。
- initialize/open 会创建或更新完整 skill 群与 AGENTS managed block。
- `reo-doctor` repair 能恢复缺失 managed skill 文件。
- 最终 skill 文本不包含外部项目 URL、GitHub 入口或“去参考外部项目”的指令。
- 外部 agent 按 skill 能写出符合合同的作品样例。

## Phase 5 - 创建与更新 Prompt-bridge

- `ExpressionDock` FAB 增加 `作品` action。
- 内容 tab rail 补充菜单增加 `作品补充`。
- main 构造 prompt 并写剪贴板；renderer 只触发 command，不持有完整 prompt 文本或 raw path。
- prompt 包含：target identity、workspace-relative location、文件合同、安全约束、可读取的数据指针、作品 skill 群入口。
- toast 反馈复制成功。
- 已有作品 More action 增加“让 Agent 更新作品”。
- 不创建占位对象。

TDD target：

- renderer 不接触 prompt 文本或 raw path。
- 创建入口只复制 prompt，不写 durable object。
- update prompt 带正确作品 identity 和 relative location。

## Phase 6 - 收口

- craft 门槛复核。
- 运行时视觉验证证据齐全。
- `npm start` 运行时验证 production preview 下的协议、CSP、navigation 和 iframe 渲染。
- `npm run verify:quick` 跑一次。
- 长期事实压回：
  - `docs/current/data.md`：文件合同、manifest mirror、query/projection。
  - `docs/current/flow.md`：watcher/recognition/创建更新时序。
  - `docs/current/electron.md`：协议、CSP、navigation 边界。
  - `docs/current/frontend.md`：FAB、tab rail、preview/fullscreen surface。
  - `docs/current/product.md`：已实现表达类型。
- 如新增长期安全或产品边界，写入 `docs/decisions/*`。
- 任务证据移入 `docs/archive/specs/*`。
- 更新 initiative `tasks.md`。

## E2E 验证拆分

不得一次性写大而空的 E2E。按状态机拆小场景：

- 创建复制 prompt。
- 外部 agent 写文件后 watcher 投影。
- 沙箱渲染。
- 外联被阻断。
- 全屏查看。
- 更新 prompt。
- 重命名、删除、恢复。
- 跨父级移动修复。

## Implementation Flow

```text
create prompt
─────────────
FAB / supplement menu
  -> renderer command with workspaceHandle + target identity only
  -> main validates IPC sender and active workspace
  -> main builds scoped prompt from file truth
  -> clipboard.writeText(prompt)
  -> toast copied

agent writes files
──────────────────
segment.md / supplement.md
  + segment.html / supplement.html
  + optional sibling assets
  -> watcher / snapshot refresh
  -> candidate scan
  -> manifest converge
  -> Memory detail projection

preview
───────
MemoryStudio selected content slot
  -> ArtifactPreview iframe
  -> app shell CSP frame-src reo-artifact:
  -> reo-artifact:// handler
  -> node directory containment + no-follow + byte cap
  -> artifact CSP default-src none / connect-src none
```

## Codepath Coverage Target

```text
CODE PATHS
==========
[GAP] workspace-contract projection schemas
  ├── segment artifact projection
  └── supplement artifact projection

[GAP] memoryFiles candidate scan
  ├── valid artifact + html entry -> manifest converge
  ├── missing html entry -> needs-review / rejected projection
  ├── duplicate id -> needs-review
  ├── unsafe path / symlink -> rejected
  └── moved directory -> parent mirror repair

[GAP] appProtocol artifact handler
  ├── valid entry html
  ├── valid sibling asset
  ├── _vendor asset
  ├── non-GET
  ├── inactive workspace
  ├── traversal / raw path / symlink
  ├── byte cap exceeded
  └── CSP headers

[GAP] securityPolicy app shell CSP
  ├── frame-src includes reo-artifact:
  └── connect-src excludes reo-artifact:

[GAP] renderer preview
  ├── iframe sandbox allow-scripts only
  ├── stable inline viewport
  ├── expanded viewport
  ├── loading / error states
  └── tab / card icon projection

[GAP] prompt bridge
  ├── create segment work prompt
  ├── create supplement work prompt
  ├── update existing work prompt
  ├── renderer never receives prompt text
  └── no placeholder object is created

[GAP] managed skill upsert
  ├── skill group files created or updated
  ├── AGENTS.md managed block routes to skill group
  ├── user custom content preserved
  └── final skills contain no external source references
```

## GSTACK REVIEW REPORT

| Review        | Trigger               | Runs | Status  | Findings                                                                                 |
| ------------- | --------------------- | ---: | ------- | ---------------------------------------------------------------------------------------- |
| Eng Review    | `$plan-eng-review`    |    1 | CLEARED | Subagent outside voice returned `READY_WITH_PATCHES`; all plan-level P1 patches applied. |
| CEO Review    | `$plan-ceo-review`    |    0 | NOT RUN | Not requested.                                                                           |
| Codex Review  | `$codex review`       |    0 | NOT RUN | Not requested.                                                                           |
| Design Review | `$plan-design-review` |    0 | NOT RUN | Not requested.                                                                           |
| DX Review     | `$plan-devex-review`  |    0 | NOT RUN | Not requested.                                                                           |

Applied eng-review patches:

- Embedded Reo-owned artifact skill group direction, including direct prompt/template/module/token rewrite and no final external-source references.
- Made artifact projection ownership explicit: summary counters, `hasAnyNote` boundary, entry hash/version and reload invalidation.
- Made protocol boundary concrete: URL shape, MIME allowlist, cache policy, byte caps, artifact CSP, app-shell `frame-src`, iframe sandbox and opaque-height constraint.
- Added managed skill upsert, AGENTS managed block, `reo-doctor` repair and first-class split-skill path coverage.

Verdict: ready to begin implementation at Phase 1. No unresolved architecture blockers remain in this plan.

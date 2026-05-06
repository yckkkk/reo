# 审查

状态：`$writing-plans` 和 `$plan-eng-review` 已通过，未发现未解决 BLOCKER/MAJOR。

## 自审

- 计划已拆为 7 个实现切片。
- 每个切片都有独立 spec、RED/GREEN/REFACTOR、验证命令、current 文档更新和提交。
- 计划没有授权在 `main` 上直接实现。
- 计划没有引入 DB、auth、updater、logging、Sentry、Vaul、wavesurfer.js 或未来能力 UI。
- shadcn/ui 只在存在精确 primitive、consumer、invariant 和测试时激活。

## 外部审查

### Subagent 初审

结论：失败，发现 2 个 BLOCKER、4 个 MAJOR。

已处理：

- `plan.md` 已写明进入实现前必须先通过 `$plan-eng-review`，且 `review.md` 无未解决 BLOCKER/MAJOR。
- `plan.md` 已补齐每切片 spec 必答项：DB schema、表关系、数据获取模式、可复用组件、文件夹结构、错误处理 gate、TDD 输出和验证证据。
- `plan.md` 已补齐 selection token 单次消费、过期、sender 绑定、`initializeWorkspace/openWorkspace` contract、handle revocation、cross-window reuse、lock lost 和 schema mismatch invalidation 测试。
- `plan.md` 已补齐涉及 CSP、protocol、navigation、permission baseline 时必须运行 `npm start`，并记录 production URL、CSP header、新窗口拒绝、外部导航拒绝和权限默认拒绝。
- `plan.md` 已补齐 shadcn 初始化同批 renderer alias、`tsconfig.json` 和 `electron.vite.config.ts` 配置要求。
- `plan.md` 已补齐每个实现切片的预期 RED/GREEN/REFACTOR 输出要求。

### Subagent 复审

结论：失败，未发现 BLOCKER，发现 3 个 MAJOR。

已处理：

- `chooseDirectory` 响应已改回 design-hardening 的 `selectionToken` + `displayPath`，不加入 `canCreateWorkspace`。
- Preload 要求已明确禁止运行时占位方法，后续方法必须同步 contract、handler、preload、renderer wrapper 和测试后才能暴露。
- IMPL-006 的 RED/GREEN 输出已拆成 renderer 和 main 两条命令，避免 `&&` 在 renderer 失败后短路 main/CSP 测试。

### Subagent 第二次复审

结论：失败，未发现 BLOCKER，发现 1 个 MAJOR。

已处理：

- IMPL-003 已把后续产品方法的 preload bridge、renderer global type、renderer API wrapper 和 bridge surface test 纳入同切片文件责任、RED 测试、实现步骤和 GREEN 输出。
- IMPL-003 已明确只暴露已有 matching handler、contract 和测试的方法，不允许后续切片临时补 preload surface。

### Subagent 第三次复审

结论：失败，未发现 BLOCKER，发现 1 个 MAJOR。

已处理：

- IMPL-003 已把 renderer global type 和 renderer API wrapper 的验证移入 renderer test/typecheck 路径，新增 `workspaceApi.test.ts`，并要求同时运行 `npm run test:main` 和 `npm run test:renderer`。
- IMPL-003 的 RED/GREEN/REFACTOR 输出已拆为 main 与 renderer 两组，避免 main test 伪覆盖 renderer 暴露面。

### Subagent 第四次复审

结论：通过，未发现 BLOCKER 或 MAJOR。

确认点：

- IMPL-003 已通过 main + renderer 双测试路径覆盖 preload/type/API 暴露面。
- Preload bridge 运行时暴露面由 main 路径覆盖。
- Renderer global type、API wrapper 和 query key ownership 由 renderer test/typecheck 路径覆盖。
- TDD 输出已拆为 `npm run test:main` 与 `npm run test:renderer` 双路径。

### Codex CLI 初审

结论：失败。有效问题已处理；“当前尚未通过 `$plan-eng-review`”属于阶段状态，不作为计划缺陷。

已处理：

- 进入 IMPL-001 前必须归档已完成 design-hardening spec 和 implementation-plan spec，使 `docs/specs/*` 为空。
- IMPL-002 首个 preload surface 已加入同切片 `workspaceBridgeSurface.test.ts` 和 preload test tsconfig 约束。
- IMPL-003 已加入 main 侧 audio manifest/chunk read、full-file refusal、malicious metadata 和 missing audio 测试。
- IMPL-007 Codex CLI 命令已补齐 quiescent/closed 前置、`codex --version`、`codex exec --help`、`--skip-git-repo-check` 和 `--ephemeral`。

### Claude CLI 初审

结论：失败。4 个 MAJOR 已处理。

已处理：

- IMPL-005 已把 `vitest.config.ts` 加入 renderer alias 同批配置。
- IMPL-002 renderer import boundary 已由 `eslint.config.js` 和 `rendererImportBoundary.test.ts` 承接。
- 全局执行规则已写明 active initiative 路径和 spec lifecycle start gate。
- IMPL-007 已增加 Codex CLI 版本、flag 兼容和不可用时不得声明通过的前置检查。

### 窄复审

- Subagent：失败 1 次后通过。最后修复为 IMPL-003 增补 `workspaceContract.test.ts` 和 `workspaceIpc.test.ts` 文件责任与预期输出。
- Codex CLI：通过，未发现 BLOCKER/MAJOR。
- Claude CLI：失败 1 次后通过。最后修复为把 `initializeWorkspace`、`openWorkspace`、`closeWorkspace` contract RED 从 IMPL-002 移到 IMPL-003。

### `$plan-eng-review`

结论：通过，未发现未解决 BLOCKER/MAJOR。

## 工程审查摘要

### 范围挑战

- 已有代码只提供 Electron shell、security baseline、custom protocol、renderer placeholder 和 main test runner；计划复用这些入口，不新建 generic runtime。
- 计划触及多个模块，但已拆为 7 个顺序切片，每片独立 spec、TDD、验证、current docs 和 commit；不适合再压缩成一个实现提交。
- DB、auth、updater、logging、Sentry、packaging、Vaul、wavesurfer.js、STT、未来 photo/video/file/film 能力均不在当前实现范围。

### 架构审查

- Renderer -> preload -> IPC -> main -> workspace folder truth 的边界明确。
- Selection token、workspace handle、sender validation、lock、path containment 和 typed error envelope 均有测试 owner。
- Spec lifecycle gate 已补齐：进入实现前归档已完成 plan/design specs，后续每片创建 spec 前确认 `docs/specs/*` 为空。

### 测试审查

- Main/preload 路径覆盖 contract、sender、selection token、preload surface、filesystem、handle、lock、draft、audio read 和 IPC handler。
- Renderer 路径覆盖 App、form/query、workspace API wrapper、home UI、recording overlay、media adapter、autosave、playback、accessibility。
- Runtime 路径覆盖 `npm start`、Computer Use、reference evidence、Codex CLI read-only validation 和 hash before/after。

### 性能与可靠性

- Audio chunk 上限、1 个 in-flight append、60 min/120 MiB cap、manifest+chunk playback 和 Blob revoke 均在计划中有测试。
- Workspace write 使用 single-writer lock、atomic temp/rename/fsync、schema mismatch invalidation 和 stale lock recovery。
- TanStack Query 只缓存 main-backed snapshot 和 detail，不拥有 recording lifecycle、chunk sequence、editor draft 或 Blob URL。

### 不在范围内

- 不引入 DB/Drizzle、auth、updater、logging/Sentry、packaging。
- 不引入 Vaul、wavesurfer.js、STT 或 ElevenLabs 全量组件。
- 不实现 photo、video、file、film、search、tag、sharing、sync。
- 不创建 generic IPC bridge、generic service layer、generic runtime 或 repository layer。

### 并行策略

该计划需要顺序执行。IMPL-001 到 IMPL-007 存在明确依赖链，且后续切片共享 preload、workspace API、renderer state 和 current docs；实现阶段不应并行拆 worktree。

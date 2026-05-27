# 执行清单

## Phase 0 — 文档生命周期

- [x] 读取 `AGENTS.md`、README、docs/current 真源和现有 toast spec。
- [x] 用 `request_user_input` 对齐 active spec 承接方式。
- [x] 归档已完成的 `docs/specs/2026-05-27-0604-toast-unified-api`。
- [x] 创建本轮 active spec。

## Phase 1 — 状态与 toast 合同测试

- [x] `toaster.test.tsx`：为 `reo-doctor` toast 写 focused RED。
  - action label 是「复制」。
  - copy icon 在 action 右侧，尺寸是 16px。
  - copy 成功状态显示「已复制」和 16px Check icon。
  - close button 统一在右上角。
  - 不复用 undo progress bar。
  - toast class/variant 可被稳定识别。
- [x] `toaster.test.tsx`：修正 Undo action 顺序的 RED。
  - 「恢复」文字在左。
  - Undo icon 在右，尺寸是 16px。
  - close button 统一在右上角。
  - 既有 `reo-undo-toast`、duration、`onAutoClose` 和 action click 语义不变。
- [x] 纯 helper 测试：review toast 状态从 Workspace snapshot 派生。
  - clean snapshot 不请求显示。
  - `needsReviewCount > 0` 请求显示。
  - 同一 workspace session 的同一 unresolved 状态不重复堆叠 toast。
  - clean refresh 请求 dismiss。

Evidence:

- `npm run test:renderer -- src/renderer/src/components/ui/toaster.test.tsx`
- `npm run test:renderer -- src/renderer/src/workspace/workspaceReviewToast.test.tsx`

## Phase 2 — UI 投影小场景

- [x] Renderer 小场景：初始 snapshot 带 `review.needsReviewCount=1` 时显示 needs-review toast，不显示旧 top-center overlay。
- [x] Renderer 小场景：file truth refresh 后 count 从 0 变 1，显示同一个 needs-review toast。
- [x] Renderer 小场景：refresh 后 `review` 清空，dismiss review toast。
- [x] Renderer 小场景：copy action 走窄 workspace bridge；main-owned prompt 写入剪贴板。
  - prompt 包含 `node skills/reo-doctor/scripts/reo-doctor.mjs`。
  - prompt 不包含 absolute path、report entry、hash、workspace handle 或 selection token。
  - 成功后同一 toast action 临时显示「已复制」和 Check icon。
- [x] Renderer 小场景：clipboard/IPC 失败时只显示普通 error toast，不 fallback 到路径或 report 内容。

Evidence:

- `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "needs-review prompt|safe copy failure|needs-review counts"`
- `npm run test:renderer -- src/renderer/src/App.test.tsx --testNamePattern "needs-review toast"`
- `MAIN_TEST_FILES=workspaceIpc.test.ts npm run test:main -- --test-name-pattern "copyNeedsReviewAgentPrompt"`

## Phase 3 — 安全与合同回归

- [x] Workspace contract / schema targeted test：snapshot `review` 仍只有 aggregate counts，不增加 entries 或 paths。
- [x] Workspace contract / schema targeted test：`copyNeedsReviewAgentPrompt` request 拒绝 renderer-provided prompt、report path 或 raw path。
- [x] Preload/bridge surface targeted test：不新增 generic IPC、generic file open 或 raw path bridge。
- [x] Main targeted test：needs-review report 和 `reo-doctor` 输出仍只使用 workspace-relative paths。
- [x] Diagnostic targeted check：新增错误路径只返回 typed error；copy handler 不接收或记录 root path、file path、title、正文、frontmatter、hash 或 secret。

Evidence:

- `MAIN_TEST_FILES=workspaceContract.test.ts npm run test:main -- --test-name-pattern "needs-review prompt|copyNeedsReviewAgentPrompt|IPC channels include"`
- `MAIN_TEST_FILES=workspaceBridgeSurface.test.ts npm run test:main -- --test-name-pattern "preload bridge"`
- `MAIN_TEST_FILES=workspaceFiles.test.ts npm run test:main -- --test-name-pattern "needs-review|reo-doctor"`

## Phase 4 — 运行时与视觉验证

- [x] 按用户纠偏，本轮不继续优化 Figma；运行时重点收敛到 Reo 自动化测试。
- [x] Toast 视觉合同由 `toaster.test.tsx` 覆盖：action 文本在左、16px icon 在右、close button 右上角且无填充底色。
- [x] Needs-review runtime 行为由 renderer 集成测试和 main IPC 测试覆盖：toast 通过 root host 出现、copy action 写入 main-owned 安全 prompt、clean refresh dismiss。

## Phase 5 — 收口验证

- [x] Targeted renderer tests：
  - `npm run test:renderer -- src/renderer/src/components/ui/toaster.test.tsx`
  - `npm run test:renderer -- src/renderer/src/App.test.tsx`
- [x] Targeted main tests：
  - `MAIN_TEST_FILES=workspaceFiles.test.ts npm run test:main -- --test-name-pattern "needs-review|reo-doctor"`
  - `MAIN_TEST_FILES=workspaceIpc.test.ts npm run test:main -- --test-name-pattern "Workspace snapshot|readWorkspaceSnapshot"`
- [x] `npm run typecheck:quick`
- [x] `npm run lint:strict`
- [x] `npm run format:check`
- [x] 提交前运行 `npm run verify:quick`。

## 拆分原则

- 不写一个覆盖全部恢复链路的大 E2E。
- 每个小场景只断言一个关键转移或副作用：toast 出现、toast 消失、copy prompt、安全边界、doctor 输出、Undo action 布局。
- 若 E2E 暴露高风险分支，先抽成 focused failing test，再实现。

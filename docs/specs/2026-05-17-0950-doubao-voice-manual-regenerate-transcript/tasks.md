# 任务

本任务清单是 D 实施 session 的直接消费入口。本 session 不执行 D 代码；下面所有 `[ ]` 都属于实施 session 的执行项。

## 入口契约

- 实施 session 启动时必须先确认：
  - `docs/specs/` 只包含本 D spec（或为空时立即在 09:50 slug 基础上更新时间戳并恢复 spec）。
  - C 已归档；B 已归档；C→D readiness gate 已执行。
  - 当前 git working tree 干净或仅含本 spec 与 initiative docs 修改。
  - 已读取 spec README / goal / plan / verification 与 d-brief、ADR 0005、C 归档 spec。
- 实施 session 必须使用 subagent-driven-development 推进 implementer / spec reviewer / code-quality reviewer 流程；分多个 task 多个 subagent，每 task 严格按 TDD（RED → GREEN → REFACTOR）执行。
- 实施 session 不在 `docs/current/*` 写入前完成 ad-hoc rewrites；docs 同步与代码改动同批落盘并同批运行 `npm run verify:quick`。

## TDD 阶段

每个阶段的 RED 必须先真实运行并失败，输出失败证据；GREEN 写最小实现；REFACTOR 后必须重跑 protect 该行为的 targeted tests。纯文档或机械配置可豁免，但需在本 tasks.md 内显式标注理由。

### Stage 1：Contract 与错误码

- [ ] RED：`workspace-contract.ts` 单元测试：
  - `workspaceRequestSegmentTranscriptionBackfillRequestSchema` 必须要求 `mode: 'fill-missing' | 'regenerate'`；缺失或非法 mode 解析失败。
  - `workspaceRequestSegmentSupplementTranscriptionBackfillRequestSchema` 同上。
  - `workspaceErrorCodeSchema` 必须包含 `'ERR_BACKFILL_TRANSCRIPT_CHANGED'`。
- [ ] GREEN：扩展 schema 与 enum；同步派生类型 `WorkspaceRequestSegmentTranscriptionBackfillRequest` 等。扩展两个 backfill request schema 时显式使用 `.extend({ mode: z.enum(['fill-missing', 'regenerate']) }).strict()`，保持与 `workspace-contract.ts` 当前 backfill / supplement request 都以 strictObject/`.strict()` 收尾的风格一致，禁止 unknown 字段静默通过。
- [ ] RED：`workspaceErrorMessages` 测试：`ERR_BACKFILL_TRANSCRIPT_CHANGED` 必须返回中文文案；`ERR_BACKFILL_TARGET_NOT_ELIGIBLE` 文案需要更新以引导覆盖。
- [ ] GREEN：扩展文案 map。
- [ ] REFACTOR + 重跑 targeted tests。

### Stage 2：Preload / workspaceApi wrapper

- [ ] RED：`workspaceBridge.ts` 与 `workspaceApi.ts` 测试：
  - bridge method 与 wrapper 参数包含 mode；类型与 contract 对齐。
  - mode 缺失或非法 → 编译错误（type-level guard）；运行时 mode 走 Zod 校验。
- [ ] GREEN：bridge 与 wrapper 增加 mode 参数；wrapper 仍保持窄方法。
- [ ] REFACTOR + 重跑 targeted tests。

### Stage 3：Main runtime mode 派发 + snapshot guard

- [ ] RED：`backfillRuntime.test.ts`（或新文件）覆盖：
  - `requestSegmentBackfill({ mode: 'fill-missing' })` 走 `requireTranscriptMissing: true` 路径；transcript 已存在时返回 `ERR_BACKFILL_TARGET_NOT_ELIGIBLE`。
  - `requestSegmentBackfill({ mode: 'regenerate' })` 在 transcript 为空时仍可入队并成功覆盖（main 端不要求 transcript 必须为空）。
  - `requestSegmentBackfill({ mode: 'regenerate' })` 在 task in-flight 开始时捕获 transcript snapshot digest；save 前重新读取并比对；digest 一致 → overwrite save 成功，manifest `lastTranscriptionAttempt='success'`。
  - `requestSegmentBackfill({ mode: 'regenerate' })` save 前 digest 不匹配 → 返回 `ERR_BACKFILL_TRANSCRIPT_CHANGED`；transcript / manifest 不变。
  - `requestSegmentBackfill({ mode: 'regenerate' })` recognize 失败 / 网络错 → 返回原 C 错误码；transcript / manifest 不变。
  - `requestSegmentBackfill({ mode: 'regenerate' })` 在 in-flight 已捕获 digest 后被 `cancelAll('workspace-switch' | 'lock-lost' | 'app-quit')` → 返回 `canceled` errorCode；**不** 重新读取 transcript、**不** 写 `segment.md` / `supplement.md` 正文、**不** 改 manifest `lastTranscriptionAttempt`。三种 cancel reason 各覆盖一条独立用例。
  - `requestSegmentBackfill({ mode: 'regenerate' })` overwrite-save helper 的"重读 transcript → 重算 digest → 比对 → ownership 复核 → 覆盖写 → 改 manifest"必须发生在同一持锁段内：用 mock `assertWorkspaceUsable` 在比对后写入前返回 `ERR_WORKSPACE_LOCK_LOST`，断言不写入 transcript / manifest 并返回 lock-lost typed error，不返回 `success`。
  - `enqueueAutomaticTargets` / `enqueueAutomaticWorkspace` 内部 mode 固定 fill-missing；任何 regenerate 调用走不进 automatic 路径。
  - BackfillQueue dedup 不区分 mode：automatic fill-missing 在队列 + 用户 manual regenerate → `ERR_BACKFILL_ALREADY_RUNNING`。
  - Supplement 路径镜像 segment 行为（含 cancel + 锁内顺序两条新用例）。
- [ ] GREEN：runtime 与 queue / save helper 实施。
  - `BackfillQueueTask` 增加 internal `mode` 字段（不暴露 IPC response）。
  - `saveSegmentTranscript` / `saveSupplementTranscript` 暴露 `allowOverwrite` 旗标 + digest 比对；overwrite 前必须复核 workspace/memory/segment(/supplement) ownership；helper 必须在 plan.md §12.10 锁内顺序不变量描述的同一持锁 critical section 内完成"重读 → 比对 → 复核 → 覆盖写 → 改 manifest"，不允许调用方拆段。
  - 在 plan.md §12.10 列出的 4 个检查点（(a) digest 捕获前 / (b) recognize 完成后但锁未拿到前 / (c) 拿锁后但首次重读 transcript 前 / (d) 写文件前）各插入一次 `signal.aborted` 检查，命中返回 `canceled`。
  - 诊断 allowlist 增加 `mode`；不增加 digest / transcript / raw path / key。
- [ ] REFACTOR + 重跑 targeted tests。

### Stage 4：IPC handler + sender / handle 校验

- [ ] RED：`workspaceIpc` 测试：
  - handler 把 mode 透传给 runtime；缺失 mode 经 Zod 拒绝并返回标准 invalid request envelope。
  - handler 保持 sender / handle ownership / lock usability 校验。
- [ ] GREEN：handler 接 mode；调用 runtime 新签名。
- [ ] REFACTOR + 重跑 targeted tests。

### Stage 5：Renderer 菜单与 AlertDialog 行为

- [ ] RED：`SegmentActionsMenu.test.tsx` / `SegmentSupplementActionsMenu.test.tsx` / `entityActionMenu.test.tsx`：
  - 菜单项 label 按 `transcript.exists` 切换。
  - voice settings disabled / unconfigured / `auth` → 菜单项 disabled + tooltip 字串。
  - recording overlay open → 菜单项 disabled + tooltip。
  - manual running Set 包含同 target → 菜单项 disabled + tooltip。
- [ ] RED：`MemoryStudio.test`（feature scope）或新增 `regenerateTranscript.test.tsx`：
  - 点击 fill-missing → 不打开 Dialog；调用 `workspaceApi` with mode=`fill-missing`。
  - 点击 regenerate → 打开 `WorkspaceDangerConfirmDialog`；cancel/ESC 关闭；confirm 在 mutation pending 时显示 spinner；mutation 入队成功后关闭 Dialog；mutation 失败时关闭 Dialog 并 root toast；切 segment 立即关闭。
- [ ] RED：`SegmentTranscriptView.test`：
  - regenerate running 期间必须继续渲染当前 transcript 文本并叠加进行中文案（plan §2.3 假设 3 锁定行为；实现路径由 implementer 选择）。
  - fill-missing running 期间渲染 B 当前 running outcome。
- [ ] RED：`App.test`（manual backfill 段）：
  - mutation 成功 → 复用 transcript save response merge；清除 manual Set。
  - mutation 失败 → root toast；清除 manual Set。
  - mutation 携带 mode 字段。
  - workspace 切换 / 关闭 → 清空 manual Set 与 confirming intent。
- [ ] GREEN：实施 menu callback、AlertDialog 接入、App manual Set 行为。
- [ ] REFACTOR + 重跑 targeted tests。

### Stage 6：错误映射与 toast

- [ ] RED：`workspaceErrorMessages.test` 与 `App.test` toast 段：
  - `ERR_BACKFILL_TRANSCRIPT_CHANGED` 文案。
  - `ERR_BACKFILL_TARGET_NOT_ELIGIBLE` 文案引导覆盖。
  - `ERR_BACKFILL_ALREADY_RUNNING` 文案沿用 C。
  - `ERR_BACKFILL_UNAVAILABLE` 文案沿用 C。
- [ ] GREEN：文案与 App toast handler。
- [ ] REFACTOR + 重跑 targeted tests。

### Stage 7：诊断与 secret 边界

- [ ] RED：`backfillDiagnostics.test`：
  - mode 字段进入 allowlist；regenerate 任务诊断带 `mode: 'regenerate'`。
  - transcript / digest / raw path / X-Api-Key / base64 / audio bytes 都不进入诊断。
- [ ] GREEN：诊断 allowlist 与 redaction。
- [ ] REFACTOR + 重跑 targeted tests。

### Stage 8：current docs 同步

文档与代码同批落盘；本阶段不豁免 verify。

- [ ] 更新 `docs/current/electron.md`：
  - anchor：`workspace:requestSegmentTranscriptionBackfill` / `workspace:requestSegmentSupplementTranscriptionBackfill` 条目（当前文件中描述这两个 channel 的段落，包含 audio.data Turbo 路径与 ffmpeg remux 的那段）扩展 `mode: 'fill-missing' | 'regenerate'` 字段。
  - anchor：错误码描述段加入 `ERR_BACKFILL_TRANSCRIPT_CHANGED` 语义。
  - anchor：automatic 与 manual 区别说明段加入"automatic 永远只入队 fill-missing；regenerate 只允许 manual"。
- [ ] 更新 `docs/current/data.md`：
  - anchor：manual backfill running state 描述段（当前以 "手动补转录 running state 使用按 workspace/entity identity 建立的 feature-local Set" 开头）保持 App component-state；显式声明 mode 不进 query key / store / manifest。
  - anchor：finalized audio Segment / SegmentSupplement manifest 字段描述段 — 确认 `lastTranscriptionAttempt` 字段不扩展。
- [ ] 更新 `docs/current/flow.md`：
  - anchor：自动补转录 background queue 描述段加入"manual regenerate 路径在 in-flight 捕获 transcript snapshot digest，save 前比对（同一持锁段内重读→比对→ownership 复核→覆盖写→改 manifest）；digest 不匹配返回 `ERR_BACKFILL_TRANSCRIPT_CHANGED`；automatic 路径与该段不交叉"。
- [ ] 更新 `docs/current/frontend.md`：
  - anchor：`SegmentActionsMenu` / `SegmentSupplementActionsMenu` 菜单项列表段加入「生成转录 / 重新生成转录」动态项与 disable 触发条件。
  - anchor：`WorkspaceDangerConfirmDialog` 危险确认段加入 regenerate 用法（与 Memory delete / Segment delete 同结构）。
- [ ] 更新 `docs/current/quality.md`：
  - anchor：main tests 覆盖列表与 renderer tests 覆盖列表扩展 mode 校验、snapshot guard、cancel-during-regenerate、锁内顺序、TRANSCRIPT_CHANGED、AlertDialog、dedup、diagnostics allowlist、automatic scanner mode-fixed。
- [ ] 同步过程中如果发现 current docs 与 C 已交付事实不一致，先修正错误事实，再写 D 增量；anchor 命中之外的章节不动。

## Subagent 分配建议

实施 session 推荐按下面切分 implementer subagent，便于 spec reviewer 与 code quality reviewer 并行复核。

- Implementer A：contract + preload + workspaceApi（Stage 1 + Stage 2）
- Implementer B：main runtime + queue + save helper + digest guard + diagnostics（Stage 3 + Stage 4 + Stage 7）
- Implementer C：renderer 菜单 + AlertDialog + App Set + error toast + SegmentTranscriptView（Stage 5 + Stage 6）
- Implementer D：current docs 同步（Stage 8）

每个 implementer 完成后，并行 dispatch：

- Spec reviewer A：spec 合规复核（合同字段、错误码、状态机、菜单 label、AlertDialog 路径、自动 scanner 限制）。
- Spec reviewer B：IPC / 安全边界复核（sender / handle / lock / settings gate / 不泄漏 secret / 不放松 Electron baseline / 不引入 main-to-renderer event / 不新增 Query key 或 Zustand）。
- Spec reviewer C：并发 / cancel / 测试完整度复核（automatic+manual 同 target、cancel/lock-lost、AlertDialog 切 segment、manual Set 边界、TRANSCRIPT_CHANGED race coverage、TARGET_NOT_ELIGIBLE 引导文案）。
- Code quality reviewer：ycksimplify 三 agent（代码复用 / 代码质量 / 效率），按 C 现有 ycksimplify SKILL 串。

每轮 reviewer 必须输出 `结论（READY-TO-IMPLEMENT / READY-WITH-MINOR / NEEDS-FIXES）+ BLOCKER / MAJOR / MINOR / PASS-CHECKS` 四档结构化结论；缺少结构化结论的 reviewer 视为未完成，必须重新 dispatch。每轮 reviewer 发现的 BLOCKER / MAJOR 必须由对应 implementer 回到 TDD 循环修复，再次 dispatch reviewer。所有 reviewer 全部 ✅ 后才能进入下一阶段或最终归档。

## Review / ycksimplify 阶段

- 每个 Stage 完成后执行一次 spec reviewer + code-quality reviewer 双串审。
- 完成全部 Stage 后执行最终一次 ycksimplify（复用 C 模式：代码复用 / 代码质量 / 效率三 agent 并行）。
- 最终一次审查必须覆盖：mode 透传链、digest guard、错误码新增、AlertDialog 二次确认、自动 scanner mode-fixed、所有 docs/current/\* 同步。

## E2E / QA 阶段

- 启动 `REMOTE_DEBUGGING_PORT=9233 npm run dev`，使用真实 Electron runtime。
- 必须覆盖场景（详见 `verification.md` §3.1–§3.6）：
  1. fill-missing 路径：transcript.exists=false 的 Segment 与 SegmentSupplement 各重试一次。
  2. regenerate 路径：transcript.exists=true 的 Segment 与 SegmentSupplement 各重试一次。
  3. regenerate 期间手动改写 transcript 文件（外部编辑），观察 TRANSCRIPT_CHANGED toast 且 transcript 保留外部编辑。
  4. voice settings 关闭 / 未配置 / `auth` 三态：菜单 disabled + tooltip。
  5. 录音 overlay open：菜单 disabled + tooltip。
  6. ALREADY_RUNNING 边界：触发 automatic queue 正在跑同一 target 时，手动点击同 target 菜单 → root toast「该录音正在生成中」；菜单项不会重复入队。
- 真实 API smoke 必须确认没有打印 X-Api-Key、base64、raw path、transcript 原文或 digest。
- 真实 runtime QA 通过后记录证据（命中场景、CDP 结构检查结果）写入 verification.md 的 `## QA 证据` 段。

## 敏感信息扫描

- 在 final commit 前对 repo diff 与 dev runtime 日志做关键字扫描：
  - X-Api-Key 值（来自本机 settings 的 last4 之外不能出现）
  - base64 payload 片段
  - WebM/Opus / OGG/Opus 文件路径
  - transcript 文本片段
  - sha256 digest 输出
- 任何扫描命中必须修复后才能 commit。

## current docs 同步清单

- 见 Stage 8。
- 同步完成后必须 `npm run verify:quick`、`npm run format:check`、`git diff --check`。

## 100% confidence loop 条件

进入 final commit 前必须全部满足，且每一项都有显式证据：

1. 全部 RED 阶段先失败，再 GREEN 通过，再 REFACTOR 后重跑 targeted tests 仍通过。
2. `npm run verify:quick` 全绿（typecheck + main test + renderer test + lint + format）。
3. `npm run format:check` 全绿。
4. `git diff --check` 干净。
5. 真实 Electron runtime QA 覆盖 6 条 E2E 场景并记录证据（与 verification.md §3.1–§3.6 对齐）。
6. 真实 API smoke 通过（或外部账号阻断时显式记录 DONE_WITH_CONCERNS 与原因）。
7. 敏感信息扫描全部通过。
8. 所有 `docs/current/*` 已同步到 D 当前事实，并通过 `prettier --check`。
9. 所有 review subagent ✅；所有 ycksimplify 反馈处理完毕。
10. 本 spec 已更新最终状态并准备归档；initiative tasks.md 已勾掉 D。

## 归档与压缩

- 进入归档前先把仍然有效的长期结论压缩回 `docs/current/*` 或 `docs/decisions/*`。
- 把本 spec 从 `docs/specs/` 移入 `docs/archive/specs/2026-05-17-0950-doubao-voice-manual-regenerate-transcript/`。
- 在 `docs/initiatives/2026-05-16-doubao-voice-followups/tasks.md` 勾掉 D；同步 plan.md 与 README.md 状态。
- 如果 D 完成同时确认 E（已完成）/ B / C / D 全部归档，初始化 initiative 归档流程，将 initiative 移入 `docs/archive/initiatives/`，并核对 `docs/specs/` 为空。

## 本 session（spec 准备）执行项

- [x] 读完 21 份必读文档与 C 端 backfill 源码骨架。
- [x] 创建 D active spec 5 文件。
- [x] 更新 initiative README / plan / tasks / d-brief 指向本 spec 并保持 current-truth-only。
- [x] 运行 `prettier --check` 与 `git diff --check`；只改 docs/spec 与 docs/initiatives，因此未运行 `npm run verify:quick`（typecheck / test / lint 范围与本 session 无关）。

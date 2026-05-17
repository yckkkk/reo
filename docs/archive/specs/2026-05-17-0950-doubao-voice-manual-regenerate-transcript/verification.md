# 验证

本验收文件描述 D 实施 session 必须执行并留下证据的检查项。当前 spec 准备 session 不写 D 代码，因此下面所有"运行结果"段在本 spec 创建时为空，实施 session 在落地时填入。

## 1. 自动化检查

### 1.1 命令

实施 session 必须运行并通过：

```bash
npm run typecheck
npm run test:main -- --test-name-pattern='doubao AUC turbo|backfill audio data|backfill (scanner|queue)|workspace backfill runtime|scanWorkspaceBackfillTargets|workspace (IPC channels include|backfill request schemas|preload bridge exposes explicit)|registered closeWorkspace IPC closes|transcript snapshot guard'
npm run test:renderer -- --run src/renderer/src/workspace/SegmentTranscriptView.test.tsx
npm run test:renderer -- --run src/renderer/src/workspace/SegmentActionsMenu.test.tsx
npm run test:renderer -- --run src/renderer/src/workspace/SegmentSupplementActionsMenu.test.tsx
npm run test:renderer -- --run src/renderer/src/workspace/entityActionMenu.test.tsx
npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern='transcription backfill|regenerate transcript'
npm run verify:quick
npm run format:check
git diff --check
```

`verify:quick` 已覆盖 typecheck、`test:main`、`test:renderer`、lint 与 format check；上面 targeted 命令是 D 行为的最小保护测试，必须先单独通过再跑全量 `verify:quick`。

### 1.2 期待结果

- 所有 targeted 与全量测试通过。
- `npm run format:check` 通过。
- `git diff --check` 干净（无尾随空格、tab 风格违例）。
- TypeScript strict 通过。

### 1.3 运行结果

实施 session 运行结果：

- `npm run typecheck`：通过。
- `npm run test:main -- --test-name-pattern='doubao AUC turbo|backfill audio data|backfill (scanner|queue)|workspace backfill runtime|scanWorkspaceBackfillTargets|workspace (IPC channels include|backfill request schemas|preload bridge exposes explicit)|registered closeWorkspace IPC closes|transcript snapshot guard'`：通过，673/673。
- `npm run test:renderer -- --run src/renderer/src/workspace/SegmentTranscriptView.test.tsx src/renderer/src/workspace/SegmentActionsMenu.test.tsx src/renderer/src/workspace/SegmentSupplementActionsMenu.test.tsx src/renderer/src/workspace/entityActionMenu.test.tsx src/renderer/src/App.test.tsx --testNamePattern='transcription backfill|regenerate transcript|SegmentTranscriptView|SegmentActionsMenu|SegmentSupplementActionsMenu|EntityActionMenu'`：通过，41/41。
- `npm run verify:quick`：通过；typecheck、main 673/673、renderer 420/420、lint、format 全绿。
- `npm run format:check`：通过。
- `git diff --check`：通过。

实施中 `npm run verify:quick` 曾在全量 renderer 期望上暴露 3 条旧断言：`App.test.tsx` 的菜单项列表未包含「生成转录」，`LoadedWorkspaceFrame.test.tsx` 的 retry callback 未包含 `mode: 'fill-missing'`。已修正后重跑 focused renderer tests、typecheck、format 和全量 `verify:quick`，全部通过。

## 2. 必须覆盖的测试

### 2.1 Contract / 类型

- `workspaceRequestSegmentTranscriptionBackfillRequestSchema` 必须显式要求 `mode`；缺失 / 非法 mode → 解析失败。
- `workspaceRequestSegmentSupplementTranscriptionBackfillRequestSchema` 同上。
- `workspaceErrorCodeSchema` 必须包含 `'ERR_BACKFILL_TRANSCRIPT_CHANGED'`。
- `workspaceErrorEnvelopeSchema` 派生类型必须接受新错误码。

### 2.2 Main runtime

- `requestSegmentBackfill({ mode: 'fill-missing' })` 走 `requireTranscriptMissing: true`；transcript 已存在 → `ERR_BACKFILL_TARGET_NOT_ELIGIBLE`。
- `requestSegmentBackfill({ mode: 'regenerate' })`：
  - transcript 空时 overwrite save 成功；manifest `lastTranscriptionAttempt='success'`。
  - transcript 非空、in-flight 期间未变 → overwrite save 成功；transcript 文本更新。
  - in-flight 期间 transcript 被外部修改（mocked file change）→ `ERR_BACKFILL_TRANSCRIPT_CHANGED`；transcript / manifest 不变。
  - recognize 失败 → 原 C 错误码透传；transcript / manifest 不变。
- Supplement 路径覆盖以上四个场景。
- BackfillQueue dedup：automatic fill-missing 在队列 + manual regenerate → `ERR_BACKFILL_ALREADY_RUNNING`。
- `enqueueAutomaticTargets` / `enqueueAutomaticWorkspace` 内部 mode 固定 fill-missing；mock automatic 调用不允许 regenerate。
- `cancelAll('workspace-switch')` / `cancelAll('lock-lost')` / `cancelAll('app-quit')` 三种 reason 各一条独立断言：regenerate 任务在 digest 捕获后被 cancel → 返回 `canceled` errorCode；不重读 transcript、不写 `segment.md` / `supplement.md` 正文、不改 manifest `lastTranscriptionAttempt`。
- regenerate overwrite-save helper 锁内顺序不变量：mock `assertWorkspaceUsable` 在 digest 比对通过后、写入前返回 `ERR_WORKSPACE_LOCK_LOST`，断言不写 transcript / manifest 并返回 lock-lost typed error，不返回 success；这条断言锁定 plan.md §12.10 的"重读→比对→ownership→覆盖写→改 manifest 必须在同一持锁段"硬不变量。
- overwrite-save 半成功保留语义：`dataRetention='previous-file-preserved'`（写文件失败）保留旧 transcript / manifest 并返回原值；`dataRetention='file-written-index-stale'`（文件已覆盖写但 index 刷新失败）manifest 已是 `'success'`，response 仍带 stale 标记，与 C 现有 saveTranscript 半成功契约一致。
- 诊断 allowlist 增加 `mode`；输出诊断中包含 `mode: 'fill-missing'` 或 `mode: 'regenerate'`；不出现 transcript、digest、raw path、X-Api-Key、base64、audio bytes。

### 2.3 IPC handler

- handler 接受 mode 并透传 runtime；mode 缺失 / 非法 → invalid request envelope。
- sender / handle / lock / settings gate 校验保持。

### 2.4 Renderer 菜单与转录视图

- `SegmentActionsMenu` / `SegmentSupplementActionsMenu`：
  - `transcript.exists=false` → 「生成转录」label；点击不打开 Dialog；调用 `workspaceApi` with mode=`fill-missing`。
  - `transcript.exists=true` → 「重新生成转录」label；点击打开 `WorkspaceDangerConfirmDialog`。
  - voice settings 关闭 / 未配置 / `auth` → disabled + tooltip 字串匹配。
  - 录音 overlay open → disabled + tooltip 字串匹配。
  - manual running Set 包含同 target → disabled + tooltip 字串匹配。
- `SegmentTranscriptView`（renderer unit）：
  - regenerate running 期间，当 selected segment 当前 transcript text 非空时必须**继续渲染该正文**（不主动隐藏），并叠加进行中文案；任务 settle 切回 success 后文本被新结果覆盖。
  - regenerate running 期间，当 selected segment 当前 transcript text 为空时（race：用户外部清空但 confirming Dialog 未关闭），按 fill-missing running 一致渲染空态 + 进行中文案，不渲染陈旧/缓存文本。
  - fill-missing running 期间使用 B 当前 running outcome（保留 B 既有视觉）。

### 2.5 AlertDialog 行为

- title「重新生成转录」、description 与 d-brief 一致、confirm「重新生成」（destructive variant）、cancel「取消」。
- confirm 按钮 click 不自动关闭 Dialog；mutation pending 时按钮 spinner。
- mutation 入队成功后关闭 Dialog；mutation 失败时关闭 Dialog 并 root toast。
- cancel / ESC / 点击 overlay 关闭 Dialog。
- 切 segment 立即关闭 Dialog；丢弃 confirm intent。

### 2.6 App manual Set

- 点击后立刻把 target 加入 Set；mutation pending 期间菜单 disabled。
- mutation 成功 / 失败后清除。
- 切换 / 关闭 workspace 时清空 Set 与 confirming intent。
- 切换 selected segment（不切 workspace）时立刻关闭 `WorkspaceDangerConfirmDialog` 并丢弃 confirm intent；该断言在 renderer App 或 MemoryStudio scope unit 测试中单独存在，不只依赖 §2.5 AlertDialog 自身的"切 segment 立即关闭"断言（两个断言分别覆盖 Dialog 生命周期与 App-level intent 清理）。

### 2.7 Cache merge

- mutation 成功 response 通过现有 transcript save response merge 路径更新 Workspace snapshot、Memory detail cache、Segment content cache、SegmentSupplement content cache。
- 不新增 invalidation 路径；不引入新 Query key。

### 2.8 错误 toast

- `ERR_BACKFILL_ALREADY_RUNNING` 文案保持 C。
- `ERR_BACKFILL_UNAVAILABLE` 文案保持 C。
- `ERR_BACKFILL_TARGET_NOT_ELIGIBLE` 文案引导用户改用「重新生成转录」。
- `ERR_BACKFILL_TRANSCRIPT_CHANGED` 文案中文化；不暴露 digest。
- 其它 C 已有 backfill 错误码沿用现有文案。

## 3. 操作验证（真实 Electron runtime）

```bash
REMOTE_DEBUGGING_PORT=9233 npm run dev
```

实施 session 必须在真实 Electron runtime 上覆盖下列场景，并把每条结果（命中文案、是否覆盖、是否回滚）写在本节 `## 3.x 运行证据` 段。

### 3.1 fill-missing 路径

- 在 transcript.exists=false 的 Segment 上：More → 「生成转录」→ 不弹 Dialog；running outcome；成功后 transcript 文本回到 Memory Studio；`lastTranscriptionAttempt='success'`。
- 在 transcript.exists=false 的 SegmentSupplement 上重复上述步骤。

### 3.2 regenerate 路径

- 在 transcript.exists=true 的 Segment 上：More → 「重新生成转录」→ AlertDialog 出现 → 「重新生成」→ Dialog 关闭；running outcome 期间继续渲染原 transcript；成功后 transcript 被新内容覆盖。
- 在 transcript.exists=true 的 SegmentSupplement 上重复上述步骤。

### 3.3 TRANSCRIPT_CHANGED 保护

- 触发 regenerate 任务后，在 ASR 返回前手动用编辑器修改对应 `segment.md` / `supplement.md` 的 `## Transcript` 段；观察任务最终返回 `ERR_BACKFILL_TRANSCRIPT_CHANGED`；root toast 显示文案；transcript 仍保留外部编辑内容；manifest `lastTranscriptionAttempt` 不变。

### 3.4 voice settings gate

- 关闭语音识别 → 菜单项 disabled + tooltip 引导设置。
- 清除 X-Api-Key → 菜单项 disabled + tooltip。
- Settings 触发 validation 失败 `auth` → 菜单项 disabled + tooltip。
- Settings validation `network` 失败 → 菜单项可点击；mutation 命中 `ERR_BACKFILL_AUTH_FAILED` 或网络错时 root toast 显示。

### 3.5 录音 overlay 阻塞

- 打开 RecordingOverlay → 菜单项 disabled + tooltip「先完成或关闭录音」。
- 关闭 RecordingOverlay → 菜单项恢复可点击。

### 3.6 ALREADY_RUNNING 边界

- 触发 automatic queue（保存 X-Api-Key 后自动 scan）正在跑同一 target 时，手动点击同 target 的 menu 项 → root toast 「该录音正在生成中」；菜单项不会重复入队。

### 3.7 QA 证据

真实 runtime 命令：

```bash
REMOTE_DEBUGGING_PORT=9233 npm run dev
```

运行环境与 fixture：

- 使用真实 Electron runtime、真实 `window.reoWorkspace` preload bridge、真实 main IPC、真实 file-truth workspace、真实豆包 Turbo file ASR。
- CDP 结构检查：`window.reoWorkspace` 暴露显式方法 `requestSegmentTranscriptionBackfill` 与 `requestSegmentSupplementTranscriptionBackfill`；`invoke` / `send` / generic IPC 不存在。
- 临时 QA workspace 位于 `/tmp` 派生目录，userData registry 条目在 QA 后已移除；voice settings 文件在 gate 测试前备份，QA 后恢复原 encrypted settings 文件。

命中结果：

- §3.1 fill-missing：`transcript.exists=false` 的 Segment 经 automatic scan 命中同一 `fill-missing` runtime 路径，`segment.md` 写入「生成转路路径测试。」且 manifest `lastTranscriptionAttempt='success'`；SegmentSupplement 同路径写入「补充生成转录测试」且 manifest `lastTranscriptionAttempt='success'`。两条路径均没有 AlertDialog。
- §3.2 regenerate：Segment More 菜单显示「重新生成转录」；AlertDialog 文案命中「重新生成转录？」和覆盖说明；确认后 running 期间继续显示旧正文「旧的 Segment 转录文本」并叠加「正在生成转录。」；成功后正文覆盖为「重新生成转路路径测试。」。SegmentSupplement More 菜单同样显示「重新生成转录」；确认后成功覆盖为「补充，重新生成转录测试。」。
- §3.3 TRANSCRIPT_CHANGED：触发 Segment regenerate 后立即外部写入 `segment.md` 的 transcript 段为「外部编辑保护文本」；runtime toast 命中「无法生成转录。转录已在生成期间发生变化，已保留当前内容。请确认后重新生成。」；最终 `segment.md` 保留外部编辑文本，manifest `lastTranscriptionAttempt` 保持 `success`，没有覆盖写。
- §3.4 voice settings gate：关闭语音识别时菜单项 `aria-disabled=true`；清除 X-Api-Key 时菜单项 `aria-disabled=true`；保存无效 key 后 settings snapshot 为 `lastValidationCode='auth'` 且菜单项 `aria-disabled=true`；构造 encrypted settings 的 `lastValidationCode='network'` 后重启 Electron，settings snapshot 为 `network`，菜单项不带 `data-disabled` / `aria-disabled`，保持可点击。
- §3.5 recording overlay：打开 RecordingOverlay 后 runtime body 命中「录音」「可以开始录制本地音频。 已录制：0 秒。」「开始录音」；overlay open 时主界面 backfill 菜单不产生可点击 backfill item，renderer 单元测试覆盖 tooltip「先完成或关闭录音」与 disabled 判定。
- §3.6 ALREADY_RUNNING：创建新的 failed/missing target，重启后 automatic scan 先入队；在同 target More 菜单点击「生成转录」时 root toast 命中「无法生成转录。这段录音正在生成转录。」；菜单项点击前不带 disabled 标记，重复入队由 main BackfillQueue dedup 拦截。

## 4. 敏感信息扫描

实施 session 在 commit 前必须执行下列检查，并把结果写在 `## 4.x 扫描证据` 段：

- 对 `git diff` 与 dev runtime 日志全文搜索：
  - X-Api-Key 明文（除 last4 投影外）
  - base64 块（长 ASCII 序列）
  - WebM / OGG / 临时 ffmpeg 路径
  - transcript 文本片段
  - sha256 digest 输出
- 所有命中必须修复后再 commit。

### 4.1 扫描证据

扫描对象：

- `git diff 29f3b141..HEAD`
- `git diff`
- `/tmp/reo-d-runtime.log`

扫描结果：

- runtime log：未命中 `X-Api-Key`、疑似明文 key、长 base64、`reo-backfill-audio-*`、`.webm` / `.ogg` 路径、`sha256` / digest、QA transcript 文本片段。
- committed diff：命中均为源码/测试/文档中的允许字段名或脱敏测试样例，包括 `X-Api-Key` 文案、`sha256-secret` 红队样例、`/tmp/private/audio.webm` 红队样例、`digest` 函数/测试名；未出现真实 key、真实 runtime raw path、base64 payload 或真实 transcript 文本。
- working diff：命中均为 current docs 中的合同字段名、禁止项说明和验收证据；未出现真实 key、base64 payload、真实 runtime raw path 或真实 transcript 文本。

结论：敏感信息扫描通过；无需修复。

## 5. docs/current 同步证据

实施 session 完成 docs 同步后填入：

- `docs/current/electron.md`：mode 字段、TRANSCRIPT_CHANGED 错误码、automatic scanner mode-fixed 段已落地。
- `docs/current/data.md`：manual running Set 仍为 App component-state；mode 不进 query key / store。
- `docs/current/flow.md`：transcript snapshot guard 段已落地。
- `docs/current/frontend.md`：菜单项与 AlertDialog 段已落地。
- `docs/current/quality.md`：测试覆盖扩展段已落地。

### 5.1 同步证据

- `docs/current/electron.md`：已同步 backfill request `mode` 字段、`ERR_BACKFILL_TRANSCRIPT_CHANGED`、automatic scanner 固定 `fill-missing`、renderer 不接触 secret / raw path / digest。
- `docs/current/data.md`：已同步 mode 不进入 manifest / query key / Zustand store，manual running Set 保持 App feature-local state。
- `docs/current/flow.md`：已同步 regenerate transcript snapshot guard，以及同一持锁段内重读、digest 比对、ownership 复核、覆盖写、manifest 更新的顺序。
- `docs/current/frontend.md`：已同步「生成转录 / 重新生成转录」菜单项、voice settings / recording overlay / manual running disabled 条件、network 可点击、AlertDialog 覆盖确认。
- `docs/current/quality.md`：已同步 mode contract、automatic mode-fixed、BackfillQueue dedup、cancel-during-regenerate、TRANSCRIPT_CHANGED、diagnostics allowlist 与 renderer AlertDialog/menu 覆盖。

`npx prettier --check docs/current/electron.md docs/current/data.md docs/current/flow.md docs/current/frontend.md docs/current/quality.md`、`npm run verify:quick`、`npm run format:check` 与 `git diff --check` 均已通过。

## 6. 100% confidence loop 出口条件

- 第 1 节命令全部通过。
- 第 2 节测试全部覆盖且通过。
- 第 3 节真实 runtime 6 条场景全部记录证据。
- 第 4 节敏感信息扫描通过。
- 第 5 节 5 份 current docs 同步并通过 `prettier --check`。
- 最终一次 review subagent + ycksimplify 反馈处理完毕。
- 实施 session 收口提交本 spec 与 initiative 文档归档变更。

### 6.1 出口结果

- 第 1 节命令全部通过。
- 第 2 节覆盖项已由 targeted tests、全量 `verify:quick`、spec reviewer 和最终 ycksimplify 复核。
- 第 3 节真实 Electron runtime QA 已记录 6 类场景证据。
- 第 4 节敏感信息扫描通过。
- 第 5 节 5 份 current docs 已同步并通过格式检查。
- Stage reviewer、Stage docs reviewer、最终 ycksimplify 三 agent 均为 `READY-TO-LAND` 或 `READY-WITH-MINOR` 且无 BLOCKER / MAJOR；唯一 MINOR（App tests workspace setup 重复）已通过 `createWorkspaceWithSingleSegment` 收口。
- 本 spec 可归档；initiative D 可勾选完成。

## 7. 本 session（spec 准备）的验证

本 spec 准备 session 不写 D 代码，仅写文档；验证范围限于：

- 运行 `npx prettier --check 'docs/archive/specs/2026-05-17-0950-doubao-voice-manual-regenerate-transcript/**/*.md' 'docs/archive/initiatives/2026-05-16-doubao-voice-followups/**/*.md'`
- 运行 `git diff --check`
- 不运行 `npm run verify:quick`。理由：本 session 改动仅限 `docs/specs/` 与 `docs/initiatives/`，无源码或 test 改动，verify:quick 的 typecheck / test / lint 与本 session 无关；下一 D 实施 session 会同批运行 verify:quick。

# 实施清单（TDD 顺序）

每个任务都按 RED → GREEN → REFACTOR 推进；纯文档任务在节末标注豁免理由。每个 commit 必须：

- 只包含一个原子改动
- 通过对应测试（`vitest run --reporter=verbose <pattern>` 或 `npm run test:main -- --grep <pattern>`）
- 不破坏 `npm run verify:quick`
- 提交信息使用 conventional commits

## 阶段 0：C-0 探针（Phase 0 / Gate 0）

C-0 是 spec 内 Gate 0。C-0 未通过禁止进入阶段 1+。

### T0.1 Context7 / 官方文档调研

- **TDD 豁免**：纯调研，无代码
- 通过 Context7 查询火山引擎离线极速版 ASR 的 endpoint、resource id、header、body 编码、计费模型、单次时长上限
- Context7 无覆盖时使用火山官方控制台、SDK Go 包、第三方实现交叉验证
- 输出：在 README.md 增加 `c0-findings` 段，包含调研来源 URL、关键引用、未解判定
- **不**写代码

### T0.2 手动 probe smoke

- **TDD 豁免**：一次性手动验证
- 写一个一次性 main process script 或 main test（在 `__tests__/c0_probe.spec.ts`，临时文件，测试通过后删除或标 `.skip`）
- 用当前 `voiceSettingsStore` 解密出的真实 X-Api-Key 调 flash endpoint，发送 1 秒静音 WebM / PCM
- 验证：
  - HTTP 200 + body 含 transcript 字段（空或非空均可）
  - 同 key 同时仍能跑 SAUC streaming（先跑一个最小 streaming probe，再跑 flash，二者无 conflict）
- 记录单次时长上限的官方数值；缺失时用 30s / 60s / 90s 边界 probe 找上限
- 输出：c0-findings 段更新；ADR 草案
- **若任一项失败**：暂停 C，回 brainstorm，更新 plan.md 中假设段

### T0.3 ADR 起草

- **TDD 豁免**：纯文档
- 起草 `docs/decisions/0005-doubao-voice-flash-asr-baseline.md`（暂留在 spec 目录，不进 main 真源）
- 内容：endpoint、header、body 编码、计费模型、单次时长上限、回落策略、与 ADR 0004 的关系
- 等 spec 收口同批进 `docs/decisions/`

### T0.4 决定 N 与 K

- **TDD 豁免**
- 基于 C-0 计费实验决定 batch cap N（默认 20）与 breaker 阈值 K（默认 3）
- 写入 plan.md `c0-findings` 段

## 阶段 1：C-1 main 后台引擎

### T1.1 `c0FlashClient` 实现

- **RED**：在 `src/main/__tests__/c0FlashClient.test.ts` 新增测试：
  - 构造 minimal request → mocked `fetch` 返回 200 + 合法 body → 返回 `{ ok: true, transcriptText }`
  - 401 → `{ ok: false, errorCode: 'auth' }`
  - 429 → `{ ok: false, errorCode: 'rate-limit' }`
  - 500 / network error / timeout → `{ ok: false, errorCode: 'network' }`
  - body schema invalid → `{ ok: false, errorCode: 'format' }`
  - abort signal fired during fetch → throw AbortError
- **GREEN**：实现 `src/main/c0FlashClient.ts` 单文件
- **REFACTOR**：抽出 errorCode 分类 helper；保证文件 ≤ 250 LOC

### T1.2 `backfillQueue` 实现

- **RED**：在 `src/main/__tests__/backfillQueue.test.ts` 新增测试：
  - enqueue 单 task → awaitTask 返回成功
  - 同 target 重复 enqueue → 第二次 accepted=false reason=duplicate
  - 手动 insertAtHead=true → 出队顺序在已有 auto task 前
  - pause 期间不出队；resume 后从队首继续
  - cancelAll 期间 abort in-flight + 清空所有 auto + manual deque
  - same errorCode 连续 K 次 → trip breaker，剩余 auto 被丢弃但 manual 保留
  - 不同 errorCode 不触发 breaker
- **GREEN**：实现 `backfillQueue.ts`；mock c0FlashClient
- **REFACTOR**：抽出 target key helper、breaker counter helper

### T1.3 `backfillScanner` 实现

- **RED**：在 `backfillScanner.test.ts` 新增测试：
  - 构造 Memory detail fixture：含 success / failed-with-text / failed-empty / never-empty segment + supplement 各若干
  - scanner 只收集 failed-empty 集合，按 updatedAt desc 排序
  - 单次 scan ≤ 200ms（性能 budget）
  - lock lost 抛 typed error，不返回部分结果
  - limit 参数生效（前 N 条）
- **GREEN**：实现 `backfillScanner.ts`
- **REFACTOR**：复用现有 Memory detail projection 函数；避免重复扫描

### T1.4 `backfillTriggerWiring` 实现

- **RED**：在 `backfillTriggerWiring.test.ts` 新增测试：
  - voiceSettingsStore.lastValidationOk 从 false → true → trigger fired 1 次
  - voiceSettingsStore.lastValidationOk 从 ok → ok → 不 trigger
  - workspace ready 且 enabled+keyConfigured+ok → trigger fired 1 次
  - 同 workspace 同次 ready 重复触发只 trigger 1 次
  - 凭证 clear（apiKeyConfigured=false）→ 不 trigger
- **GREEN**：实现 `backfillTriggerWiring.ts`；在 `voiceSettingsStore.ts` 增加 `onSnapshotChange(listener)` 窄 export，由 trigger wiring 内部过滤 `lastValidationOk` 上升沿
- **REFACTOR**：抽出 once-per-ready helper

### T1.5 `backfillDiagnostics` 实现

- **RED**：在 `backfillDiagnostics.test.ts`：
  - 调 wrapper 写 `area='backfill'` 一组 event → 调用 `recordDiagnosticEvent` 时 `area / event / fields` 正确传入
  - 字段中含 `transcript`、`apiKey`、`path` 等敏感 key → 由现有 `sanitizeDiagnosticFields` 自动 `[redacted]`（通过现有 sanitizer 路径间接验证）
  - 9 个 `ERR_BACKFILL_*` errorCode 通过现有 `SAFE_ERROR_CODES` 保留（先在 T2.1 把错误码加入 `workspaceErrorCodeSchema`）
- **GREEN**：实现 `backfillDiagnostics.ts`，单一 thin wrapper：导出按 event 命名的 helper（如 `recordTriggerFired`、`recordTaskSucceeded`），内部调 `recordDiagnosticEvent({ area: 'backfill', event, fields })`
- **REFACTOR**：不引入独立 sanitizer 或独立 allowlist；event 名以字符串编码 `source`（如 `task-succeeded-auto`）避免新增 sanitizer 路径

### T1.6 main 启动接线

- **RED**：在 `index.test.ts`（或 lifecycle test）增加：
  - app ready 后 backfillTriggerWiring 已订阅
  - workspace close 时 BackfillQueue.cancelAll('workspace-switch')
  - app quit 时 BackfillQueue.cancelAll('app-quit')
  - renderer process gone 时 cancelAll
- **GREEN**：在 `src/main/index.ts` 与 workspace lifecycle 注入 hook
- **REFACTOR**：合并入 lifecycle helper

## 阶段 2：C-2 IPC + renderer 接通

### T2.1 contract 扩展

- **RED**：在 `src/workspace-contract/__tests__/` 新增：
  - 2 个新 request schema 严格校验
  - 2 个新 response schema 严格校验
  - 9 个新错误码进入 `workspaceErrorCodeSchema`
- **GREEN**：修改 `workspace-contract.ts` + `reo-workspace-bridge.ts`
- **REFACTOR**：复用 saveTranscript response schema 派生

### T2.2 main IPC handler

- **RED**：在 `workspaceIpc.test.ts` 新增：
  - sender 非法 → typed error
  - handle 非法 → lock-lost
  - workspaceId mismatch → typed error
  - voice settings disabled → ERR_BACKFILL_VOICE_DISABLED
  - apiKey 未配置 → ERR_BACKFILL_API_KEY_MISSING
  - 同 target 已 running → ERR_BACKFILL_ALREADY_RUNNING
  - task 成功 → response 同 saveTranscript shape
  - task 失败 → 错误码映射正确
  - workspace switch 期间 → ERR_BACKFILL_CANCELED
- **GREEN**：实现 2 个 handler
- **REFACTOR**：segment / supplement handler 共用核心逻辑

### T2.3 preload 暴露

- **RED**：preload test 验证 2 个新方法存在且只接受合法 payload
- **GREEN**：`contextBridge` 注册
- **REFACTOR**：复用现有 wrapping 模式

### T2.4 renderer workspaceApi wrapper

- **RED**：renderer test 验证 wrapper 调用正确 preload 方法、传递 payload、解析 response
- **GREEN**：`workspaceApi.ts` 新增 2 个方法
- **REFACTOR**：与 saveTranscript wrapper 对齐

### T2.5 `SegmentTranscriptView` outcome `'running'`

- **RED**：`SegmentTranscriptView.test.tsx` 新增：
  - 传 `outcome={kind: 'running'}` 渲染 `copy.running` 灰文
  - 不渲染重试按钮
  - 无 spinner
- **GREEN**：扩展 outcome rendering branch
- **REFACTOR**：保留现有失败可重试态行为

### T2.6 Memory Studio + App 集成

- **RED**：`App.test.tsx` / `MemoryStudio.test.tsx` 新增：
  - 点击重试按钮 → 该 target 立即进入 running 状态（按钮变「正在生成」）
  - IPC 成功 → transcript 文本出现，按钮回 success
  - IPC 失败 → 回到失败可重试态，root toast 显示错误文案
  - 同 target 第二次点击 in-flight 期间 → 按钮不可点（disabled）
  - supplement 路径对称覆盖
- **GREEN**：
  - `App.tsx` 持有 `manualRunningSegmentTargets` / `manualRunningSupplementTargets` Set
  - 实现 `handleRetrySegmentTranscription` / `handleRetrySupplementTranscription`
  - 删除 `showTranscriptionRetryPlaceholder`
  - `MemoryStudio.tsx` 传 running set，derive outcome
- **REFACTOR**：抽出 `targetKey` helper；抽出 `addImmutable` / `removeImmutable` 通用 Set 工具

## 阶段 3：C-3 录音暂停 + breaker + 诊断接通

### T3.1 录音暂停接线

- **RED**：`App.test.tsx` + main test：
  - recording overlay 打开 → BackfillQueue.pause('recording') 被调
  - recording overlay 关闭 → BackfillQueue.resume('recording') 被调
  - 录音中 manual enqueue 仍接受，task 不出队
  - 录音中触发上升沿 fired → trigger wiring 正常 scan + enqueue（queue 在 pausing 状态），dequeue 等录音结束
- **GREEN**：在 App 顶层 recording flow lifecycle 注入 main 侧 pause / resume 信号（通过 main process recording lifecycle hook，不引入新 IPC）；main 内 BackfillQueue 已支持 pause/resume
- **REFACTOR**：复用现有 main 侧 recording flow lifecycle hook

### T3.2 breaker / batch cap 集成测试

- **RED**：新增集成测试 `backfillIntegration.test.ts`：
  - 50 条 failed segment + bad key（每次 flash 返回 auth）→ batch 只 enqueue N 条；连续 K 次 auth fail 后 breaker trip，剩余被丢弃
  - 手动重试不受 breaker 限制
  - 下次 trigger 上升沿 breaker 重置
- **GREEN**：（实现已在 T1.2 内）；仅补集成测试
- **REFACTOR**：n/a

### T3.3 main 诊断接通

- **RED**：诊断测试覆盖所有 9 个允许 event
- **GREEN**：在 BackfillQueue + scanner + trigger wiring 关键路径调 diagnostics
- **REFACTOR**：抽出 helper

## 阶段 4：文档同步

- T4.1 更新 `docs/current/electron.md`：新增 2 个 IPC channel 段落；诊断允许 list 追加 backfill events
- T4.2 更新 `docs/current/flow.md`：BackfillQueue lifecycle + 触发上升沿 + recording pause + breaker + batch cap
- T4.3 更新 `docs/current/data.md`：renderer manual running state 归属；强调不引入新 Query key 与 Zustand
- T4.4 更新 `docs/current/frontend.md`：`SegmentTranscriptView` outcome `'running'`；App `manualRunning*Targets` set
- T4.5 更新 `docs/current/quality.md`：错误码列表追加；后台任务诊断要求；新增 main 测试覆盖项
- T4.6 把 `docs/decisions/0005-doubao-voice-flash-asr-baseline.md` 从 spec 目录移入 `docs/decisions/`

**TDD 豁免**：文档同步；内容必须与代码事实完全一致

## 阶段 5：归档与下一步

- T5.1 `npm run verify:quick` 全绿
- T5.2 git diff 自查：无遗漏 `docs/current/*` 段落
- T5.3 把 spec 移入 `docs/archive/specs/2026-05-17-0029-doubao-voice-auto-backfill/`（必须先确认 spec objective 全部完成）
- T5.4 更新 initiative `tasks.md`：C 行从 `[ ]` 改为 `[x]` + 归档路径
- T5.5 更新 initiative `plan.md`：C→D readiness gate 状态
- T5.6 调整 d-brief.md（如必要，因为 D 现在确实可以复用真实手动触发 IPC）
- T5.7 进入 D 的 spec 创建

## 测试覆盖矩阵

| 路径                          | 单元 / 集成 | 文件                                 |
| ----------------------------- | ----------- | ------------------------------------ |
| c0FlashClient HTTP / 错误分类 | unit        | `c0FlashClient.test.ts`              |
| BackfillQueue enqueue / dedup | unit        | `backfillQueue.test.ts`              |
| BackfillQueue head insert     | unit        | `backfillQueue.test.ts`              |
| BackfillQueue pause / resume  | unit        | `backfillQueue.test.ts`              |
| BackfillQueue cancel + abort  | unit        | `backfillQueue.test.ts`              |
| BackfillQueue breaker         | unit        | `backfillQueue.test.ts`              |
| BackfillQueue batch cap       | unit        | `backfillQueue.test.ts`              |
| BackfillScanner               | unit        | `backfillScanner.test.ts`            |
| BackfillTriggerWiring         | unit        | `backfillTriggerWiring.test.ts`      |
| backfillDiagnostics allowlist | unit        | `backfillDiagnostics.test.ts`        |
| main IPC handler 路径         | unit        | `workspaceIpc.test.ts`               |
| preload exposure              | unit        | preload test                         |
| renderer workspaceApi wrapper | unit        | `workspaceApi.test.ts`               |
| SegmentTranscriptView running | component   | `SegmentTranscriptView.test.tsx`     |
| MemoryStudio retry segment    | integration | `MemoryStudio.test.tsx`              |
| MemoryStudio retry supplement | integration | `MemoryStudio.test.tsx`              |
| App retry handler             | integration | `App.test.tsx`                       |
| recording 暂停接线            | integration | `App.test.tsx` / main lifecycle test |
| breaker + batch cap 集成      | integration | `backfillIntegration.test.ts`        |

## 提交边界（建议）

- commit 1：T0.1 + T0.2 + T0.3 + T0.4（C-0 探针 + ADR 草案 + 决定 N/K）
- commit 2：T1.1（c0FlashClient）
- commit 3：T1.2（BackfillQueue）
- commit 4：T1.3 + T1.4（scanner + trigger wiring）
- commit 5：T1.5 + T1.6（diagnostics + main 启动接线）
- commit 6：T2.1 + T2.2 + T2.3 + T2.4（contract + IPC + preload + renderer wrapper）
- commit 7：T2.5 + T2.6（SegmentTranscriptView + App / MemoryStudio）
- commit 8：T3.1 + T3.2 + T3.3（录音暂停 + breaker 集成 + 诊断接通）
- commit 9：T4.\*（文档同步 + ADR 移入）
- commit 10：T5.\*（归档）

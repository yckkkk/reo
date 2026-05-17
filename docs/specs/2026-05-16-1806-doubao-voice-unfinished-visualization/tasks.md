# 实施清单（TDD 顺序）

每个任务都按 RED → GREEN → REFACTOR 推进；不允许跳过 RED 阶段；纯文档任务在节末标注豁免理由。

每个 commit 都必须：

- 只包含一个原子改动
- 通过对应测试（`vitest run --reporter=verbose <pattern>`）
- 不破坏 `npm run verify:quick`
- 提交信息使用 conventional commits

## 阶段 1：B-0 manifest schema（main process）

### T1.1 `lastTranscriptionAttempt` schema 接入

- **RED**：在 `src/main/__tests__/memoryFiles*.test.ts` 新增测试：
  - 合法 manifest（含 `'success'` / `'failed'` / `'never'` / absent）可通过 strict parse
  - 不合法值（如 `'unknown'`、空字符串、数字）必须 reject
- **GREEN**：修改 `segmentObjectManifestSchema` 与 `supplementObjectManifestSchema`，加 optional `lastTranscriptionAttempt`
- **REFACTOR**：抽出 `lastTranscriptionAttemptSchema` 复用常量

### T1.2 finalized projection 派生

- **RED**：在 `workspaceFiles.test.ts`（或 memoryFiles.test.ts 内 projection 段）新增测试：
  - manifest 含 `'failed'` → projection 字段 `'failed'`
  - manifest 含 `'success'` → projection 字段 `'success'`
  - manifest absent → projection 字段 `'never'`
- **GREEN**：在 `FinalizedAudioSegmentProjection` 与 supplement projection 类型加 `lastTranscriptionAttempt: 'success' | 'failed' | 'never'`；派生时 `?? 'never'`
- **REFACTOR**：抽出 `deriveLastTranscriptionAttempt(manifest)` helper

### T1.3 `extractSegmentTranscript` 对不可见清空占位保持空转录

- **RED**：在 `memoryFiles.test.ts` projection 段新增测试：
  - finalized segment manifest 含 `lastTranscriptionAttempt='success'`
  - `segment.md` 的 `## Transcript` 下只剩 Markdown/HTML 注释占位（例如 `<!-- cleared externally -->`）
  - projection 必须返回 `lastTranscriptionAttempt === 'success'` 且 `transcript.exists === false`
- **GREEN**：让 `extractSegmentTranscript` 在判定 transcript 正文时忽略 HTML 注释占位；不可见注释不算用户可见转录内容
- **REFACTOR**：保持 `lastTranscriptionAttempt` 派生 helper 不联动 transcript 内容

## 阶段 2：B-0 write path（main process）

### T2.1 finalize request DTO 加字段

- **RED**：在 `src/workspace-contract/__tests__/` 与 `recordingDrafts.test.ts` 新增测试：
  - `WorkspaceFinalizeRecordingDraftRequest` Zod schema 必须接受 `lastTranscriptionAttemptOnFinalize: 'failed' | 'never'`
  - 不接受 `'success'`（renderer 不许在 finalize 时声称成功）
- **GREEN**：修改 `src/workspace-contract/recordingDrafts.ts` 内的 request schema；preload bridge 类型自动跟随
- **REFACTOR**：supplement finalize DTO 对称添加

### T2.2 finalize 写 manifest 初值

- **RED**：在 `recordingDrafts.test.ts` 新增 case：
  - finalize 带 `lastTranscriptionAttemptOnFinalize='failed'` → 写出 manifest 含 `'failed'`
  - finalize 带 `lastTranscriptionAttemptOnFinalize='never'` → 写出 manifest 含 `'never'`
- **GREEN**：在 finalize manifest write 处理（`recordingDrafts.ts` 内的 finalizeRecordingDraft / finalizeSegmentSupplementRecordingDraft）注入字段
- **REFACTOR**：单一 helper 写 finalize manifest

### T2.3 saveTranscript 同步 update manifest 为 `'success'`

- **RED**：在 `memoryFiles.test.ts` / `saveTranscript` 相关测试新增 case：
  - 先 finalize 得到 manifest `'failed'`；调用 saveTranscript 成功 → manifest 更新为 `'success'`
  - saveTranscript 失败（previous-file-preserved 或 file-written-index-stale） → manifest 保持 `'failed'`
- **GREEN**：在 `workspace:saveTranscript` handler 内（segment 与 supplement 各一处）加 manifest update；与 segment.md write 同 lock；任一失败按现行 typed error envelope 处理
- **REFACTOR**：抽出 `markTranscriptionAttemptSuccess(manifestPath)` helper

## 阶段 3：B-0 旧文件行为校验（main process）

### T3.1 absent → `'never'` 端到端验证

- **VERIFY-ONLY（RED 豁免）**：当前源码已在 T1.2 实现 absent → `'never'`，且 projection 层已有覆盖；本节只补 `readMemoryDetail` 端到端回归断言，不作为 RED → GREEN 任务执行。
- **回归补测**：构造或复用 fixture：现有 finalized segment manifest 缺失 `lastTranscriptionAttempt`；调 `readMemoryDetail` 返回的 projection.segments[*].lastTranscriptionAttempt === `'never'`
- **REFACTOR**：优先复用现有 readMemoryDetail fixture，不新增重复 fixture

### T3.2 `'success' ∧ exists=false` 路径

- **RED**：构造 fixture：manifest `'success'` + segment.md 不含 `## Transcript`；projection `(lastAttempt='success', exists=false)`
- **GREEN**：T1.2 已实现
- **REFACTOR**：fixture 集中

## 阶段 4：B-1 SegmentTranscriptView 重构

### T4.1 props 重构（不改外观）

- **RED**：在 `SegmentTranscriptView.test.tsx` 新增 case：
  - 传 `outcome={kind: 'success'}` 渲染 transcript 文本
  - 传 `outcome={kind: 'empty-never'}` 渲染 `copy.empty`
  - 传 `outcome={kind: 'empty-cleared'}` 渲染 `copy.empty`
  - 传 `outcome={kind: 'failed-retryable'}` 渲染 `copy.failedRetryable` + retry Button；按钮 click 触发 `onRetry`
  - `onRetry` 缺失时按钮 disabled
- **GREEN**：修改 `SegmentTranscriptView.tsx`，新 props 与渲染分支
- **REFACTOR**：保留原行为；删除旧 `transcript: { exists, text }` prop

### T4.2 MemoryStudio segment transcript 调用方

- **RED**：在 `MemoryStudio.test.tsx`（或 `LoadedWorkspaceFrame.test.tsx`）新增 case：
  - 一个 `lastAttempt='failed'` 的 segment 在转录 tab 上显示「上次生成转录失败」+「重试」按钮
  - 点击按钮调用 `onRetrySegmentTranscription({workspaceId, memoryId, segmentId})`
  - `lastAttempt='never'` 仍显示「这段录音还没有转录。」无按钮
- **GREEN**：MemoryStudio 内转录 tab 把 `(segmentProjection.lastTranscriptionAttempt, segmentContent?.transcript)` 转为 `outcome`；新增 `onRetrySegmentTranscription` prop
- **REFACTOR**：抽出 `deriveTranscriptOutcome` helper（segment + supplement 共用）

### T4.3 MemoryStudio supplement transcript 调用方

- **RED**：在 `MemoryStudio.test.tsx` 新增 case：
  - 一个 `lastAttempt='failed'` 的 supplement 在 supplement tab 上显示「上次生成补充录音转录失败」+「重试」按钮
  - 点击按钮调用 `onRetrySupplementTranscription({workspaceId, memoryId, segmentId, supplementId})`
- **GREEN**：MemoryStudio 内 supplement panel 同结构
- **REFACTOR**：复用 helper

### T4.4 App stub callback

- **RED**：在 `App.test.tsx` 新增 case：
  - 点击重试 → 触发 root toast「转录引擎尚未上线」（或同等 placeholder 文案）
- **GREEN**：App 内注入 `onRetrySegmentTranscription` / `onRetrySupplementTranscription`，body 调 `showReoToast` 或同等 placeholder
- **REFACTOR**：抽出 stub 函数

## 阶段 5：B-1 RecordingOverlay finalize 传新字段

### T5.1 RecordingOverlay finalize call 携带 `lastTranscriptionAttemptOnFinalize`

- **RED**：在 `RecordingOverlay.test.tsx` 新增 case：
  - 录音前 `voiceSettings.enabled=true` → finalize 调用携带 `'failed'`
  - 录音前 `voiceSettings.enabled=false` → finalize 调用携带 `'never'`
  - `voiceSettings` 未加载时不能 finalize（已有行为，验证不退化）
- **GREEN**：RecordingOverlay 在 finalize 调用处按 `transcriptionEnabled` 决定字段；对 supplement finalize 对称
- **REFACTOR**：抽出常量 / helper

### T5.2 RecordingOverlay 异常恢复 finalize 也传字段

- **RED**：恢复 marker 路径（App 内）finalize 调用补字段
- **GREEN**：App 内 marker→finalize 路径补字段；marker 自身**不**保存该字段（恢复时按当前 voice settings snapshot 重新判定）
- **REFACTOR**：注释说明"marker 不存该字段，按当前 settings 判定"

## 阶段 6：B-2 Sidebar 红点

### T6.1 Settings IconButton 叠加 dot

- **RED**：在 `AppShell.test.tsx`（或对应 sidebar 测试文件）新增 case：
  - `voiceSettings.lastValidationCode='auth'` → IconButton 内出现 `data-testid="voice-credentials-dot"` 元素
  - `lastValidationCode='ok'` → 不存在
  - `lastValidationCode='network'` → 不存在（与 plan 共识）
  - voiceSettings query loading → 不存在
- **GREEN**：在 Settings IconButton 内复用 `useQuery(voiceSettingsQueryOptions())`，按条件渲染 dot
- **REFACTOR**：抽出 `<VoiceCredentialsDot/>` feature-local 子组件

### T6.2 不影响 click 行为 / 不引入键盘焦点

- **RED**：dot 不影响 IconButton click → 仍切 `appMode='settings'`；dot 设 `aria-hidden`，键盘 tab 顺序不变
- **GREEN**：dot 用 `<span aria-hidden="true">`，绝对定位
- **REFACTOR**：抽出常量样式

### T6.3 录音中行为

- **RED**：录音中点击 Settings IconButton → root toast「先完成或关闭录音」（现状）；dot 仍可见
- **GREEN**：已有行为，验证不退化
- **REFACTOR**：无

## 阶段 7：文档同步

- T7.1 更新 `docs/current/data.md`：finalized projection 字段表 + manifest 字段段落 + absent 视为 'never' 规则
- T7.2 更新 `docs/current/flow.md`：finalize / saveTranscript / completion backfill 段落补 manifest 字段写入语义
- T7.3 更新 `docs/current/frontend.md`：`SegmentTranscriptView` failed-retryable 渲染 + Sidebar Settings IconButton 红点
- T7.4 更新 `docs/current/electron.md`：finalize IPC request 新字段段落

这一阶段是文档同步；**TDD 豁免**，但内容必须与代码事实完全一致。

## 阶段 8：归档与下一步

- T8.1 `npm run verify:quick` 全绿
- T8.2 git diff 自查：无遗漏 `docs/current/*` 段落
- T8.3 把 spec 移入 `docs/archive/specs/2026-05-16-1806-doubao-voice-unfinished-visualization/`（必须先确认 spec objective 全部完成）
- T8.4 启动 subagent 收口审查（按 initiative tasks.md 的"收口审查节点"）
- T8.5 调整 c-brief.md 与 d-brief.md（如必要）
- T8.6 进入 C 的 spec 创建

## 测试覆盖矩阵

| 路径                           | 单元 / 集成 | 文件                                                      |
| ------------------------------ | ----------- | --------------------------------------------------------- |
| manifest schema                | unit        | `memoryFiles.test.ts`                                     |
| finalize write                 | unit        | `recordingDrafts.test.ts`                                 |
| saveTranscript update          | unit        | `memoryFiles.test.ts` (transcript save 段)                |
| projection derive              | unit        | `workspaceFiles.test.ts`                                  |
| absent 行为                    | unit        | `memoryFiles.test.ts`                                     |
| user-cleared 行为              | unit        | `memoryFiles.test.ts` + `MemoryStudio.test.tsx`           |
| SegmentTranscriptView 渲染     | component   | `SegmentTranscriptView.test.tsx`                          |
| MemoryStudio 集成              | integration | `MemoryStudio.test.tsx` / `LoadedWorkspaceFrame.test.tsx` |
| App stub callback              | integration | `App.test.tsx`                                            |
| RecordingOverlay finalize call | integration | `RecordingOverlay.test.tsx`                               |
| Sidebar dot                    | component   | `AppShell.test.tsx`                                       |
| recovery marker 恢复 finalize  | integration | `App.test.tsx` 恢复 marker 段                             |

## 提交边界（建议）

- commit 1：T1.1 + T1.2 + T1.3（schema + projection）
- commit 2：T2.1 + T2.2（finalize write path）
- commit 3：T2.3（saveTranscript update）
- commit 4：T3.1 + T3.2（旧文件行为校验）
- commit 5：T4.1（SegmentTranscriptView refactor）
- commit 6：T4.2 + T4.3 + T4.4（MemoryStudio + App callback）
- commit 7：T5.1 + T5.2（RecordingOverlay finalize call）
- commit 8：T6.1 + T6.2 + T6.3（Sidebar dot）
- commit 9：T7.\* 文档同步
- commit 10：归档移动

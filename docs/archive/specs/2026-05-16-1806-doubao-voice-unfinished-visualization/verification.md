# 边界情况 + 验收 + 最终复核

## 边界情况补齐（每条含场景 / 触发 / 处理 / 界面反馈 / 文案 / 数据保护 / 验收）

### B-1：UI 边界

| #   | 场景                                 | 触发                                                                | 处理规则                                                                               | 界面反馈                                | 建议文案                 | 数据保护                            | 验收                                                                    |
| --- | ------------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------ | ----------------------------------- | ----------------------------------------------------------------------- |
| 1   | 旧 segment 缺字段                    | manifest 缺 `lastTranscriptionAttempt`                              | derived 为 `'never'`                                                                   | 显示 `copy.empty`                       | 「这段录音还没有转录。」 | manifest 不被回写                   | 单测：absent → projection 'never'；集成：旧 fixture 不显示重试按钮      |
| 2   | 凭证恢复后 manifest 仍 `'failed'`    | 用户保存新 key，C 未跑                                              | UI 仍显示「上次失败 / 重试」                                                           | 按钮可点击 → stub toast                 | 「转录引擎尚未上线」     | manifest 不动                       | 集成：键盘焦点 + click 可达                                             |
| 3   | 用户外部清空 transcript              | Finder 编辑 segment.md 删 `## Transcript`                           | snapshot refresh 后 `exists=false`，manifest 仍 `'success'`                            | 显示 `copy.empty`，无按钮               | 「这段录音还没有转录。」 | manifest 不动                       | 集成：fixture 模拟外部清空                                              |
| 4   | 同一 segment 反复点重试              | 快速点击「重试」按钮                                                | stub callback 同步触发；不防抖（无 IPC）                                               | 每次 toast 显示一次                     | 「转录引擎尚未上线」     | 不写文件                            | 集成：连点 3 次产生 3 个 toast（或同一 toast 更新，按 sonner 默认行为） |
| 5   | 切 segment 时按钮焦点                | 用户在 segment A 转录 tab 内按 Tab 到「重试」按钮，再切到 segment B | segment B 转录 tab 进入；如果 B 也是 failed-retryable，焦点应回到 transcript view 起点 | 按 React key 控制 unmount/mount         | n/a                      | n/a                                 | 集成：切 segment 不抛 focus 异常                                        |
| 6   | Query 仍 loading                     | Memory detail 已 ready，但 segment content query loading            | `SegmentTranscriptView` 显示 `copy.loading`，不展示按钮                                | 「正在载入转录内容。」                  | n/a                      | n/a                                 | 单测：loading 优先级高于 outcome                                        |
| 7   | Query 失败                           | segment content query error                                         | 显示 `copy.error`，不展示按钮                                                          | 「转录加载失败，请重试。」              | n/a                      | n/a                                 | 单测：error 状态不渲染按钮                                              |
| 8   | supplement 转录失败                  | supplement manifest `'failed'` ∧ exists=false                       | 与 segment 对称                                                                        | 「上次生成补充录音转录失败。」+「重试」 | 同左                     | n/a                                 | 集成：supplement tab 切换显示                                           |
| 9   | 选中的 supplement 在 reorder 中      | drag/drop 重新排序内容 tab                                          | 重排不影响 transcript outcome                                                          | 无                                      | n/a                      | n/a                                 | 集成：reorder 后 outcome 仍正确                                         |
| 10  | finalize 时 voiceSettings 仍 loading | RecordingOverlay 不允许 finalize（已有行为）                        | finalize 调用本不会触发                                                                | n/a                                     | n/a                      | n/a                                 | 现有 RecordingOverlay loading guard 不退化                              |
| 11  | finalize 成功后 saveTranscript 失败  | transcript 文本非空但 saveTranscript 返回错误                       | manifest 保持 `'failed'`；recovery marker 路径不变                                     | root toast 显示错误（现状）             | 现状文案                 | manifest + recovery marker 双重保存 | 集成：marker 持有 finalized projection + transcript snapshot            |
| 12  | recovery marker 恢复后 finalize      | 用户在崩溃后选择"保存恢复"                                          | finalize 调用按当前 `voiceSettings.enabled` 决定字段（不读 marker 中字段）             | 与正常 finalize 一致                    | n/a                      | marker 不写该字段                   | 集成：marker 路径调 finalize 携带正确字段                               |

### B-2：红点边界

| #   | 场景                           | 触发                                                    | 处理规则                                                    | 界面反馈                 | 建议文案 | 验收                                    |
| --- | ------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------- | ------------------------ | -------- | --------------------------------------- |
| 13  | settings 第一次启动            | voiceSettings query 尚未有结果                          | dot hidden                                                  | 无                       | n/a      | 单测：query loading 不显示 dot          |
| 14  | settings query 永久失败        | IPC 异常或 main 持续返回错误                            | dot hidden（与"未知不展示"一致）                            | 无                       | n/a      | 不通过 dot 表达 query 错误              |
| 15  | 保存 key 后 probe 成功         | `lastValidationCode='ok'`                               | dot 立即消失                                                | 平滑切换，无动画         | n/a      | 集成：手动模拟 invalidate 'auth' → 'ok' |
| 16  | 保存 key 后 probe network 失败 | `lastValidationCode='network'`                          | dot **不**显示（按共识：只覆盖 auth）                       | 无 dot                   | n/a      | 单测：network 不触发 dot                |
| 17  | 录音中点击 settings            | Sidebar Settings button click 时 recording overlay 打开 | dot 显示不变；click 触发现有 root toast「先完成或关闭录音」 | toast 出现，appMode 不切 | 现状文案 | 集成：dot 不影响录音中行为              |
| 18  | clear API key                  | 用户清除 key → `lastValidationCode=undefined`           | dot 隐藏                                                    | 无                       | n/a      | 集成：clear 流程后 dot 消失             |
| 19  | 跨 workspace 切换              | 切到另一个 workspace                                    | dot 不变（settings 是 app-scoped）                          | 无变化                   | n/a      | 集成：切 workspace 不触发 dot 重渲染    |
| 20  | dot 与 macOS dark mode         | 切 light/dark theme                                     | dot 颜色仍是 `bg-destructive`，可见                         | n/a                      | n/a      | 视觉手验                                |

### B-0：manifest schema 边界

| #   | 场景                                | 触发                                            | 处理规则                                                                              | 验收                          |
| --- | ----------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------- |
| 21  | 第三方写非法字段值                  | 外部工具改 manifest 写 `'unknown'`              | strict schema reject → typed error envelope → unsafe manifest 处理                    | 单测：非法值不进入 projection |
| 22  | manifest 文件不存在                 | 用户删 `.reo/objects/segments/<id>.json`        | 现有 `ERR_WORKSPACE_SEGMENT_NOT_FOUND` 行为不变                                       | 不引入新错误码                |
| 23  | manifest 字段类型错                 | `lastTranscriptionAttempt: 42`                  | strict reject                                                                         | 单测：number 不接受           |
| 24  | manifest 字段为空字符串             | `lastTranscriptionAttempt: ''`                  | strict reject（不在 literal union）                                                   | 单测：空字符串不接受          |
| 25  | finalize 同时 saveTranscript 同时来 | 并发 finalize+save 同 segmentId                 | 现有 memory write lock 串行；任一失败按现行 envelope                                  | 集成：现有锁不退化            |
| 26  | finalize 流程不带新 request 字段    | request 缺 `lastTranscriptionAttemptOnFinalize` | request schema 接受缺字段；main 按 `'never'` 写入 manifest                            | 单测：缺字段路径派生 never    |
| 27  | recovery marker 不存该字段          | marker 自身 schema 不变                         | marker 仅承载 `memoryId/segmentId/...`，新字段由 finalize 时刻按 `voiceSettings` 决定 | 单测：marker schema 严格不变  |

### 全局工程边界

| #   | 场景                                        | 处理                                                         |
| --- | ------------------------------------------- | ------------------------------------------------------------ |
| 28  | `npm run verify:quick` 失败                 | 阻断本 spec 收口                                             |
| 29  | TypeScript strict 失败                      | 阻断                                                         |
| 30  | 现有 vitest 测试退化                        | 阻断                                                         |
| 31  | renderer 首屏渲染时间                       | 不能因 voiceSettings 多读引入额外 round-trip（query 已存在） |
| 32  | 多 worker 测试并发                          | manifest fixture 不共享磁盘路径（已有 isolation 模式）       |
| 33  | macOS 红绿灯 region 与 sidebar dot 几何冲突 | dot 在 Settings IconButton 内部，距离 traffic light 行足够远 |
| 34  | 高分屏 dot 模糊                             | 使用 1rem-based geometry 不写 sub-pixel                      |
| 35  | reduced motion                              | dot 静态，不引入动画                                         |
| 36  | 多人协作                                    | n/a（Reo 单用户本机）                                        |

## 验收清单（收口状态）

### 收口验证证据

- 2026-05-16 America/Los_Angeles：`npm run verify:quick` 通过；覆盖 `typecheck`、`test:main` 613 个用例、`test:renderer` 403 个用例、`lint` 和 `format:check`。
- B spec 已归档到 `docs/archive/specs/2026-05-16-1806-doubao-voice-unfinished-visualization/`；`docs/specs/` 为空。
- `docs/current/data.md`、`docs/current/flow.md`、`docs/current/frontend.md` 和 `docs/current/electron.md` 已与 B 的当前代码事实对齐。
- 运行时手动 / 视觉验证项保留为后续人工 QA 建议；本次 CLI 收口以自动化验证、代码复审和 current docs 对齐为归档证据。

### 代码事实

- [x] `segmentObjectManifestSchema` 与 `supplementObjectManifestSchema` 含 optional `lastTranscriptionAttempt`，strict 保留
- [x] `FinalizedAudioSegmentProjection` 与 supplement projection 含必填 `lastTranscriptionAttempt: 'success' | 'failed' | 'never'`
- [x] `WorkspaceFinalizeRecordingDraftRequest` 与 supplement finalize request 含可选 `lastTranscriptionAttemptOnFinalize?: 'failed' | 'never'`；缺失按 `'never'`
- [x] finalize main handler 把 request 字段写入 manifest
- [x] saveTranscript main handler 在 segment.md write 成功后同步 update manifest 为 `'success'`
- [x] manifest update 与 segment.md write 共用 lock；任一失败 → 同步走 typed error envelope
- [x] absent 字段 → projection 派生 `'never'`
- [x] `SegmentTranscriptView` props 重构为 `outcome` model
- [x] `MemoryStudio` 两处调用方使用 `outcome`
- [x] `App.tsx` 注入 stub `onRetrySegmentTranscription` / `onRetrySupplementTranscription`，body 调 root toast
- [x] `RecordingOverlay` finalize call 携带 `lastTranscriptionAttemptOnFinalize`
- [x] Recovery marker 路径 finalize call 携带正确字段
- [x] Settings IconButton 内 dot 复用 `voiceSettingsQueryOptions()`；条件 `lastValidationCode === 'auth'`
- [x] dot 不影响 IconButton click；`aria-hidden`
- [x] 不新增 IPC channel
- [x] 不新增 Query key
- [x] 不新增 npm 依赖

### 文档事实

- [x] `docs/current/data.md`：finalized projection 字段表 + manifest 字段段落
- [x] `docs/current/flow.md`：finalize / saveTranscript 段落补 manifest 字段写入语义
- [x] `docs/current/frontend.md`：`SegmentTranscriptView` failed-retryable + Sidebar dot
- [x] `docs/current/electron.md`：finalize IPC request 新字段

### 测试事实

- [x] 所有新增测试通过
- [x] `npm run verify:quick` 全绿
- [x] 新增 segment / supplement 测试覆盖 success / failed / never 三态
- [x] absent 字段路径有独立测试
- [x] 用户外部清空 transcript 路径有独立测试
- [x] Sidebar dot 在 auth / ok / network / loading / 录音中交互状态下有断言；query error 按未知不展示原则由 loading/no-data 路径保护

### 后续人工 QA 建议（未作为本次 CLI 归档门禁）

- [ ] 启动 Reo dev server
- [ ] 录一段 audio，关闭 ASR toggle 后 finalize → 转录 tab 显示「这段录音还没有转录。」，无按钮
- [ ] 打开 ASR toggle 但故意填错 key（probe auth 失败）→ Sidebar 红点出现
- [ ] 录一段 audio 期间断网 → finalize 后转录 tab 显示「上次生成转录失败。」+「重试」按钮；点击 → toast「转录引擎尚未上线」
- [ ] 修正 key → probe ok → Sidebar 红点消失
- [ ] 切换 light / dark theme → 红点仍可见
- [ ] 切换 workspace → 红点状态不变

## 最终复核（归档事实）

- [x] 基于最新输入（initiative plan.md @ 2026-05-16 18:06 America/Los_Angeles）
- [x] 每个状态都有产品说明和工程说明（success / failed / never × loading / ready）
- [x] 包含完整状态切换（B-1 UI state machine + B-2 dot state machine + lastAttempt manifest state machine）
- [x] 包含边界情况（36 项）
- [x] 包含异常处理（schema reject / write failure / query loading / query error）
- [x] 包含数据规则（manifest absent → never；用户外部清空不动 manifest）
- [x] 包含权限规则（不引入新 permission）
- [x] 包含验收标准（代码 / 文档 / 测试；运行时手验项已降级为后续人工 QA 建议）
- [x] README.md 末尾包含"最终目标总结"长段
- [x] 内容可以直接复制给工程师（plan.md 文件改动清单 + tasks.md TDD 顺序已可直接执行）
- [x] 未跨越 B 范围进入 C / D 实施

## 收口产出物（spec 进 archive 时必须存在）

- 本目录五个文件保持完整
- `docs/current/data.md` / `docs/current/flow.md` / `docs/current/frontend.md` / `docs/current/electron.md` 已同批更新
- `docs/initiatives/2026-05-16-doubao-voice-followups/tasks.md` B 行从 `[ ]` 改为 `[x]` + 归档路径
- 进入 archive：`docs/archive/specs/2026-05-16-1806-doubao-voice-unfinished-visualization/`

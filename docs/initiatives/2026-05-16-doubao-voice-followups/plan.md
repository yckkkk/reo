# 计划

本计划承接 2026-05-16 brainstorm 收口共识。E 已完成；B 已完成、归档并通过真机 E2E gate；C 已实现并归档；剩余 D 在 C→D readiness gate 后推进。
`docs/current/*` 与源码事实优先于本计划；本计划只保留剩余工作的顺序、边界和 readiness gate。

## 已落地输入合同

- B 已归档：`docs/archive/specs/2026-05-16-1806-doubao-voice-unfinished-visualization/`
- B 真机 E2E gate 已通过：2026-05-17 America/Los_Angeles 使用 `REMOTE_DEBUGGING_PORT=9233 npm run dev` 启动真实 Electron runtime，验证普通 Segment、SegmentSupplement 与 Settings auth 红点路径。
- `lastTranscriptionAttempt` 字段、派生规则、finalize IPC 字段、transcript UI 与 Sidebar 红点的当前事实以 `docs/current/data.md` / `docs/current/electron.md` / `docs/current/frontend.md` / `docs/current/flow.md` 为准。
- C/D 只消费这些 current 合同；本 initiative 不再复制字段值域、写入时机或 UI 判定细节。

## C：自动补转录

- 执行入口：`docs/initiatives/2026-05-16-doubao-voice-followups/c-brief.md`
- 当前状态：C 已实现，归档路径为 `docs/archive/specs/2026-05-17-0029-doubao-voice-auto-backfill/`。
- C 引擎基线已改为大模型录音文件识别标准版 2.0 `volc.seedasr.auc`；极速版 `volc.bigasr.auc_turbo` 因成本与跨族问题不作为默认实现路径。
- C-0b 交付方案是 main-only TOS staging + short-lived GET URL + cleanup，配合 WebM/Opus -> OGG/Opus remux；不得用公开本地服务、公网隧道或默认未配置对象存储上传绕过。
- C0 findings 已写入 C spec；长期结论写入 ADR 0005。
- 真实 X-Api-Key 已通过标准版 2.0 `volc.seedasr.auc` submit/query smoke，证明同 key 可访问 AUC；ffmpeg remux 已改为随应用安装 binary；完整 Reo C live backfill 仍需真实 TOS staging 配置才能验证，不阻塞 D 复用 C 的 manual IPC 合同。

## D：手动重新生成转录

- 执行入口：`docs/initiatives/2026-05-16-doubao-voice-followups/d-brief.md`
- D 只能在 C 归档后进入 active spec。
- D 的产品与工程细节以 d-brief.md 为准。

## 推进顺序与 readiness gate

### 顺序：C → D（保持）

### Readiness gates（每个 transition 只执行一次）

- **B→C readiness gate**：已完成。B 归档后已重读 current 相关段落、B 归档 spec、initiative plan/tasks/c-brief/d-brief 与代码事实；B 真机 E2E gate 已通过。该 gate 只允许下一 session 进入 C 重新审视与 active spec 创建，不授权直接实施 C。
- **C→D readiness gate**：C 归档后，重读 C 归档 spec、current 相关段落、d-brief 与代码事实；确认 D 复用 `workspace:requestSegmentTranscriptionBackfill` 与 `workspace:requestSegmentSupplementTranscriptionBackfill` 后，才能创建 D active spec。
- **D→archive readiness gate**：D 归档后，重读 current 与 tasks；确认 B/C/D 全部完成后，才能归档本 initiative。

若任一 gate 调整面超过 30%，回到 brainstorm 重新对齐。

### 完成条件

- B / C / D 各自 spec 完成、归档；稳定结论压缩进 `docs/current/*` 或 `docs/decisions/*`
- C0 探针结论沉淀为 `docs/decisions/0005-doubao-voice-file-asr-baseline.md`
- 本 initiative 移入 `docs/archive/initiatives/2026-05-16-doubao-voice-followups/`

## 禁止项（不变）

- 不在没有新 spec 的情况下添加 hidden retry / More menu / 后台任务 / endpoint fallback
- voice X-Api-Key 不引入环境变量凭证、双 header 鉴权或平台密钥路径；C 的 main-only TOS staging 需要运行环境显式配置，ffmpeg 默认使用随应用安装 binary 且 env path 只作为 override；renderer 不接触这些配置
- 不把 endpoint 选择写成 runtime 自动切换
- 不跳过 C0 探针直接进入 C-1/C-2/C-3 实施

## 时间戳

本计划版本：2026-05-17 America/Los_Angeles

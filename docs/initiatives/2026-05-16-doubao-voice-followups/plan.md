# 计划

本计划承接 2026-05-16 brainstorm 收口共识。E 已完成；B/C/D 三项按 B → C → D 串行推进。
`docs/current/*` 与源码事实优先于本计划；本计划只保留剩余工作的顺序、边界和 readiness gate。

## 已落地输入合同

- B 已归档：`docs/archive/specs/2026-05-16-1806-doubao-voice-unfinished-visualization/`
- `lastTranscriptionAttempt` 字段、派生规则、finalize IPC 字段、transcript UI 与 Sidebar 红点的当前事实以 `docs/current/data.md` / `docs/current/electron.md` / `docs/current/frontend.md` / `docs/current/flow.md` 为准。
- C/D 只消费这些 current 合同；本 initiative 不再复制字段值域、写入时机或 UI 判定细节。

## C：自动补转录

- 执行入口：`docs/initiatives/2026-05-16-doubao-voice-followups/c-brief.md`
- C spec 的 Phase 0 / Gate 0 是 C0 探针；C0 通过前不得实施 C-1/C-2/C-3。
- C0 findings 必须写入 C active spec；只有长期结论在 C0 通过后压缩进 ADR。
- C 的产品与工程细节以 c-brief.md 为准。

## D：手动重新生成转录

- 执行入口：`docs/initiatives/2026-05-16-doubao-voice-followups/d-brief.md`
- D 只能在 C 归档后进入 active spec。
- D 的产品与工程细节以 d-brief.md 为准。

## 推进顺序与 readiness gate

### 顺序：B → C → D（保持）

### Readiness gates（每个 transition 只执行一次）

- **B→C readiness gate**：B 归档后，重读 current 相关段落、B 归档 spec、initiative plan/tasks/c-brief/d-brief 与代码事实；更新 C/D brief 与 tasks 后，才能创建 C active spec。
- **C→D readiness gate**：C 归档后，重读 C 归档 spec、current 相关段落、d-brief 与代码事实；确认 C 的手动触发合同足以支撑 D 后，才能创建 D active spec。
- **D→archive readiness gate**：D 归档后，重读 current 与 tasks；确认 B/C/D 全部完成后，才能归档本 initiative。

若任一 gate 调整面超过 30%，回到 brainstorm 重新对齐。

### 完成条件

- B / C / D 各自 spec 完成、归档；稳定结论压缩进 `docs/current/*` 或 `docs/decisions/*`
- C0 探针结论沉淀为新 ADR 或扩展 `docs/decisions/0004-doubao-voice-asr-endpoint-baseline.md`
- 本 initiative 移入 `docs/archive/initiatives/2026-05-16-doubao-voice-followups/`

## 禁止项（不变）

- 不在没有新 spec 的情况下添加 hidden retry / More menu / 后台任务 / endpoint fallback
- 不引入环境变量凭证、双 header 鉴权或平台密钥路径
- 不把 endpoint 选择写成 runtime 自动切换
- 不跳过 C0 探针直接进入 C-1/C-2/C-3 实施

## 时间戳

本计划版本：2026-05-16 18:06 America/Los_Angeles

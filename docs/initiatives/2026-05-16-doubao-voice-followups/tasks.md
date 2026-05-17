# 任务

## 已完成

- [x] **E**：`bigmodel_async` vs `bigmodel` endpoint 校正 + probe 计费核实。
  - 归档：`docs/archive/specs/2026-05-16-1720-doubao-voice-endpoint-billing-audit/`
  - 决策：`docs/decisions/0004-doubao-voice-asr-endpoint-baseline.md`
  - 结论：当前 endpoint 三元组（`bigmodel_async` + `volc.seedasr.sauc.duration` + 单 `X-Api-Key`）为 SeedASR 2.0 推荐配置，无需调整。

## 待推进（按顺序）

- [x] **B**：未转录状态可视化
  - 归档：`docs/archive/specs/2026-05-16-1806-doubao-voice-unfinished-visualization/`
  - 验收：见 spec verification.md
  - 真机 E2E gate：2026-05-17 America/Los_Angeles 使用 `REMOTE_DEBUGGING_PORT=9233 npm run dev` 验证真实 Electron runtime；覆盖普通 Segment 三态、SegmentSupplement failed retry、Settings auth 红点与设置页失败状态。
  - 收口：current docs 已同步；B→C readiness gate 已执行。
  - **B→C readiness gate**：已执行；C/D brief 与本 tasks.md 已按 B 归档后的 current/code 事实更新

- [x] **C**：自动补转录
  - brief：`docs/initiatives/2026-05-16-doubao-voice-followups/c-brief.md`
  - 归档：`docs/archive/specs/2026-05-17-0029-doubao-voice-auto-backfill/`
  - 当前状态：C 已实现；真实 X-Api-Key 已通过 `volc.seedasr.auc` submit/query smoke；完整 Reo C live backfill 待 TOS/ffmpeg 配置验证。
  - 进入 C spec 前的硬前置：
    - B 已归档（B 的 manifest 字段是 C 的输入合同）
    - B→C readiness gate 已完成
    - B 真机 E2E gate 已通过
    - C session 已重新读取 current docs、initiative README/plan/tasks/c-brief 与 ADR 0004
    - C session 已完成 C brainstorm 与引擎选型确认：标准版 2.0 是 C 默认引擎；极速版因成本与跨模型族问题不作为默认路径
  - C spec 内执行顺序：
    - C-0a：官方文档选型与能力矩阵已完成；结论写入 C 归档 spec 与 ADR 0005
    - C-0b：已采用 main-only TOS staging + short-lived GET URL + cleanup；不得用公开本地服务、公网隧道或默认未配置对象存储上传绕过
    - C-0 findings 写入 C 归档 spec；长期结论压缩到 ADR 0005
  - 验收：见 C spec verification.md
  - 收口：current docs / decisions 已同步
  - **C→D readiness gate**：见 plan.md；只执行一次，完成后再开 D 的 spec

- [ ] **D**：手动重新生成转录
  - brief：`docs/initiatives/2026-05-16-doubao-voice-followups/d-brief.md`
  - 进入 D spec 前的硬前置：
    - B 已归档
    - C 已归档（D 复用 C 引擎合同、manual IPC 与中间态展示）
  - 验收：在 D spec verification.md 内
  - 收口：归档 spec + 同步对应 current docs
  - **D→archive readiness gate**：见 plan.md；只执行一次，完成后再归档本 initiative

## 全部完成后

- [ ] 把 initiative 移入 `docs/archive/initiatives/2026-05-16-doubao-voice-followups/`
- [ ] 确认 `docs/specs/` 为空或只剩明确 active spec

## 时间戳

本任务列表版本：2026-05-17 America/Los_Angeles

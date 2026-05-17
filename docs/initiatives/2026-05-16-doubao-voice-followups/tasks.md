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

- [ ] **C**：自动补转录
  - brief：`docs/initiatives/2026-05-16-doubao-voice-followups/c-brief.md`
  - 当前状态：待重新审视并 spec 化；不得直接按 brief 实施。
  - 进入 C spec 前的硬前置：
    - B 已归档（B 的 manifest 字段是 C 的输入合同）
    - B→C readiness gate 已完成
    - B 真机 E2E gate 已通过
    - 下一 session 已重新读取 current docs、B 归档 spec、initiative README/plan/tasks/c-brief/d-brief 与代码事实
    - 下一 session 已完成 C brainstorm，明确 C 是否保持当前目标、是否裁剪范围、是否重排 C0/C1/C2/C3
  - C spec 内执行顺序：
    - 先完成 C-0 / Gate 0（离线 flash endpoint 可用性 + key 复用 + 单次时长上限）
    - C-0 通过后才允许进入 C-1/C-2/C-3 实施
    - C-0 findings 写入 C active spec；长期结论再压缩到 ADR
  - 验收：在 C spec verification.md 内
  - 收口：归档 spec + 同步对应 current docs / decisions
  - **C→D readiness gate**：见 plan.md；只执行一次，完成后再开 D 的 spec

- [ ] **D**：手动重新生成转录
  - brief：`docs/initiatives/2026-05-16-doubao-voice-followups/d-brief.md`
  - 进入 D spec 前的硬前置：
    - B 已归档
    - C 已归档（D 复用 C 引擎合同与中间态展示）
  - 验收：在 D spec verification.md 内
  - 收口：归档 spec + 同步对应 current docs
  - **D→archive readiness gate**：见 plan.md；只执行一次，完成后再归档本 initiative

## 全部完成后

- [ ] 把 initiative 移入 `docs/archive/initiatives/2026-05-16-doubao-voice-followups/`
- [ ] 确认 `docs/specs/` 为空

## 时间戳

本任务列表版本：2026-05-17 00:14 America/Los_Angeles

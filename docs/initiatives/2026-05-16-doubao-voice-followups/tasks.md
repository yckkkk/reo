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
  - 归档 spec：`docs/archive/specs/2026-05-17-0512-doubao-voice-auto-backfill-turbo/`
  - 当前状态：C 已按 Turbo `audio.data` 路径完成；旧标准版 `audio.url` / TOS staging 方案已归档为 superseded。
  - C 收口事实：
    - B 已归档（B 的 manifest 字段是 C 的输入合同）
    - B→C readiness gate 已完成
    - B 真机 E2E gate 已通过
    - C 已完成重新对齐：普通个人用户只配置 X-Api-Key，默认引擎是支持 `audio.data` 的极速版
    - C 已确认 Turbo flash 官方 `audio.data`、单 X-Api-Key、格式限制、WebM/Opus 本地 remux 和真实 API smoke
    - C 已交付 main queue、手动 IPC/preload/renderer、生命周期和诊断
    - 不得用标准版 URL、公开本地服务、公网隧道、默认对象存储或 TOS 配置绕过
    - 长期结论已压缩到 ADR 0005
  - 验收：见 C 归档 spec verification.md
  - 收口：已同步对应 current docs / decisions
  - **C→D readiness gate**：下一步执行；只执行一次，完成后再开 D 的 spec

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

本任务列表版本：2026-05-17 America/Los_Angeles

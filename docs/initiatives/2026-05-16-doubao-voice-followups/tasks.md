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
  - **C→D readiness gate**：已执行；D brief 已按 C 归档、真实 E2E/QA 和源码事实更新

- [ ] **D**：手动重新生成转录
  - brief：`docs/initiatives/2026-05-16-doubao-voice-followups/d-brief.md`
  - active spec：`docs/specs/2026-05-17-0950-doubao-voice-manual-regenerate-transcript/`
  - 当前状态：D active spec 已创建并准备好下一 session 直接执行；本 session 未写 D 代码。
  - 实施 session 入口：阅读 spec README/goal/plan/tasks/verification → 按 tasks.md 的 Stage 1–8 串行 + subagent 分工推进。
  - 当前合同决策（来自 spec）：
    - 在两个现有 backfill IPC 上扩展显式 `mode: 'fill-missing' | 'regenerate'` 字段；Reo 未发布不保留旧 missing-only request 兼容垫片
    - main 端 regenerate 路径在 in-flight 捕获 transcript snapshot digest，save 前比对，不一致返回新增 `ERR_BACKFILL_TRANSCRIPT_CHANGED`
    - 自动 scanner / automatic batch 永远只入队 fill-missing；automatic 路径不接受 regenerate
    - 不新增 main-to-renderer event channel、TanStack Query key、Zustand store、manifest schema 字段或第二条队列
  - 验收：在 D spec verification.md 内（含自动化命令、6 条真实 Electron runtime QA 场景、敏感信息扫描、5 份 current docs 同步证据、100% confidence loop 出口条件）
  - 收口：归档 spec + 同步对应 current docs
  - **D→archive readiness gate**：见 plan.md；只执行一次，完成后再归档本 initiative

## 全部完成后

- [ ] 把 initiative 移入 `docs/archive/initiatives/2026-05-16-doubao-voice-followups/`
- [ ] 确认 `docs/specs/` 为空

## 时间戳

本任务列表版本：2026-05-17 America/Los_Angeles

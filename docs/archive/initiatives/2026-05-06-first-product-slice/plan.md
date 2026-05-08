# 计划

## 阶段

1. Design-hardening gate：已通过，归档后位于 `docs/archive/specs/2026-05-06-0912-first-product-slice-product-grade-design-hardening/`。
2. Reconciled implementation plan：已通过 `$writing-plans` 对抗审查，不写入 `docs/superpowers/*`。
3. Plan engineering review：已通过 `$plan-eng-review` 对抗审查，无 unresolved BLOCKER/MAJOR。
4. Plan handoff：将最终任务清单同步回本 initiative，更新 design spec 的 review/verification，然后归档 design-hardening spec。
5. TDD implementation：使用 `$executing-plans` 或 subagent-driven development，在隔离 worktree 中逐 slice 执行，每次只保留一个 active task spec。
6. QA/review/verification/commit：按 current docs、active initiative、当前 task spec 和源码事实完成。

## 执行权威

Implementation 阶段执行权威：

- `docs/current/*`
- `docs/initiatives/2026-05-06-first-product-slice/implementation-plan.md`
- 当前 initiative README、plan 和 tasks
- 当前唯一 active task spec
- 源码事实

Archived specs 和 archived initiatives 只作为历史背景。

## 实施任务顺序

1. Workspace 文件真源、atomic write、durable memory、recording nested path 和 recover/rebuild。
2. 显式 IPC/preload、sender validation、microphone intent 和 media permission contract。
3. Workspace entry create/open、RHF + Zod、folder picker 和错误分支。
4. App shell、可拖动 sidebar、悬浮内容面板、lucide icon-only controls 和基础导航。
5. Home 页面 local search、月份分组、memory card、空状态和禁止 future capability。
6. Memory detail high-fidelity 当前范围和 More future wireframe boundary。
7. 移除 `RecordingOverlay` mock transcript，拆分录音状态和副作用。
8. Recording drawer、ElevenLabs waveform/source retokenize、录音控制和全部当前状态。
9. Mic sequencing、MediaRecorder adapter、draft append、finalize transaction 和错误恢复。
10. 本地 playback、transcript/reflections 编辑和文件优先保存。
11. App integration、routing、query/cache ownership、forbidden capability audit。
12. Runtime QA、reference comparison、accessibility、security 和 release verification。
13. Docs/current 压缩、initiative 收口、最终 review、verification 和 commit。

# 实施计划对齐

## 已替换的归档决策

归档 implementation plan 和上一轮 design-hardening 只作为历史证据，不是 corrected first product slice 的执行权威。

已被本 spec 替换的决定：

- “First product slice 不显示完整 sidebar”已被替换。当前设计要求 layered app shell，并覆盖 sidebar rail、expanded、resizing 和 collapse 动画。
- “Recording overlay 使用 Radix Dialog bottom sheet layout，不引入 Vaul dependency”已被替换。当前设计要求采用 shadcn Drawer/Vaul，除非 implementation task 记录明确 blocker、fork 或 fallback。
- “Live Waveform/Waveform 只提供 visual model；first slice 使用 lightweight state bars”已被替换。当前设计要求采用或裁剪 ElevenLabs UI waveform source，除非记录适配失败原因。
- “wavesurfer.js deferred”过弱。若 playback、scrubber 或长音频波形进入实现，它仍是必须评估的候选。
- “Mock transcript”不得作为真实转写显示。当前设计只能把 transcript 作为手写草稿，真实 STT 必须等待新的 foundation。

## 可复用的当前基础

可以保留为 foundation：

- Electron sandbox、contextIsolation 和 security baseline。
- 显式 preload API pattern。
- Workspace handle、token 和 path containment。
- Workspace 文件真源和可重建 index。
- Recording draft append/finalize transaction tests。
- RHF + Zod form owner。
- TanStack Query provider 和 snapshot cache pattern。
- Renderer/main test harness。

必须返工：

- `WorkspaceHome` UI 层级和 app shell。
- `CreateWorkspaceForm` 产品级 entry flow 和状态。
- `RecordingOverlay` 容器、视觉层级、waveform 和 editor 状态。
- drawer、editor、audio 复杂度增加后必须拆分组件目录。
- 实现完成后，`docs/current/*` 不得继续描述 first slice 排除 sidebar 或 Vaul。

## `$writing-plans` 输入

Reconciled implementation plan 必须：

1. 从本 active spec 出发，不从 archived plan 出发。
2. 围绕 UI shell、开源组件采用、data contracts、drawer/recording、editor/playback 和 verification 拆分 implementation slices。
3. 每个代码或行为 slice 保持 TDD RED/GREEN/REFACTOR。
4. 从 main checkout 实施时使用隔离 worktree。
5. 只在代码事实改变时更新 `docs/current/*`。
6. 每个完成 slice 都带验证证据并独立 commit。

## 计划落点

`$writing-plans` 必须遵守 Reo 文档生命周期，不使用 skill 默认路径。

本轮已采用的落点：

- `docs/specs/2026-05-06-0912-first-product-slice-product-grade-design-hardening/reconciled-implementation-plan.md`
- `docs/initiatives/2026-05-06-first-product-slice/implementation-plan.md`

禁止：

- 不得把可执行计划写入 `docs/superpowers/*`。
- 不得编辑 archived implementation plan。

## 门禁结论

- Design-hardening gate：PASS。
- `$writing-plans`：PASS。
- `$plan-eng-review`：PASS。

本 reconciliation 的长期结论已转交 active initiative。归档后，本文件只作为背景证据。

# 复杂度与性能收敛

## 目标

按优先级修复全库复杂度审查发现的所有问题，降低长录音、大记忆空间、补转录队列、renderer 渲染和验证工具链的重复扫描、同步阻塞、重复分配和无界等待风险。

## 范围

- Main process 文件真源、workspace index、recording draft、finalize、registry、workspace open/rename。
- 豆包流式 ASR、finalized audio backfill、backfill queue、scanner、Turbo request。
- Renderer App cache merge、Memory Studio、Recording Overlay、transcript preview、MemoryRail、pending delete projection。
- scripts、tests、lint、verify、Vitest、main test runner。

## 非目标

- 不引入新产品能力。
- 不引入 database、auth、updater、packaging、Sentry、Zustand 或 remote telemetry。
- 不改变 Electron sandbox、context isolation、Node integration、permission、custom protocol 或 IPC 安全边界。
- 不为了优化常数改写 `workspaceDirectoryTransactions.ts` 的 fd-relative safety model。

## 完成条件

- `tasks.md` 中所有 P1、P2、P3、P4 任务完成或被源码证据明确合并、取消。
- 每个行为改动都有 RED/GREEN/REFACTOR 证据。
- 涉及 `docs/current/*` 门禁的改动同批更新对应 current 真源。
- 完成时运行并通过 `npm run verify:quick`。
- 涉及 build/tooling 的最终批次运行并通过 `npm run verify:strict`。
- 涉及 Memory Studio 视觉或布局的批次运行对应 runtime 视觉验证。
- 涉及 ASR/backfill/audio 热路径的批次记录目标 benchmark 或可重复测量命令。

## 当前执行入口

完成 spec：

- `docs/specs/2026-05-17-2300-complexity-optimization/`

## 完成状态

- T01-T61 已全部完成。
- 完成验证：`npm run verify:quick`。
- 完成时间：2026-05-18 01:39 America/Los_Angeles。

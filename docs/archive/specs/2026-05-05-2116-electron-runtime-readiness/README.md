# Electron Runtime Readiness

## 时间

2026-05-05 21:16 America/Los_Angeles

## 目标

完成 foundation-completion initiative Task 03：判断当前是否需要新增 preload/IPC，并把 Electron runtime readiness 边界压缩回 current docs。

## TDD 豁免

本 slice 不改变 runtime 行为，不新增 preload、IPC、handler、renderer API 或测试 runner。

TDD 豁免：不执行 RED/GREEN/REFACTOR。验证以 Context7/官方文档核对、源码事实核对、`npm run verify:quick`、`npm run build`、Electron runtime evidence、docs lifecycle checks 和多轮 review 为准。

## 范围

- 核对 renderer 是否有真实主进程特权能力需求。
- 若没有真实 consumer，保持 preload/IPC absent。
- 更新 `docs/current/electron.md` 和 `docs/current/flow.md`，记录当前 readiness 判断。
- 更新 initiative Task 03 状态并归档本 spec。

# 代码库简化基础

## 当前状态

- 状态：complete
- 类型：已完成的产品或代码开发 initiative
- 归档 spec：`docs/archive/specs/2026-05-15-2222-codebase-simplification-start-gate`

## 目标

在不改变用户可见行为、不新增 runtime surface、不引入兼容层的前提下，逐步收敛两类重复结构：

- main process 的文件事务 helper：减少 `process.chdir`、directory identity、`fsync`、safe cleanup、open-in-directory 和 directory rename 的重复实现。
- renderer 的实体 action wrapper：让 Memory Space、Memory、Segment 和 SegmentSupplement 的只读系统动作通过统一、可测试的 action binding 进入 `EntityActionMenu`，减少 wrapper 里的直接 bridge 调用和重复菜单 wiring。

## 非目标

- 不新增 IPC channel、preload API、DB、auth、packaging、updater、telemetry 或 generic runtime。
- 不改变实体 More 菜单视觉、文案、组结构、toast 文案、Dialog owner、optimistic update、delete/restore 或 Query ownership。
- 不把业务组件提前提升为通用设计系统 primitive。
- 不把文件事务 helper 扩成任意 filesystem abstraction；helper 只表达当前 Reo workspace directory identity 和 transaction 不变量。

## 完成条件

- `src/main` 中重复的 directory fsync、validated cwd critical section、open/remove/read directory entry helper 收敛到一个当前命名清楚的 helper 模块，并由 focused main tests 覆盖。
- `memoryFiles.ts`、`recordingDrafts.ts`、`atomicWorkspaceFile.ts`、`workspaceFiles.ts` 和 `workspaceLock.ts` 中的迁移保持原有 lock、identity、rollback、cleanup 和 stale/unsafe path 行为。
- 四类 renderer entity action menu wrapper 不再直接调用 `window.reoWorkspace`；直接 bridge access 只留在 `workspaceApi.ts` 或等价窄 API owner 中。
- `docs/current/flow.md`、`docs/current/frontend.md` 和 `docs/current/quality.md` 只在项目级模式实际改变时更新为当前事实。
- 每个实现 spec 按 RED/GREEN/REFACTOR 收口，并在收口前通过 `npm run verify:quick`。

## 采用依据

- Node.js v22 fs 文档确认 `fs.constants`、exclusive open、`fsyncSync`、`renameSync`、`linkSync`、`rmSync` / `rmdirSync` 行为存在平台差异；Reo helper 必须继续保留当前 unsafe path、directory identity 和 best-effort directory fsync 规则。
- React 官方文档建议只在共用逻辑能让组件表达 intent、封装外部系统同步或消除有意义重复时抽取 hook/component；本 initiative 的 renderer 抽取只处理 entity shell action binding，不迁移 owner state。

## 收口状态

完成条件已收口到 `docs/current/flow.md`、`docs/current/frontend.md` 和 `docs/current/quality.md` 的当前事实；后续代码开发需要创建新的 active spec。

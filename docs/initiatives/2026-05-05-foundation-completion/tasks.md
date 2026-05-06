# Tasks

## 子任务状态

- [x] Task 01：Initiative scope、成功标准、非目标、10 天节奏、每个 slice 的验收门槛。
- [x] Task 02：Quality/Test 完整化，Vitest gate、renderer/component test 边界、verify 命令分层。
- [x] Task 03：Electron runtime readiness，preload/IPC 真实 consumer 判断，禁止 generic bridge。
- [x] Task 04：Data foundation，Drizzle、`better-sqlite3`、migration、schema ownership。
- [x] Task 05：Auth foundation，Better Auth Electron、session lifecycle、secure persistence。
- [x] Task 06：Data fetching/state/forms foundation，TanStack Query、Zustand、React Hook Form、Zod 的实际归属。
- [x] Task 07：Component/UI foundation gate，shadcn 初始化条件与真实 consumer。
- [x] Task 08：Logging/error foundation，electron-log、Sentry、error shape、diagnostic boundary。
- [ ] Task 09：Packaging/update foundation，Forge、fuses、ASAR、signing、notarization、electron-updater 顺序。
- [ ] Task 10：Full foundation closeout，current 压缩、decisions、verification matrix、archive、handoff prompt。

## 全局门槛

- 每个 task 必须先创建 `docs/specs/YYYY-MM-DD-HHMM-*/`。
- 每个 task 只能推进一个可验证 foundation slice。
- 每个 task 都必须先核对对应 `docs/current/*`。
- 每个 task 必须重新核对相关官方资料；涉及实现时优先 Context7 和官方 docs。
- 每个行为改动 task 必须执行 RED -> GREEN -> REFACTOR。
- 每个 task 收口前必须运行 `npm run verify:quick`。
- 每个 task 收口前必须运行 `npm run build`，除非该 task 的 spec 明确说明无构建相关风险且用户接受豁免。
- 每个 task 收口前必须运行 `git diff --check`、`diff -u AGENTS.md .claude/CLAUDE.md`、`git ls-files out dist build .vite .tmp`、`find docs/specs -mindepth 1 -maxdepth 1 -print`、`git status --short`、`git ls-files --others --exclude-standard`。
- 涉及 Electron security、protocol、preload、IPC、permission、navigation、production loading、logging 或 updater 的 task，必须额外执行 `docs/current/electron.md` 要求的 runtime evidence。
- 每个 commit 前必须运行独立 `$review` 风格审查，覆盖完整 diff 和 untracked files。
- 每个 commit 前必须运行多轮 subagent 审查和 Claude CLI review；阻断项必须修完并复审通过。
- 每个 task 收口后必须归档 spec，`docs/specs` 回到空状态。

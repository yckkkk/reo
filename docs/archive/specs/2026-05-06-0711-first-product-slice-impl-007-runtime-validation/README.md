# IMPL-007 Runtime、persistence、reference 和 Codex 只读验证

创建时间：2026-05-06 07:11 America/Los_Angeles

## 目标

验证第一产品切片在 production Electron runtime 中可用，workspace 磁盘文件可被 Codex CLI 只读理解，并完成长期任务收口前的证据链。

## 范围

- 运行 automated verification：`npm run verify:quick`、`npm run build`。
- 启动 Electron production runtime，验证 URL、CSP、window-open、navigation、permission、workspace create、recording overlay、playback、save、disk tree。
- 记录 stable workspace files 和 hash before/after。
- 运行 Codex CLI read-only validation，确认 CLI 能读取 workspace `AGENTS.md`、`recording.json`、`transcript.md`、`reflections.md`，且 hash 不变。
- 对照参考素材记录 home/overlay/micro-interaction evidence。
- 更新 current docs 和 active initiative 完成状态。

## TDD 声明

本切片是 runtime validation slice。运行态验证发现 recording finalize 竞态后，已按 RED -> GREEN -> REFACTOR 修复，并把证据记录在 `tdd.md`。

## 完成条件

- `npm run verify:quick`、`npm run build` 通过。
- Electron runtime 操作验证完成。
- `recording.json`、`.reo/index.json` 和 `audio.webm` 实际大小一致。
- Codex CLI read-only validation 完成，hash before/after 不变。
- `git diff --check`、`diff -u AGENTS.md .claude/CLAUDE.md`、`find docs/specs -mindepth 1 -maxdepth 1 -print` 通过。
- Active initiative 完成并按文档生命周期归档。

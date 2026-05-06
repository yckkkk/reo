# 执行计划

## 验证步骤

1. 运行 `npm run verify:quick` 和 `npm run build`。
2. 启动 Electron production runtime，并记录 production URL、CSP header、新窗口拒绝、外部导航拒绝、权限默认拒绝。
3. 使用 Computer Use 完成 workspace 创建、record action、record/pause/resume/stop、playback、transcript/reflections 编辑。
4. 记录 workspace disk tree：`AGENTS.md`、`.reo/workspace.json`、`.reo/index.json`、`recordings/<id>/audio.webm`、`transcript.md`、`reflections.md`、`recording.json`。
5. 对稳定 metadata 和用户内容做 hash before/after；排除 `.reo/workspace.lock*` 和 temp files。
6. 关闭或静置 Reo workspace，确认没有 append/autosave/playback in-flight，并核对 finalized recording 不再接受 late append。
7. 运行 `codex --version` 和 `codex exec --help`，确认 read-only sandbox、`--cd`、`--skip-git-repo-check`、`--ephemeral` 可用。
8. 运行 Codex CLI read-only validation，并确认 hash 不变。
9. 对照 `/private/tmp/reo-reference-frames/` 和本地参考素材记录结构证据。
10. 若 runtime validation 发现真实缺陷，补 RED 测试、修复、重新 build 和重新 runtime 验证。
11. 更新 current docs、active initiative、spec review/verification。
12. 归档 spec，提交：`test: validate first product slice runtime`。

## 不改代码规则

- 未发现真实缺陷时不改产品代码。
- 发现缺陷时必须先记录可复现失败或写自动失败测试。
- 不扩大 scope 到 packaging/updater、真实 STT、waveform、Vaul、future capability。

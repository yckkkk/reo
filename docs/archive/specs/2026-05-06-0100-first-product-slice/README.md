# First Product Slice

时间：2026-05-06 01:00 America/Los_Angeles
状态：设计中

## 目标

设计 Reo 第一个真实产品功能闭环：用户创建本地 memory workspace，在 workspace 内录音，录音时看到实时 mock transcription，停止后编辑 transcript 与 reflections，并把所有产物保存为 Codex CLI 可读取的普通 workspace 文件。

## 范围

- 本 spec 只做产品、设计、工程和 QA/Test 设计。
- 不实现代码。
- 不安装依赖。
- 不初始化 shadcn/ui。
- 不创建 generic runtime、agent runtime、voice agent、generic IPC bridge 或 generic service layer。
- 不做 film generation。

## TDD 豁免

本 session 是纯文档/设计阶段，没有行为代码改动，因此 RED -> GREEN -> REFACTOR 暂不执行。后续 implementation plan 必须为录音状态机、workspace 初始化、文件写入、autosave、恢复和错误路径定义真实 TDD 切片。

## 输入上下文

已读取：

- `AGENTS.md`
- `README.md`
- `docs/README.md`
- `docs/current/foundation.md`
- `docs/current/architecture.md`
- `docs/current/electron.md`
- `docs/current/frontend.md`
- `docs/current/quality.md`
- `docs/current/data.md`
- `docs/current/flow.md`
- `docs/archive/initiatives/2026-05-05-foundation-completion/closeout.md`
- `docs/archive/initiatives/2026-05-05-foundation-completion/handoff.md`

参考资料：

- 用户提供的 memory recording UI 图片与视频。
- 原始参考素材目录：`/Users/yck/Downloads/PM/设计参考/记忆录音/`。
- 视频抽帧临时分析目录：`/private/tmp/reo-reference-frames/`，仅作本 session 视觉理解证据，不进入 git。
- Obsidian 官方文档：vault 是本地文件夹，`.obsidian` 保存 vault 配置，attachments 是普通文件。
- Zettlr 官方文档：project 以文件夹为单位组织，项目内可以保留任意文件。

## 产物

- `spec.md`：联合设计规格。
- `tasks.md`：设计阶段任务记录。
- `review.md`：本地对抗性审查。
- `verification.md`：验证记录。

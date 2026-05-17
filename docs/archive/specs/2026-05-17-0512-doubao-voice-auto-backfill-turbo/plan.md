# 计划

## T0：C-0 重新对齐

- 已归档被产品约束否定的标准版 URL/TOS active spec。
- 已更新 ADR 0005：C 默认引擎是 `volc.bigasr.auc_turbo`，理由是普通个人用户只配置 `X-Api-Key`。
- 已记录官方 Markdown、官方页面、本地 flash demo 与 subagent 调研结论。
- 已采用 WebM/Opus 到 OGG/Opus 的本地 ffmpeg remux；ffmpeg binary 随 app 依赖安装，不要求用户系统预装。

## T1：Main 后台引擎

已新增 main-owned 模块：

- `src/main/doubaoAucTurboClient.ts`
- `src/main/backfillAudioDataSource.ts`
- `src/main/backfillQueue.ts`
- `src/main/backfillScanner.ts`
- `src/main/backfillRuntime.ts`
- `src/main/backfillDiagnostics.ts`

当前行为：

- client 构造 `audio.data` 请求并解析 `X-Api-Status-Code`，包括 `45000010` auth 映射。
- source 从 finalized audio read helper 读取 bytes，转换为 OGG/Opus，生成 base64，但不把 base64 暴露到日志或 renderer。
- queue 串行执行，manual 入队首但不抢占，auto 受 N=20/K=3 保护。
- runtime 负责 active workspace scope、voice settings 读取、saveTranscript 调用和取消。
- trigger wiring 由 `workspaceIpc.ts` 注册处持有，绑定 workspace ready、voice settings 成功、recording pause/resume 和 workspace close lifecycle，不创建独立 generic trigger service。
- scanner 只收集 `lastTranscriptionAttempt='failed'` 且 `transcript.exists=false` 的 Segment/Supplement。

## T2：IPC / preload / renderer 手动重试

- 已新增两个显式 workspace IPC channel。
- 已扩展 contract schema、bridge type、preload 方法和 renderer `workspaceApi` wrapper。
- `SegmentTranscriptView` 已增加 `running` outcome。
- `App.tsx` 已用 feature-local set 管理手动 running target，替换 placeholder retry。
- 成功后更新现有 Workspace snapshot / Memory detail / selected content query；失败显示脱敏文案并清 running。

## T3：生命周期、诊断、E2E/QA

- 录音 overlay open 时暂停自动出队，close 后 resume。
- workspace switch、lock lost、renderer gone、app quit cancelAll。
- diagnostics 使用现有 allowlist 事件。
- 已使用真实 API key 跑 Turbo smoke；已运行 dev app 做 Electron runtime QA。

## T4：文档收口与归档

- 已更新 `docs/current/electron.md`、`data.md`、`flow.md`、`frontend.md`、`quality.md`。
- 已更新 initiative README/plan/tasks/c-brief。
- 当前 spec 已在最终验证后归档。
- 已运行 format、targeted tests、verify:quick、git diff --check。
- review 与 ycksimplify 使用多个 subagent，有效发现已处理后提交。

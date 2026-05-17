# 工程实现说明（C）

## Main Process

- `src/main/c0SeedAsrAucClient.ts`：标准版 2.0 submit/query client，处理 processing、queued、success、auth、rate-limit、network、timeout、empty-audio、quota、size、format、malformed 和 abort。
- `src/main/backfillAudioUrlSettings.ts`：解析显式 TOS 配置，ffmpeg 默认使用随应用安装 binary，`REO_BACKFILL_FFMPEG_PATH` 仅作为 override。缺少 TOS 或无法解析 ffmpeg binary 时返回 unconfigured，不默认上传。
- `src/main/backfillAudioUrlSource.ts`：WebM/Opus -> OGG/Opus remux、TOS PUT、short-lived GET URL、cleanup、abort。
- `src/main/backfillQueue.ts`：FIFO、manual head insert、dedup、pause/resume、cancel、batch cap、breaker、URL cleanup、manual await。
- `src/main/backfillRuntime.ts`：把 read finalized audio、URL source、AUC client、auto save 串成 workspace queue。
- `src/main/backfillScanner.ts`：从 workspace file truth 收集 failed-empty Segment 与 SegmentSupplement。
- `src/main/backfillTriggerWiring.ts`：voice settings ok 上升沿、workspace ready 上升沿、once-per-ready、recording pause、workspace switch/lock lost cancel。
- `src/main/backfillDiagnostics.ts`：复用现有 main diagnostics allowlist。

## IPC / Preload / Renderer

- 新增 IPC：
  - `workspace:requestSegmentTranscriptionBackfill`
  - `workspace:requestSegmentSupplementTranscriptionBackfill`
- 新增 preload bridge 与 renderer `workspaceApi` wrapper。
- `SegmentTranscriptView` 支持 `running` outcome。
- `App.tsx` 持有 feature-local manual running target sets，替换 placeholder retry。
- `MemoryStudio` 和 `LoadedWorkspaceFrame` 只透传 running target state，不新增 store。

## 数据与安全

- 不新增 DB、migration、manifest 字段、Query key 或 Zustand store。
- Durable source 仍是 `segment.md` / `supplement.md` 与 manifest `lastTranscriptionAttempt`。
- Renderer 不接触 Node/Electron API、raw path、audio bytes、provider URL、TOS credential 或 X-Api-Key。
- Preload 仍只暴露窄 `window.reoWorkspace` product methods。

## 错误语义

- Backfill-specific typed errors：voice disabled、API key missing、already running、target not eligible、provider failed、audio URL unconfigured、audio URL failed、canceled。
- Lock lost 继续复用 `ERR_WORKSPACE_LOCK_LOST`。
- Manual target 必须是 finalized audio、transcript empty、`lastTranscriptionAttempt='failed'`。

## 外部验证边界

本地自动化证明代码路径、签名形态、cleanup、IPC 和 UI state；真实 SeedASR/TOS smoke 需要用户提供可用配置和承担一次小样本调用成本。

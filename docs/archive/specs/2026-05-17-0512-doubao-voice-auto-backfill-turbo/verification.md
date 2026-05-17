# 验证

## C-0 证据

- 官方 Markdown：`/Users/yck/Downloads/PM/技术线/reo文件区/大模型录音文件极速版识别API.md`
- 官方页面：`https://www.volcengine.com/docs/6561/1631584?lang=zh`
- 本地 demo：`/Users/yck/Downloads/PM/技术线/reo文件区/auc_python/auc_flash_demo.py`
- 子代理结论：Turbo flash 支持 `audio.data`，新版控制台单 `X-Api-Key`，限制 2h / 100MB / WAV-MP3-OGG OPUS。
- 真实 safeStorage key smoke：HTTP 200，`X-Api-Status-Code: 20000000`，`X-Api-Message: OK`，`X-Tt-Logid: 20260517211433432A5C8DA5318717FD92`。Smoke 没有输出 key、base64、raw path 或 transcript 原文。
- 旧 `.env.local` 旧控制台字段作为 `X-Api-Key` 均返回 `45000010 Invalid X-Api-Key`，不作为 Reo 当前产品路径。
- Dev runtime QA：`REMOTE_DEBUGGING_PORT=9233 npm run dev` 启动真实 Electron runtime；CDP 只读检查返回 `hasGenericInvoke=false`、`hasGenericSend=false`、`hasSegmentBackfill=true`、`hasSupplementBackfill=true`、`settingsOk=true`、`apiKeyConfigured=true`、`lastValidationOk=true`、`memorySpaceListOk=true`。

## 必须覆盖的测试

- `doubaoAucTurboClient.test.ts`
  - success
  - auth / rate-limit / network / timeout
  - empty-audio / silent-audio / size / format
  - malformed body
  - abort
  - request 不泄漏 key 到 error message
- `backfillAudioDataSource.test.ts`
  - WebM/Opus 输入转换为 OGG/Opus
  - 超过产品上限拒绝
  - 转换失败映射 typed error
  - cleanup
  - diagnostics 不含 raw path、audio.data、key
- `backfillQueue.test.ts`
  - FIFO
  - manual head insert
  - dedup
  - pause/resume
  - cancel/abort
  - batch cap N=20
  - breaker K=3
- `backfillScanner.test.ts`
  - failed + transcript missing eligible
  - success / exists true / never / non-finalized 不 eligible
  - segment + supplement 覆盖
- `backfillTriggerWiring.test.ts`
  - voice settings ok 上升沿
  - workspace ready 上升沿
  - once-per-ready
  - lock lost / workspace switch cancel
  - recording pause
- IPC/preload/renderer
  - contract schema
  - workspace IPC handler
  - preload bridge mapping
  - workspaceApi wrapper
  - SegmentTranscriptView running
  - App 手动 retry 成功/失败/already-running

## 操作验证

- 使用真实 API key 运行 Turbo flash smoke，不打印 key、base64、raw path 或 transcript 原文。
- 启动 `npm run dev`，用真实 Electron runtime 验证：
  - 保存/验证 key 后自动任务触发。
  - failed-empty Segment 手动重试显示 running，成功后显示 transcript。
  - failed-empty SegmentSupplement 手动重试同样成功。
  - 录音 overlay open 时自动任务暂停。

## 已运行命令

```bash
npm run typecheck
npm run test:main -- --test-name-pattern='doubao AUC turbo|backfill audio data|backfill (scanner|queue)|workspace backfill runtime|scanWorkspaceBackfillTargets|workspace (IPC channels include|backfill request schemas|preload bridge exposes explicit)|registered closeWorkspace IPC closes'
npm run test:renderer -- --run src/renderer/src/workspace/SegmentTranscriptView.test.tsx
npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern='retrying a failed'
npm run test:renderer -- --run src/renderer/src/App.test.tsx --reporter=verbose
REMOTE_DEBUGGING_PORT=9233 npm run dev
npm run test:main -- --test-name-pattern='doubao AUC Turbo client maps service|registered closeWorkspace IPC closes|lock lost cancels|diagnostic error names'
npm run test:main -- --test-name-pattern='backfill audio data source|scanWorkspaceBackfillTargets|drops an automatic scan|registered workspace IPC fires|registered closeWorkspace IPC closes|diagnostic error names'
npm run test:main -- --test-name-pattern='cancels before transcript save|rejects manual target|resolves abort even when ffmpeg never closes|removes external abort listener'
npm run test:main -- --test-name-pattern='cancels before transcript save|rejects manual target|resolves abort even when ffmpeg never closes|removes external abort listener|scanWorkspaceBackfillTargets'
npm run test:main -- --test-name-pattern='scanWorkspaceBackfillTargets applies the automatic cap|backfill queue|diagnostic error names'
npm run test:main -- --test-name-pattern='closeWorkspace skips global backfill cancellation|finalized audio backfill reads accept'
npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern='transcription backfill' --reporter=verbose
npm run test:renderer -- --run src/renderer/src/settings/VoiceSettingsPanel.test.tsx --reporter=verbose
npm run test:renderer -- --run src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern='transcription retry' --reporter=verbose
npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern='releases the previous workspace handle|shows open-local workspace errors as toasts without losing' --reporter=verbose
npm run verify:quick
npm run format:check
git diff --check
```

结果：

- typecheck 通过。
- main targeted 631/631 通过；后续风险点 targeted 命令实际覆盖 main 全量，647/647 通过。
- SegmentTranscriptView 8/8 通过；App retry targeted 2/2 通过；App 全文件 85/85 通过；App transcription backfill targeted 3/3 通过。
- LoadedWorkspaceFrame transcription retry targeted 2/2 通过。
- Workspace switch targeted 3/3 通过，覆盖 persisted memory space、local workspace 切换释放旧 handle，并确认 open-local 失败时不丢失当前 workspace。
- VoiceSettingsPanel 16/16 通过；修复了非 C 改动引入的日期脆弱 fixture，未改产品行为。
- `npm run verify:quick` 通过：typecheck、main 646/646、renderer 405/405、lint、format。
- `npm run format:check` 通过。
- `git diff --check` 通过。
- dev runtime 启动成功并通过只读 CDP QA。

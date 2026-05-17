# 实施清单（C）

## T0：Gate 与前置

- [x] 官方文档确认标准版 2.0 submit/query、`volc.seedasr.auc`、URL-only `audio.url`、新版 `X-Api-Key` header。
- [x] 本地 demo 核对，确认旧版 / 极速版示例不能作为标准版 2.0 客户端基线。
- [x] 确认禁止公开本地 HTTP、公网隧道和默认未配置对象存储上传。
- [x] 选择 main-only TOS staging + short-lived GET URL + cleanup 作为 C-0b 交付方案。
- [x] 确认 WebM/Opus 先 remux 为 OGG/Opus；使用随应用安装的 ffmpeg binary，`REO_BACKFILL_FFMPEG_PATH` 只作为 override。
- [x] 评估 TOS SDK 并拒绝引入；实现 native TOS signing。
- [x] N=20、K=3 保持。
- [x] Live SeedASR AUC smoke：真实 X-Api-Key 调用 `volc.seedasr.auc` submit/query 成功。
- [ ] Live Reo SeedASR/TOS smoke：未执行，缺少真实 TOS 配置。

## T1：Main 后台引擎

- [x] `c0SeedAsrAucClient.ts` + tests
- [x] `backfillAudioUrlSettings.ts`
- [x] `backfillAudioUrlSource.ts` + tests
- [x] `backfillQueue.ts` + tests
- [x] `backfillRuntime.ts` + tests
- [x] `backfillScanner.ts` + tests
- [x] `backfillTriggerWiring.ts` + tests
- [x] `backfillDiagnostics.ts` + tests
- [x] `voiceSettingsStore.ts` 增加 snapshot listener
- [x] `index.ts` 接线 workspace ready、voice settings、recording pause、workspace switch、lock lost、app quit

## T2：IPC / Preload / Renderer

- [x] workspace contract 新增 2 个 request channel 和 backfill errors
- [x] `workspaceIpc.ts` 注册 manual segment/supplement handler
- [x] IPC handler 校验 sender、handle、workspaceId、lock、settings、manual eligibility
- [x] preload `workspaceBridge.ts` 暴露窄方法
- [x] renderer `workspaceApi.ts` wrapper
- [x] `SegmentTranscriptView` running outcome
- [x] `MemoryStudio` / `LoadedWorkspaceFrame` 透传 running sets
- [x] `App.tsx` 替换 placeholder retry，持有 feature-local optimistic running sets
- [x] `workspaceErrorMessages.ts` 增加 backfill 文案

## T3：暂停、breaker、诊断与集成

- [x] recording open pause、close resume
- [x] workspace switch / lock lost / renderer gone / app quit cancel
- [x] auto batch cap N=20
- [x] same errorCode consecutive K=3 breaker
- [x] manual bypass batch cap / breaker
- [x] diagnostics 不记录 transcript、raw path、audio URL、object key、TOS credential、X-Api-Key、title 或用户文本
- [x] auto save 前重读 transcript，避免覆盖已存在 transcript

## T4：文档同步与归档

- [x] `docs/current/electron.md`
- [x] `docs/current/flow.md`
- [x] `docs/current/data.md`
- [x] `docs/current/frontend.md`
- [x] `docs/current/quality.md`
- [x] ADR 0005
- [x] initiative README / plan / tasks
- [x] spec 归档到 `docs/archive/specs/2026-05-17-0029-doubao-voice-auto-backfill/`

## TDD 记录

本轮行为改动均以测试先行或失败测试驱动补齐。最终收口阶段新增的 manual eligibility 与 audio URL abort 先出现失败，再补实现并重跑 main backfill 测试。

收口风险修复的 TDD 记录：

- app protocol 日志脱敏：先运行 `npm run test:main -- --test-name-pattern "app protocol resolve warnings"`，失败于 helper 缺失；补 `appProtocolDiagnostics` 后发现直接 import Electron handler 不适合 Node test，改为可测试的 warning wrapper 并重跑通过。
- 新安装环境 ffmpeg fallback：先运行 `npm run test:main -- --test-name-pattern "packaged ffmpeg"`，失败于缺少默认 ffmpeg path；安装 `@ffmpeg-installer/ffmpeg` 并实现 main-only fallback 后重跑通过。
- 显式无 packaged binary 分支：新增 `packagedFfmpegPath: null` 测试后先失败，暴露 null 仍触发真实 package fallback；修成 undefined 才解析 package、null 表示缺失后重跑通过。
- review 后补强：新增默认生产 package resolution 测试和 app protocol warning wrapper 测试，避免只覆盖注入 seam 或纯 helper。

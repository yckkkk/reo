# 验证与最终复核（C）

## C-0b 验证

- [x] 官方文档验证标准版 2.0 URL-only `audio.url`、submit/query endpoint、resource id 和 header。
- [x] 官方文档验证极速版 base64 不适合作为 C 默认路径。
- [x] 本地 demo 验证只作为旧版 / 极速版补充证据。
- [x] TOS staging 方案满足 main-only、显式配置、短 TTL、cleanup、不暴露敏感数据。
- [x] WebM/Opus -> OGG/Opus remux 路径有单元测试。
- [x] TOS PUT/GET/DELETE native signing 有单元测试。
- [x] 真实 X-Api-Key AUC smoke：公开 demo MP3 URL 调用 `volc.seedasr.auc`，submit HTTP 200 / provider `20000000`，query HTTP 200 / provider `20000000`，109 次 query 后返回非空 transcript；未记录 transcript 正文、X-Api-Key 或 provider log id。
- [x] 新安装环境 ffmpeg 前置：无 `REO_BACKFILL_FFMPEG_PATH` 时使用随应用安装的 ffmpeg binary；显式 env path 仅作为 override。
- [ ] 完整 Reo SeedASR/TOS smoke：未执行；缺少真实 TOS 配置，无法覆盖本地 finalized WebM/Opus -> OGG/Opus -> TOS presigned GET -> AUC -> cleanup。

## 行为验收

- [x] AUC client submit success + query processing/queued/success
- [x] AUC auth / rate-limit / network / timeout / empty-audio / quota / size / format / malformed body / abort
- [x] Audio URL source lifecycle、format boundary、cleanup、abort、diagnostics sensitive-field absence
- [x] Queue FIFO、manual head insert、dedup、pause/resume、cancel/abort、N=20、K=3、manual bypass
- [x] Scanner failed + transcript missing eligible；success、exists true、non-finalized、zero-byte 不 eligible；Segment 和 Supplement 覆盖
- [x] Trigger wiring voice settings ok 上升沿、workspace ready 上升沿、once-per-ready、lock lost/workspace switch cancel、recording pause
- [x] IPC handler settings preflight、already-running、manual eligibility、save success、typed failure
- [x] preload / workspace API schema surface
- [x] `SegmentTranscriptView` running outcome
- [x] `App.tsx` manual optimistic running state
- [x] diagnostics allowlist

## 已运行验证

- `npx tsc -p tsconfig.main.json --noEmit --pretty false`：通过
- `npm run test:main -- --test-name-pattern "backfill|requestSegmentTranscriptionBackfill|requestSegmentSupplementTranscriptionBackfill|main bootstrap wires backfill"`：通过，662 tests passed
- `npx vitest run src/renderer/src/workspace/workspaceApi.test.ts src/renderer/src/workspace/SegmentTranscriptView.test.tsx src/renderer/src/App.test.tsx -t "backfill|transcription|SegmentTranscriptView|workspace renderer API wrapper" --reporter=verbose`：通过，14 passed，81 skipped
- `npm run format:check`：通过
- `npm audit --json`：通过，0 vulnerabilities
- `git diff --check`：通过
- `npm run verify:quick`：通过；typecheck、main tests 662/662、renderer tests 404/404、lint、format check 均通过
- `REMOTE_DEBUGGING_PORT=9233 npm run dev`：通过；真实 Electron runtime 启动，preload backfill methods 存在，renderer 无 `require/process/electron/ipcRenderer` 暴露，voice settings 显示 enabled/configured 且 validate 返回 `ok`
- 标准版 AUC live smoke：通过；`volc.seedasr.auc` submit/query 均返回 provider `20000000`，transcript length 8590
- `npm run test:main -- --test-name-pattern "backfill|requestSegmentTranscriptionBackfill|requestSegmentSupplementTranscriptionBackfill|main bootstrap wires backfill"`：通过，662 tests passed
- `npm run test:renderer -- --run src/renderer/src/workspace/SegmentTranscriptView.test.tsx src/renderer/src/workspace/MemoryStudio.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/workspaceApi.test.ts`：通过，3 files / 95 tests passed
- `npm run test:main -- --test-name-pattern "packaged ffmpeg|env ffmpeg override|missing ffmpeg|app protocol resolve warnings|app protocol resolve warning call|backfill audio URL|c0SeedAsrAucClient|requestSegmentTranscriptionBackfill|requestSegmentSupplementTranscriptionBackfill|main bootstrap wires backfill"`：通过，667 tests passed；覆盖 packaged ffmpeg default resolution、env override、missing fallback、app protocol warning wrapper、audio URL source、AUC client、manual IPC 和 backfill bootstrap
- `npm run verify:quick`：通过；typecheck、main tests 667/667、renderer tests 404/404、lint、format check 均通过

## 100% Confidence Loop

事实信心范围：

- 本地代码路径、IPC/security、queue lifecycle、renderer running state、diagnostics redaction 和 current docs 同步可由测试与源码证明。
- 标准版 AUC 外部服务与同 key 复用可由 live smoke 证明。
- 完整 Reo C 本地录音 backfill 仍需要真实 TOS 配置和一次小样本调用证明。最终状态必须标记为 DONE_WITH_CONCERNS，不能声称 TOS staging 已 live 验证。

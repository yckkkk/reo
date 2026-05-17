# 验证与最终复核（C）

## C-0b 验证

- [x] 官方文档验证标准版 2.0 URL-only `audio.url`、submit/query endpoint、resource id 和 header。
- [x] 官方文档验证极速版 base64 不适合作为 C 默认路径。
- [x] 本地 demo 验证只作为旧版 / 极速版补充证据。
- [x] TOS staging 方案满足 main-only、显式配置、短 TTL、cleanup、不暴露敏感数据。
- [x] WebM/Opus -> OGG/Opus remux 路径有单元测试。
- [x] TOS PUT/GET/DELETE native signing 有单元测试。
- [ ] 真实 SeedASR/TOS smoke：未执行；缺少真实 TOS/SeedASR 配置和计费授权。

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

## 100% Confidence Loop

事实信心范围：

- 本地代码路径、IPC/security、queue lifecycle、renderer running state、diagnostics redaction 和 current docs 同步可由测试与源码证明。
- 外部 live smoke 不能由本 session 证明；需要真实 TOS + SeedASR 配置和一次小样本调用。最终状态必须标记为 DONE_WITH_CONCERNS，不能声称外部服务已 live 验证。

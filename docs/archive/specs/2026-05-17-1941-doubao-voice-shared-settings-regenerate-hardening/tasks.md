# Tasks

## Stage 1: 建立新 spec 与需求真源

- [x] 写入 README、goal、plan、tasks、verification。
- [x] 核对最新用户补充：shared X-Api-Key、设置页 copy、regenerate dialog immediate close、optimistic running。
- [x] 不修改旧归档 spec 的历史语义。

## Stage 2: BackfillQueue committed result TDD

- [x] RED：新增测试，证明 cancel 后若 runTask 已返回带 response 的成功结果，queue 当前会误报 canceled。
- [x] GREEN：最小修改 `backfillQueue.ts`，保留带 response 的结果。
- [x] REFACTOR：保留旧测试，确认普通 late success without response 仍 canceled。
- [x] Targeted tests：`npm run test:main -- --run test/main/backfillQueue.test.ts --test-name-pattern='committed successful result|pause resume and cancel'`。

## Stage 3: Voice settings shared-key copy TDD

- [x] RED：更新 `VoiceSettingsPanel.test.tsx`，要求 switch aria/name、section copy、required hint、configured helper、clear dialog description 都表达 shared key。
- [x] GREEN：更新 `VoiceSettingsPanel.tsx` 文案。
- [x] REFACTOR：保证完整 key 仍只存在 input value，不渲染为文本。
- [x] Targeted tests：`npm run test:renderer -- --run src/renderer/src/settings/VoiceSettingsPanel.test.tsx`。

## Stage 4: docs/current 同步

- [x] 更新 `docs/current/frontend.md`：settings panel shared-key copy 与 regenerate optimistic close。
- [x] 更新 `docs/current/flow.md`：shared key gate 与 committed response cancel 语义。
- [x] 更新 `docs/current/quality.md`：新增测试覆盖和敏感信息边界。
- [x] 必要时核对 `docs/current/electron.md` 已准确表达 app-scoped settings channel 和 shared key。

## Stage 5: 自动化验证

- [x] Targeted main tests。
- [x] Targeted renderer tests。
- [x] `npm run verify:quick`。
- [x] `npm run format:check`。
- [x] `git diff --check`。

## Stage 6: 真实 Electron E2E

- [x] 启动 `REMOTE_DEBUGGING_PORT=9233 npm run dev`。
- [x] 在真实 app 设置页核对保存后 last4、verified 状态、shared-key copy。
- [x] Segment regenerate：确认点击后 dialog 立即关闭、旧正文保留、running 出现、成功后覆盖。
- [x] SegmentSupplement regenerate：确认点击后 dialog 立即关闭、旧正文保留、running 出现、成功后覆盖。
- [x] 记录 QA 证据到 `verification.md`。

## Stage 7: 安全扫描与 100% confidence loop

- [x] 扫描 git diff 与 runtime logs：真实 key、raw path、audio temp path、base64、digest、transcript 片段不得泄露。
- [x] 自问“对当前实现是否 100% 有事实信心？”若否，列出漏洞，回到对应 Stage 修复并重跑验证。

## Stage 8: 归档与 commit

- [x] 完成 verification.md。
- [x] 将 spec 移入 `docs/archive/specs/2026-05-17-1941-doubao-voice-shared-settings-regenerate-hardening/`。
- [x] 确认 `docs/specs/` 为空。
- [x] commit，不 push。

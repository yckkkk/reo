# Verification

## RED

- `npm run test:main -- --run test/main/backfillQueue.test.ts --test-name-pattern='cancel after a committed successful result preserves the response'`
  - 失败：manual task 在 cancel 后把已返回 `response` 的成功结果改报 `{ ok:false, errorCode:'canceled' }`。
- `npm run test:renderer -- --run src/renderer/src/settings/VoiceSettingsPanel.test.tsx --testNamePattern='VoiceSettingsPanel'`
  - 失败：设置页仍使用「流式语音识别」和旧 helper/清除确认文案，未表达 shared X-Api-Key。
- `npm run test:main -- --run test/main/backfillQueue.test.ts --test-name-pattern='cancel after a committed falsey response preserves the result'`
  - 失败：`response:false` 被 truthiness 判断误当作未提交结果并改报 canceled。
- `npm run test:main -- --run test/main/backfillRuntime.test.ts --test-name-pattern='allows manual fill-missing for never-attempted finalized audio'`
  - 失败：manual fill-missing 对 finalized audio 严格要求 failed attempt，导致用户真实点击「生成转录」被误提示已生成。
- `npm run test:main -- --run test/main/backfillRuntime.test.ts test/main/backfillQueue.test.ts --test-name-pattern='manual supplement fill-missing|skips automatic targets that are no longer failed-only|cancel after a committed falsey response preserves the result'`
  - 失败：修复 manual fill-missing 后，automatic runtime preflight 被误放宽到 never/success；测试证明 automatic target 不应进入 remux。

## GREEN / REFACTOR

- `BackfillQueue` 改为以 `result.response !== undefined` 判断 committed result，保留 `response:false` 等 falsey 结果；没有 response 的 late success 仍按 canceled 处理。
- `VoiceSettingsPanel` 文案统一为「豆包语音识别」，并说明同一 X-Api-Key 同时用于录音实时转写、录音文件生成转录和重新生成转录。
- manual fill-missing 使用 `audioByteLength > 0 && !transcript.exists`；automatic scanner/runtime 继续使用 failed-only predicate。
- 新增 Segment 与 SegmentSupplement manual fill-missing tests，覆盖 `lastTranscriptionAttempt=never/success` 且 transcript empty 的 finalized audio。
- 新增 automatic stale preflight regression，确认 automatic target 变成 never/success 后不会 remux、不会 save。

## 自动化

- Targeted main：
  - `npm run test:main -- --run test/main/backfillRuntime.test.ts test/main/backfillQueue.test.ts --test-name-pattern='manual fill-missing for finalized audio without transcript|manual supplement fill-missing|skips automatic targets that are no longer failed-only|backfill scanner excludes success, never, existing transcript, and zero-byte audio|cancel after a committed falsey response preserves the result'`
  - 结果：pass，`678/678`。
- Targeted renderer：
  - `npm run test:renderer -- --run src/renderer/src/settings/VoiceSettingsPanel.test.tsx src/renderer/src/App.test.tsx --testNamePattern='VoiceSettingsPanel|opens voice settings|regenerate transcript'`
  - 结果：pass，相关测试 `17/92`。
- `npm run verify:quick`
  - 第一次 fresh run：typecheck、main `678/678`、renderer `420/420`、lint 均通过；`format:check` 发现 `src/main/backfillRuntime.ts` 格式问题，已修复。
  - 第二次 fresh run：exit 0；typecheck 通过，main `678/678`，renderer `420/420`，lint 通过，内置 `format:check` 通过。
- `npm run format:check`：exit 0，所有匹配文件符合 Prettier。
- `git diff --check`：exit 0。

## Electron E2E

- 启动命令：`REMOTE_DEBUGGING_PORT=9233 npm run dev`，CDP 连接端口 `9233`。
- Preload 结构检查：`window.reoWorkspace` 存在；未暴露 generic `invoke/send`。
- 设置页 shared-key：
  - 显示「豆包语音识别」。
  - 显示「同一个 X-Api-Key 用于录音实时转写，以及录音文件的生成转录和重新生成转录。」
  - 显示 `末 4 位 9151` 与已验证状态。
  - DOM 文本不包含完整 X-Api-Key。
  - switch accessible name 为「启用豆包语音识别」。
- Segment fill-missing：
  - 修复前真实点击无 transcript finalized Segment 的「生成转录」会误报已生成；修复后同一入口可触发 manual fill-missing 并写入转录。
- Segment regenerate：
  - 点击「重新生成转录」后出现覆盖确认。
  - 点击确认后 100ms 级别 dialog 从 DOM 消失。
  - 旧正文保留，running 文案出现。
  - 后端完成后 running 消失，无错误 toast，正文由 ASR 结果覆盖。
- TRANSCRIPT_CHANGED 外部编辑保护：
  - regenerate 期间写入外部文本。
  - 后端返回 conflict toast；dialog 已关闭；running 消失。
  - 文件保留外部文本，不被 ASR 结果覆盖。
  - 再次真实 UI regenerate 可恢复为 ASR 结果。
- SegmentSupplement regenerate：
  - 通过现有 `window.reoWorkspace` 窄 preload 读取 finalized Segment 音频、创建 SegmentSupplement draft、append、finalize、保存旧 transcript，未手改 workspace 文件。
  - UI 中出现补充录音 tab，旧 transcript 可见。
  - hover 显示「补充录音2 更多操作」，菜单包含「重新生成转录」。
  - 点击确认后 120ms 级别 dialog 从 DOM 消失；旧正文保留；显示「正在生成补充录音转录」。
  - 后端完成后 running 消失，无错误 toast，旧正文被 ASR 结果覆盖。

## 敏感信息扫描

- 归档前 fresh scan 对 `git diff` 与 `/tmp/reo-shared-settings-e2e-runtime.log` 扫描：
  - 真实 X-Api-Key：未命中。
  - 长 base64-like 段：未命中。
  - runtime 明文 `X-Api-Key`：未命中。
  - runtime WebM/OGG/ffmpeg temp path：未命中。
  - runtime digest：未命中。
  - runtime transcript 片段：未命中。
- diff 内允许出现的 `X-Api-Key`、`digest`、`webm`、测试文案字样均为 UI 文案、类型/字段名或测试语义，不包含真实密钥、raw path、audio bytes、base64、ffmpeg path 或真实 digest。

## 100% confidence loop

- Loop 1 漏洞：设置页仍将 key 描述为只服务流式识别。修复：shared-key copy、aria-label、required/configured helper、clear dialog 全部更新；renderer tests 与真实 settings E2E 覆盖。
- Loop 2 漏洞：已提交的 backfill response 可能被晚到 cancel 改报 canceled。修复：以 `response !== undefined` 识别 committed result；覆盖 object response 与 falsey response。
- Loop 3 漏洞：manual fill-missing 对 finalized audio 过严，导致用户看到「生成转录」却无法生成。修复：manual 使用 transcript-empty + audio-present；Segment/Supplement 单元测试和真实 Segment E2E 覆盖。
- Loop 4 漏洞：manual predicate 可能污染 automatic failed-only 不变量。修复：automatic scanner/runtime 继续固定 failed-only；新增 automatic stale preflight RED/GREEN。
- Loop 5 漏洞：Supplement path 容易只靠 Segment 推断。修复：新增 Supplement manual fill-missing 单元测试，并完成真实 SegmentSupplement regenerate E2E。
- Loop 6 漏洞：真实 key、音频路径、digest 或 transcript 可能进入 diff/log。修复：settings DOM full-key negative、自动化单测、CDP negative、敏感扫描共同覆盖。
- 当前结论：在最终 fresh `verify:quick`、`format:check`、`git diff --check` 和归档后扫描均通过的条件下，本实现达到事实上的 100% 交付信心。

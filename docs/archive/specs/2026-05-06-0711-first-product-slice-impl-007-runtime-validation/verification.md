# 验证记录

## 自动验证

| 阶段      | 命令或操作                                                                         | 结果       | 证据                                                                                                                                                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Automated | `npm run verify:quick`                                                             | 通过       | 初始运行通过：typecheck、main tests、renderer tests、lint、format check。                                                                                                                                                                              |
| Automated | `npm run build`                                                                    | 通过       | 修复后重新 build 通过，生成 main、preload、renderer production output。                                                                                                                                                                                |
| RED       | `npm run test:main -- recordingDrafts`                                             | 失败后通过 | RED 暴露 finalized recording late append 与 finalize failure reject；GREEN 后 36/36 passed。                                                                                                                                                           |
| RED       | `npm run test:renderer -- src/renderer/src/workspace/mediaRecorderAdapter.test.ts` | 失败后通过 | RED 暴露 `stop()` 提前 resolve 和 final chunk conversion failure 被吞；GREEN 后 adapter tests 4/4 passed。                                                                                                                                             |
| RED       | `npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx`    | 失败后通过 | RED 暴露 append error 后仍 finalize、failed retry 未清理旧 recorder、controller ready 前过早显示 Stop、retry 未清空旧 draft；GREEN 后 overlay tests 覆盖 ok:false/reject 立即 failed、不 finalize、controller ready gate、failed retry cleanup/reset。 |
| RED       | `npm run test:renderer -- src/renderer/src/workspace/recordingMachine.test.ts`     | 失败后通过 | RED 暴露 failed 后无法 retry；GREEN 后 failed -> start-requested 进入 acquiring。                                                                                                                                                                      |
| RED       | `npm run test:main -- recordingDrafts`                                             | 失败后通过 | RED 暴露 index update failure 后 metadata finalized/index missing 风险；GREEN 后 metadata 回滚到 draft。                                                                                                                                               |
| RED       | `npm run test:main -- workspaceFiles`                                              | 失败后通过 | RED 暴露 corrupt index rebuild 丢失 finalized recording summary；GREEN 后从 finalized metadata/audio 重建 index。                                                                                                                                      |
| RED       | `npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx`    | 失败后通过 | RED 暴露 stale Stop 和 media start failure 未 discard draft；GREEN 后 stale Stop 不 finalize，失败 draft 被 discard。                                                                                                                                  |
| RED       | `npm run test:main -- workspaceFiles`                                              | 失败后通过 | RED 暴露合法但陈旧的 `.reo/index.json` 会隐藏 finalized recording；GREEN 后 open 会从 finalized metadata/audio 协调并写回 index。                                                                                                                      |
| RED       | `npm run test:renderer -- src/renderer/src/workspace/mediaRecorderAdapter.test.ts` | 失败后通过 | RED 暴露 recorder setup failure 后 media tracks 泄漏；GREEN 后 construction/start 抛错会 stop 已获取 tracks。                                                                                                                                          |
| RED       | `npm run test:main -- workspaceFiles`                                              | 失败后通过 | RED 暴露 index update 失败前会提前持久化 stale 协调结果；GREEN 后 update 成功前不写入协调结果。                                                                                                                                                        |

## Production runtime

| 阶段             | 命令或操作                                                    | 结果 | 证据                                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime          | `./node_modules/.bin/electron --remote-debugging-port=9242 .` | 通过 | production URL 为 `reo-app://renderer/index.html`。                                                                                                                                                                         |
| Runtime security | DevTools Protocol runtime checks                              | 通过 | `require`、`process`、`window.electron` 均为 `undefined`；`window.reoWorkspace` 只含显式 workspace 方法；无 `invoke/send`；`window.open` 返回 `null`；外部 navigation attempt 后 URL 仍为 `reo-app://renderer/index.html`。 |
| Workspace create | Computer Use 操作                                             | 通过 | 在 `~/Downloads/reo-runtime-green-073601` 创建 workspace；home 显示 `Runtime green memory`、0 items。                                                                                                                       |
| Recording        | Computer Use 操作                                             | 通过 | 打开 overlay，执行 start、pause、resume、stop；stop 后进入 edit recording，home summary 显示 1 item。                                                                                                                       |
| Editing/autosave | DevTools input event + disk read                              | 通过 | `transcript.md` 首行 `Green runtime transcript note.`；`reflections.md` 首行 `Green runtime reflection note.`。                                                                                                             |
| Playback         | Computer Use 操作                                             | 通过 | 点击 `Play recording` 后 audio control 出现，播放按钮变为暂停，进度值从 0 前进到 `0.175958`。                                                                                                                               |

## Persistence

稳定文件在 `~/Downloads/reo-runtime-green-073601`：

- `AGENTS.md`
- `.reo/workspace.json`
- `.reo/index.json`
- `recordings/rec_20260506144036_15b98c2f/audio.webm`
- `recordings/rec_20260506144036_15b98c2f/recording.json`
- `recordings/rec_20260506144036_15b98c2f/transcript.md`
- `recordings/rec_20260506144036_15b98c2f/reflections.md`

Runtime 目录选择器还生成了 `.DS_Store`，这是 Finder/native dialog artifact，不是 Reo stable data contract。

一致性证据：

- `audio.webm` 实际大小：`1370330` bytes。
- `.reo/index.json` summary `audioByteLength`：`1370330`。
- `recording.json`：`status: "finalized"`、title `Runtime green memory recording`、`audioByteLength: 1370330`、包含 `finalizedAt`。

## Codex CLI read-only

| 阶段                 | 命令或操作                                                                                                     | 结果 | 证据                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| CLI capability       | `codex --version`                                                                                              | 通过 | `codex-cli 0.128.0`。                                                                                                                      |
| CLI capability       | `codex exec --help`                                                                                            | 通过 | 支持 `--sandbox read-only`、`--cd`、`--skip-git-repo-check`、`--ephemeral`。                                                               |
| Read-only validation | `codex exec --sandbox read-only --cd ~/Downloads/reo-runtime-green-073601 --skip-git-repo-check --ephemeral -` | 通过 | Codex 读取 `AGENTS.md`、workspace/index/recording JSON、transcript/reflections 首行，输出 workspace title、录音数量和 recording metadata。 |
| Hash guard           | before/after hash diff                                                                                         | 通过 | `diff -u /tmp/reo-runtime-green-hash-before.txt /tmp/reo-runtime-green-hash-after.txt` 输出为空。                                          |

## Reference

- Home 第一屏保持单一 workspace title、单一 primary record action 和 `Memory Content`，没有 photo、video、file、film 或未来能力入口。
- Overlay 使用居中 modal、单一录音控制组、编辑态 transcript/reflections 区域和 native audio playback；本切片未引入 waveform、Vaul drawer 或 ElevenLabs source fork。
- UI 不使用 emoji；icon-only controls 未引入。

## 收口

| 阶段     | 命令或操作                                       | 结果 | 证据                                                                             |
| -------- | ------------------------------------------------ | ---- | -------------------------------------------------------------------------------- |
| Closeout | `npm run verify:quick`                           | 通过 | 最终归档后运行；typecheck、main tests、renderer tests、lint、format check 通过。 |
| Closeout | `npm run build`                                  | 通过 | 最终归档后 production build 通过。                                               |
| Closeout | `git diff --check`                               | 通过 | 无 whitespace error。                                                            |
| Closeout | `diff -u AGENTS.md .claude/CLAUDE.md`            | 通过 | 输出为空，镜像入口一致。                                                         |
| Closeout | `find docs/specs -mindepth 1 -maxdepth 1 -print` | 通过 | 输出为空，active spec 已归档。                                                   |

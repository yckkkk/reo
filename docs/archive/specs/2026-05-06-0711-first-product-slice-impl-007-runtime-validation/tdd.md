# TDD 记录

本切片原本是验证切片。运行态验证发现真实缺陷后，按 RED -> GREEN -> REFACTOR 补测试并修复。

## 运行态失败

第一次 production Electron runtime 操作在 `~/Downloads/reo-runtime-final-gJP9Z2` 创建 workspace 并完成录音后，磁盘文件出现不一致：

- `.reo/index.json` summary：`audioByteLength: 820114`。
- `recordings/rec_20260506142355_152a9c71/recording.json`：仍为 `status: "draft"`、空 title、`audioByteLength: 831721`。
- 结论：MediaRecorder final chunk 与 finalize 存在竞态，且 finalized recording 缺少 late append guard。

## RED

| 阶段 | 命令或操作                                                                         | 结果 | 证据                                                                                                             |
| ---- | ---------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------- |
| RED  | `npm run test:main -- recordingDrafts`                                             | 失败 | 新增 late append 断言后，`appendRecordingAudioChunk` 对 finalized recording 返回 `ok: true`。                    |
| RED  | `npm run test:renderer -- src/renderer/src/workspace/mediaRecorderAdapter.test.ts` | 失败 | 新增 final `dataavailable` 断言后，`controller.stop()` 在 final chunk `arrayBuffer()` resolve 前提前 resolve。   |
| RED  | `npm run test:renderer -- src/renderer/src/workspace/mediaRecorderAdapter.test.ts` | 失败 | 新增 final chunk conversion failure 断言后，`controller.stop()` 在 `arrayBuffer()` reject 时仍 resolve。         |
| RED  | `npm run test:renderer -- src/renderer/src/workspace/recordingMachine.test.ts`     | 失败 | 新增 failed retry 断言后，failed 状态点击 Start recording 仍停留 failed。                                        |
| RED  | `npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx`    | 失败 | 新增 failed retry stale chunk 断言后，旧 recorder failure 不会停止 controller。                                  |
| RED  | `npm run test:main -- recordingDrafts`                                             | 失败 | 新增 index update failure 断言后，finalize 返回 `unknown`，未证明 metadata 回滚为 draft。                        |
| RED  | `npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx`    | 失败 | 新增 controller ready 前 stop/finalize 禁止断言后，UI 已提前进入 recording 并显示 Stop。                         |
| RED  | `npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx`    | 失败 | 新增 failed retry draft reset 断言后，旧 mock transcript 仍显示在新录音中。                                      |
| RED  | `npm run test:main -- workspaceFiles`                                              | 失败 | 新增 corrupt index rebuild finalized recording 断言后，open 只重建空 index。                                     |
| RED  | `npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx`    | 失败 | 新增 stale Stop 和 media start failure cleanup 断言后，draft 未 discard。                                        |
| RED  | `npm run test:main -- workspaceFiles`                                              | 失败 | 新增 valid-but-stale index 断言后，合法 `.reo/index.json` 缺 finalized recording 时 open 仍返回空 recordings。   |
| RED  | `npm run test:renderer -- src/renderer/src/workspace/mediaRecorderAdapter.test.ts` | 失败 | 新增 recorder setup failure 断言后，`getUserMedia` 已成功但 `MediaRecorder.start()` 抛错时 media tracks 未停止。 |
| RED  | `npm run test:main -- workspaceFiles`                                              | 失败 | 新增 update failure no-prepersist 断言后，update 函数抛错前已把 stale index 协调结果写入 `.reo/index.json`。     |

## GREEN

| 阶段  | 命令或操作                                                                         | 结果 | 证据                                                                                                                                                                                                                                                                             |
| ----- | ---------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GREEN | `npm run test:renderer -- src/renderer/src/workspace/mediaRecorderAdapter.test.ts` | 通过 | adapter tests 6/6 passed，含 recorder construction/start failure 停止已获取 tracks。                                                                                                                                                                                             |
| GREEN | `npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx`    | 通过 | overlay tests 覆盖 controller ready 前不显示 stop、不 finalize、append ok:false/reject 立即 failed、不 finalize、failed retry reset、清理旧 recorder、忽略 stale chunks、DOM 级 stale Stop 不 finalize。                                                                         |
| GREEN | `npm run test:renderer -- src/renderer/src/workspace/recordingMachine.test.ts`     | 通过 | recording machine tests 覆盖 failed 后 retry。                                                                                                                                                                                                                                   |
| GREEN | `npm run test:main -- workspaceFiles recordingDrafts`                              | 通过 | main tests 40/40 passed，含 finalized append guard、finalizing late append、finalize failure envelope、index update failure metadata rollback、corrupt index finalized recording rebuild、valid-but-stale index reconciliation、index update failure no-prepersist side effect。 |

## 修复内容

- `createBrowserMediaRecorderAdapter().stop()` 等待 recorder `stop` 事件和 pending `dataavailable.arrayBuffer()` promises 完成后再 resolve。
- `createBrowserMediaRecorderAdapter().stop()` 对 final chunk conversion failure reject，并在停止 tracks 后让 overlay 进入 failed，不继续 finalize。
- `appendRecordingAudioChunk` 拒绝 `status !== "draft"` 的 recording，返回 `ERR_RECORDING_FINALIZED`。
- `finalizeRecordingDraft` 设置 per-recording finalizing guard，finalize 过程中 late append 返回 `ERR_RECORDING_FINALIZED`。
- `finalizeRecordingDraft` 拒绝重复 finalize，使用实际 `audio.webm` 文件大小写入 finalized metadata、返回值和 `.reo/index.json` summary；index 更新失败时回滚 metadata 到 draft。
- `openWorkspaceFiles` 在 `.reo/index.json` 损坏、丢失或合法但陈旧时，从 finalized recording metadata 和 `audio.webm` 协调 recording summaries 并写回 index。
- `updateWorkspaceIndex` 读取 stale/corrupt index 时可使用 filesystem 协调结果计算 update，但不会在 update 成功前把协调结果单独写入磁盘。
- `RecordingOverlay` 只在 MediaRecorder controller ready 后进入 recording；在 append error envelope、rejected promise 或 media start failure 后立即进入 failed，不调用 finalize，停止当前 recorder controller，discard 未完成 draft；failed retry 清空旧 draft/timer state，并使用 recording session token 忽略旧 recorder stale chunks 和 stale Stop。
- `createBrowserMediaRecorderAdapter().start()` 在获取 media stream 后，如果 recorder 构造或 start 失败，会停止已获取 media tracks；构造失败分支补充了直接覆盖测试。
- Current docs 更新了 finalized recording append guard、final chunk 等待和 byte-length 一致性事实。

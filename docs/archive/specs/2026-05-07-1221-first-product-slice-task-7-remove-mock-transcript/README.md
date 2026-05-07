# Task 7：移除 RecordingOverlay mock transcript

创建时间：2026-05-07 12:21 America/Los_Angeles

## 目标

把 `RecordingOverlay` 的产品级行为推进到当前 first product slice 不再展示 mock transcript：录音过程中不再生成 placeholder 行；停止后进入 editing 时 transcript textarea 初始为空，等待用户编辑或后续 STT foundation 接入；reflections、autosave、playback、cleanup 行为保持当前。`recordingMachine` 保持纯状态机，不参与 transcript 生成。

## 范围

- 反转现有 `RecordingOverlay.test.tsx` 中关于 `Mock transcript 1s/2s` 的断言为负向：
  - 录音过程中界面和 transcript textarea value 都不出现 `/Mock transcript/i`。
  - 保留 pause/resume timer、`media.controller.pause/resume` 调用次数和 stop/finalize 行为断言。
  - 保留 failed retry/transcript autosave/discard 等其它当前覆盖的行为。
- 新增或调整测试证明：
  - 录音中前进 timer 不会让 transcript textarea 出现 mock 文本。
  - 停止并进入 editing 后 transcript textarea 初始为空字符串。
- `RecordingOverlay.tsx`：
  - 删除 `Mock transcript ${n}s` placeholder timer 和 `Local mock transcript fallback`。
  - 保留 elapsed timer、recording lifecycle、autosave、playback、Blob URL cleanup 与所有 microphone intent 边界。
  - 不引入新的 component、state、prop 或 IPC channel。
- `recordingMachine.ts`：维持纯状态机；不读写 transcript。
- 同批更新 `docs/current/frontend.md`、`docs/current/flow.md`、`docs/current/data.md`、`docs/current/quality.md` 中关于 mock transcript / placeholder transcript / placeholder timer 的当前事实，反映“产品级 first slice 不展示 mock transcript；transcript textarea 在 STT foundation 引入前默认为空，只接受用户编辑”的当前规则。

## 非范围

- 不实现真实 STT、不接入 ElevenLabs Transcript Viewer、不创建 STT foundation。
- 不改 recording drawer 形态、不接入 Vaul/wavesurfer/ElevenLabs Live Waveform。
- 不修改 finalize、append、microphone intent、playback 文件契约或 IPC surface。
- 不修改 `package.json`、依赖或既有 archive 内容；收口时按 Reo lifecycle 归档本 spec 并提交。
- 不实现 Task 8/9（drawer + waveform、mic sequencing 高保真）。

## 参考与设计约束

- Reo first product slice 已记录（`docs/current/frontend.md`）：当前 recording overlay 仍有 mock transcript 占位语义；产品级 first slice 完成形态不得显示 mock transcript，也不得暗示真实 STT。Task 7 是把该约束落到代码与测试。
- Recording drawer reference `/Users/yck/Downloads/PM/设计参考/记忆录音/录音详细页-没有录音弹层.png` 与 `Reflections详细弹层.jpg`：transcript 是停止后用户可编辑文本，不需要被自动生成的占位行覆盖。
- `recordingMachine` 是 feature-local 状态机；transcript 不属于状态机职责。
- React 19 + TypeScript、Tailwind v4、shadcn/ui Textarea source 已在 overlay 中使用，本 task 不新增 primitive。

## TDD 验收

- RED：现有 `RecordingOverlay.test.tsx` 中 `pauses and resumes timer plus local mock transcript`、`cleans up a failed recorder before retry and ignores stale chunks` 等用例继续断言 `Mock transcript ${n}s`，但代码尚未删除 placeholder timer 时，新增/反转的断言（界面与 textarea 不出现 mock transcript、editing 进入 transcript textarea 初始为空）会失败。
- GREEN：删除 placeholder timer 与 finalize 后 mock fallback；前述 RED 断言通过；保留 pause/resume timer、media controller、autosave、playback、cleanup 行为。
- REFACTOR：删除随之失效的局部派生状态（如 `latestTranscript` 行）和不必要 import；不新增抽象。

## 验证

- `npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx`（RED + GREEN 各记录一次）。
- `npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/recordingMachine.test.ts`。
- `/simplify` 自审；输出汇总到 review.md。

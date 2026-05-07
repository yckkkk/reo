# Task 8：Recording drawer、waveform 和 voice control

创建时间：2026-05-07 12:43 America/Los_Angeles

## 目标

把当前 `RecordingOverlay` 的录音入口迁移到产品级 recording drawer 基础：使用 shadcn/ui Drawer + Vaul 的底部抽屉语义，引入 ElevenLabs UI source-derived waveform 和 voice button 作为真实业务 consumer，建立录音控制状态、关闭保护和错误状态。

## 范围

- 新增 `src/renderer/src/components/ui/drawer.tsx`，基于 shadcn/ui Drawer + Vaul source，retokenize 到 Reo design system。
- 新增 ElevenLabs-derived `src/renderer/src/components/ui/waveform.tsx` 和 `voice-button.tsx`，只保留 Reo 当前需要的 waveform / voice control 源语，不保留 demo、agent、network、API key、自动成功状态或装饰性 copy。
- 新增 `src/renderer/src/workspace/recording/RecordAudioDrawer.tsx`、`RecordingControls.tsx`、`RecordingWaveform.tsx` 和测试。
- 修改 `recordingMachine.ts`，让状态机表达 drawer 录音阶段和关闭保护；保持纯函数，不调用 DOM、MediaRecorder、IPC 或文件 API。
- 修改 `RecordingOverlay.tsx` 为当前 runtime drawer 入口：当前 Home/Memory detail 仍可打开 recording surface，并沿用既有 durable recording transaction，不扩大 main/preload/IPC surface。
- 修改 `package.json` / `package-lock.json`，只允许引入当前 source 的 exact dependency。
- 更新 `docs/current/frontend.md`。

## 非范围

- 不新增或重写 main/preload IPC、filesystem transaction、MediaRecorder durable capture pipeline 或 playback chunk protocol。
- 不新增 STT、AI transcript、agent runtime、cloud/network 调用或 API key。
- 不引入 wavesurfer.js；当前没有 long waveform、peaks、regions、scrubber 或第二个 waveform consumer。
- 不引入 Zustand；recording drawer lifecycle、timer、open state 和 control state 是当前 component/local state。
- 不显示 photo、video、file、film、AI generation、sharing、sync、auth user、global search 或 entity graph。

## Source / reuse decisions

- Drawer：采纳 shadcn/ui Drawer source，因为官方 shadcn 文档说明 Drawer 基于 Vaul，提供 `Drawer`、`DrawerContent`、`DrawerHeader`、`DrawerTitle`、`DrawerDescription`、`DrawerFooter` 等组合，适合当前 bottom drawer 语义。
- Vaul：采纳 `vaul@1.1.2`。Context7 记录 Vaul 支持 controlled `open/onOpenChange`、`dismissible={false}` 和 `data-vaul-no-drag`，用于录音中关闭保护与 waveform/control 交互区。
- ElevenLabs UI waveform：采纳 waveform source 的 canvas/bar visual language，并裁剪为 Reo 当前需要的 `Waveform` source；不使用 microphone permission 组件，不创建自己的 stream。
- ElevenLabs UI voice button：采纳 voice button 的 voice-recording state component 结构，裁剪 automatic feedback、keyboard shortcut demo、agent copy 和 live waveform runtime，只保留 Reo controls 使用的 `idle/recording/processing` 视觉与 button semantics。
- TanStack Query：不用于 drawer local lifecycle。Context7/TanStack Query docs 将 Query 定位为 server/async data cache；录音 lifecycle、drawer open、timer、MediaRecorder state 和 control UI 属于 local/component state。
- wavesurfer.js：本 task 不采纳。官方 Record plugin 覆盖 microphone recording、duration、pause/resume/start/stop 等能力，但 Task 8 不实现 durable capture 和 playback scrubber；等 Task 10 或出现 long waveform/scrubber consumer 再重新评估。

## Source evidence

- Context7 `/websites/ui_shadcn`：Drawer composition、installation and Vaul-backed shadcn Drawer source。
- Context7 `/emilkowalski/vaul`：controlled drawer、non-dismissible drawer、`data-vaul-no-drag`。
- Context7 `/tanstack/query`：TanStack Query owns server state, not local UI state。
- ElevenLabs UI docs：`https://ui.elevenlabs.io/docs/components` 列出 Waveform、Live Waveform、Voice Button 等组件。
- ElevenLabs UI Voice Button docs：`https://ui.elevenlabs.io/docs/components/voice-button`。
- ElevenLabs UI Waveform docs：`https://ui.elevenlabs.io/docs/components/waveform`。
- ElevenLabs UI GitHub：`https://github.com/elevenlabs/ui`，MIT，shadcn/ui-based registry。
- shadcn Drawer docs：`https://ui.shadcn.com/docs/components/drawer`。
- wavesurfer Record docs：`https://wavesurfer-js.pages.dev/docs/modules/plugins_record`。

## Reference notes

- 参考素材用于结构、层级和 micro-interactions，不复制视觉 token。
- `录音详细页-没有录音弹层.png`：录音入口应是当前页面上的抽屉/弹层，不是独立 page。
- `录音详细页-录音中弹层.png`：录音中状态必须有清楚的主控制、实时反馈和不可误关保护。
- `Drawer with ElevenLabs audio component.mp4`：bottom drawer 与 audio component 的组合关系是主要交互参考；视觉必须 retokenize 到 Reo。
- Sidebar/main panel 结构不属于本 task；不得重改 Task 4 shell。

## TDD 目标

RED：

- `RecordAudioDrawer` 不存在，drawer role/name、关闭保护、waveform、voice control 测试失败。
- Home `Record memory` drawer 不要求已有 `memoryId`，且 permission 成功前不创建 draft。
- `recordingMachine` 对 idle/editing 的 late failed event 必须 no-op，当前状态机尚未覆盖该规则。

GREEN：

- Drawer 使用 controlled `open/onOpenChange`，录音忙碌时阻止 Escape/overlay/close button 关闭；非忙碌关闭后下次打开回到 ready 状态。
- `RecordingControls` 用 VoiceButton source-derived control 渲染 start/pause/resume/stop/retry。
- `RecordingWaveform` 用 ElevenLabs waveform source-derived component 表达 idle/recording/paused/finalizing/failed 状态，不创建 microphone stream。
- `recordingMachine` 成为纯状态机，表达 close blocked 和 late failure no-op，事件字段不使用 optional 兼容分支。
- `RecordingOverlay` 复用 `RecordAudioDrawer` shell、`RecordingWaveform` 和 `RecordingControls`，不新增 generic overlay。

REFACTOR：

- 删除 demo、agent、network、API key、自动 timeout、无用 copy、未实现状态和重复 JSX。
- 检查 source 是否真正被业务 consumer 使用；未被使用的 source 不进入 commit。

## 验证命令

```bash
npx vitest run src/renderer/src/workspace/recording/RecordAudioDrawer.test.tsx src/renderer/src/workspace/recordingMachine.test.ts
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
git status --short
```

## Runtime / reference evidence

- 必须用 Computer Use 验证 Electron dev app 中 `Record memory` 打开 bottom drawer。
- 必须验证 recording busy 状态下 Escape/close 不关闭，idle/failed/editing 可关闭。
- 必须验证 waveform/voice control 在浅色和深色主题下可读、无 overlap、无 emoji、无 agent/cloud/API key 文案。

## 停止条件

- source CLI 生成 Next.js-only、network、agent runtime 或 API key 代码，且无法用薄适配裁剪到 Reo 边界。
- Vaul/shadcn Drawer 无法在 Electron renderer / jsdom tests 中保持可访问 role/name 和关闭保护。
- 出现必须修改 main/preload/IPC/file transaction 的需求，停止并转入 Task 9。
- 任一审查出现 unresolved BLOCKER/MAJOR，不得提交。

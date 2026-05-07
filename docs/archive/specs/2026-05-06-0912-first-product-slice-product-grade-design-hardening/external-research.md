# External Research

## Context7: Electron

Library：`/electron/electron`

设计影响：

- Preload 必须通过 `contextBridge` 暴露窄 API，不能暴露 raw `ipcRenderer` 或通用 `send/invoke`。
- IPC channel 必须显式命名，renderer 只能调用预定义产品能力。
- Permission policy 必须在 main process 用 session permission handler 控制；audio media 只允许 trusted renderer。
- 导航、window open、protocol、session、download、permission 都是 main process 安全边界，不允许 renderer 临时放权。

对 Reo 的结论：

- 录音、workspace folder、audio read、transcript/reflections save 继续走 `window.reoWorkspace` 窄 API。
- 不创建 generic IPC bridge。
- 如果后续引入 file import、updater、auth 或 logging，必须逐项扩展 preload/IPC，并更新 `docs/current/electron.md`。

## Context7: shadcn/ui

Library：`/shadcn-ui/ui`

设计影响：

- shadcn/ui 是 source-owned component model，不是传统 runtime component library。
- 组件应按 exact consumer 添加，不应 `add all`。
- shadcn/ui 强调 open code、composition、distribution、beautiful defaults，可被 retokenize 到 Reo design system。
- Drawer 是 shadcn/ui 的现成组件，底层使用 Vaul；Dialog/Drawer 可以组合为 responsive pattern。

对 Reo 的结论：

- 已有 Button、Label、Dialog、Textarea 不能成为自研 UI framework。
- 新增 Drawer、Tooltip、Popover、ScrollArea、Form、Input、Separator、Skeleton、Tabs 等必须由真实 consumer 触发。
- Recording bottom drawer 必须优先采用 shadcn Drawer/Vaul source，而不是继续用普通 Dialog 伪装。

## Context7: TanStack Query

Library：`/tanstack/query`

设计影响：

- TanStack Query 负责 async server/main-backed data 的 fetching、cache、mutation 和 invalidation。
- Query key 必须稳定；mutation 成功后应 invalidate 或 seed 对应 query。
- TanStack Query 是 transport-agnostic，可以用于 IPC-backed async data。

对 Reo 的结论：

- Workspace snapshot、memory detail、recording detail、search/index 查询属于 TanStack Query。
- Active recording lifecycle、MediaRecorder controller、chunk sequence、Blob URL、unsaved editor draft 不进 Query。
- Mutations 必须定义 query key、invalidations、pending/error state 和 rollback/retention。

## ElevenLabs UI

来源：

- https://ui.elevenlabs.io/
- https://ui.elevenlabs.io/docs/components
- https://ui.elevenlabs.io/docs/components/waveform
- https://ui.elevenlabs.io/blocks/audio
- https://github.com/elevenlabs/ui

研究结论：

- ElevenLabs UI 是基于 shadcn/ui 的 open-code registry，目标是 audio/agent/transcription UI。
- 组件包括 Audio Player、Live Waveform、Waveform、Speech Input、Transcript Viewer、Voice Button、Mic Selector、Scrub Bar。
- Waveform 提供 Canvas-based visualization、MicrophoneWaveform、RecordingWaveform、AudioScrubber、StaticWaveform。
- Audio examples 包含 transcriber、music player、voice form，展示 MediaRecorder constraints、live waveform、audio player、voice button 等模式。
- GitHub repo MIT license，约 2.2k stars，可作为成熟开源参考，但组件默认偏 Next.js/shadcn，需要逐组件裁剪。

对 Reo 的结论：

- 录音波形和 playback/scrub UI 不能继续使用手写轻量 bars 作为最终设计。
- 优先采用 ElevenLabs UI 的 Waveform、Voice Button、Audio Player/Scrub Bar、Transcript Viewer source，retokenize 到 Reo token。
- 不采用 ElevenLabs agent runtime、network token、hosted examples、all components install 或粉色/agent demo 视觉。

## shadcn Drawer / Vaul

来源：

- https://ui.shadcn.com/docs/components/drawer
- https://vaul.emilkowal.ski/
- https://github.com/emilkowalski/vaul

研究结论：

- shadcn Drawer 明确说明 Drawer built on Vaul，并支持 bottom/side direction、scrollable content、responsive dialog。
- Vaul 是 React drawer component，GitHub star 数高，但 repo 当前声明 unmaintained。

对 Reo 的结论：

- 由于参考图核心交互是 large bottom drawer，优先采用 shadcn Drawer/Vaul source。
- Vaul 维护风险不构成直接自研理由；先走 source-owned shadcn Drawer、retokenize、pin version、测试 focus/escape/backdrop/drag/keyboard/reduced motion。
- 如果 Vaul 的维护风险或 Electron 桌面行为测试出现 BLOCKER，允许 fork 或 Radix Dialog + tested drawer shell fallback，但必须记录适配失败证据。

## wavesurfer.js

来源：

- https://github.com/katspaugh/wavesurfer.js
- https://wavesurfer.xyz/examples/?react.js=
- https://wavesurfer-js.pages.dev/docs/modules/plugins_record

研究结论：

- wavesurfer.js 是成熟 audio waveform player，官方插件包括 Regions、Timeline、Minimap、Envelope、Record、Spectrogram、Hover。
- Record plugin 支持 microphone recording and waveform rendering。
- v7 使用 Shadow DOM，可通过 `::part()` styling，但 Reo token 深度控制成本更高。
- 官方 FAQ 提醒大文件 decode 可能有内存风险，长音频应使用 pre-decoded peaks。

对 Reo 的结论：

- 对 live recording visualization，ElevenLabs UI Waveform source 更贴近 shadcn/Tailwind/Reo retokenize。
- 对长 audio playback、scrubbing、regions、peaks、timeline 或第二个 waveform consumer，wavesurfer.js 是优先采用方案。
- 当前设计不自研 long waveform engine；若第一产品切片需要 scrubber，高优先评估 ElevenLabs AudioScrubber；若出现性能或长音频需求，采用 wavesurfer.js。

## Practical UI

使用章节：

- Ch.1：Minimise interaction cost、Minimise cognitive load、Create a design system、Ensure an interface is accessible、Use common design patterns、Clearly indicate interaction states。
- Ch.4：Create a clear visual hierarchy、Space elements based on how closely related they are、Use predefined spacing、Keep related actions close。
- Ch.7：Define 3 button weights、Use a single primary button、Ensure button text describes the action、Ensure buttons have sufficient target size。
- Ch.8：Stack forms in a single column layout、Do not use placeholder as labels、Keep labels close、Choose validation approach。

对 Reo 的结论：

- 创建工作区表单保持单列和显式 label；submit 不应让用户卡在无解释 disabled 状态。
- 录音控制必须把 record/stop/pause 与 timer 放在同一任务区域，降低 interaction cost。
- Home 和 detail 必须有清晰视觉层级：title、action strip、section divider、cards。
- 每个 interactive state 必须有 default/hover/active/focus/disabled/busy/error。
- icon-only controls 必须 48px target、tooltip 和 accessible name。

## GitHub 成熟实现参考

- `elevenlabs/ui`：audio/agent shadcn registry，MIT，适合 source-owned component reuse。
- `katspaugh/wavesurfer.js`：成熟 waveform/playback/record plugin，适合长音频和 waveform engine。
- `emilkowalski/vaul`：Drawer interaction source，适合 bottom drawer，但需要维护风险控制。
- `shadcn-ui/ui`：组件 source 和 registry 模型，适合 Reo 逐组件引入。

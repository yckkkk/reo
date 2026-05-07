# Task 10：本地播放与笔记编辑组件

创建时间：2026-05-07 14:56 America/Los_Angeles

## 目标

把录音 drawer 的编辑态从内联控件推进到可交付组件边界：本地 audio playback、Transcript draft、Reflections draft 必须形成清晰的信息层级、组件职责、深浅色 token 适配和行为测试。当前 slice 不新增 STT、AI、网络、全局播放器、复杂 scrubber 或新的 main service。

## 当前事实

- Task 8 已引入 shadcn Drawer/Vaul、ElevenLabs source-derived Waveform/VoiceButton 和录音 drawer shell。
- Task 9 已把 finalized recording read/save 改为 `workspaceHandle + memoryId + recordingId`，并保留 duplicate finalized recording guard。
- 当前 `RecordingOverlay` 已经能在停止后进入编辑态，使用文件优先 autosave 保存 transcript/reflections，并通过 manifest + bounded chunk read 创建 renderer Blob URL 播放。
- 当前缺口不是 main 侧读写，而是 audio/transcript UI primitive 与 feature component 边界过薄，编辑态信息层级仍像 MVP 内联区域。

## 范围

- 新增 `components/ui/audio-player.tsx`：Reo local playback primitive，已评估 ElevenLabs Audio Player source，当前保留 HTML5 audio underlay、Reo play/pause control、Radix Slider playback position、time labels、local playback surface 和 Reo token。
- 不新增 shared `components/ui/transcript-viewer.tsx`：ElevenLabs Transcript Viewer 依赖 alignment/STT 和 scrubber runtime；当前 slice 只有用户编辑 draft，因此 transcript preview 留在 recording feature-local 边界。
- 新增 `workspace/recording/RecordingPlayback.tsx`：feature-local playback 组合，未加载时持有 `Load recording` command，加载成功后只展示 playback surface。
- 新增 `workspace/recording/TranscriptReflectionsEditor.tsx`：feature-local editor 组合，持有有界 Transcript preview、Transcript textarea、Reflections textarea 的信息层级。
- 修改 `RecordingOverlay.tsx`：复用上述组件，保留现有 autosave、chunk read、Blob URL cleanup、stale session guard 和 nested identity request。
- 更新 `docs/current/frontend.md` 与 `docs/current/quality.md`。

## 非范围

- 不安装 ElevenLabs CLI，不一次性添加组件集合。
- 不引入 `wavesurfer.js`、global audio provider 或 playback speed，除非出现第二个 waveform/scrubber consumer。当前引入 `@radix-ui/react-slider` 只服务 `AudioPlayer` 的本地 position control。
- 不改变 main/preload IPC contract，不创建 generic IPC bridge、generic recording service 或 generic runtime。
- 不显示未实现的 speech-to-text、AI summary、speaker diarization、export、rename、delete、show in folder。
- 不把 DB 当作 transcript/reflections 真源。

## TDD 行为

1. RED：`AudioPlayer` 作为本地 playback primitive，必须渲染具名 audio surface、显示 ready/loaded copy，并使用 Reo token class；当前文件不存在，应失败。
2. GREEN：实现最小 `AudioPlayer`。
3. RED：`TranscriptReflectionsEditor` 必须把本地 transcript draft 作为有界只读 preview，同时提供 Transcript/Reflections 两个具名 textarea，且不显示 STT/AI 文案；当前文件不存在，应失败。
4. GREEN：实现最小 viewer/editor。
5. RED：`RecordingOverlay` 编辑态必须通过 feature component 暴露 local playback 和 draft editor，保持 autosave payload 含 `memoryId + recordingId`，并保留旧 playback behavior tests。
6. GREEN：替换内联 JSX，不改文件事务语义。
7. REFACTOR：按 ycksimplify 删除冗余 props、重复 class、无意义 wrapper 和过度状态。

## 成功标准

- 编辑态信息层级为：本地 playback command/surface、Transcript preview、Transcript draft、Reflections draft。
- Transcript preview 明确来自本地 draft；空态不声称没有真实 transcript 文件。
- Playback surface 有可访问名称，并继续通过 finalized-only chunk read + Blob URL 工作。
- Transcript/reflections autosave 仍按 nested identity 请求，不引入 STT copy 或 mock transcript。
- 深浅色只通过 Reo token 生效，不在业务组件散落暗色专用 class。
- `npm run verify:quick`、`git diff --check`、`diff -u AGENTS.md .claude/CLAUDE.md` 和 `find docs/specs -mindepth 1 -maxdepth 1 -print` 在归档前记录证据。

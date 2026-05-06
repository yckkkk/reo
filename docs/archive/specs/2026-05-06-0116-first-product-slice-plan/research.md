# Research Notes

## Context7

### Electron

Library：`/electron/electron`

结论：

- Renderer 必须通过 preload 暴露窄 API。
- Preload 使用 `contextBridge.exposeInMainWorld`。
- Renderer 不拿到 `ipcRenderer`、`electron`、`fs` 或 generic channel。
- IPC 使用 `ipcRenderer.invoke` 和 main process `ipcMain.handle` 风格。
- Workspace folder selection 属于 main process privileged capability。

### TanStack Query

Library：`/tanstack/query`

结论：

- Main-backed async data 已经是真实 consumer。
- Renderer 应使用 `QueryClientProvider`。
- Query key 必须稳定。
- 写操作使用 mutation，并在成功后 invalidate 对应 workspace / recording query。
- v5 API 使用 object argument，例如 `invalidateQueries({ queryKey })`。

### shadcn/ui

Library：`/shadcn-ui/ui`

结论：

- shadcn/ui 是 copy-owned component source，不是黑盒组件库。
- Vite + React 使用本地 alias 导入，例如 `@/components/ui/button`。
- 第一版 large overlay、tooltip、button、textarea 已经构成真实 accessible primitive consumer。
- 生成的 source 必须立即被真实 UI 使用，并改造成 Reo token 视觉。

## Electron Vite

electron-vite 官方结构包含：

```text
src/
  main/
  preload/
  renderer/
```

默认 preload entry 是 `src/preload/{index|preload}.{js|ts|mjs|cjs}`。Reo 当前没有 preload，本 plan 采用 `src/preload/index.ts`，不把 preload 塞进 `src/main`。

参考：

- https://electron-vite.org/guide/dev
- https://electron-vite.org/guide/build

## MediaRecorder

MDN 结论：

- `MediaRecorder` 状态为 `inactive`、`recording` 或 `paused`。
- `start(timeslice)` 可以按时间片发出 `dataavailable`，适合避免长录音只在 stop 时一次性传大 blob。
- `pause()` 停止继续收集当前 blob，但可 resume。
- `resume()` 从 paused 回到 recording，inactive 时会抛 `InvalidStateError`。
- `stop()` 后触发最终 `dataavailable` 和 `stop`。

参考：

- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/start
- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/resume

## 2026 Design Direction

可采纳方向：

- Calm design：当前任务只显示当前工作需要的 UI，隐藏未实现的 Films / photo / video / file action。
- Motion-driven interfaces：录音、暂停、继续、保存状态的 motion 必须表达状态，不做装饰动画。
- Spatial hierarchy：workspace 背景 + recording overlay 的层级要用深度、blur 和 scale 表达，不复制参考图的粉色系统。
- Human warmth：Reo 不能做成通用 AI dashboard，要保留 memory workspace 的私人、温暖、可读文件感。
- Agent-oriented future：workspace `AGENTS.md` 和普通文件不是实现细节，而是未来 agent-readable interface。

参考：

- Pixelmatters, 7 UI design trends to watch in 2026: https://www.pixelmatters.com/insights/7-UI-design-trends-to-watch-in-2026
- SaaSUI, 7 SaaS UI Design Trends in 2026: https://www.saasui.design/blog/7-saas-ui-design-trends-2026
- Creative Bloq, Texture, warmth and tactile rebellion: https://www.creativebloq.com/design/graphic-design/texture-warmth-and-tactile-rebellion-the-big-graphic-design-trends-for-2026
- Wang et al., From Human Interfaces to Agent Interfaces: https://arxiv.org/abs/2603.20300

## Obsidian Fact Check

用户认为 Obsidian 开源。核对结果：Obsidian core 不是开源项目。可以参考它的 product behavior，不能复用 core source。

可参考行为：

- Vault 是本地文件夹。
- 可从 existing folder 打开 vault。
- `.obsidian` 是隐藏配置目录。
- Notes 是 Markdown 文件，附件保存在 vault folder。
- Obsidian 维护 metadata cache，但用户内容仍以文件为主。

参考：

- Obsidian Manage vaults: https://obsidian.md/help/manage-vaults
- Obsidian data storage: https://obsidian.md/help/data-storage
- Obsidian open source discussion: https://obsidian.rocks/why-isnt-obsidian-open-source/

## GitHub / Open Source Candidates

### `DeltaCircuit/react-media-recorder`

- URL: https://github.com/DeltaCircuit/react-media-recorder
- Stars: 589
- License: MIT
- NPM: `react-media-recorder@1.7.2`
- Package size from `npm view`: 23,886 bytes unpacked.
- Capability: typed React hook/component over MediaRecorder, includes start/stop/pause/resume/status/errors.

Decision：不采用为第一版 dependency。

原因：

- Reo 需要 `start(timeslice)` + chunk append IPC，避免无时长限制录音在 renderer 内存中堆成一个大 blob。
- 该库主要暴露 final `mediaBlobUrl` / `onStop` happy path，不是 recording-specific file streaming contract。
- 录音状态机、mock transcript ticker、autosave 和 IPC chunk sequence 是 Reo 产品逻辑，直接用标准 MediaRecorder 更小、更可测。

### `katspaugh/wavesurfer.js`

- URL: https://github.com/katspaugh/wavesurfer.js
- Stars: 10,216
- License: BSD-3-Clause
- NPM: `wavesurfer.js@7.12.6`
- Package size from `npm view`: 1,225,093 bytes unpacked.
- Capability: waveform player, official Record plugin.

Decision：不采用为第一版 dependency。

原因：

- 第一版需要录音状态、可播放原音频和可编辑文本，不需要可拖动 waveform、region、peaks 或 spectrogram。
- 波形视觉可以先用 Reo token 驱动的 lightweight bars 表达 recording / playback state。
- 一旦用户需要 waveform scrubbing、regions 或长音频 peaks，再引入。

### `logseq/logseq`

- URL: https://github.com/logseq/logseq
- Stars: 42,674
- License: AGPL-3.0
- Product reference: privacy-first, local-first knowledge management。

Decision：只作产品参考，不复用代码。

原因：ClojureScript stack 和 AGPL license 都不适合直接吸入 Reo。

### `laurent22/joplin`

- URL: https://github.com/laurent22/joplin
- Stars: 54,656
- Product reference: privacy-focused cross-platform notes app with Electron topic。

Decision：只作产品参考，不复用代码。

原因：大型 monorepo 和 license shape 不适合作为 Reo first slice 的直接代码来源。

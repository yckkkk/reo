# IMPL-006 Recording overlay、MediaRecorder、autosave 和 playback

创建时间：2026-05-06 06:50 America/Los_Angeles

## 目标

本切片完成第一产品切片的录音闭环：从 workspace home 打开 recording overlay，执行 record/pause/resume/stop，写入 audio chunks，生成本地 mock transcript，finalize 后进入 editing，支持 transcript/reflections autosave 和本地 audio playback。

## 范围

- 添加 shadcn Dialog/Textarea source，并 retokenize 到 Reo tokens。
- 安装 `@radix-ui/react-dialog`；不引入 Vaul、wavesurfer.js 或 STT SDK。
- 创建 feature-local `recordingMachine.ts`、`mediaRecorderAdapter.ts`、`RecordingOverlay.tsx`。
- App 将 `WorkspaceHome` 的 record action 连接到 overlay。
- 使用 IMPL-003 已有 explicit preload API：draft、append、finalize、discard、manifest/chunk read、save transcript/reflections。
- Production CSP 增加 `media-src 'self' blob:`，只服务本地 audio playback Blob URL。

## 非范围

- 不实现真实 speech-to-text；transcript 明确是本地 mock draft。
- 不引入 waveform/scrubber/regions。
- 不添加 photo、video、file、film 能力。
- 不创建 generic recording runtime、generic service layer 或 generic IPC bridge。

## 完成条件

- Renderer RED/GREEN 覆盖 lifecycle、pause/resume、finalize wait、autosave failure、playback Blob revoke、overlay accessibility。
- Main RED/GREEN 覆盖 CSP `media-src 'self' blob:` 和 audio permission baseline。
- `npm run test:renderer`、`npm run test:main`、`npm run verify:quick`、`npm run build` 通过。
- 使用 Electron runtime/CDP 或 Computer Use 记录 production URL、CSP、blob audio、新窗口拒绝、外部导航拒绝、权限默认拒绝。
- 更新 `docs/current/frontend.md`、`electron.md`、`data.md`、`flow.md`、`quality.md`。
- spec 完成后归档，active `docs/specs/*` 清空。

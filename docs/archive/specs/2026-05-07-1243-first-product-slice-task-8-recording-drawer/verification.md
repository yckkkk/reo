# Verification

## RED

命令：

```bash
npx vitest run src/renderer/src/workspace/recording/RecordAudioDrawer.test.tsx src/renderer/src/workspace/recordingMachine.test.ts
```

结果：失败，符合 RED。

- `RecordAudioDrawer.test.tsx` 无法解析 `./RecordAudioDrawer`。
- `recordingMachine.test.ts` 的 retry 仍返回旧 `acquiring`，未进入 `acquiring-permission`。
- late `failed` event 会把 `idle` 转成 `failed`，未忽略陈旧失败。
- `isRecordingCloseBlocked` 尚未导出。

追加 RED：

```bash
npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx -t "resets the drawer to ready state when reopened after editing"
```

结果：失败，符合 RED。关闭 editing drawer 后重新 open 同一 `RecordingOverlay` 实例仍显示 `Edit recording`，复现 Computer Use 发现的 runtime 状态残留。

最终 `/simplify` 追加 RED：

```bash
npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/recording/RecordAudioDrawer.test.tsx src/renderer/src/workspace/recordingMachine.test.ts
```

结果：失败，符合 RED。

- `ignores transcript autosave results after the drawer is closed and reopened` 显示旧 `Save failed` alert 污染 ready drawer。
- `stops scheduling playback chunks after a chunk read fails` 在单个 chunk 失败后仍调度第 5 个 chunk read。

## GREEN

命令：

```bash
npx vitest run src/renderer/src/workspace/recording/RecordAudioDrawer.test.tsx src/renderer/src/workspace/recordingMachine.test.ts
npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/recording/RecordAudioDrawer.test.tsx src/renderer/src/workspace/recordingMachine.test.ts
```

结果：通过，最终为 3 个测试文件，35 个测试。

命令：

```bash
npm run typecheck
```

结果：通过。

实现证据：

- `npx shadcn@4.7.0 add drawer` 成功生成 `components/ui/drawer.tsx` 并引入 `vaul@1.1.2`，随后 retokenize 到 Reo design system。
- `npx @elevenlabs/cli@0.5.2 components add waveform` 成功生成 ElevenLabs UI waveform source，随后裁剪成 Reo 当前需要的 `Waveform` primitive。
- `npx @elevenlabs/cli@0.5.2 components add voice-button` 因会覆盖现有 `button.tsx` 中止；已读取官方 registry JSON，并按其 VoiceButton + LiveWaveform 组合结构做薄适配，不覆盖 Reo Button。
- `RecordAudioDrawer` 是当前 runtime 复用的 controlled Vaul drawer shell；`RecordingOverlay` 在该 shell 内复用 waveform 和 voice control，并保留 durable recording transaction。
- Drawer close 后重开回到 ready state，不沿用上一轮 editing draft。
- Drawer close/reopen 后旧 autosave response 不再写回 ready drawer。
- Playback chunk read 失败后不继续调度后续 chunk IPC。

## REFACTOR / simplify

命令：

```bash
npx vitest run src/renderer/src/workspace/recording/RecordAudioDrawer.test.tsx src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/recordingMachine.test.ts
npm run typecheck
```

结果：通过。

Simplify 修复：

- 删除 `canRetry` 死字段。
- 删除未来 `RecordingTarget` 和 state `drawerSessionId` 预埋。
- 删除 `failed.message` 重复状态，alert message 只由 `RecordingOverlay` 的 current error owner 持有。
- 删除单用途 `RecordingErrorState`，复用 `WorkspaceErrorBanner`。
- 删除多层三元状态文案，改为扁平 `statusTextFor`。
- 删除手动 `aria-describedby` 覆盖，使用 Radix generated description wiring。
- Drawer footer 固定，body 滚动，减少业务层为小窗口额外补布局的需要。
- `RecordAudioDrawer` 只接收 `closeBlocked`，不再读取整台 recording machine。

## Runtime / reference evidence

工具：Computer Use，Electron dev app，workspace `/private/tmp/reo-task5-create-runtime`。

验证：

- 浅色 Home `Record memory` 打开 bottom drawer；drawer 显示 `Recording`、ready 文案、Waveform、`Start recording` 和 `Close recording panel`。
- 点击 `Start recording` 后进入 `Preparing microphone access`，close command disabled；进入 recording 后显示 `Pause recording` / `Stop recording`，close command 仍 disabled。
- 点击 disabled close 未关闭 drawer。
- 点击 `Stop recording` 后进入 `Edit recording`，Transcript/Reflections 编辑区可滚动，close command 仍固定在 footer。
- 关闭后再次点 `Record memory`，drawer 回到 `Ready to record local audio`，不再沿用上一轮 edit state。
- 深色主题下 drawer、waveform、button、footer、文本和背景均可读，无明显 overlap。
- runtime 未显示 agent、cloud、API key、model、photo、video、file、film 或 STT/AI transcript 文案。
- dev server 在移除手动 `aria-describedby` 后未再输出 Radix missing description warning。

参考图映射：

- `录音详细页-没有录音弹层.png`：当前 ready drawer 保持页面内 bottom drawer，而不是独立 page。
- `录音详细页-录音中弹层.png`：recording 状态具备 waveform、主控制和忙碌关闭保护。
- `Drawer with ElevenLabs audio component.mp4`：采用 bottom drawer + audio waveform/control 组合节奏，并 retokenize 到 Reo。
- `Reflections详细弹层.jpg`：当前只作为 editing wireframe 边界，Transcript/Reflections 区域存在但不实现 STT/editor future 能力。

## Fixed gates

已运行：

```bash
npx vitest run src/renderer/src/workspace/recording/RecordAudioDrawer.test.tsx src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/recordingMachine.test.ts
npm run typecheck
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
git status --short
```

结果：

- `npm run verify:quick` 通过：typecheck、main 248、renderer 82、lint、format。
- `git diff --check` 通过。
- `diff -u AGENTS.md .claude/CLAUDE.md` 无差异。
- `find docs/specs -mindepth 1 -maxdepth 1 -print` 归档后无输出。
- `git status --short` 只包含 Task 8 范围内代码、文档和 dependency 变更。

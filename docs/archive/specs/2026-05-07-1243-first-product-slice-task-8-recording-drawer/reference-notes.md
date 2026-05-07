# Reference Notes

## 当前范围 high fidelity

- Recording drawer 是当前设计范围，必须符合 Reo design system 的高保真实现。
- Drawer 是 bottom sheet，不创建 page、top bar、rail sidebar 或独立 recording route。
- 控制区必须清楚表达 idle、acquiring/processing、recording、paused、finalizing、failed、editing。
- 忙碌状态必须防误关；可关闭状态需要清晰 close command。

## 参考图映射

- `录音详细页-没有录音弹层.png`：无录音/准备录音状态的抽屉层级、主动作和空内容责任。
- `录音详细页-录音中弹层.png`：录音中主控制、反馈强度、底部抽屉位置和防误关。
- `Reflections详细弹层.jpg`：抽屉内编辑内容和 transcript/reflections 的后续信息层级；Task 8 只做 wireframe 边界，不实现编辑器。
- `Drawer with ElevenLabs audio component.mp4`：ElevenLabs audio component 的 waveform/control 组合节奏；只采纳结构和 micro-interaction。

## Wireframe 边界

- Transcript/reflections editing 属于 Task 10，Task 8 只保留未来 section boundary。
- Playback scrubber 属于 Task 10，不在 Task 8 显示可点击 scrubber。
- STT/AI transcript 不显示为 disabled 或 placeholder。

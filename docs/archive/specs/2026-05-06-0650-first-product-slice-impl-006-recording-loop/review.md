# Review 记录

## 自审重点

- 是否等待最后 append ack 后 finalize。
- pause 是否停止 timer/mock transcript，resume 是否恢复。
- save failure 是否保留 renderer draft 和 previous disk content。
- playback 是否先 manifest 再 chunk read，Blob URL 是否在 close/switch/unmount revoke。
- Dialog 是否有 role/name、safe Escape、return focus、reduced motion fallback。
- CSP 是否只增加必要 `media-src 'self' blob:`，不放松 sandbox、navigation、permission。

## 结果

- PASS：未发现 BLOCKER/MAJOR。
- Stop flow 等待 append queue 后才调用 finalize；duplicate stop 在 state machine 中保持 `stopping`。
- Pause 停止 mock transcript timer，resume 后恢复；MediaRecorder pause/resume 通过 adapter 转发。
- Save failure 显示 alert，renderer transcript/reflections draft 不清空；main save 使用 atomic write，失败返回 `previous-file-preserved`。
- Playback 先读 manifest 再按 chunk read，Blob URL 在 close/switch/unmount revoke。
- Dialog 使用 Radix 语义；recording/paused/stopping 时 close 被拒绝，避免 Escape 或 close button 中断写入。
- CSP 只增加必要 `media-src 'self' blob:`；sandbox、navigation、window-open、permission baseline 未放松。

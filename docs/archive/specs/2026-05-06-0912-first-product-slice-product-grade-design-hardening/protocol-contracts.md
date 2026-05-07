# Protocol Contracts

## Preload API

Renderer sees only:

```ts
window.reoWorkspace = {
  chooseDirectory()
  initializeWorkspace(input)
  openWorkspace(input)
  closeWorkspace(input)
  getMemoryDetail(input)
  beginMicrophoneIntent(input)
  clearMicrophoneIntent(input)
  createRecordingDraft(input)
  appendRecordingAudioChunk(input)
  finalizeRecordingDraft(input)
  discardRecordingDraft(input)
  getRecordingDetail(input)
  readRecordingAudioManifest(input)
  readRecordingAudioChunk(input)
  saveTranscript(input)
  saveReflections(input)
}
```

No generic `invoke`, no `ipcRenderer`, no raw file path, no Node API.

## Channel matrix

| Channel                                | Request                                       | Response                                  | State owner                       | Errors                                   |
| -------------------------------------- | --------------------------------------------- | ----------------------------------------- | --------------------------------- | ---------------------------------------- |
| `workspace:chooseDirectory`            | none                                          | canceled or selection token + displayPath | form component + main token store | choose failed                            |
| `workspace:initialize`                 | token, title, description                     | workspaceHandle, workspaceId, snapshot    | main + Query seed                 | conflict, permission, invalid, expired   |
| `workspace:open`                       | token                                         | workspaceHandle, workspaceId, snapshot    | main + Query seed                 | missing, locked, corrupt, unsupported    |
| `workspace:close`                      | handle                                        | ok                                        | main                              | handle invalid                           |
| `workspace:getMemoryDetail`            | handle, memoryId                              | memory detail projection                  | Query                             | missing/corrupt                          |
| `workspace:beginMicrophoneIntent`      | handle, drawerSessionId                       | microphoneIntentId, expiresAt             | main permission intent store      | denied, already active                   |
| `workspace:clearMicrophoneIntent`      | handle, drawerSessionId                       | cleared                                   | main permission intent store      | expired/not found                        |
| `workspace:createRecordingDraft`       | handle, optional memoryId/title               | recordingId, nextSequence                 | recording reducer + main draft    | locked, collision                        |
| `workspace:appendRecordingAudioChunk`  | handle, recordingId, sequence, bytes          | nextSequence                              | main append queue                 | sequence, chunk too large, append failed |
| `workspace:finalizeRecordingDraft`     | handle, recordingId, title, optional memoryId | memory detail + recording summary         | files + Query invalidation        | finalize failed                          |
| `workspace:discardRecordingDraft`      | handle, recordingId                           | discarded                                 | main                              | not found                                |
| `workspace:getRecordingDetail`         | handle, memoryId, recordingId                 | metadata + text status                    | Query                             | missing/corrupt                          |
| `workspace:readRecordingAudioManifest` | handle, memoryId, recordingId                 | byteLength, mimeType, maxChunkBytes       | playback component                | audio missing                            |
| `workspace:readRecordingAudioChunk`    | handle, memoryId, recordingId, offset, length | Uint8Array                                | playback component                | invalid range                            |
| `workspace:saveTranscript`             | handle, memoryId, recordingId, markdown       | saved                                     | editor autosave                   | previous preserved                       |
| `workspace:saveReflections`            | handle, memoryId, recordingId, markdown       | saved                                     | editor autosave                   | previous preserved                       |

## Sender validation

Every handler must validate:

- sender frame is main frame
- URL is trusted dev loopback or `reo-app://renderer/index.html`
- session/partition matches created window
- channel is in allowlist
- workspaceHandle belongs to sender
- workspaceId/memoryId/recordingId belongs to handle root
- path containment under workspace root

## Permission contract

- Audio media permission 只能由 trusted renderer 在存在一个 sender-scoped active `microphoneIntentId` 时请求。
- `workspace:beginMicrophoneIntent` 在 Record drawer 进入 `acquiring` 时调用；intent 绑定 sender frame，并保存 workspace handle、drawer session id 和短 TTL 作为 begin/clear ownership metadata。
- Renderer 必须 await `workspace:beginMicrophoneIntent` response，成功后才允许调用 `navigator.mediaDevices.getUserMedia({ audio: true })`。
- Electron `setPermissionCheckHandler` 对 `media` 永远返回 false，不在 check 阶段授予权限，也不消费 intent。
- Electron `setPermissionRequestHandler` 对 `media` request 先消费该 sender 恰好一个未过期 microphone intent，再判断 requested media types 是否为 audio-only 和 sender origin 是否 trusted；只有全部满足时才授予 `media`。Electron permission request 不携带 workspace/drawer 字段，因此 permission request handler 不得信任 renderer 传入的 workspace 或 drawer 字段。permission request handler 在 grant 或 denial 时消费 intent。
- `workspace:clearMicrophoneIntent` runs when the drawer cancels, times out, unmounts or leaves `acquiring` without a permission decision.
- Permission race test must prove that calling `getUserMedia` before the intent response is denied.
- Camera/video permission is denied in current slice.
- Geolocation, notifications, MIDI, clipboard, window-open and external navigation are denied unless future slice adds explicit contract.

## Timeout and cancellation

- OS directory chooser: user-driven, canceled returns typed canceled.
- Workspace initialize/open: bounded timeout in renderer UI; main operation may complete and disk truth wins on retry.
- Audio append: no user cancellation per chunk; stop waits append queue; failure enters failed state.
- Recording drawer cannot close by backdrop/escape while `acquiring`, `recording`, `paused` or `stopping` if closing would corrupt data.
- Save transcript/reflections: autosave can be superseded by newer draft; stale save response cannot overwrite newer editor state.

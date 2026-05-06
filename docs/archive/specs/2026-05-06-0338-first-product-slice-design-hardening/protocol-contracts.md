# 协议契约

## Preload 公共 API

公共 API 命名为 `window.reoWorkspace`，只暴露产品方法。

禁止暴露：

- `ipcRenderer`
- `electron`
- `fs`
- `path`
- `send(channel, payload)`
- `invoke(channel, payload)`
- generic file read/write
- generic command bus

## Workspace handle 规则

Renderer 不持有后续写入能力的裸 `rootPath`。

- `chooseDirectory()` 只返回可展示的 `displayPath` 和短生命周期 `selectionToken`。
- `initializeWorkspace()` 和 `openWorkspace()` 接收 `selectionToken` 或用户显式 open workflow 的 token。
- Main process 对 token 绑定的路径执行 `realpath`、containment、metadata、permission 和 conflict 校验。
- 初始化或打开成功后，main 返回 opaque `workspaceHandle`、`workspaceId` 和 workspace snapshot。
- 后续 recording、read、save、audio 操作只接收 `workspaceHandle`、`workspaceId`、`recordingId` 和业务 payload。
- Main 端维护 handle registry：handle 绑定 canonical realpath、workspaceId、owning sender identity、createdAt、lastUsedAt、mode。
- Handle 只在同一 trusted main frame、同一 session/partition、同一 app lifecycle 内有效。
- Window 关闭、workspace close、lock lost、schema mismatch 或 permission revocation 时撤销 handle。
- Main 对每个 handle 操作重新校验 sender、workspaceId、lock ownership 和 path containment。
- Renderer 提供的任何 `rootPath`、absolute file path 或 relative path 都不得直接成为读写目标。

## 错误信封

```ts
type ReoError = {
  code: string;
  message: string;
  diagnostic: string;
  recoverable: boolean;
  retryHint?: string;
  dataRetention: 'none_written' | 'previous_file_preserved' | 'draft_preserved';
};
```

Renderer 只展示 `message`。日志和测试可以检查 `diagnostic`。UI 文案不得暴露敏感或过长的本地文件路径。

## Sender 校验

所有 IPC handler 都必须先执行 sender validation。

| 检查项            | 规则                                                                                | 拒绝测试                              |
| ----------------- | ----------------------------------------------------------------------------------- | ------------------------------------- |
| 主 frame          | 只接受 `event.senderFrame === event.sender.mainFrame` 或 Electron 等价主 frame 判断 | subframe、iframe、about:blank、srcdoc |
| Production origin | 只接受 `reo-app://renderer/index.html`，host 必须是 `renderer`                      | 其他 host、path traversal、空 host    |
| Dev origin        | 只接受 loopback dev server URL，且端口来自受控 dev server URL                       | 非 loopback、随机端口                 |
| Session/partition | IPC、custom protocol、permission policy 必须属于同一个 BrowserWindow session        | 错 session fake sender                |
| Handle ownership  | `workspaceHandle` 只允许创建它的 sender 使用                                        | cross-window handle reuse             |
| Channel allowlist | 只注册本矩阵列出的 channels                                                         | unknown channel                       |

## IPC 协议矩阵

| ID     | 对应需求       | Preload 方法                        | IPC 通道                      | 请求                                                                           | 响应                                                                       | 错误                                                                                                             | 超时/取消                                                                      | sender/permission                                           | 状态归属                             | 测试                   |
| ------ | -------------- | ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------ | ---------------------- |
| PC-001 | FR-001         | `chooseDirectory()`                 | `workspace:chooseDirectory`   | 无输入                                                                         | `{ canceled: true }` 或 `{ canceled: false, selectionToken, displayPath }` | `ERR_DIALOG_FAILED`                                                                                              | OS dialog 决定耗时；user cancel 返回 typed result                              | trusted main frame；OS dialog                               | component folder state               | preload + dialog tests |
| PC-002 | FR-002/003/014 | `initializeWorkspace(input)`        | `workspace:initialize`        | title、description、selectionToken                                             | `{ workspaceHandle, workspaceId, snapshot }`                               | `ERR_WORKSPACE_AGENTS_CONFLICT`、`ERR_PERMISSION_DENIED`、`ERR_INVALID_WORKSPACE_INPUT`、`ERR_SELECTION_EXPIRED` | renderer 有 bounded timeout；main write 可能完成，后续 open 以 disk truth 为准 | trusted sender；token path canonicalization；workspace lock | workspace files + query invalidation | schema + file tests    |
| PC-003 | FR-004/005     | `openWorkspace(input)`              | `workspace:open`              | selectionToken 或 recent/open token                                            | `{ workspaceHandle, workspaceId, snapshot }`                               | `ERR_WORKSPACE_MISSING`、`ERR_UNSUPPORTED_SCHEMA`、`ERR_CORRUPT_INDEX`、`ERR_WORKSPACE_LOCKED`                   | bounded timeout；scan start 后不取消                                           | trusted sender；lock acquisition                            | TanStack Query                       | open/rebuild tests     |
| PC-004 | FR-007         | `createRecordingDraft(input)`       | `recording:createDraft`       | workspaceHandle、workspaceId、optional title                                   | draft id、createdAt                                                        | `ERR_WORKSPACE_LOCKED`、`ERR_DRAFT_COLLISION`、`ERR_HANDLE_INVALID`                                              | bounded timeout；renderer failure 时 discard                                   | handle owner sender；workspace lock                         | recording reducer + draft files      | draft tests            |
| PC-005 | FR-008/009     | `appendAudioChunk(input)`           | `recording:appendAudioChunk`  | workspaceHandle、workspaceId、recordingId、sequence、bytes、mimeType           | `{ sequence, byteLength }`                                                 | `ERR_SEQUENCE_MISMATCH`、`ERR_AUDIO_APPEND_FAILED`、`ERR_AUDIO_CHUNK_TOO_LARGE`、`ERR_AUDIO_LIMIT_EXCEEDED`      | bounded timeout；无 ack 时 renderer 标记 failed                                | handle owner sender；audio budget                           | main append lock                     | strict sequence tests  |
| PC-006 | FR-010/011     | `finalizeRecordingDraft(input)`     | `recording:finalizeDraft`     | workspaceHandle、workspaceId、recordingId、durationMs、transcript、reflections | finalized recording detail                                                 | `ERR_APPEND_IN_PROGRESS`、`ERR_FINALIZE_FAILED`、`ERR_AUDIO_MISSING`                                             | finalization 开始后不可取消；timeout 后 follow-up open                         | handle owner sender；workspace lock                         | main draft transaction               | finalize race tests    |
| PC-007 | FR-013         | `readRecordingDetail(input)`        | `recording:readDetail`        | workspaceHandle、workspaceId、recordingId                                      | metadata + transcript + reflections                                        | `ERR_RECORDING_MISSING`、`ERR_CORRUPT_RECORDING`、`ERR_HANDLE_INVALID`                                           | bounded timeout                                                                | handle owner sender                                         | TanStack Query                       | detail tests           |
| PC-008 | FR-013         | `readRecordingAudioManifest(input)` | `recording:readAudioManifest` | workspaceHandle、workspaceId、recordingId                                      | mimeType、byteLength、chunkSize、chunkCount                                | `ERR_AUDIO_MISSING`、`ERR_PATH_TRAVERSAL`、`ERR_AUDIO_LIMIT_EXCEEDED`、`ERR_HANDLE_INVALID`                      | bounded timeout                                                                | handle owner sender；path containment                       | playback loading state               | manifest/path tests    |
| PC-009 | FR-013         | `readRecordingAudioChunk(input)`    | `recording:readAudioChunk`    | workspaceHandle、workspaceId、recordingId、offset、length                      | bytes、offset、byteLength                                                  | `ERR_AUDIO_MISSING`、`ERR_AUDIO_CHUNK_TOO_LARGE`、`ERR_AUDIO_RANGE_INVALID`、`ERR_HANDLE_INVALID`                | bounded timeout；每次最多 1 MiB                                                | handle owner sender；path containment                       | Blob assembly state                  | chunk/range tests      |
| PC-010 | FR-012         | `saveTranscript(input)`             | `recording:saveTranscript`    | workspaceHandle、workspaceId、recordingId、content                             | save status、updatedAt                                                     | `ERR_SAVE_TRANSCRIPT_FAILED`、`ERR_HANDLE_INVALID`                                                               | renderer debounce；bounded IPC；允许 retry                                     | handle owner sender                                         | editor local + workspace file        | autosave tests         |
| PC-011 | FR-012         | `saveReflections(input)`            | `recording:saveReflections`   | workspaceHandle、workspaceId、recordingId、content                             | save status、updatedAt                                                     | `ERR_SAVE_REFLECTIONS_FAILED`、`ERR_HANDLE_INVALID`                                                              | 同 transcript                                                                  | handle owner sender                                         | editor local + workspace file        | autosave tests         |
| PC-012 | FR-011         | `discardRecordingDraft(input)`      | `recording:discardDraft`      | workspaceHandle、workspaceId、recordingId                                      | discarded                                                                  | `ERR_DRAFT_ALREADY_FINALIZED`、`ERR_HANDLE_INVALID`                                                              | bounded timeout                                                                | handle owner sender                                         | main draft files                     | discard tests          |
| PC-013 | FR-004/013     | `closeWorkspace(input)`             | `workspace:close`             | workspaceHandle、workspaceId                                                   | closed                                                                     | `ERR_HANDLE_INVALID`                                                                                             | bounded timeout                                                                | handle owner sender                                         | main handle registry                 | handle revoke tests    |

## 自定义 protocol 契约

`reo-app://renderer/index.html` 只服务 packaged renderer shell，不服务用户 workspace 文件。

| 项             | 规则                                                                         | 测试                                           |
| -------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| Scheme         | `reo-app`，privileged scheme 在 app ready 前注册                             | registration order test                        |
| Host           | 只允许 `renderer`                                                            | reject `reo-app://other/...`                   |
| Path           | 只允许 renderer build output 内路径；默认入口是 `/index.html`                | reject `../`、encoded traversal、absolute path |
| MIME           | 根据静态资源扩展名返回安全 MIME；未知资源返回 404                            | MIME tests                                     |
| CSP            | production HTML 注入/返回严格 CSP；播放落地时只增加 `media-src 'self' blob:` | runtime CSP check                              |
| Error response | traversal、unknown host、missing file 返回 400/404，不回显本地路径           | protocol error tests                           |
| Session        | protocol handler 注册到 BrowserWindow 使用的 session                         | session binding test                           |

## DTO 规则

- `selectionToken` 是 main-owned、短生命周期、single-use token。
- `workspaceHandle` 是 main-owned opaque capability，不可持久化到 workspace 文件。
- Renderer 不把 absolute path 写入 workspace metadata；metadata 只使用 relative refs。
- Audio bytes 使用带 sequence、declared mime type 和 byteLength 的 binary DTO。
- 大 payload budget 在本 spec 中固定；实现阶段只能收紧，不能在没有 review 的情况下放宽。

## 音频预算

| 项                    | first product slice 上限                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------- |
| 单 chunk              | 1 MiB                                                                                         |
| in-flight chunks      | 每个 recording 最多 1 个 append 在途                                                          |
| 默认 timeslice        | 1000 ms；若浏览器事件更密，adapter 合并到不超过单 chunk 上限                                  |
| 单次 recording 软上限 | 60 分钟或 120 MiB，以先到为准                                                                 |
| Playback IPC          | 先读 manifest，再按 1 MiB chunk 读取；不允许一次性通过 IPC 返回完整 audio 文件                |
| Blob assembly         | renderer 只在 manifest 合法且总大小不超过 first-slice 上限时组装 Blob，关闭 overlay 时 revoke |
| 超限行为              | 停止录音并返回 `ERR_AUDIO_LIMIT_EXCEEDED`，保留 draft recovery                                |
| MIME                  | 优先使用 Electron MediaRecorder 提供的 `audio/webm` 兼容类型，metadata 记录实际 mimeType      |

这些数字是 first slice 的防 DoS 和测试预算，不是产品承诺。后续放宽必须重新审查 filesystem、UI、playback 和 Codex readability。

## 权限模型

| 能力                                   | 权限                                                             |
| -------------------------------------- | ---------------------------------------------------------------- |
| Folder selection                       | main process 中的 OS dialog，生成 `selectionToken`               |
| Workspace file write                   | main-owned `workspaceHandle` + path containment + workspace lock |
| Microphone                             | 只允许 trusted renderer 请求 audio media                         |
| Video/camera/geolocation/notifications | 拒绝                                                             |
| Navigation/window-open                 | 除 trusted app URL 外全部拒绝                                    |
| External shell/openExternal            | first slice 不使用                                               |

## 取消语义

- Folder selection：user cancel 是一等非错误结果。
- Workspace initialize：writes begin 后不可取消；timeout recovery 读取 disk truth。
- Audio append：每个 chunk 不可取消；ack 失败使 recording 进入 failed/recovery。
- Finalize：开始后不可取消。
- Autosave：renderer 可以 supersede pending debounce；in-flight write 完成或失败并保留 previous file。

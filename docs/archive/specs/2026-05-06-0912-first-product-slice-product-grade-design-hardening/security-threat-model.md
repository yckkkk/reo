# Security Threat Model

## Assets

- User audio, transcript, reflections and workspace files.
- Workspace root real path.
- Workspace handle and selection token.
- Auth/session data when Better Auth is introduced.
- Diagnostic logs and future Sentry payloads.

## Threats and mitigations

| Threat                              | Risk                                      | Mitigation                                                                         | Tests                      |
| ----------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------- |
| Renderer gets raw filesystem access | arbitrary file read/write                 | no Node/Electron imports; preload narrow API                                       | restricted import test     |
| Generic IPC bridge                  | privilege escalation                      | explicit channel list and DTO schemas                                              | preload surface test       |
| Path traversal                      | write outside workspace                   | canonical realpath + containment                                                   | main path tests            |
| Token replay                        | open/write wrong workspace                | one-shot selection token bound to sender + TTL                                     | token lifecycle tests      |
| Cross-window handle reuse           | unauthorized workspace write              | handle owner sender validation                                                     | cross-sender tests         |
| Permission overgrant                | camera/video/mic misuse                   | audio media only for trusted renderer with active microphone intent; others denied | runtime permission tests   |
| Mock STT misrepresents privacy      | user thinks speech sent/processed         | no mock transcript as real; STT gated by foundation                                | UI copy tests              |
| Log leaks transcript/path           | privacy breach                            | no logging bridge until diagnostics slice; redaction required                      | future redaction tests     |
| DB becomes hidden content truth     | content loss/read-only validation failure | files remain truth; DB rebuildable app index only                                  | file hash/rebuild tests    |
| Vaul/drawer dependency risk         | unpatched UI behavior                     | source-owned shadcn component, pinned version, tests, fork option                  | drawer regression tests    |
| Waveform audio context leak         | mic privacy/battery                       | cleanup streams/audio contexts on unmount/close                                    | media cleanup tests        |
| Unimplemented future buttons        | user data loss/confusion                  | forbidden capabilities not rendered in build                                       | forbidden capability tests |

## Electron baseline

Must remain true:

- `app.enableSandbox()`
- `sandbox: true`
- `contextIsolation: true`
- `nodeIntegration: false`
- `webSecurity: true`
- window open denied by default
- external navigation denied by default
- custom protocol only serves renderer assets
- production CSP does not allow unsafe inline/eval

## Microphone permission intent

- Renderer cannot request audio permission as a durable capability.
- Record drawer must enter `acquiring` and call `workspace:beginMicrophoneIntent` before `getUserMedia`.
- Main 为每个 trusted sender 保存一个短生命周期 microphone intent；workspace handle 和 drawer session id 只是 begin/clear ownership metadata。
- Electron permission check handler 对 `media` 永远返回 false；permission request handler 对 `media` request 先消费 sender-scoped intent，再判断 audio-only 和 trusted origin，并且不信任 renderer 传入的 workspace/drawer 字段。
- No active intent means deny, even when the sender URL is trusted.
- Intent ids are opaque, not reusable and never persisted to workspace files.

## Privacy stance

- Current first slice is local-first.
- No network STT, agent runtime, telemetry, cloud sync or auth UI is implied by this spec.
- Future Sentry/electron-log requires explicit privacy, redaction, retention and release owner.

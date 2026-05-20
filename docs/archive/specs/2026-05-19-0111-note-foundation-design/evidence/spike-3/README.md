# Spike #3: Electron `reo-attachment://` Protocol POC

## Scope

This spike used an isolated Electron app under:

```text
.tmp/note-foundation-spikes/spike-3-protocol/
```

No production source, package manifest, current docs, or initiative docs were edited.

## POC Architecture

- `reo-poc://renderer/index.html` serves one CSP-protected test page from `protocol.handle`.
- `reo-attachment://<workspaceId>/attachments/<file>` serves image attachments from a generated fixture workspace.
- Both schemes are registered in one `protocol.registerSchemesAsPrivileged(...)` call before `app.whenReady()`.
- The `reo-attachment` scheme uses `secure: true`, `supportFetchAPI: true`, `corsEnabled: false`, and `stream: true`.
- The BrowserWindow keeps Electron security enabled: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`, `allowRunningInsecureContent: false`, and `webviewTag: false`.
- Top-level navigation away from `reo-poc://` is denied with `will-navigate`; window open is denied with `setWindowOpenHandler`.

The handler validates:

- `GET` only.
- `host === workspaceId`.
- strict pathname pattern: `/attachments/<safe-name>.(png|jpg|jpeg|gif|webp|avif)`.
- path containment under both workspace root and `attachments/`.
- symlink leaf rejection via `lstat`.
- realpath containment after leaf validation.
- invalid requests return `404 not found`, except non-GET returns `405 method not allowed`.
- successful and invalid responses include `Cache-Control: no-store`.

## Commands

```bash
cd /Users/yck/Downloads/PM/技术线/reo/.tmp/note-foundation-spikes/spike-3-protocol
npm init -y
npm install --save-dev electron@41.5.0
EVIDENCE_DIR=/Users/yck/Downloads/PM/技术线/reo/docs/specs/2026-05-19-0111-note-foundation-design/evidence/spike-3 npm start
```

## Versions

- Electron package: `41.5.0`
- Runtime Electron: `41.5.0`
- Runtime Chromium: `146.0.7680.216`
- Runtime Node: `24.15.0`

## Results

`protocol-results.json` is fully green:

```json
{
  "registerBeforeReady": true,
  "imgFetch200": true,
  "imgElementLoaded": true,
  "navigationDenied": true,
  "wrongWorkspace404": true,
  "traversal404": true,
  "symlink404": true,
  "nonGet405or404": true,
  "pathLeakAbsent": true
}
```

Screenshot capture was feasible and saved as `screenshot.png`.

Runtime note: the `<img>` request loaded successfully and triggered a protocol `GET 200`. Renderer JavaScript `fetch('reo-attachment://...')` returned `Failed to fetch` with `corsEnabled: false` across `reo-poc://` to `reo-attachment://`. This does not block `<img>` display, but it means Reo should not rely on renderer JS `fetch()` against `reo-attachment://` unless the CSP and CORS model is explicitly redesigned.

## CSP Used

The POC page used:

```text
default-src 'none'; script-src 'unsafe-inline'; img-src 'self' blob: reo-attachment:; connect-src 'self' reo-attachment:; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'
```

The production port should add `reo-attachment:` to `img-src`. Do not add `connect-src reo-attachment:` unless Reo intentionally supports renderer JS fetch for attachments and resolves the `corsEnabled: false` behavior.

## Security Decision

`reo-attachment://` is viable for sub-spec (c) image display without relaxing Electron sandbox, context isolation, Node integration, webSecurity, navigation, window-open, CSP, or permission baselines.

Implementation constraints to port into Reo:

- Register all custom privileged schemes once before `app.ready`; include existing `reo-app` and new `reo-attachment` in the same early registration path.
- Register the handler in the same production session used by the renderer.
- Keep `corsEnabled: false` for the attachment scheme unless there is a separate approved design for renderer JS fetch.
- Use `reo-attachment://<workspaceId>/attachments/<safe-image-file>` only; do not encode raw paths in URL, DOM, logs, or responses.
- Resolve `workspaceId` through current main-owned workspace/session state; renderer must not provide root paths.
- Validate method, host, strict pathname, extension whitelist, containment, symlink leaf, and realpath containment before serving bytes.
- Return generic invalid responses with no absolute path or workspace root leak.
- Use `Cache-Control: no-store`.
- Keep top-level navigation and window-open denied for `reo-attachment://`.

## Fallback Decision

Fallback needed for image display: **No**. `reo-attachment://` works for `<img>` under the locked-down BrowserWindow.

Fallback needed for renderer JS fetch: **Yes, if JS fetch is required**. With `corsEnabled: false`, cross-scheme renderer `fetch()` failed. If Reo needs programmatic bytes, prefer an existing narrow IPC stream/read contract or a separately approved protocol/CORS design. Base64 inline is not recommended for the main path because it increases DOM/cache pressure and weakens the clean file-backed URL model.

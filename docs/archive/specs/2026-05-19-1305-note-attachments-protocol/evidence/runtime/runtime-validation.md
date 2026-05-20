# Runtime Validation

Timestamp: 2026-05-19 14:54 America/Los_Angeles

Commands:

```bash
npm run build:app
REO_DIAGNOSTICS_CONSOLE=1 npm start
```

Observed runtime:

- `npm run build:app` completed Electron Vite main, preload, and renderer production build.
- `npm start` launched `electron-vite preview` and emitted diagnostics:
  - `{"area":"app","event":"ready","fields":{"mode":"production"}}`
  - `workspace:readVoiceTranscriptionSettings` completed with `status:"ok"`.
  - `workspace:listMemorySpaces` completed with `status:"ok"`.

Runtime boundary evidence:

- Production URL: `src/main/index.ts` loads `getAppShellUrl('index.html')`, and `src/main/appProtocol.ts` returns `reo-app://renderer/index.html`.
- CSP header: `src/main/security.ts` injects `Content-Security-Policy` for app pages; `src/main/securityPolicy.ts` production policy is `img-src 'self' data: blob: reo-attachment:` and `connect-src 'self'`.
- Protocol registration: `src/main/appProtocol.ts` registers `reo-attachment` with `registerSchemesAsPrivileged` before app ready and handles only GET requests with `Cache-Control: no-store`.
- New-window deny: `src/main/index.ts` uses `setWindowOpenHandler(() => ({ action: 'deny' }))`.
- External navigation deny: `src/main/index.ts` prevents `will-navigate`, `will-redirect`, and `will-frame-navigate` when the URL is not trusted.
- Permission default deny: `src/main/security.ts` installs `setDevicePermissionHandler(() => false)` and routes permission requests through the one-shot media intent decision path.

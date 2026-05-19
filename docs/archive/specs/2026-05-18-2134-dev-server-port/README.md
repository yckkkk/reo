# Dev Server Port

Created: 2026-05-18 21:34 America/Los_Angeles

## Objective

Reo development renderer server must not use Vite's default `5173`, because that port can be owned by another local app. Reo should use a stable project-owned loopback port and fail explicitly if that port is occupied.

## Success Criteria

- `electron.vite.config.ts` configures renderer dev server on `5183`.
- `strictPort` remains enabled.
- Current Electron documentation states the development URL and failure behavior.
- Main-side verification covers the configured port.

## Evidence

- Context7 Vite v8.0.10 docs: `server.port` sets the dev server port; `server.strictPort` makes Vite exit if the selected port is already in use.
- Context7 electron-vite docs: renderer Vite server options live under `renderer.server`.
- RED: `MAIN_TEST_FILES=test/main/electronViteConfig.test.ts npm run test:main` failed because actual port was `5173` while expected Reo-owned port is `5183`.
- GREEN: `MAIN_TEST_FILES=test/main/electronViteConfig.test.ts npm run test:main` passed after changing renderer server port to `5183`.
- Runtime: `npm run dev` started Electron and printed renderer URL `http://localhost:5183/`, then reached `[Main] App ready`.
- Cleanup: the runtime verification process was stopped after startup; `lsof -nP -iTCP:5183 -sTCP:LISTEN` returned no listener.
- Final gate: `npm run verify:quick` passed.

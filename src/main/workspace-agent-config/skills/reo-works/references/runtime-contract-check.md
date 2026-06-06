# Reo works runtime contract check

Run this deterministic contract check before ending a works task.

## File check

- `segment.md` or `supplement.md` frontmatter parses and includes `id`, `title`, `kind: artifact`, `format: html`.
- `entry.html`, `runtime.json`, `state.json` and `assets/` exist in the same directory.
- Run `node skills/reo-generative-runtime/scripts/validate-runtime.mjs <target-directory>`.
- Local assets, if any, are ordinary files under `assets/` and are referenced with relative paths only.
- No `.reo/objects`, `.reo/index.json`, lock, draft or review file was edited for normal creation/update.

## Runtime check

- HTML renders useful static content before any script runs.
- Scripts are optional and bounded to the current document.
- Ordinary Web network, CDN libraries, remote fonts/images and browser `fetch`/XHR are allowed when useful.
- No Node, Electron, raw filesystem paths, `file://`, symlinks or `.reo/` internals.
- `window.reo` usage loads `reo-render://vendor/reo-render/bridge.js` before work code.
- `state.json` is a JSON object and remains readable after agent edits.

## Projection check

- Reopen or refresh Reo and confirm the object appears as an artifact Segment or Supplement.
- If Reo reports a runtime fault, fix the missing/invalid bundle file instead of editing `.reo`.
- Do not create or edit `.reo/objects`, `.reo/index.json`, locks, drafts or review files for normal creation/update.

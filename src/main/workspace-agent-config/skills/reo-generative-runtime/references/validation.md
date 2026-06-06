# Reo runtime validation

Validation answers whether this bundle can run in Reo.

## Required checks

- `entry.html`, `runtime.json` and `state.json` exist.
- `runtime.json` and `state.json` parse as JSON.
- `entry.html` is a complete HTML document with useful visible content.
- Local files are under `assets/` and referenced by relative URLs.
- No `file://`, absolute local path, symlink, `.reo/` dependency or editor temp file is required.
- If `entry.html` uses `window.reo`, it also loads `reo-render://vendor/reo-render/bridge.js`.
- Narrow embeds do not have horizontal text overflow; flex/grid text containers can shrink with `min-width: 0`, single-line labels ellipsize, and long unbroken text can wrap.
- The work or widget stays light enough for future agent edits.

Run `node skills/reo-generative-runtime/scripts/validate-runtime.mjs <target-directory>` before ending a runtime task. This check validates runnability; it does not review taste, content quality, network choices or user choices.

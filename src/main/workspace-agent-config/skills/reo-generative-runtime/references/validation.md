# Reo runtime validation

Validation answers whether this bundle can run in Reo.

## Required checks

- `entry.html`, `runtime.json` and `state.json` exist.
- `segment.md` exists for work Segments; `supplement.md` exists for work Supplements.
- `widget.md` exists for `widgets/<widget-directory>/`; `component.md` exists for `home-components/<component-directory>/`.
- `runtime.json` and `state.json` parse as JSON.
- `entry.html` is a complete HTML document with useful visible content.
- If `runtime.json.theme.tokens` is `reo-semantic-v1`, `entry.html` includes the full Reo semantic token block rather than a shortened hand-written subset.
- Local files are under `assets/` and referenced by relative URLs.
- No `file://`, absolute local path, symlink, `.reo/` dependency or editor temp file is required.
- If `entry.html` uses `window.reo`, it also loads `reo-render://vendor/reo-render/bridge.js`.
- Narrow embeds do not have horizontal text overflow; flex/grid text containers can shrink with `min-width: 0`, single-line labels ellipsize, and long unbroken text can wrap.
- Inline work previews show the useful summary, primary controls and core result before a long scroll; complex works use sections, deliberate internal scroll areas, fullscreen affordances or supplements instead of hiding the core value far below the fold.
- Workspace rail widgets remain usable from 240px to 520px wide.
- User-visible runtime copy does not include literal local file URL scheme examples, machine paths or usernames.
- The work or widget stays light enough for future agent edits.

Run `node skills/reo-generative-runtime/scripts/validate-runtime.mjs <target-directory>` before ending a runtime task. This check validates runnability; it does not review taste, content quality, network choices or user choices.

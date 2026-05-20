# Visual and runtime evidence

## Screenshot

Screenshot path:

```text
docs/specs/2026-05-19-0111-note-foundation-design/evidence/spike-1/blocknote-spike.png
```

Capture command:

```bash
playwright screenshot --channel chrome --viewport-size 1440,1000 --wait-for-selector '[data-adapter="mantine"] .bn-editor' --wait-for-timeout 1500 http://127.0.0.1:5179/ /Users/yck/Downloads/PM/技术线/reo/docs/specs/2026-05-19-0111-note-foundation-design/evidence/spike-1/blocknote-spike.png
```

The image shows:

- Left panel: `@blocknote/mantine` editor mounted with parsed Markdown content.
- Right panel: bare `BlockNoteViewRaw + custom CSS` editor mounted with the same Markdown content.
- Both panels show lossy Markdown export output below the editor.
- Radix portal probe buttons render in each panel header.

## Screenshot tooling note

The in-app Playwright debug MCP could not launch its bundled Chromium because the expected browser executable was missing from the Playwright cache:

```text
Executable doesn't exist at /Users/yck/Library/Caches/ms-playwright/chromium-1200/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing
```

Fallback used system Chrome through Playwright CLI `--channel chrome`, which successfully captured the screenshot.

## Runtime DOM evidence

Playwright + system Chrome reported both editors mounted:

```json
{
  "panels": [
    {
      "adapter": "mantine",
      "hasEditor": true,
      "hasContainer": true,
      "editorText": "Reo note spikeMarkdown remains the semantic truth.BlockNote is the editing adapter.Export is intentionally tested as lossy.Portal surfaces must not fight Radix ",
      "exportText": "# Reo note spike\n\nMarkdown remains the semantic truth.\n\n* BlockNote is the editing adapter.\n* Export is intentionally tested as lossy.\n* Portal surfaces must not fight Radix overlays.\n\n> A local attachment would stay as ",
      "editorRect": {
        "width": 648,
        "height": 320
      },
      "backgroundColor": "rgb(255, 255, 255)",
      "boxShadow": "rgb(228, 228, 231) 0px 0px 0px 1px inset"
    },
    {
      "adapter": "bare",
      "hasEditor": true,
      "hasContainer": true,
      "editorText": "Reo note spikeMarkdown remains the semantic truth.BlockNote is the editing adapter.Export is intentionally tested as lossy.Portal surfaces must not fight Radix ",
      "exportText": "# Reo note spike\n\nMarkdown remains the semantic truth.\n\n* BlockNote is the editing adapter.\n* Export is intentionally tested as lossy.\n* Portal surfaces must not fight Radix overlays.\n\n> A local attachment would stay as ",
      "editorRect": {
        "width": 648,
        "height": 320
      },
      "backgroundColor": "rgb(255, 255, 255)",
      "boxShadow": "rgb(228, 228, 231) 0px 0px 0px 1px inset"
    }
  ],
  "blocknoteFloatingElements": 58
}
```

## Radix portal evidence

After opening the Mantine-panel Radix DropdownMenu:

```json
{
  "radixWrappers": [
    {
      "tag": "DIV",
      "text": "Copy pathShow in FinderDelete",
      "zIndex": "50"
    }
  ]
}
```

After opening the Mantine-panel Radix Dialog:

```json
{
  "dialogInBody": true,
  "overlayZ": "40",
  "contentZ": "50",
  "activeRoleDialogText": "Radix DialogThis portal intentionally coexists with BlockNote floating UI.Open popoverClose"
}
```

Interpretation:

- Radix body portal behavior works in the same page as BlockNote.
- BlockNote editor and Radix portal surfaces can coexist in the simple Vite runtime.
- Reo still needs Electron runtime verification for focus trap, ESC ordering, pointer-events, overlay stacking and `data-theme` inheritance.

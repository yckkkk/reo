# Notes-like lightweight editor

Timezone: America/Los_Angeles

## Objective

Replace the current raw Markdown textarea editing surface with a lightweight Notes-like editor for Reo note and transcript text. Reo must hide Markdown control markers while editing bold, italic, unordered lists, and ordered lists, while still saving durable content as Markdown files.

## Current truth

- User semantic content remains Markdown in `memory.md`, `segment.md`, and `supplement.md`.
- External edits through Finder or another Markdown editor remain valid Markdown edits.
- `LightweightMarkdownEditorSurface` currently renders a raw textarea and toolbar commands insert Markdown syntax.
- Read-only `MarkdownContentSurface` already renders basic inline emphasis and list Markdown without source markers.

## Product constraints

- Reo editing should align with macOS Notes for this slice: formatting appears as text state and list structure, not visible Markdown syntax.
- Cursor placement inside bold, italic, unordered list, or ordered list content must not reveal Markdown markers.
- Toolbar controls are limited to bold, italic, unordered list, and ordered list for this slice; the Tiptap kernel still keeps StarterKit's normal heading, quote, code, list, mark, keymap, and input rule behavior.
- Saved content must remain standard Markdown.

## Technical decision

Use Tiptap as the first editor kernel for this slice.

Tiptap is selected because its official React package provides a ProseMirror-backed editor kernel with StarterKit marks/lists, Markdown import/export through `@tiptap/markdown`, extension composition, and explicit command APIs. That matches the narrow Notes-like requirement better than retaining a textarea or adopting a fuller product editor shell, while still leaving a real path for future headings, quotes, checklist, link, table, attachment block, and agent-authored structured inserts.

The implementation must keep the future extension seam explicit:

- A single editor kernel component owns Tiptap setup, registered extensions, theme classes, Markdown serialization, and commands.
- The first toolbar set exposes bold, italic, unordered list, and ordered list; the editor extension set uses StarterKit, Markdown, and Image so normal Markdown nodes remain available through Tiptap shortcuts, pasted Markdown, and external `.md` edits.
- Future Markdown features are added by registering an extension and Markdown serialization behavior in the same owner module, not by adding feature-specific parsing in product components.
- Product surfaces continue to exchange only Markdown strings with existing Reo save, stale, dirty, and attachment flows.
- Editor control icons use Tiptap-owned UI/icon components only if they are available from an installed, stable Tiptap package boundary; otherwise Reo uses `lucide-react` icons.

## Success criteria

- Existing note creation and inline finalized text editing use the new editor surface.
- Bold and italic toolbar actions apply visible rich text formatting and serialize to Markdown.
- Bullet and numbered list toolbar actions create visible list structure and serialize to Markdown.
- Typing Markdown shortcuts such as `- ` and `1. ` creates visible list items without leaving the marker visible in Reo.
- Pressing Return at the end of a non-empty list item creates the next item; pressing Return from an empty list item exits the list.
- Dirty state, save/cancel, baseline conflict handling, image paste/drag insertion, and workspace interruption guards continue to work through Markdown string changes.
- No renderer code imports Node or Electron APIs.

## Verification

- Focused renderer tests passed for `LightweightMarkdownEditorSurface`, `NoteEditorOverlay`, and `LoadedWorkspaceFrame`.
- `npm run typecheck:quick` passed.
- `npm run verify:quick` passed.
- Runtime visual validation covered the Memory Studio inline editor in dark and light themes:
  - `/tmp/reo-lightweight-editor-toolbar-dirty-fixed.png`
  - `/tmp/reo-lightweight-editor-toolbar-light-fixed.png`
- Dirty-state toolbar runtime metrics showed save/cancel at the right edge through `ml-auto`, and list toolbar output carried visible marker styling through `list-disc`.

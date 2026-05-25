# Tiptap editor audit

Timezone: America/Los_Angeles

## Objective

Audit and harden the Tiptap lightweight Markdown editor so the editor follows the normal Tiptap model, keeps Markdown as the durable file truth, and removes old textarea-formatting assumptions.

## Current scope

- Preserve Tiptap StarterKit input rules and standard Markdown node support.
- Keep product surfaces exchanging Markdown strings only.
- Keep the visible toolbar limited to current direct controls without disabling the editor kernel.
- Verify direct Markdown file edits from external tools or Codex render correctly in Reo.

## Success criteria

- Direct Markdown containing headings, lists, blockquotes, and code renders as Tiptap nodes in edit mode.
- `# ` is treated as a normal Tiptap heading shortcut, with visible heading styling after text is entered.
- Toolbar-created list content serializes back to Markdown.
- Old textarea formatting kernel files and old model helpers are absent from active source.
- `npm run verify:quick` passes after fixes.

## Verification

- `npm run verify:quick` passed.
- Focused renderer tests covered Markdown import/export, toolbar serialization, Tiptap node styling, image upload, and link popover external-link bridge behavior.
- Focused main tests covered the explicit Markdown external-link IPC contract, preload bridge mapping, registration, trusted sender validation, and non-web URL rejection.

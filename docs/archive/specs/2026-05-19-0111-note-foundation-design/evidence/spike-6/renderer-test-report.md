# Renderer harness report

## Command

```bash
node .tmp/note-foundation-spikes/spike-6-external-edit-refresh/note-refresh-harness.mjs
```

Result: PASS, exit code 0.

## Files

- Harness: `.tmp/note-foundation-spikes/spike-6-external-edit-refresh/note-refresh-harness.mjs`
- Result JSON: `docs/specs/2026-05-19-0111-note-foundation-design/evidence/spike-6/refresh-results.json`

## What it proved

The harness models the future renderer-only state transition after a visibility-triggered content refresh:

- Clean editor: refreshed disk body replaces the editor body, baseline hash updates, and no banner remains.
- Dirty editor: local unsaved body is preserved, baseline hash is preserved, and conflict-needed banner state is set when disk content hash changes.

This is enough for spike evidence because the production source already proves the refresh trigger and query invalidation path. The missing note-specific behavior is only the editor-local merge rule.

## TDD note

No production source or production test files were edited. This spike created an isolated pure harness under `.tmp` and evidence under the requested spec path. The implementation sub-spec should convert the reducer behavior into real renderer-node tests before adding the production `NoteEditorOverlay` code.

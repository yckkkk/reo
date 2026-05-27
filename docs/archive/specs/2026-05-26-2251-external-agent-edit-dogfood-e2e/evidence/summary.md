# Evidence Summary

## Scenario Results

| Scenario                                     | Result                                                                                                                                        | Evidence                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| A: rename Segment + create note Supplement   | External Codex edited only ordinary files. Reo converged after workspace selection.                                                           | `scenario-a/summary.md`                |
| B: create Memory                             | External Codex used the shortened local path, did not read global memory, and `.reo/index.json` converged.                                    | `scenario-b/after-snapshot.md`         |
| C: create note Segment                       | External Codex created only `segment.md`; Segment manifest converged.                                                                         | `scenario-c/after-snapshot.md`         |
| D: rename and move Supplement across Segment | External Codex moved the whole Supplement directory, preserved stable id, and Reo repaired parent manifest.                                   | `scenario-d/after-snapshot.md`         |
| E: JSON-only Tiptap edit                     | External Codex edited only `content.tiptap.json.content`; explicit UI selection serialized JSON to Markdown and rendered highlight/underline. | `scenario-e/after-ui-select.md`        |
| F: Memory space root rename                  | Initial runtime check failed; focused test and implementation now repair stale metadata title on open.                                        | `scenario-f/root-rename-runtime*.json` |
| G: active workspace passive refresh          | With the target Segment selected, external Markdown and JSON edits both refreshed UI and reconciled sidecar/Markdown in about 2 seconds.      | `scenario-g/after-*.md`                |

## Optimization Decisions

- `AGENTS.md` / `reo-edit`: Add normal-task stop conditions. This reduced over-reading in B-D compared with A.
- Reo system: Fix stale memory-space title mirror during `openWorkspaceFiles`; external folder rename is a system convergence responsibility.
- Reo system: No change needed for active selected Markdown/JSON passive refresh; G passed after the target Segment was actually selected.
- Test/dev tooling: Use `codex exec ... -c 'approval_policy="never"'`; current Codex CLI does not accept `--ask-for-approval` for this path, and `-p` is profile, not prompt.

## Remaining Boundary

Scenario E showed that JSON-only edits to a non-selected Segment do not immediately serialize to Markdown until that Segment is read. That is acceptable under the current model because Reo reconciles on focused detail read and active selected content refresh. A future optimization could proactively reconcile sidecars for non-selected objects during full snapshot refresh, but that would increase background write cost and is not needed for this spec.

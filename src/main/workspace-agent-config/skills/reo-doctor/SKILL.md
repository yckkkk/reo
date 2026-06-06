---
name: reo-doctor
description: Use when a Reo memory space has missing config, sidecar or mirror errors, duplicate ids, needs-review items, or the agent is unsure whether direct file edits left the space consistent.
---

# Reo Doctor

Recovery-only: do not run this skill before ordinary edits. For ordinary editing, creation, rename or move tasks, use `skills/reo-edit/SKILL.md` first.
Run it only after Reo reports needs-review, missing managed config, duplicate ids, sidecar conflicts, mirror issues, or when the user explicitly asks for diagnosis.

Default rule: do not spend time reasoning about Reo internals unless a Reo error, missing config, duplicate id, sidecar conflict, mirror issue or needs-review state appears.

## Quick Check

From the memory space root, run:

```bash
node skills/reo-doctor/scripts/reo-doctor.mjs
```

To apply deterministic safe repairs:

```bash
node skills/reo-doctor/scripts/reo-doctor.mjs --fix
```

The script repairs Reo managed `AGENTS.md` blocks and managed skill files, then reports unresolved issues. It must preserve user-written content in `AGENTS.md`.
When `.reo/review/needs-review.json` exists, the script prints the unresolved entries with workspace-relative paths and recovery hints.

## Boundaries

- Deterministic missing managed config can be repaired.
- Duplicate ids, conflicting sidecar changes, ambiguous parentage and user content conflicts must be reported instead of guessed.
- Do not delete semantic files during repair unless the user explicitly asks.

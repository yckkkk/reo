# RED Evidence

Command:

```bash
MAIN_TEST_FILES=test/main/workspaceFiles.test.ts npm run test:main -- --test-name-pattern "workspace snapshot refresh passively|workspace snapshot refresh preserves simultaneous|workspace snapshot refresh preserves invalid"
```

Result: failed as expected.

- `workspace snapshot refresh passively serializes note Segment sidecar JSON to Markdown` failed because `segment.md` still contained `Original note segment`.
- `workspace snapshot refresh passively serializes note Supplement sidecar JSON to Markdown` failed because `supplement.md` still contained `Original note supplement`.
- `workspace snapshot refresh passively serializes audio Segment transcript sidecar JSON to Markdown` failed because `segment.md` still contained `Original audio transcript`.
- `workspace snapshot refresh passively serializes audio Supplement transcript sidecar JSON to Markdown` failed because `supplement.md` still contained `Original audio supplement transcript`.
- Conflict and invalid/unsupported sidecar preservation tests passed before implementation.

## Confidence Audit RED Follow-ups

After subagent review, three additional focused gaps were converted into tests:

```bash
MAIN_TEST_FILES=test/main/tiptapContentSidecar.test.ts npm run test:main -- --test-name-pattern "existing-only reconcile does not create"
```

Result before the fix: failed because `reconcileTiptapContentSidecar({ createIfMissing: false })` still created `content.tiptap.json`.

```bash
MAIN_TEST_FILES=test/main/workspaceFiles.test.ts npm run test:main -- --test-name-pattern "workspace snapshot refresh does not clobber|workspace snapshot refresh aborts when passive"
```

These tests were added for the final implementation audit and pass after the targeted fixes:

- Passive sidecar write rechecks the Markdown leaf at atomic commit time, so a concurrent Markdown edit is preserved and treated as conflict/review instead of being overwritten.
- Passive sidecar write failure aborts snapshot refresh instead of being swallowed as an invalid Memory candidate.

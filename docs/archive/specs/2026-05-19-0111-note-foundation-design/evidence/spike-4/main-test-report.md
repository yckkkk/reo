# Spike 4 test report

## Commands run

```bash
node .tmp/note-foundation-spikes/spike-4-note-draft-transaction/note-draft-transaction-harness.mjs
```

Result: PASS.

Output summary:

- `workspaceDirectoryTransactions` source is payload-name neutral.
- Current audio draft allowlist rejects a `segment.md`-only note draft.
- Note-specific `segment.md` and `supplement.md` allowlists accept markdown-only drafts.
- Note allowlist rejects unexpected `audio.webm` and symlink Markdown leaves.
- Finalized-segment preflight can reject a stale draft before reading missing `audio.webm`.

```bash
MAIN_TEST_FILES=test/main/workspaceDirectoryTransactions.test.ts npm run test:main -- --test-name-pattern "workspace directory transaction"
```

Result: PASS.

Output summary:

- 8 tests passed.
- Covered parent identity replacement, no-replace file open, no-follow existing open, safe removal, directory fsync allowlist, identity-bound entry read, tree remove identity, and late payload protection.

```bash
npx prettier --check docs/specs/2026-05-19-0111-note-foundation-design/evidence/spike-4/README.md docs/specs/2026-05-19-0111-note-foundation-design/evidence/spike-4/main-test-report.md
npx prettier --write docs/specs/2026-05-19-0111-note-foundation-design/evidence/spike-4/README.md docs/specs/2026-05-19-0111-note-foundation-design/evidence/spike-4/main-test-report.md
npx prettier --check docs/specs/2026-05-19-0111-note-foundation-design/evidence/spike-4/README.md docs/specs/2026-05-19-0111-note-foundation-design/evidence/spike-4/main-test-report.md
```

First result: FAIL, both new evidence files needed Prettier formatting.

Second result: PASS, both evidence Markdown files were formatted.

Final check result: PASS, all matched evidence files use Prettier style.

## Harness scope

The sandbox harness is intentionally not production code. It creates an isolated workspace under `.tmp/note-foundation-spikes/spike-4-note-draft-transaction/workspace` and checks the minimal filesystem invariants needed for this spike.

What it proves:

- Existing directory transaction source does not encode audio filenames.
- Current audio draft payload validation is not reusable unchanged for note drafts.
- A note-only payload validator can safely accept `segment.md` / `supplement.md` without accepting `audio.webm`, symlinks, or unknown payloads.
- Stale finalized truth can be checked before touching a stale draft that lacks `audio.webm`.

Limitations:

- It does not import private production functions or modify production tests.
- It does not prove full note finalize rollback/index behavior; that belongs in sub-spec (b) TDD.
- It does not run `npm run verify:quick` because this spike is read-only analysis plus isolated evidence, not a production change.

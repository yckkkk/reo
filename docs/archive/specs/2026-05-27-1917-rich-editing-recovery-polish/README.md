# Rich Editing Recovery Polish

Timezone: America/Los_Angeles (PDT).

## Intent

Reo already detects Tiptap sidecar conflicts, invalid JSON, unsupported durable content and ambiguous Markdown candidates, writes `.reo/review/needs-review.json/md`, projects only aggregate counts to the UI and gives the user a safe copy-prompt toast. This slice improves the local recovery surface for rich editing issues without adding automatic merge, raw path IPC, renderer report entries or in-app repair editing.

The user selected `Recovery polish` as the next priority. The goal is a small, testable improvement: when a human or ordinary agent opens the local report or runs `reo-doctor`, each unresolved rich-editing entry must explain what kind of manual recovery is safe. The guidance must lower judgment cost, not turn Reo internals into the product workflow.

## Official Basis

Context7 was used for current Tiptap docs. Relevant official model:

- Tiptap can be initialized with content checking and `onContentError` for schema-invalid content.
- `emitContentError` can report schema content errors without full content checking.
- `setContent` supports `errorOnInvalidContent` for invalid content handling.

Reo continues to use the official editor/content model at the editor boundary. This slice does not replace Tiptap schema handling, does not broaden durable JSON support and does not make Reo guess merges. Reo only improves its local report/doctor guidance for cases the current file-truth reconcile already classifies as unresolved.

## State Machine

```text
External Markdown or content.tiptap.json change happens
  -> main reads object Markdown and same-node sidecar through file truth
  -> Tiptap sidecar reconcile classifies the pair
  -> safe single-source changes reconcile silently
  -> conflict, invalid JSON, unsupported content or markdown-write-required cannot converge
  -> Reo writes needs-review report with category/reason/object kind/relative paths
  -> UI receives aggregate review counts only
  -> user copies prompt or runs reo-doctor
  -> local report/doctor gives reason-specific manual recovery hints
  -> human/agent edits ordinary files to choose one truth source or fix JSON
  -> next snapshot refresh either converges and clears report, or keeps needs-review
```

Markdown candidate variant:

```text
External object candidate is duplicate, ambiguous or unsafe
  -> candidate is excluded from normal projection
  -> report entry records category/reason and workspace-relative candidate paths
  -> local hint tells the user to make one legal object shape and preserve user content
```

## Invariants

- Renderer snapshot remains aggregate-only: no report entries, no paths, no title/body/transcript/frontmatter/hash.
- No new raw path IPC, no generic report viewer and no renderer-side file-system repair action.
- `.reo/review/needs-review.json` stays machine-readable and workspace-relative only.
- `.reo/review/needs-review.md` is a local file for humans/agents in the memory space; it may contain recovery instructions but not copied user content or hashes.
- `reo-doctor` remains recovery-only. It can surface hints, but it must not modify semantic content or perform sidecar/Markdown merges.
- Manual recovery guidance must be conservative: choose one truth source, repair JSON to the durable profile, remove only same-node technical sidecars when Markdown should win, preserve semantic files and rerun snapshot/doctor.
- Tiptap capability remains official-model-first; unsupported durable JSON remains needs-review instead of silent coercion.
- No E2E mega-test. Each scenario asserts one visible side effect: report markdown, doctor JSON, prompt text, stale report clearing or path redaction.

## Scenarios

1. `content-conflict` sidecar entry renders a local hint explaining that both Markdown and sidecar changed; choose one source, do not guess a merge.
2. `invalid-sidecar` entry renders a hint explaining that malformed `content.tiptap.json` can be fixed or removed only when Markdown should regenerate the sidecar.
3. `unsupported-tiptap-content` entry renders a hint explaining that JSON must be simplified to the supported durable profile or converted through Markdown/UI.
4. `markdown-write-required` entry renders a hint explaining that the sidecar-authored Markdown mirror could not be written and the next safe action is to refresh through Reo or choose a source manually.
5. Duplicate or ambiguous Markdown candidate entries render hints to keep exactly one valid object per id and preserve user payload.
6. `reo-doctor` emits the same recovery hint per sanitized entry, using only workspace-relative paths.
7. The copied needs-review agent prompt points agents to the hints and still excludes raw paths, report entries, hashes and handle data.
8. Clean refresh after manual repair still clears the report; this should use existing coverage unless implementation changes behavior.

## Success Criteria

- Focused tests fail before the report/doctor/prompt guidance exists.
- Hints are shared by report markdown and generated `reo-doctor` output where possible.
- Existing report redaction, snapshot aggregate-only review and copy prompt safety tests remain valid.
- No current docs update unless a stable contract changes. If hints become a stable recovery contract, compress only that fact.
- Run targeted main/renderer tests, xhigh subagent review/simplification, `npm run verify:quick`, archive and commit.

## Non-Goals

- No automatic merge of Markdown and sidecar JSON.
- No in-app report entries, raw paths or file opener.
- No broader Tiptap durable profile expansion.
- No new editor recovery panel.
- No generated giant E2E.

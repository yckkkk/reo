# GREEN And Runtime Evidence

## Focused Tests

```bash
MAIN_TEST_FILES=test/main/workspaceFiles.test.ts npm run test:main -- --test-name-pattern "workspace snapshot refresh passively|workspace snapshot refresh preserves simultaneous|workspace snapshot refresh preserves invalid"
MAIN_TEST_FILES=test/main/tiptapContentSidecar.test.ts npm run test:main -- --test-name-pattern "existing-only reconcile does not create"
MAIN_TEST_FILES=test/main/workspaceFiles.test.ts npm run test:main -- --test-name-pattern "workspace snapshot refresh does not clobber|workspace snapshot refresh aborts when passive"
MAIN_TEST_FILES=test/main/tiptapContentSidecar.test.ts npm run test:main
MAIN_TEST_FILES=test/main/workspaceFiles.test.ts npm run test:main
```

Results:

- Passive note Segment, note Supplement, audio Segment transcript and audio Supplement transcript tests passed.
- Simultaneous Markdown + sidecar conflict preservation passed, including sidecar edits that update `contentHash`.
- Existing-only reconcile does not create missing sidecars.
- Passive sidecar writes do not clobber a Markdown leaf changed between read and atomic commit.
- Passive sidecar write failure aborts snapshot refresh instead of silently dropping a Memory from the rebuilt index.
- Invalid JSON and unsupported Tiptap JSON preservation passed.
- Tiptap sidecar codec/reconcile suite passed.
- Full `workspaceFiles.test.ts` passed with 44 tests.

## Runtime Dogfood

Runtime target:

`/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试`

Steps:

- Restarted current repo dev Electron so main process loaded this implementation.
- Opened the test memory space.
- Externally edited non-selected note Segment sidecar:
  `memories/mem_20260519032914_666583be--碎片记录/segments/seg_20260519174530_0c59233b--笔记2/content.tiptap.json`
- Added green highlight and underline in Tiptap JSON with stamp `17801032126`.
- Before selecting the target Segment manually, polled `segment.md`.

Observed Markdown mirror before manual selection:

```markdown
<mark data-color="var(--tt-color-highlight-green)" style="background-color: var(--tt-color-highlight-green); color: inherit">Watcher passive JSON nonselected 17801032126</mark> and ++Watcher passive underline 17801032126++
```

The live Reo UI then showed the Segment content with green highlight and underline without reload or manual refresh.

Supplement follow-up:

- Externally edited note SegmentSupplement sidecar:
  `memories/mem_20260519032914_666583be--碎片记录/segments/seg_20260519192442_9d40b545--笔记4/supplements/sup_20260519192630_64e47ac8--补充笔记1/content.tiptap.json`
- Added blue highlight and underline in Tiptap JSON with stamp `17801240069`.
- Before selecting the Supplement tab manually, polled `supplement.md`.

Observed Supplement Markdown mirror before tab selection:

```markdown
<mark data-color="var(--tt-color-highlight-blue)" style="background-color: var(--tt-color-highlight-blue); color: inherit">Watcher supplement JSON nonselected 17801240069</mark> and ++Watcher supplement underline 17801240069++
```

After selecting the Supplement tab, the live Reo UI showed the blue highlight and underline without reload or manual refresh.

## Confidence Audit

Subagent review found three concrete implementation risks and one follow-up efficiency opportunity.

Fixed in this slice:

- Passive reconcile now calls the sidecar codec in existing-only mode, so a `content.tiptap.json` deleted after the initial existence check is not recreated by snapshot refresh.
- Passive Markdown writes now compare the current Markdown leaf at atomic commit time against the exact text read before reconciliation. If the file changed, the Markdown edit is preserved and the sidecar is left for review.
- Passive write failures now abort snapshot refresh instead of being swallowed by the read-model candidate scan and accidentally persisting a partial index.

Accepted boundary:

- Snapshot refresh reconciles every legal finalized note/audio Segment and SegmentSupplement with an existing sidecar. Non-selected objects were the missing product gap and are directly covered by tests and dogfood; selected dirty editor protection remains the existing renderer/focused-save conflict path and is not solved by passing raw paths or selection state through this IPC.

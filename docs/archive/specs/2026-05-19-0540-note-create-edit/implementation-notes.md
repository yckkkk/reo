# Note Create / Edit Implementation Notes

## 2026-05-19 05:40 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Decision:
  sub-spec (b) 入口保留为 note create/edit，但 Phase 1 先收口 editor decision。
- Reason:
  已归档设计 spec 明确记录 Spike #2 结果：BlockNote 0.51.1 与 Milkdown 7.21.1 均未通过
  原始 markdown-truth gate。若直接实现默认编辑器，会违反 Markdown / frontmatter 是真源的硬约束。
- Alternatives considered:
  - 直接按原设计使用 BlockNote：拒绝，当前 gate 未通过。
  - 直接切 Milkdown：拒绝，fallback gate 同样未通过。
  - 先缩小 normal-mode subset 或采用更窄 markdown-first adapter：采用，保持 raw mode
    保护所有不确定 markdown。
- User-visible note:
  本 sub-spec 的第一批 RED 测试会先覆盖 editor fixture gate；只有 gate 可解释地转绿后，才继续
  NoteEditorOverlay 与 FAB runtime 实现。

## 2026-05-19 05:46 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Baseline before Phase 1 RED:
  `npm run verify:quick` 通过。
- Evidence summary:
  - `test:main` 通过，750/750。
  - `test:renderer` 通过，449/449。
  - `lint:strict` 通过。
  - `format:check` 通过。

## 2026-05-19 05:47 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 1 RED evidence:
  `npx vitest run --project renderer-node src/renderer/src/workspace/noteMarkdownMode.test.ts`
  失败，原因是 `Cannot find module './noteMarkdownMode'`。
- GREEN evidence:
  同一 focused renderer test 通过，5/5。
- Decision:
  先采用 Reo-owned markdown-first normal/raw decision module，不在 Phase 1 引入 BlockNote 或
  Milkdown 依赖。
- Reason:
  Spike #2 已证明两个候选 editor adapter 都未满足原始 round-trip gate；当前最小正确实现是用
  保守 normal subset 与 raw mode 保护 markdown 真源，再在 overlay 层挂载对应编辑 surface。

## 2026-05-19 05:56 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 1 contract RED evidence:
  `MAIN_TEST_FILES=test/main/noteWorkspaceContract.test.ts npm run test:main`
  失败，缺少 note draft / content IPC channel 与 Zod schema export。
- Contract GREEN evidence:
  同一 focused main test 通过，4/4。
- Phase 1 runtime RED evidence:
  `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main`
  先失败于缺少 `src/main/noteDrafts.ts`，随后补 note Segment 后再失败于缺少 note Supplement
  runtime export。
- Runtime GREEN evidence:
  `MAIN_TEST_FILES=test/main/noteWorkspaceContract.test.ts,test/main/noteDrafts.test.ts npm run test:main`
  通过，6/6。
- Type evidence:
  `npm run typecheck:quick` 通过。
- Tradeoff:
  note draft runtime 先落在 `src/main/noteDrafts.ts`，不塞进 audio-specific `recordingDrafts.ts`；
  共享点仅复用 workspace path、markdown object、memory read model 刷新能力。

## 2026-05-19 06:01 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 1 first `verify:quick` result:
  FAIL。
- Findings:
  - `workspaceContract.test.ts` 的显式 channel 清单未同步新增 note channel；这是本次改动造成的
    测试断言漂移。
  - `backfillAudioDataSource.test.ts` 的 abort timing case 出现 `pending !== abort`；focused
    重跑同一测试通过，判断为既有时序 flaky，不改 audio backfill 代码。
- Resolution evidence:
  - `MAIN_TEST_FILES=test/main/workspaceContract.test.ts npm run test:main -- --test-name-pattern "workspace contract exposes only the explicit chooseDirectory channel"`
    通过。
  - `MAIN_TEST_FILES=test/main/backfillAudioDataSource.test.ts npm run test:main -- --test-name-pattern "backfill audio data source resolves abort even when ffmpeg never closes"`
    通过。

## 2026-05-19 06:04 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 1 second `verify:quick` result:
  FAIL at `lint:strict` after main 756/756 and renderer 454/454 passed.
- Finding:
  `noteMarkdownMode.ts` 的 inline math regex 有一个 ESLint `no-useless-escape` 问题。
- Resolution evidence:
  - `npm run lint:strict` 通过。
  - `npx vitest run --project renderer-node src/renderer/src/workspace/noteMarkdownMode.test.ts`
    通过，5/5。

## 2026-05-19 06:10 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 1 `verify:quick` result:
  PASS。
- Evidence summary:
  - `test:main` 通过，756/756。
  - `test:renderer` 通过，454/454。
  - `lint:strict` 通过。
  - `format:check` 通过。

## 2026-05-19 06:15 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 1 gate result:
  `/review` FAIL，`$ycksimplify` FAIL。
- Review findings fixed:
  - note finalize response schema 不再复用 audio-capable generic response，改为要求 note Segment
    projection。
  - note supplement finalize response schema 不再接受 audio supplement，改为要求 note Supplement
    projection。
  - 未实现的 note discard channel 从 explicit IPC allowlist 移除；discard runtime 留到 overlay close
    flow 实现时同 schema 一起加入。
- `$ycksimplify` finding fixed:
  移除未使用的 `noteDraftIndexPathForTest` test-only surface。
- Resolution evidence:
  `MAIN_TEST_FILES=test/main/noteWorkspaceContract.test.ts,test/main/workspaceContract.test.ts npm run test:main -- --test-name-pattern "note|workspace contract exposes only"`
  通过，6/6。

## 2026-05-19 06:20 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 1 re-gate `verify:quick` result:
  PASS。
- Evidence summary:
  - `test:main` 通过，756/756。
  - `test:renderer` 通过，454/454。
  - `lint:strict` 通过。
  - `format:check` 通过。

## 2026-05-19 06:31 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 1 re-gate result:
  `/review` FAIL，`$ycksimplify` FAIL。
- Review finding:
  note draft / content channel 已进入 explicit IPC allowlist，但 preload bridge 与 main process handler
  尚未暴露同名方法，形成不可调用的空 channel。
- `$ycksimplify` finding:
  `noteMarkdownMode.ts` 的 raw check 可复用为单一检查表，fixture 数量断言应表达 `>=20` 合同。
  该简化已合入。
- Resolution:
  补齐 `ReoWorkspaceBridge` 类型、preload bridge 方法、main process handler、以及 finalized note
  content read/write runtime。最终 content read/write 继续以 `segment.md` / `supplement.md` 的
  Markdown/frontmatter 为真源，并刷新 memory projection。
- Focused evidence:
  `MAIN_TEST_FILES=test/main/workspaceBridgeSurface.test.ts,test/main/workspaceIpc.test.ts,test/main/noteDrafts.test.ts,test/main/noteWorkspaceContract.test.ts npm run test:main -- --test-name-pattern "note content IPC|workspace preload bridge exposes explicit|note segment draft|note supplement|note"`
  通过，8/8。
- Full verification:
  `npm run verify:quick` 通过。
- Evidence summary:
  - `test:main` 通过，757/757。
  - `test:renderer` 通过，454/454。
  - `lint:strict` 通过。
  - `format:check` 通过。

## 2026-05-19 07:00 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 1 re-gate result:
  `/review` FAIL，`$ycksimplify` PASS。
- Review finding:
  note finalize 与 finalized note edit 已用 atomic 单文件写入，但仍不是跨文件事务。index refresh
  失败时可能留下 durable note 文件，或让已完成 note 的 Markdown 真源被部分改写。
- Resolution:
  - note Segment / Supplement finalize 增加父级 file-truth preflight，并在 refresh 失败时清理本次新暴露的
    durable directory 与 manifest，保留 draft。
  - finalized note Segment / Supplement edit 在写入前读取原 Markdown 与 manifest；后续 manifest 更新或
    projection refresh 失败时恢复原文件。
- RED evidence:
  `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "refresh fails|index refresh fails"`
  失败，证明 finalize 会暴露 durable 文件，edit 会改写旧正文。
- GREEN evidence:
  `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "refresh fails|index refresh fails|note segment draft|note supplement"`
  通过，6/6。
- Focused verification:
  `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main && npm run typecheck:quick && npx eslint src/main/noteDrafts.ts test/main/noteDrafts.test.ts && npx prettier --check src/main/noteDrafts.ts test/main/noteDrafts.test.ts`
  通过。
- Full verification:
  `npm run verify:quick` 通过。
- Evidence summary:
  - `test:main` 通过，761/761。
  - `test:renderer` 通过，454/454。
  - `lint:strict` 通过。
  - `format:check` 通过。

## 2026-05-19 07:20 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 1 final gate:
  PASS。
- Gate evidence:
  - `npm run verify:quick` 通过：`test:main` 761/761，`test:renderer` 454/454，
    `lint:strict` 通过，`format:check` 通过。
  - `/review` PASS：note IPC 垂直链路与 rollback 修复无 BLOCKER / MAJOR。
  - `$ycksimplify` PASS：`noteDrafts.ts` 已合并可消化的 helper 复用，无剩余 actionable
    simplification。
- Residual non-gate note:
  review 提醒 index refresh 成功后 draft cleanup 失败仍可在后续硬化；当前不阻塞 Phase 1。

## 2026-05-19 06:54 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 1 `$ycksimplify` gate follow-up:
  `noteDrafts.ts` 写入 markdown、draft metadata 与 finalized manifest 时改为复用现有
  `writeWorkspaceFileAtomic` / `writeWorkspaceJsonAtomic`。备选方案是保留 `writeFile` +
  `JSON.stringify`，但这会让 note runtime 自己维护一套工作区写入语义。
- Tradeoff:
  该改动不改变 note contract，但让 note 写入路径与现有 workspace atomic write helper 对齐，
  代价是 `noteDrafts.ts` 需要一个内部 `workspaceWriteAssert` 适配函数。
- Focused evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts,test/main/noteWorkspaceContract.test.ts,test/main/workspaceIpc.test.ts,test/main/workspaceBridgeSurface.test.ts npm run test:main -- --test-name-pattern "note|workspace preload bridge exposes explicit methods"`
    通过，8/8。
  - `npx vitest run --project renderer-node src/renderer/src/workspace/noteMarkdownMode.test.ts`
    通过，5/5。
  - `npm run typecheck:quick && npx eslint src/main/noteDrafts.ts && npx prettier --check src/main/noteDrafts.ts`
    通过。
- Full verification note:
  追加改动后曾启动 `npm run verify:quick`；`test:main` 通过 757/757，进入
  `test:renderer` 后长时间无输出且未自然结束，因此终止该额外全量验证。本条不作为
  `verify:quick` 通过证据；最近一次完整 `verify:quick` 通过证据仍为 06:31 条目。

## 2026-05-19 07:10 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 1 `$ycksimplify` gate follow-up:
  `noteDrafts.ts` 将 note Markdown 渲染、note manifest path、finalized note edit rollback
  恢复逻辑收敛为局部 helper。备选方案是保留 Segment / Supplement 两套内联路径，但会在后续
  conflict 与 attachment 子阶段继续放大重复。
- Tradeoff:
  该改动不改变 note draft / finalized note 行为；代价是 rollback helper 在恢复失败时只做
  best-effort，不覆盖原始 update failure。
- Focused verification:
  - `npm run typecheck:quick`
    通过。
  - `npx eslint src/main/noteDrafts.ts`
    通过。
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "refresh fails|index refresh fails|note segment draft|note supplement"`
    通过，6/6。
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts,test/main/noteWorkspaceContract.test.ts,test/main/workspaceIpc.test.ts,test/main/workspaceBridgeSurface.test.ts npm run test:main -- --test-name-pattern "refresh fails|index refresh fails|note content IPC|workspace preload bridge exposes explicit|note segment draft|note supplement|note"`
    通过，12/12。
  - `npx vitest run --project renderer-node src/renderer/src/workspace/noteMarkdownMode.test.ts`
    通过，5/5。
  - `npx prettier --check src/main/noteDrafts.ts docs/specs/2026-05-19-0540-note-create-edit/implementation-notes.md`
    通过。
- Full verification note:
  本次 simplify 后曾再次启动 `npm run verify:quick`；`test:main` 通过 761/761，
  `test:renderer` worker 持续 CPU busy 且超过 3 分钟无输出，因此终止该额外全量验证。
  本条不作为 `verify:quick` 通过证据；Phase 1 最近一次完整 `verify:quick` 通过证据仍为 07:00
  条目。

## 2026-05-19 07:28 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 2 implementation decision:
  Note editor UI 先采用 Reo 自己的 markdown-first textarea overlay，并用 Phase 1 的
  `decideNoteMarkdownMode` 标注普通 / raw mode；本 sub-spec 不把 BlockNote 或 Milkdown 接入
  renderer runtime。
- Alternatives considered:
  1. 直接接入 BlockNote Mantine：spike 证明可 mount，但 round-trip gate 未达到 markdown 真源要求，
     且 bundle/CSS 风险超出本 sub-spec 的最小实现边界。
  2. 接入 Milkdown：spike 未证明能优于 BlockNote 的 round-trip gate，且仍需额外 adapter。
  3. 纯 preview surface + 外部编辑：无法完成本 sub-spec 的 create/edit overlay 目标。
- Reason:
  当前 note 真源已经是 `segment.md` / `supplement.md` 正文；textarea 可以直接维护 markdown
  语义真源，满足 TDD、IPC 与 transaction 验证，同时避免把未通过 round-trip gate 的 editor JSON
  模型引入产品语义层。
- Tradeoff:
  首版没有富文本所见即所得能力；换来较小实现面、更清楚的 Electron IPC 边界与可验证的 markdown
  持久化路径。

## 2026-05-19 07:31 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 2 RED evidence:
  - `npx vitest run --project renderer-jsdom-browser src/renderer/src/workspace/workspaceApi.test.ts`
    失败：`createNoteSegmentDraft is not a function`。
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "Note expression|finalized Note segments|SegmentSupplement menu"`
    失败：FAB 仍只暴露 `笔记暂不可用`；Memory Studio 把 note-only detail 当成空片段；
    SegmentSupplement 菜单没有 `笔记补充`。

## 2026-05-19 07:55 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 2 GREEN implementation:
  renderer 接入 note API wrappers、FAB 笔记入口、`MarkdownContentSurface`、`NoteEditorOverlay`、
  Memory Studio note Segment 展示，以及 Note Segment create/edit 保存链路。
- Behavior covered:
  - 已选 Memory 时 FAB `笔记` 入口可用；无当前 Memory 时仍保持不可用。
  - `NoteEditorOverlay` 新建 Note Segment 走 `createNoteSegmentDraft` →
    `writeNoteSegmentDraftBody` → `finalizeNoteSegmentDraft`，不创建 Memory，也不触发录音草稿。
  - finalized Note Segment 编辑走 `writeSegmentContent`，并更新当前 note content query。
  - Memory Studio 展示 note-only Segment，不再把 note-only Memory 当作空片段。
  - Segment 补充菜单新增 `笔记补充` 入口并把目标传给 App note overlay flow。
- Focused evidence:
  - `npx vitest run --project renderer-jsdom-browser src/renderer/src/workspace/workspaceApi.test.ts`
    通过，3/3。
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "Note expression|finalized Note segments|SegmentSupplement menu"`
    通过，3/3。
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/App.test.tsx --testNamePattern "edits finalized Note|finalizes a FAB Note"`
    通过，2/2。
  - `npm run typecheck:quick` 通过。
- Full verification:
  `npm run verify:quick` 通过：`test:main` 761/761，`test:renderer` 459/459，
  `lint:strict` 通过，`format:check` 通过。

## 2026-05-19 08:12 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 2 review gate first run:
  `/review` FAIL，4 个 MAJOR：
  note SegmentSupplement 被 audio-only 过滤导致不可见；finalized note supplement 没有 edit
  wiring；create overlay 打开即创建 draft，cancel 会留下持久 draft；overlay 未使用
  `decideNoteMarkdownMode` 标注普通 / raw mode。
- Resolution:
  - `MemoryStudio` 的 supplement tab/content 模型收敛为 multi-kind，note supplement 使用
    `MarkdownContentSurface`，不再进入 audio playback/transcription 分支。
  - `App` 与 `NoteEditorOverlay` 补齐 finalized note supplement edit flow，保存走
    `writeSegmentSupplementContent` 并更新 note supplement content cache。
  - create overlay 改为 save 时才创建 note draft；关闭或 cancel 不触发 draft write。
  - overlay 复用 `decideNoteMarkdownMode`，显示 `普通 Markdown` / `Raw Markdown` 状态。
- Tradeoff:
  lazy draft creation 避免引入本 sub-spec 未设计的 renderer-side draft discard IPC，但在用户保存前没有
  持久草稿恢复。当前 Phase 2 目标是 create/edit 可用链路与 markdown 真源，恢复语义留给后续更明确的
  draft lifecycle 设计。
- Focused evidence:
  - `npm run typecheck:quick`
    通过。
  - `npx vitest run --project renderer-jsdom-browser src/renderer/src/workspace/workspaceApi.test.ts`
    通过，3/3。
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "Note expression|finalized Note segments|SegmentSupplement menu"`
    通过，3/3。
  - `npx vitest run --project renderer-node src/renderer/src/workspace/workspaceQueries.test.ts src/renderer/src/workspace/noteMarkdownMode.test.ts`
    通过，11/11。
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/App.test.tsx --testNamePattern "FAB Note|overlay is closed|edits finalized Note|Note SegmentSupplement"`
    通过，4/4。
- Full verification:
  `npm run verify:quick` 通过：`test:main` 761/761，`test:renderer` 462/462，
  `lint:strict` 通过，`format:check` 通过。
- Simplify gate:
  `$ycksimplify` PASS。可消化简化已完成：`MarkdownContentSurface` 避免无效 edit 按钮并支持 tab
  panel 复用；note supplement tab/content 与 edit wiring 已收敛；无剩余 actionable simplification。

## 2026-05-19 08:23 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 2 review gate second run:
  `/review` FAIL，1 个 MAJOR：create flow 中 draft body write 成功后若 finalize 失败，overlay
  没有保存 `write*DraftBody` 返回的新 revision，用户重试会用 stale revision 写入，导致可恢复的
  finalize/index failure 变成 stale draft failure。Segment 与 SegmentSupplement create path 都受影响。
- RED evidence:
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/App.test.tsx --testNamePattern "retries a FAB Note save"`
    失败：第二次保存后 `finalizeNoteSegmentDraft` 仍只调用 1 次，说明 stale revision 阻断了重试。
- Resolution:
  `NoteEditorOverlay` 在 note Segment 与 note SegmentSupplement create path 中，body write 成功后立即把
  response revision 写回 active draft state，再调用 finalize。若 finalize 失败，下一次保存会用最新
  revision 继续覆盖同一 draft body 并重试 finalize。
- Focused evidence:
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/App.test.tsx --testNamePattern "retries a FAB Note save|FAB Note|overlay is closed|edits finalized Note|Note SegmentSupplement"`
    通过，5/5。
  - `npm run typecheck:quick`
    通过。
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "Note expression|finalized Note segments|SegmentSupplement menu"`
    通过，3/3。
  - `npx vitest run --project renderer-node src/renderer/src/workspace/workspaceQueries.test.ts src/renderer/src/workspace/noteMarkdownMode.test.ts`
    通过，11/11。
- Full verification:
  `npm run verify:quick` 通过：`test:main` 761/761，`test:renderer` 463/463，
  `lint:strict` 通过，`format:check` 通过。

## 2026-05-19 09:37 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 re-gate second run:
  `/review` 与 `$ycksimplify` 均 FAIL：finalized note read path 没有把 `workspaceId` 传入
  manifest ownership check；finalized note write path 虽然会在 update manifest 时复核 ownership，
  但应在任何 Markdown write 前先读取并验证 manifest。
- Resolution:
  - `readFinalizedNoteSegmentContent` 与 `readFinalizedNoteSegmentSupplementContent` 改为显式接收
    `workspaceId`，IPC read handler 使用 active handle workspaceId 传入。
  - finalized note Segment / SegmentSupplement body save 在读取当前 Markdown 与写入 Markdown 前，
    先以 no-follow manifest read 校验 workspaceId / memoryId / segmentId / supplementId ownership。
  - ownership mismatch 测试扩展到 workspaceId mismatch，并断言失败写入不会污染 `segment.md` /
    `supplement.md`。
- Focused evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main`
    通过，12/12。
  - `npm run typecheck:quick`
    通过。
  - `npx prettier --check src/main/noteDrafts.ts src/main/workspaceIpc.ts test/main/noteDrafts.test.ts`
    通过。
- Full verification:
  `npm run verify:quick` 通过：`test:main` 767/767，`test:renderer` 463/463，
  `lint:strict` 通过，`format:check` 通过。

## 2026-05-19 09:45 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 re-gate third run:
  `/review` FAIL，2 个 MAJOR：ownership mismatch write 在进入 catch rollback 时仍可能重写
  Markdown；`$ycksimplify` FAIL，finalized note public read/write 未复用现有 duplicate finalized
  Segment id guard。
- RED evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "duplicate|ownership mismatches"`
    失败，4/4 failed：ownership mismatch 失败写入改变 `segment.md` / `supplement.md` inode；
    duplicate Segment id 下 note Segment / SegmentSupplement read 仍返回成功。
- Resolution:
  - finalized note Segment / SegmentSupplement read 与 write 复用
    `assertNoDuplicateSegmentDirectoryById`，与 finalized audio read 的 duplicate durable Segment
    identity guard 对齐。
  - finalized note Segment / SegmentSupplement write 在读取 rollback baseline 和读取 Markdown 正文前，
    先完成 no-follow manifest ownership 校验与 duplicate Segment id 校验；pre-write failure 不再进入
    Markdown rollback write。
- Focused evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "duplicate|ownership mismatches"`
    通过，4/4。
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main`
    通过，14/14。
  - `npm run typecheck:quick`
    通过。
  - `npx prettier --check src/main/noteDrafts.ts test/main/noteDrafts.test.ts`
    通过。
- Full verification:
  `npm run verify:quick` 通过：`test:main` 769/769，`test:renderer` 463/463，
  `lint:strict` 通过，`format:check` 通过。

## 2026-05-19 10:01 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 re-gate fourth run:
  `/review` PASS；`$ycksimplify` FAIL，2 个必须修复点：finalized note 创建路径没有复用
  file-space node `<id>--<title>` 命名不变量；Note SegmentSupplement draft parent existence check
  直接读取整份 parent `segment.md`。
- RED evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "file truth|unsafe parent"`
    失败：finalized note Segment directory basename 仍是 `seg_note`，不是
    `seg_note--Final note`。
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "note supplement draft finalizes"`
    失败：finalized note SegmentSupplement directory basename 仍是 `sup_note`，不是
    `sup_note--Final supplement`。
- Resolution:
  - `memoryFiles.ts` 导出已有 `memorySegmentDirectoryForNewNode` 和
    `segmentSupplementDirectoryForNewNode`，note finalize 复用同一 `<id>--<title>` file-space node
    naming helper。
  - finalized note Segment / SegmentSupplement create 额外检查现有 default / generated target，避免旧
    default 目录或同名 generated 目录被绕过。
  - Note SegmentSupplement draft parent check 改为 no-follow manifest ownership +
    duplicate Segment id guard + parent directory / `segment.md` no-follow existence check，不再为
    existence 读取整份 Markdown。
- Focused evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "file truth|note supplement draft finalizes|unsafe parent"`
    通过，3/3。
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main`
    通过，15/15。
  - `npm run typecheck:quick`
    通过。
  - `npx prettier --check src/main/memoryFiles.ts src/main/noteDrafts.ts test/main/noteDrafts.test.ts`
    通过。
- Verification note:
  首次 `npm run verify:quick` 在 renderer long suite 中出现
  `keeps non-target Memory detail refreshable during a pending Segment delete` 20s timeout；该测试
  focused rerun 通过，随后完整 `npm run verify:quick` 通过。该 timeout 未指向本轮 main-process
  note file-space 改动。
- Full verification:
  `npm run verify:quick` 通过：`test:main` 770/770，`test:renderer` 463/463，
  `lint:strict` 通过，`format:check` 通过。

## 2026-05-19 10:21 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 re-gate fifth run:
  `/review` FAIL，2 个 MAJOR：note manifest read schema 仍比 file-truth contract 宽，缺少
  `objectType` / `finalizedAt` 且使用 passthrough；duplicate finalized Segment guard 跳过 owner
  Memory，不能直接发现同一 Memory 下同 id 多目录。`$ycksimplify` FAIL，2 个效率 / 复用问题：
  note Segment finalize 和 note SegmentSupplement finalize 都用完整 Memory detail 读取做 parent check。
- RED evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "stale loose|same-memory duplicate|does not scan full Memory detail"`
    失败，3/5 failed：两个 finalize 路径触发 full Memory detail scan；duplicate guard 没有拒绝
    same-Memory duplicate Segment id。
  - stale loose manifest read/write 测试在现有路径下已失败返回，但仍补入覆盖，防止 public note path
    重新放宽 manifest schema。
- Resolution:
  - finalized note Segment / SegmentSupplement manifest schema 改为 strict，并要求
    `objectType` 和 `finalizedAt`。
  - `assertNoDuplicateSegmentDirectoryById` 先扫描每个 Memory 的 likely Segment directory candidates，
    owner Memory 内多于一个同 id candidate 时也返回 duplicate。
  - `readMemoryFileTruth` 导出为窄 parent Memory file-truth read；note Segment finalize 用它替代
    full `readMemoryDetailFromFileTruth`。
  - note SegmentSupplement finalize 复用 `assertFinalizedSegmentParentForNoteSupplement`，用 no-follow
    manifest / duplicate guard / parent directory / `segment.md` no-follow check 替代 full Memory detail scan。
- Focused evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "stale loose|same-memory duplicate|does not scan full Memory detail"`
    通过，5/5。
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main`
    通过，20/20。
  - `npm run typecheck:quick`
    通过。
  - `npx prettier --check src/main/memoryFiles.ts src/main/noteDrafts.ts test/main/noteDrafts.test.ts`
    通过。

## 2026-05-19 10:33 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Verification repair:
  首次全量 `npm run verify:quick` 在行为测试均通过后失败于 `lint:strict`，原因是 stale manifest
  tests 使用 `_objectType` / `_finalizedAt` 解构丢弃字段，触发 `no-unused-vars`。改为复制 manifest
  后用 bracket access 删除字段，保持测试意图不变并满足 TypeScript index-signature 规则。
- Full verification:
  `npm run verify:quick` 通过：`test:main` 775/775，`test:renderer` 463/463，
  `lint:strict` 通过，`format:check` 通过。

## 2026-05-19 11:05 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- UI correction:
  用户明确指出 Phase 3 的 note UI 仍在错误地重建页面。当前实现已收回到 Memory Studio
  既有结构：Segment strip、selected Segment 播放区、同一条 content tab rail、同一套 tab
  More reveal 和同一类实体 More 菜单都复用既有录音设计。
- Resolution:
  - 新建 Note 仍从 FAB `笔记` 进入与录音创建流程同级的沉浸式 `NoteEditorOverlay`。
  - finalized note Segment 不再直接跳过播放区和 tab rail；它保留同一播放 row 的不可播放占位，
    不额外插入说明文案，避免改变录音 tab rail 的纵向位置。
  - note 正文位于 primary `正文` tab 下的 `MarkdownContentSurface`；surface 不重复渲染 Segment
    title，展开按钮绝对定位在正文区域右上角，不占用正文流高度。
  - primary `转录` / `正文` tab 和 SegmentSupplement tab 使用同一类 pill + sibling More
    affordance；primary tab More 复用 `SegmentActionsMenu`，因此拥有用默认应用打开、在访达中显示、
    复制相对路径、复制绝对路径、重命名和删除。audio `转录` tab 额外保留生成/重新生成转录。
- Alternatives rejected:
  - 为 note 正文单独做 header、标题和展开按钮行：拒绝，因为会重新设计 note-only 页面并破坏
    录音文本区域的纵向基准。
  - 为 `正文` / `转录` tab 手写轻量 DropdownMenu：拒绝，因为会复制并削弱已有 Segment entity
    More 菜单能力。
- Focused evidence:
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "renders finalized Note segments|content tab rail|Memory Studio|SegmentSupplement More"`
    通过，9/9。
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/App.test.tsx --testNamePattern "FAB Note|retries a FAB Note save|overlay is closed|edits finalized Note|Note SegmentSupplement|生成转录|重新生成转录"`
    通过，5/5。
  - `npm run typecheck:quick`
    通过。
  - `npx prettier --check src/renderer/src/workspace/MemoryStudio.tsx src/renderer/src/workspace/MarkdownContentSurface.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/SegmentActionsMenu.tsx src/renderer/src/App.test.tsx docs/current/frontend.md docs/current/product.md`
    通过。

## 2026-05-19 11:13 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- UI correction follow-up:
  编辑页继续删除不属于当前实现的 UI：不显示 `普通 Markdown` / `Raw Markdown` 标签，不显示多余的
  editor kind 小标题，不保留当前没有真实工具能力的 toolbar placeholder。当前只保留单个 note 标题、
  保存按钮和正文 textarea；未来接入通过 gate 的 BlockNote/Milkdown/adapter 时再新增真实 toolbar。
- Runtime issue found:
  dev HMR 过程中出现过 `PrimaryContentTab` 的 `renderMoreMenu is not a function` 中间态，导致用户看到
  More 无效。已重启 Electron dev runtime，并把 primary tab More 改成显式复用 `SegmentActionsMenu`，
  不再自写轻量菜单。
- Focused evidence:
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/App.test.tsx --testNamePattern "FAB Note|edits finalized Note|Note SegmentSupplement"`
    通过，4/4。
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "renders finalized Note segments|content tab rail"`
    通过，2/2。
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/App.test.tsx --testNamePattern "FAB Note|retries a FAB Note save|overlay is closed|edits finalized Note|Note SegmentSupplement"`
    通过，5/5。
  - `npm run typecheck:quick`
    通过。
  - `npx prettier --check src/renderer/src/workspace/NoteEditorOverlay.tsx src/renderer/src/App.test.tsx`
    通过。

## 2026-05-19 09:00 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 `$ycksimplify` gate first run:
  FAIL，1 个归档前必须修复的 current-doc mismatch：`docs/current/flow.md` 的 Workspace
  snapshot refresh flow 只写录音流程打开时暂停 refresh，但 renderer 代码已同时把
  `noteEditorTarget` 作为 refresh / recording recovery 暂停条件。
- Resolution:
  `docs/current/flow.md` 已更新为录音流程或 Note editor 打开时都暂停 snapshot refresh，避免外部文件变化绕过当前录音或笔记编辑的 Memory / Workspace 切换保护。

## 2026-05-19 09:18 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 `/review` gate first run:
  FAIL，1 个 BLOCKER 与 2 个 MAJOR：
  finalized note `segment.md` / `supplement.md` / manifest 读取使用普通 `readFile` 跟随 symlink
  leaf；finalized note Segment / SegmentSupplement body save 没有同目标 main process 写队列；
  `docs/current/*` 仍有 Memory detail / scan projection 的 audio-only 表述。
- RED evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "request order"`
    失败：同一 note Segment 并发保存时，旧请求和新请求没有串行化，测试返回失败。
- Resolution:
  - `noteDrafts.ts` 对 finalized note Markdown 与 manifest 读取改为 `O_NOFOLLOW` file handle，并拒绝非普通文件。
  - finalized note Segment / SegmentSupplement body save 进入同 root / memory / segment /
    supplement / file 的 main process 写队列，避免旧保存 out-of-order 覆盖新保存。
  - `docs/current/flow.md`、`frontend.md`、`electron.md` 已更新为 finalized audio / note
    projection 当前事实。
- Focused evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main`
    通过，10/10。
  - `npm run typecheck:quick`
    通过。
- Full verification:
  `npm run verify:quick` 通过：`test:main` 765/765，`test:renderer` 463/463，
  `lint:strict` 通过，`format:check` 通过。

## 2026-05-19 09:34 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 re-gate:
  `/review` FAIL，2 个 BLOCKER + 1 个 MAJOR：finalized note read/write 仍未在 read site /
  write 前严格复核 manifest ownership；`docs/current/frontend.md` 仍写 FAB 只有录音可执行。
  `$ycksimplify` FAIL：`docs/current/data.md` 仍有 Memory detail / Segment content /
  SegmentSupplement content audio-only 表述；note save queue 与 recording markdown save queue 复制。
- RED evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "ownership mismatches"`
    失败，2/2 failed：mismatched note Segment / SegmentSupplement manifest 仍被 read/write 接受。
- Resolution:
  - 新增 `workspaceAsyncQueue.ts` 复用 per-target async queue，recording markdown save 与 note body
    save 共用同一 helper。
  - finalized note Segment / SegmentSupplement manifest 使用 strict ownership 校验；read site 和
    body save 前都复核 workspaceId / memoryId / segmentId / supplementId。
  - `docs/current/data.md` 和 `frontend.md` 已同步 note projection、note content query 和 Note FAB 当前事实。
- Focused evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "ownership mismatches"`
    通过，2/2。
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main`
    通过，12/12。
  - `npm run typecheck:quick`
    通过。
- Full verification:
  `npm run verify:quick` 通过：`test:main` 767/767，`test:renderer` 463/463，
  `lint:strict` 通过，`format:check` 通过。

## 2026-05-19 08:53 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 refactor/docs:
  长期事实已压缩回 `docs/current/foundation.md`、`docs/current/architecture.md`、
  `docs/current/product.md`、`docs/current/frontend.md`、`docs/current/electron.md`、
  `docs/current/flow.md`、`docs/current/data.md`、`docs/current/roadmap.md` 和
  `docs/current/quality.md`。这些文档现在描述当前已实现的 audio + note Segment /
  SegmentSupplement、Note editor overlay、Markdown content surface、note IPC contract、note draft
  lifecycle、query cache ownership 与 renderer test expectations。
- Operation verification:
  该早期记录已被 2026-05-19 12:26 America/Los_Angeles 的 Electron dev runtime CDP 验证补齐。
  Focused renderer / main tests 继续覆盖 finalize retry、save pending lock 和 failure rollback；runtime
  证据覆盖 dirty discard、Note Segment create/edit surface、primary `正文` More 菜单、Note
  SegmentSupplement create 和 tab rail / content surface 布局。
- Focused evidence:
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/App.test.tsx --testNamePattern "retries a FAB Note save|FAB Note|overlay is closed|edits finalized Note|Note SegmentSupplement"`
    通过，5/5。
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "Note expression|finalized Note segments|SegmentSupplement menu"`
    通过，3/3。
  - `npx vitest run --project renderer-node src/renderer/src/workspace/workspaceQueries.test.ts src/renderer/src/workspace/noteMarkdownMode.test.ts`
    通过，11/11。
  - `npx prettier --check docs/current/foundation.md docs/current/architecture.md docs/current/product.md docs/current/frontend.md docs/current/electron.md docs/current/flow.md docs/current/data.md docs/current/roadmap.md docs/current/quality.md`
    通过。
  - `rg -n 'audio 单模态|当前 runtime 只实现 `audio`|只暴露录音补充|当前菜单只暴露录音补充|note、photo|笔记、视频|视频 / 图片 / 笔记|body并|length和|selected SegmentSupplement audio content' docs/current`
    无匹配。
- Full verification:
  `npm run verify:quick` 通过：`test:main` 761/761，`test:renderer` 463/463，
  `lint:strict` 通过，`format:check` 通过。

## 2026-05-19 08:37 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 2 final gate:
  PASS。
- Gate evidence:
  - `npm run verify:quick` 通过：`test:main` 761/761，`test:renderer` 463/463，
    `lint:strict` 通过，`format:check` 通过。
  - `/review` PASS：无 BLOCKER / MAJOR；复审确认 note supplement visibility/edit、lazy draft
    create、markdown mode、retry revision 和 pending input lock 均已收口。
  - `$ycksimplify` PASS：`MarkdownContentSurface`、note supplement tab/content 与 App wiring 已完成可消化简化，
    无剩余 actionable simplification。

## 2026-05-19 08:32 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 2 review gate third run:
  `/review` FAIL，1 个 MAJOR：已有 draft 后 pending 保存期间 textarea 仍可编辑；如果用户在
  finalize in-flight 时继续输入，finalize 成功会关闭 overlay 并保存旧 closure 捕获的正文，造成用户可见的
  note 内容丢失。
- RED evidence:
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/App.test.tsx --testNamePattern "retries a FAB Note save"`
    失败：第二次保存 pending 时 `笔记正文` textarea 仍未 disabled。
- Resolution:
  `NoteEditorOverlay` 在任何 pending save 期间禁用 textarea，而不是只在尚未创建 draft 时禁用。这样
  body write / finalize in-flight 期间不会出现 UI 输入与保存闭包竞争。
- Focused evidence:
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/App.test.tsx --testNamePattern "retries a FAB Note save|FAB Note|overlay is closed|edits finalized Note|Note SegmentSupplement"`
    通过，5/5。
  - `npm run typecheck:quick`
    通过。
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "Note expression|finalized Note segments|SegmentSupplement menu"`
    通过，3/3。
  - `npx vitest run --project renderer-node src/renderer/src/workspace/workspaceQueries.test.ts src/renderer/src/workspace/noteMarkdownMode.test.ts`
    通过，11/11。
- Full verification:
  `npm run verify:quick` 通过：`test:main` 761/761，`test:renderer` 463/463，
  `lint:strict` 通过，`format:check` 通过。

## 2026-05-19 11:31 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 UI correction:
  已归档的 `docs/archive/specs/2026-05-19-0111-note-foundation-design/README.md` 与
  `engineering-handoff.md` 仍作为本 initiative 后续所有 review / simplify gate 的原始设计约束基线。
  当前 sub-spec 继续叠加运行时 UI 事实：Memory Studio 不重做页面，Note 复用录音片段结构、tab rail
  与内容区位置。
- Decision:
  沉浸式 Note editor 的可见标题不再显示 Segment 标题；Note Segment 正文编辑页显示与 tab rail
  一致的 `正文`，Note SegmentSupplement 编辑页显示对应 supplement tab 标题。正文 textarea 顶部 padding
  从 `py-14` 收紧到 `py-6`。
- Interaction correction:
  主内容 tab 的 More trigger 禁止参与 content-tab drag start，避免点击 `转录` / `正文` More 时被父级
  draggable tab 抢走交互。补充 tab More 同步加同一保护。
- Evidence:
  - RED:
    `npx vitest run --project renderer-jsdom-components src/renderer/src/App.test.tsx --testNamePattern "FAB Note|edits finalized Note|Note SegmentSupplement"`
    失败，overlay 仍显示 `笔记1` 且 textarea 使用 `py-14`。
  - GREEN focused:
    `npx vitest run --project renderer-jsdom-components src/renderer/src/App.test.tsx --testNamePattern "FAB Note|edits finalized Note|Note SegmentSupplement" && npx vitest run --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "finalized recording supplements"`
    通过，4/4 + 1/1。
  - Regression:
    `npx vitest run --project renderer-jsdom-components src/renderer/src/App.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`
    通过，149/149。
  - Full verification:
    `npm run verify:quick` 通过：`test:main` 781/781，`test:renderer` 463/463，
    `lint:strict` 通过，`format:check` 通过。
- Alternatives considered:
  - 在 overlay 中继续显示 Segment 标题：拒绝，用户可见层级会把片段名和 tab 内容名混在一起。
  - 为主 tab More 单独造菜单：拒绝，`SegmentActionsMenu` 已是 segment.md / transcript 操作的复用入口。

## 2026-05-19 12:03 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 re-gate remediation:
  `/review` FAIL 的安全 BLOCKER 来自 note draft 读取路径：`readNoteDraftMetadata`、
  `readNoteSupplementDraftMetadata`、`finalizeNoteSegmentDraft` 和
  `finalizeSegmentSupplementNoteDraft` 会跟随 `.reo/drafts/*/<id>/` 下的 symlink leaf。
  已改为先逐层复核 draft directory ancestor 和 leaf directory 都不是 symlink 或非目录，再用
  no-follow file handle 读取 `segment.json`、`segment.md`、`supplement.json` 和
  `supplement.md`。
- Product / flow decision:
  Note create overlay 继续采用 lazy draft：打开编辑页不创建 draft，只有保存时才创建 draft、写 body
  并 finalize。dirty close 通过 `WorkspaceDangerConfirmDialog` 二次确认；确认放弃只关闭 overlay，
  不创建 draft、不写文件。
- Spec narrowing:
  原 README / plan 中的 normal/raw mode 与 recovery marker 表述不再作为本 sub-spec 的完成条件。
  Spike #2 已证明当前 BlockNote / Milkdown round-trip gate 不满足 markdown-first 要求；本 sub-spec
  交付单一 markdown-first textarea，不显示 mode badge，不展示未实现 toolbar。由于 lazy draft 在保存前
  不存在 durable draft 或 recovery marker，未保存关闭只能通过 dirty confirm 保护；body write 成功但
  finalize 失败时通过同一 overlay 保留 draft revision 做 in-session retry。
- Alternatives considered:
  - 打开 Note editor 时立即创建 draft 并写 recovery marker：拒绝，会让取消创建产生 Reo-managed
    draft 副作用，违背当前 lazy draft 合同。
  - 为未保存正文增加 renderer recovery marker：拒绝，当前没有 durable draft 身份，marker 会成为
    第二语义真源。
  - 保留 normal/raw mode badge：拒绝，当前没有通过 gate 的 editor adapter，展示 mode 会暗示未交付能力。
- RED evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "symlinked draft"`
    失败，4/4 failed：symlinked draft metadata / markdown leaf 被读取。
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/App.test.tsx --testNamePattern "dirty FAB Note"`
    失败：点击返回后没有出现 `alertdialog`。
- GREEN focused evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "symlinked draft"`
    通过，4/4。
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/App.test.tsx --testNamePattern "dirty FAB Note|FAB Note|edits finalized Note|Note SegmentSupplement"`
    通过，5/5。
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main`
    通过，30/30。
- Full verification:
  `npm run verify:quick` 通过：`test:main` 785/785，`test:renderer` 459/459，
  `lint:strict` 通过，`format:check` 通过。

## 2026-05-19 12:28 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 re-gate result:
  `/review` FAIL：active spec 仍残留 `draft → overlay`、discard IPC 和缺少 runtime operation
  validation 的表述。`$ycksimplify` FAIL：active initiative 仍残留 BlockNote / raw mode /
  recovery marker 作为 sub-spec (b) 当前合同，并发现 `assertNoteParentMemory` 会把 unsafe parent
  Memory 读取错误降级成 `ERR_MEMORY_NOT_FOUND`。
- RED evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "unsafe parent memory"`
    失败：symlinked parent `memory.md` 返回 `ERR_MEMORY_NOT_FOUND`，未保留 unsafe typed error。
- Resolution:
  - `assertNoteParentMemory` 先保留已有 workspace error envelope；普通 unsafe path error 映射为
    `ERR_WORKSPACE_UNSAFE_PATH`，只有 missing file 才映射为 `ERR_MEMORY_NOT_FOUND`，其它 parent
    truth 读取异常映射为 metadata invalid。
  - finalized note Segment / SegmentSupplement edit save 复用已读取的 Markdown / manifest baseline，
    不再为 title 和 ownership 额外重复读取同一文件。
  - active spec 与 active initiative 已统一为 markdown-first textarea、save-time lazy draft、dirty
    close confirm、finalize retry；不再把 BlockNote / Raw mode / recovery marker / discard IPC 写成
    sub-spec (b) 当前完成条件。
  - `docs/current/quality.md` 的 renderer coverage 列表已改为 Note markdown-first textarea、dirty
    close confirm、无 mode badge / fake toolbar。
- GREEN focused evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "unsafe parent memory|symlinked draft|finalized note segment edit|finalized note supplement edit"`
    通过，9/9。
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main`
    通过，31/31。
- Full verification:
  `npm run verify:quick` 通过：`test:main` 786/786，`test:renderer` 459/459，
  `lint:strict` 通过，`format:check` 通过。
- Electron dev runtime evidence:
  - CDP target：`http://localhost:5183/` in current Electron dev runtime。
  - Evidence JSON：`docs/specs/2026-05-19-0540-note-create-edit/evidence/runtime/note-create-edit-runtime.json`
  - Screenshot：`docs/specs/2026-05-19-0540-note-create-edit/evidence/runtime/note-create-edit-runtime.png`
  - Runtime covered dirty discard confirm, primary `正文` More menu items, edit overlay title/spacing/no
    mode badge/no fake toolbar, Note SegmentSupplement create, note playback placeholder, tab rail baseline,
    MarkdownContentSurface position, and expand button placement.
  - Finalize retry remains covered by focused failure-injection renderer test because the Electron
    contextBridge runtime API is immutable from renderer CDP and cannot be monkey-patched without changing
    production code.

## 2026-05-19 12:46 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 re-gate result:
  `$ycksimplify` FAIL：`updateManifestUpdatedAt` still reread finalized note manifest files after the caller
  had already read and parsed the same baseline, and active initiative plan still described sub-spec (c) as a
  BlockNote image paste flow despite this sub-spec intentionally delivering a markdown-first textarea.
- Resolution:
  - `updateManifestUpdatedAt` now receives the already-parsed finalized note manifest, keeps the ownership
    assertion, and writes the updated manifest without a second no-follow read. The original manifest string is
    still retained for rollback.
  - Sub-spec (c) initiative plan now describes markdown-first attachment insertion and explicitly gates rich
    editor paste / image block behavior behind a future editor adapter spec after round-trip gate success.
- Alternatives considered:
  - Keep rereading manifest before updating `updatedAt`: rejected because the save queue already serializes this
    object and the caller has the no-follow baseline needed for validation and rollback.
  - Keep BlockNote paste flow as the sub-spec (c) default: rejected because the active implementation contract is
    markdown-first until a rich editor adapter passes Reo's round-trip gate.
- Focused verification:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "finalized note segment edit|finalized note supplement edit|unsafe parent memory|symlinked draft"`
    passed, 9/9.
- Full verification:
  `npm run verify:quick` passed: `test:main` 786/786, `test:renderer` 459/459, `lint:strict`
  passed, `format:check` passed.

## 2026-05-19 13:02 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 final gate:
  - `/review` re-review PASS with no unresolved BLOCKER / MAJOR issues. The reviewer checked the archived
    design spec, active spec / initiative docs, runtime evidence, unsafe parent Memory fix, UI reuse constraints,
    and Electron security baseline.
  - `$ycksimplify` re-review PASS with no unresolved BLOCKER / MAJOR issues. The reviewer verified that
    finalized note manifest writes no longer reread the same manifest baseline and that sub-spec (c) is now
    markdown-first attachment insertion with rich editor paste behavior gated behind a future editor adapter spec.
  - `npm run verify:quick` passed after the final simplification fixes: `test:main` 786/786,
    `test:renderer` 459/459, `lint:strict` passed, `format:check` passed.
- Archive readiness:
  Sub-spec (b) meets its phase gate and can move to `docs/archive/specs/2026-05-19-0540-note-create-edit/`.

## 2026-05-20 00:24 America/Los_Angeles

- Commit anchor: pending working tree after `4e7e5e69`.
- Markdown persistence correction:
  - Finalized note save/finalize now derives `bodyByteLength` and `contentHash` from the Markdown body after
    `renderWorkspaceMarkdownObject` has serialized and `parseWorkspaceMarkdownObject` has parsed the persisted
    document.
  - This makes the persisted `segment.md` / `supplement.md` body the canonical source for manifest-derived values,
    instead of assuming the textarea input string and the persisted Markdown body have identical trailing newline
    shape.
- Alternatives considered:
  - Strip the rendered Markdown trailing newline to match textarea input: rejected because it would couple Reo to
    gray-matter formatting details and still leave the manifest derived from a pre-persistence representation.
  - Treat stale body byte length as harmless in all read paths: rejected because normal note content reads should
    keep detecting stale or inconsistent persisted state.
- Runtime evidence:
  - Expanded note editor has no standalone file input or upload button, no `普通 Markdown` mode badge, and the
    textarea top padding is `4px`.
  - Paste/drop image insertion was exercised in the expanded editor, followed by save, preview image decode, reopen,
    restore original body, and save.

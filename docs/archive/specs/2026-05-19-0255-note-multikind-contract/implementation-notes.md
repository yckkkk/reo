# Implementation notes

## 2026-05-19 02:55 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Decision: sub-spec (a) 继续推进，sub-spec (b) 前必须重新收口 editor 决策。
- Alternatives considered:
  - 立刻停止整个 initiative：会阻塞不依赖 editor 的 multi-kind contract。
  - 在 sub-spec (a) 内选择 Milkdown：违反 spike 证据，Milkdown 也没有通过当前
    markdown-truth gate。
- Reason: Stage 1 review 明确 sub-spec (a) 是数据合同工作，不依赖 rich editor；BlockNote
  与 Milkdown 的 round-trip 风险属于 sub-spec (b) blocker。

## 2026-05-19 02:58 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- RED evidence:
  `MAIN_TEST_FILES=test/main/workspaceMarkdownObjects.test.ts,test/main/workspaceContract.test.ts npm run test:main`
  失败。
- Failure summary:
  - `workspace markdown object accepts note kind and rejects unsupported object kinds` 因
    `kind` 只允许 `audio` 失败。
  - `workspace memory summary contract rejects unknown nested fields` 因 summary 仍要求
    `durationMs` / `hasTranscript` 并拒绝 `audioDurationMs` / `hasAudioTranscript` 等新字段失败。
  - `workspace segment projection contract accepts note kind without audio fields` 因 Segment
    / Supplement projection 只允许 `type: audio` 且要求音频字段失败。

## 2026-05-19 03:18 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- GREEN implementation:
  - Markdown Segment / SegmentSupplement frontmatter `kind` 扩展为 `audio | note`。
  - Workspace contract projection 改成 `type` discriminated union；note projection 只暴露
    `bodyByteLength`，不暴露 audio duration、audio bytes 或 transcript 字段。
  - Memory summary 字段改为总量 + audio/note 分项：
    `segmentCount`、`audioSegmentCount`、`noteSegmentCount`、`audioDurationMs`、
    `audioByteLength`、`hasAudioTranscript`、`hasAnyNote`、`supplementCount`。
  - Existing audio-only backfill、recording、MemoryStudio、delete projection 路径显式用
    `type === 'audio'` 窄化，避免 note projection 被当成可转录音频。
- Verification:
  - `MAIN_TEST_FILES=test/main/workspaceMarkdownObjects.test.ts,test/main/workspaceContract.test.ts npm run test:main`
    通过，53/53。
  - `npm run typecheck:quick` 通过。
  - 相关 main test slice 通过，499/499。
- Tradeoff:
  - 本阶段没有实现 note durable read/write runtime；因此 note projection schema 已存在，但
    当前 file-truth scanner 仍只产生 audio projection。note durable 写入留给 sub-spec (b)。

## 2026-05-19 03:20 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase gate failure:
  `npm run verify:quick` 在 renderer component test
  `finalizes a SegmentSupplement recording from the selected Segment plus menu` 失败。
- Root cause:
  该测试夹具的 `parentSegment` 没有按当前 segment projection contract 提供
  `supplements` 数组；`MemoryStudio` 读取 detail 后按 contract 访问
  `selectedSegment.supplements`，因此测试渲染崩溃。
- Resolution:
  将测试夹具改成完整 audio segment projection，并让 finalize 响应中的 segment 携带新增
  supplement。
- Verification:
  `npm run test:renderer -- src/renderer/src/App.test.tsx -t "finalizes a SegmentSupplement recording from the selected Segment plus menu"`
  通过，1/1。

## 2026-05-19 03:27 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase gate failure:
  `npm run verify:quick` 中 typecheck、main tests、renderer tests 与 lint 均通过，但
  `format:check` 发现 4 个文件未格式化。
- Resolution:
  对 `src/main/memoryFiles.ts`、`src/renderer/src/workspace/MemoryStudio.tsx`、
  `src/renderer/src/workspace/segmentDeleteProjection.ts`、
  `test/main/recordingDrafts.test.ts` 执行 Prettier。

## 2026-05-19 03:37 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- GREEN phase verification:
  `npm run verify:quick` 通过。
- Evidence summary:
  - `test:main` 通过，744/744。
  - `test:renderer` 通过，447/447。
  - `lint:strict` 通过。
  - `format:check` 通过。

## 2026-05-19 03:42 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Review gate failure:
  `/review` 判定 GREEN phase 未通过，因为 durable Segment / SegmentSupplement manifest 与
  read model 仍未把 `kind: note` 投影为真实 note。
- RED evidence:
  `MAIN_TEST_FILES=test/main/memoryFiles.test.ts npm run test:main` 失败，新增
  `memory detail projects finalized note segments and note supplements from file truth` 中
  `segmentCount` 实际为 0。
- Resolution:
  - Durable Segment / SegmentSupplement manifest schema 改为 `kind` discriminated union。
  - `kind: note` manifest 使用 Markdown body byte length 校验 `bodyByteLength`。
  - Memory detail file-truth read model 投影 note Segment / SegmentSupplement，不暴露
    `durationMs`、`audioByteLength` 或 `transcript`。
  - Existing audio summary、audio projection 和 transcription helper 路径继续通过 audio type guard
    限制在 `kind: audio`。
- Verification:
  `MAIN_TEST_FILES=test/main/memoryFiles.test.ts npm run test:main` 通过，148/148。

## 2026-05-19 04:00 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- GREEN phase verification after review fix:
  `npm run verify:quick` 通过。
- Evidence summary:
  - `test:main` 通过，745/745。
  - `test:renderer` 通过，447/447。
  - `lint:strict` 通过。
  - `format:check` 通过。

## 2026-05-19 04:04 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- `$ycksimplify` recheck result:
  PASS，并做了最小清理。
- Applied simplifications:
  - `src/main/memoryFiles.ts` 合并 Segment / SegmentSupplement projection 的公共字段构造。
  - `src/renderer/src/workspace/segmentDeleteProjection.ts` 在 pending delete baseline
    匹配中纳入 `audioSegmentCount`、`noteSegmentCount` 和 `hasAnyNote`，避免新增 summary
    字段下的 optimistic projection 误判。
- Required follow-up:
  因 `$ycksimplify` 修改了文件，父线程重新运行完整 `npm run verify:quick`。

## 2026-05-19 04:09 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- GREEN phase verification after `$ycksimplify` cleanup:
  `npm run verify:quick` 通过。
- Evidence summary:
  - `test:main` 通过，745/745。
  - `test:renderer` 通过，447/447。
  - `lint:strict` 通过。
  - `format:check` 通过。

## 2026-05-19 04:12 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 docs update:
  `docs/current/data.md` 已压缩 multi-kind current facts。
- Current fact captured:
  - Memory summary 使用 audio/note 分项字段。
  - Memory detail read model 投影 finalized `audio` 与 `note` Segment / SegmentSupplement。
  - Note projection 只暴露 `bodyByteLength`，不暴露 audio duration、audio bytes、
    transcript 或 transcription attempt。
  - Audio draft/finalize path 仍是 audio-only recording transaction。
- Tradeoff:
  未在 Phase 3 继续重命名所有历史 `recordingDirectory` 局部变量；它们仍服务大量
  audio transaction / recovery 路径。此轮只保留已完成的类型守卫和 projection helper
  简化，避免把文档收口阶段扩大成大规模命名 churn。

## 2026-05-19 04:19 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 verification:
  `npm run verify:quick` 通过。
- Evidence summary:
  - `test:main` 通过，745/745。
  - `test:renderer` 通过，447/447。
  - `lint:strict` 通过。
  - `format:check` 通过。

## 2026-05-19 04:25 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 gate findings:
  - `/review` 失败：`docs/current/data.md` stable files 与 `.reo/index.json` summary 描述仍使用
    audio-only 语言。
  - `$ycksimplify` 失败并已修复：`hasAnyNote` 原先只统计 note Segment，漏掉 audio Segment
    下的 note SegmentSupplement。
- Applied resolution:
  - `docs/current/data.md` 明确 audio payload 只属于 audio Segment / SegmentSupplement；note
    节点使用 Markdown 正文与 manifest `bodyByteLength`。
  - `.reo/index.json` summary 字段更新为 `segmentCount`、`audioSegmentCount`、
    `noteSegmentCount`、`audioDurationMs`、`audioByteLength`、`hasAudioTranscript`、
    `hasAnyNote` 和 `supplementCount`。
  - 没有 visible Segment detail 的 pending delete fallback 不把 `hasAnyNote` 从 true 降成
    false；该低信息路径无法证明其它 audio Segment 下没有 note supplement。已有 visible
    Segment detail 时仍精确重算。

## 2026-05-19 04:40 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 verification after review/simplify fixes:
  `npm run verify:quick` 通过。
- Evidence summary:
  - `test:main` 通过，746/746。
  - `test:renderer` 通过，449/449。
  - `lint:strict` 通过。
  - `format:check` 通过。
- Gate failure count update:
  本 phase 有一次验证中断重跑。第一次完整 `verify:quick` 在 renderer 阶段因长时间无输出被父线程中断；
  拆分运行确认 renderer components project 本身需要约 269 秒且通过，随后整条 `verify:quick`
  自然跑完通过。

## 2026-05-19 04:46 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 `$ycksimplify` recheck result:
  FAIL，并做了文档 current-truth 修正。
- Applied simplifications:
  - `docs/initiatives/2026-05-19-note-foundation/README.md` 的当前阶段改为 sub-spec (a)
    multi-kind contract，并把 gate 名称统一为 `$ycksimplify`。
  - `docs/initiatives/2026-05-19-note-foundation/tasks.md` 为 sub-spec (a) 补上 active
    状态与 spec 入口。
  - 设计 spec / engineering handoff 中的 phase gate 命名改为 `$ycksimplify`；projection 示例中
    note Segment 对齐当前实现的 `bodyByteLength`。
- Required follow-up:
  因 `$ycksimplify` 修改了文档，已重新运行 `npm run format:check` 并通过；若继续收口
  phase gate，重新运行完整 `npm run verify:quick`。

## 2026-05-19 04:48 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 `/review` recheck result:
  FAIL。Review 指出 note Segment / SegmentSupplement 已进入 generic read model，但 title update
  helper 仍拒绝 `kind: note`，且会在目录 rename 后失败，造成部分磁盘变更与错误 retention 报告。
- RED evidence:
  `MAIN_TEST_FILES=test/main/memoryFiles.test.ts npm run test:main` 失败，新增两条测试：
  - `renames finalized note segment file-space node through file truth`
  - `renames finalized note segment supplement file-space node through file truth`
    两者都在当前实现下返回 `ok: false`。
- Resolution:
  - `updateSegmentMarkdownInKnownDirectory` 和 `updateSupplementMarkdownInKnownDirectory`
    接受当前 Markdown schema 支持的 `audio | note` kind，并保留原 kind。
  - note title update 只更新 frontmatter title 与目录 basename，不改写 Markdown body，避免破坏
    manifest `bodyByteLength`；audio title update 保留既有正文 H1 更新行为。
- GREEN evidence:
  `MAIN_TEST_FILES=test/main/memoryFiles.test.ts npm run test:main` 通过，151/151。

## 2026-05-19 04:54 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 verification after note rename fix:
  `npm run verify:quick` 通过。
- Evidence summary:
  - `test:main` 通过，748/748。
  - `test:renderer` 通过，449/449。
  - `lint:strict` 通过。
  - `format:check` 通过。

## 2026-05-19 05:01 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 `/review` recheck result:
  FAIL。Code-level recheck 通过，但 active spec hygiene 仍有 MAJOR：已完成设计 spec 仍留在
  `docs/specs/*`，同时 sub-spec (a) 也是 active spec。
- Resolution:
  - 将已完成设计 spec 从 `docs/specs/2026-05-19-0111-note-foundation-design/`
    归档到 `docs/archive/specs/2026-05-19-0111-note-foundation-design/`。
  - 更新 initiative README / plan / tasks 与本 sub-spec README 中的设计 spec、spike
    evidence 路径。
- Tradeoff:
  initiative 原 plan 曾要求 4 个 sub-spec 全部归档后再归档设计 spec；实际 Reo 文档纪律要求
  active `docs/specs/*` 只保留当前任务。设计 spec 已完成且 evidence 已齐全，因此优先维护
  active spec 单一真源。

## 2026-05-19 05:01 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 `$ycksimplify` recheck result:
  FAIL，并做了 multi-kind contract 正确性修复。
- Finding:
  自动补转录 scanner 只把 audio Segment 交给 backfill selector；`note` Segment 下的 audio
  SegmentSupplement 虽然已经进入 read model，却不会被 scanner 读取和入队。
- RED evidence:
  `MAIN_TEST_FILES=test/main/backfillRuntime.test.ts npm run test:main -- --test-name-pattern "scanWorkspaceBackfillTargets includes audio supplements under note segments"`
  失败，`detailReads` 实际为 0。
- Resolution:
  - `backfillScanner` 的 segment 输入允许非 audio parent，只对带 audio projection 的 Segment
    本体执行 Segment backfill eligibility。
  - `backfillRuntime` 把所有 Segment 的 audio SegmentSupplement 交给 scanner，并把有 supplement
    的 Memory summary 纳入候选，避免 note parent 下的 audio supplement 被 summary 预筛掉。
- GREEN evidence:
  - 同一 focused RED 测试通过。
  - `MAIN_TEST_FILES=test/main/backfillRuntime.test.ts npm run test:main` 通过，39/39。

## 2026-05-19 05:08 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 verification after design spec archive and `$ycksimplify` backfill fix:
  `npm run verify:quick` 通过。
- Evidence summary:
  - `test:main` 通过，749/749。
  - `test:renderer` 通过，449/449。
  - `lint:strict` 通过。
  - `format:check` 通过。

## 2026-05-19 05:27 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 verification after final review format finding:
  `npm run verify:quick` 通过。
- Evidence summary:
  - `test:main` 通过，750/750。
  - `test:renderer` 通过，449/449。
  - `lint:strict` 通过。
  - `format:check` 通过。
- Gate note:
  最终 `/review` fork 报告 format gate 失败；父 workspace 重新运行 Prettier 后显示相关文件
  unchanged，并以父 workspace 完整 `verify:quick` 作为 gate 证据。

## 2026-05-19 05:19 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Final Phase 3 `$ycksimplify` recheck result:
  FAIL，并做了 scope 内正确性与 current-truth 清理。
- Applied fixes:
  - `findSegmentDirectoryById` 现在能返回合法 finalized note Segment 目录；audio 专用
    `findFinalizedAudioSegmentById` 仍拒绝 non-audio target。
  - recording draft append 遇到同 id finalized note Segment 时按 finalized target 阻断，不把合法
    note file truth 误报为 unsafe durable recording。
  - `WORKSPACE_SEGMENT_KINDS` 改为 `WORKSPACE_CONTENT_KINDS`，避免 Segment /
    SegmentSupplement 共享 Markdown kind 时使用过窄命名。
  - Memory Studio 的 filtered list 命名为 `audioSegments`，明确 sub-spec (a) 之后 renderer
    当前仍只渲染 audio Segment。
  - initiative README 的当前约束改为 multi-kind contract 已存在、note runtime 未进入；
    archived design spec 的非证据路径改为 archive 路径。
- RED evidence:
  `MAIN_TEST_FILES=test/main/memoryFiles.test.ts npm run test:main -- --test-name-pattern "recording lookup resolves finalized note segment directories"`
  失败，`findSegmentDirectoryById` 返回 `Invalid durable recording`。
- GREEN evidence:
  同一 focused test 通过。
- Deferred efficiency finding:
  automatic backfill 仍用 `supplementCount > 0` 作为 note-parent supplement 候选预筛。当前
  Memory summary 没有 `audioSupplementCount` / `hasAudioSupplement`，而 sub-spec (a) 刚修复了
  note Segment 下 audio Supplement 必须进入 scanner；此处保持正确性优先，不在本 gate 扩展 summary
  contract。

## 2026-05-19 05:39 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Final Phase 3 gate result:
  PASS。
- Evidence summary:
  - Parent workspace `npm run verify:quick` 通过：main 750/750，renderer 449/449，
    `lint:strict` 通过，`format:check` 通过。
  - Independent `/review` subagent gate PASS，无未解 BLOCKER / MAJOR。
  - Independent `$ycksimplify` subagent gate PASS，未做改动。
- Archive decision:
  sub-spec (a) objective 已完成，implementation-notes 随 spec 归档到
  `docs/archive/specs/2026-05-19-0255-note-multikind-contract/`。

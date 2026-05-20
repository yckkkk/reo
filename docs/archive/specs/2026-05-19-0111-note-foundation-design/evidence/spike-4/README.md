# Spike 4: note draft transaction feasibility

Status: DONE_WITH_CONCERNS

## Answer

Yes, note Segment drafts can reuse `.reo/drafts/segments/<segmentId>/` and the existing workspace directory transaction primitives. Note SegmentSupplement drafts should mirror existing supplement draft ownership under `.reo/drafts/supplements/<supplementId>/`.

The constraint is that only the directory/atomic/identity helpers are reusable 1:1. The current audio draft and finalize functions are intentionally audio-shaped and must be split into note-specific sibling paths.

## Reuse 1:1

- `src/main/workspaceDirectoryTransactions.ts:40-60`: unsupported directory fsync allowlist and best-effort directory fsync.
- `src/main/workspaceDirectoryTransactions.ts:62-79`: `runInWorkspaceDirectorySync`, cwd-bound critical section with directory identity checks.
- `src/main/workspaceDirectoryTransactions.ts:81-121`: no-replace and existing file open helpers; no payload-name assumptions.
- `src/main/workspaceDirectoryTransactions.ts:123-166`: known-directory file/tree/empty-directory removal and entry read helpers.
- `src/main/recordingDrafts.ts:274-291`: `withMarkdownSaveQueue` can be reused for serialized Markdown body writes if promoted/genericized.
- `src/main/recordingDrafts.ts:293-320`: draft directory creation pattern is reusable for note draft siblings.
- `src/main/workspacePaths.ts:98-180`: guarded child directory creation/ensure pattern is reusable.

Focused existing tests confirm the transaction helper behavior: `test/main/workspaceDirectoryTransactions.test.ts:28-256`.

## Must split or adapt

- Draft metadata schemas are audio-only: `src/workspace-contract/workspace-contract.ts:369-393` require `type: 'audio'`, `nextSequence`, and `audioByteLength`.
- Draft create is audio-only: `src/main/recordingDrafts.ts:623-686` and `704-781` write `segment.json`/`supplement.json`, create `audio.webm`, and return `nextSequence`.
- Append/read/clone are audio-only and not note concepts: `src/main/recordingDrafts.ts:802-1359` depends on sequence ordering, `audio.webm`, and byte counts.
- Finalize wrapper is audio-only: `src/main/recordingDrafts.ts:1851-1955` calls `appendAudioSegmentToMemory`; supplement finalize at `1987-2086` calls `appendAudioSupplementToSegment`.
- Current manifest schemas are audio-only: `src/main/memoryFiles.ts:124-155` and `683-718` require `kind: 'audio'`, duration, sequence, audio bytes, and transcription attempt.
- Current Markdown renderers write audio frontmatter: `src/main/memoryFiles.ts:1080-1112` emits `kind: 'audio'`.
- Finalize copy currently defaults to audio draft allowlist: `src/main/memoryFiles.ts:77-78` and `4024-4053`. `segment.md` is not allowed in current draft copy.
- Finalized file writers require `audio.webm` and audio metadata: `src/main/memoryFiles.ts:4485-4559` and `4561-4640`.
- Projection and content IPC schemas are audio-only: `src/workspace-contract/workspace-contract.ts:217-267`, `776-816`, and `879-900`.

## Unsafe payload and stale draft answer

No conflict if note draft finalize uses a note-specific payload validator:

- Segment note draft allowlist: only `segment.md`.
- Supplement note draft allowlist: only `supplement.md`.
- Reject `audio.webm`, JSON sidecars, directories, symlinks, and unknown files in note drafts.

There is a conflict if sub-spec (b) reuses the current audio finalize copy path unchanged, because `copyDirectoryContents()` defaults to `DRAFT_RECORDING_FILES`, which rejects `segment.md` and accepts audio sidecars instead.

Stale audio draft logic does not require `audio.webm` if it rejects finalized truth before draft reads. Current append does that for Segment drafts after runtime state is cleared: `src/main/recordingDrafts.ts:843-847`. Note finalize should preserve the same ordering: check durable finalized truth before reading note draft payload.

## Minimal GREEN implementation shape

Create note segment draft:

- Validate handle/workspace/memory.
- Create `.reo/drafts/segments/<segmentId>/` with guarded parent identity.
- Write `segment.md` using no-follow atomic write; body may be empty.
- Return `{ segmentId }`; no `nextSequence`, no `audioByteLength`, no `audio.webm`.

Write/read note segment draft body:

- Use a Markdown save queue keyed by `rootPath + segmentId`.
- Open only `segment.md` no-follow in the known draft directory.
- Reject symlink/non-file/oversized body.
- Write body atomically; return body byte length/revision if needed.

Finalize note segment draft:

- Verify durable Segment id is not already finalized before reading draft.
- Stage under the target Memory `segments/` directory using the existing staging/expose transaction shape.
- Copy only `segment.md` from the draft.
- Write finalized `segment.md` with frontmatter `kind: note`; preserve body exactly after frontmatter.
- Write `.reo/objects/segments/<segmentId>.json` with `kind: 'note'`, `bodyByteLength`, created/finalized/updated timestamps, `memoryId`, `workspaceId`, and no audio/transcription fields.
- Refresh the Memory summary/index using multi-kind projection.
- Remove the draft only after durable marker/index/manifest success.

Discard note segment draft:

- Reuse guarded safe directory removal for `.reo/drafts/segments/<segmentId>/`.
- Reject unsafe path and preserve draft on unsafe cleanup.

Supplement shape:

- Use `.reo/drafts/supplements/<supplementId>/supplement.md`.
- Same write/read/finalize/discard pattern, with parent `memoryId + segmentId` validation.
- Finalize into parent Segment `supplements/<supplementDirectory>/supplement.md`.
- Write `.reo/objects/supplements/<supplementId>.json` with `kind: 'note'` and `bodyByteLength`.

## Recommendation

Implement sub-spec (b) as sibling note draft functions, not as a generic rewrite of recording draft functions. Extract only the shared directory transaction pieces and Markdown write queue. Keep audio append/clone/read/finalize names audio-specific, and introduce note-specific payload validators plus note manifest/projection schemas.

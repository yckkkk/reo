# 复杂度与性能收敛 Tasks

## P1

- [x] T01 `src/main/memoryFiles.ts`：把 workspace index rebuild 改为 directory-aware 单次扫描，消除 `O(M^2 + S + P)` 嵌套重扫。
- [x] T02 `src/main/recordingDrafts.ts`、`src/main/memoryFiles.ts`：finalize 返回已知 projection，只 refresh owning Memory，避免录音热路径全 workspace rebuild。
- [x] T03 `src/main/memoryFiles.ts`、`src/main/recordingDrafts.ts`：global segment duplicate/lookup 使用 owner-aware manifest 或已解析 memory path，消除每 memory 重扫。
- [x] T04 `src/main/doubaoStreamingAsr.ts`：live PCM gzip 从 main-thread sync hot path 移出，重连 replay coalesce bounded frame。
- [x] T05 `src/workspace-contract/transcript-segments.ts`、`src/main/recordingTranscriptionSessions.ts`：transcript merge 保持 sorted invariant，使用 binary/two-pointer merge 和 append fast path。
- [x] T06 `src/main/backfillAudioDataSource.ts`、`src/main/recordingDrafts.ts`：finalized audio backfill 改为 streaming remux，降低 Buffer/Uint8Array/temp/base64 峰值。
- [x] T07 `src/renderer/src/workspace/MemoryStudio.tsx`：Segment strip virtualization/windowing 或非可见 preview 轻量化。
- [x] T08 `src/main/workspaceFiles.ts`、`src/main/memoryFiles.ts`：snapshot/index refresh stale/corrupt path 只执行一次 full rebuild。

## P2

- [x] T09 `src/main/backfillRuntime.ts`：backfill eligibility revalidation 使用 narrow target projection 或 same-memory grouped read。
- [x] T10 `src/main/backfillRuntime.ts`：workspace automatic scan 先过滤 no-audio summary，并用 bounded top-K selector。
- [x] T11 `src/main/backfillQueue.ts`：queue 改 head-index deque 与 per-batch pending counts。
- [x] T12 `src/main/recordingTranscriptionSessions.ts`：PCM replay buffer 改 deque/ring buffer，避免每 chunk spread/filter。
- [x] T13 `src/renderer/src/workspace/MemoryStudio.tsx`：playback `timeupdate` state 下沉到 memoized child，避免 parent 全量 rerender。
- [x] T14 `src/renderer/src/workspace/MemoryStudio.tsx`：primary segment audio Blob URL/waveform decode 按 content version 缓存。
- [x] T15 `src/renderer/src/App.tsx`：visibility refresh invalidation 预计算 protected keys/prefix Sets，缩窄 invalidation。
- [x] T16 `src/renderer/src/workspace/RecordingOverlay.tsx`、`src/renderer/src/workspace/recording/recordingTimeline.ts`：renderer live ASR batching，延迟 full markdown rebuild。
- [x] T17 `src/main/workspaceMemorySpaceRegistry.ts`、`src/main/workspaceJsonFile.ts`：registry 写入前 enforce serialized byte budget，保证写后可读。
- [x] T18 `src/main/workspaceMemorySpaceRegistry.ts`：rename reconciliation 按 directory candidates 计数，慢 scan 移出 registry write critical section。
- [x] T19 `package.json`：`verify:strict` 避免重复 typecheck，同时保留 standalone `npm run build` 的 typecheck 安全性。
- [x] T20 `eslint.config.js`：把非产品输入 `.tmp`、`.agents/skills`、`.claude/skills`、`.superpowers` 排除出 ESLint traversal。

## P3

- [x] T21 `src/main/memoryFiles.ts`：single-memory index refresh 从 filter + full sort 改为删除旧项后 insert/splice。
- [x] T22 `src/main/recordingDrafts.ts`、`src/main/memoryFiles.ts`：targeted finalized segment/supplement read helper，减少单目标 projection 重建。
- [x] T23 `src/main/recordingDrafts.ts`、`src/workspace-contract/recording-audio.ts`：audio read 避免 Buffer 到 Uint8Array 的额外 copy。
- [x] T24 `src/main/workspaceFiles.ts`、`src/main/workspaceIpc.ts`：open/rename 复用已验证 metadata/root identity，并保留 post-lock revalidation。
- [x] T25 `src/renderer/src/App.tsx`：`mergeMemoryIntoSnapshot` 改 one-pass id replace，只在 ordering field 改变时 reposition。
- [x] T26 `src/renderer/src/App.tsx`：Segment/Supplement merge 改 replace/upsert，避免每次 full sort。
- [x] T27 `src/renderer/src/App.tsx`：coalesce per workspace/session visibility refresh，减少重复 snapshot/detail IPC。
- [x] T28 `src/renderer/src/workspace/RecordingOverlay.tsx`：waveform samples 使用 ring buffer/downsampler ref。
- [x] T29 `src/renderer/src/workspace/RecordingOverlay.tsx`：draft playback preview Blob 按 session/chunkCount/byteLength 缓存。
- [x] T30 `src/main/backfillScanner.ts`：eligible target scanner 使用 finite-limit bounded selector/min-heap。
- [x] T31 `src/main/backfillQueue.ts`：manual count、position、workspace cancel 合并扫描并维护 counts。
- [x] T32 `src/main/doubaoAucTurboClient.ts`：Turbo request stringify 前 enforce cap，缩短大 body duplicate lifetime。
- [x] T33 `src/main/doubaoStreamingAsr.ts`：inbound gzip/JSON parse 增加 oversize early reject 和 async/worker threshold。
- [x] T34 `vitest.config.ts`：renderer pure logic tests 拆 node bucket，jsdom component tests 保持 serialized。
- [x] T35 `scripts/measure-titlebar-alignment.mjs`：ImageMagick `txt:-` 改 raw pixel buffer/typed array，一次分类。
- [x] T36 `scripts/measure-memory-studio-layout.mjs`：HTTP/CDP command 增加 timeout，socket close/error reject pending commands。
- [x] T37 `src/renderer/src/App.test.tsx`：保留关键 full App integration，其余 cache/menu/projection coverage 拆 focused tests。

## P4

- [x] T38 `src/renderer/src/workspace/segmentDeleteProjection.ts`：visible segment summary 改 single accumulator。
- [x] T39 `src/renderer/src/App.tsx`：pending delete grouping 改 local mutable array build。
- [x] T40 `src/renderer/src/workspace/segmentDeleteProjection.ts`：pending delete projections 先按 memory group，避免 `O(M * P)`。
- [x] T41 `src/renderer/src/workspace/MemoryStudio.tsx`：content tab model memoize，unchanged drag-over no-op。
- [x] T42 `src/renderer/src/workspace/recording/RecordingTranscriptPreview.tsx`：focused segment binary search，长 transcript window/combine older spans。
- [x] T43 `src/renderer/src/workspace/MemoryRail.tsx`：信任 upstream order 或 memoize row model，避免 render 内 sort/date churn。
- [x] T44 `src/main/recordingDrafts.ts`：draft append/read 减少重复 directory identity work。
- [x] T45 `src/main/recordingDrafts.ts`：如出现高并发 drafts，为 runtime cache cleanup 增加 `root -> Set<key>` 二级索引。
- [x] T46 `src/main/memoryFiles.ts`：candidate scan 改 single-pass partition。
- [x] T47 `src/main/backfillRuntime.ts`：`enqueueAutomaticTargets` 改 streaming/bounded task list。
- [x] T48 `src/main/doubaoStreamingAsr.ts`：array frame normalize 改 iterative flatten 或拒绝 unsupported arrays。
- [x] T49 `src/main/doubaoStreamingAsr.ts`：小数组 `flatMap` 改 `for...of` push loop。
- [x] T50 `src/main/doubaoStreamingAsr.ts`：secret redaction 在 secret list 增长前改 escaped combined regex。
- [x] T51 `src/main/recordingTranscriptionSessions.ts`：close path 如无 mutation safety 需求，避免复制 `Map.values()` 数组。
- [x] T52 `scripts/measure-memory-studio-layout.mjs`：为大 workspace 增加 documented `--max-items` sampling mode，并保留 full mode。
- [x] T53 `test/main/memoryFiles.test.ts`：test helper loop 内 root/memory id hoist。
- [x] T54 `test/main/backfillRuntime.test.ts`、`test/main/backfillAudioDataSource.test.ts`：mock async milestone polling 改 deferred promise。
- [x] T55 `src/renderer/src/workspace/RecordingOverlay.test.tsx`：bridge fixture 改 immutable defaults + explicit overrides。
- [x] T56 `src/renderer/src/workspace/recordingRecovery.test.ts`：大 fixture 只保留一个边界生成测试，其余共享/prebuilt fixture。
- [x] T57 `test/main/designSystemTokens.test.ts`：每 CSS 文件预解析 light/dark token maps。
- [x] T58 `test/main/preloadSandboxBoundary.test.ts`：共享 file-local ESLint instance。
- [x] T59 `test/main/rendererViewportCss.test.ts`：CSS 文件 module-scope read/cache。
- [x] T60 `scripts/run-main-tests.mjs`：测试数增长前预留 generator/batching，避免 argv/memory 压力。
- [x] T61 `test/main/memoryFiles.test.ts`、`test/main/recordingDrafts.test.ts`：移除 workspace fixture helper 的重复 recording draft init，只保留 idempotence test。

# Complexity Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 complexity-optimizer 全库审查发现的全部复杂度和性能问题。

**Architecture:** 该计划不新增产品能力；只减少重复扫描、同步阻塞、重复分配、无界等待和不必要渲染。Main process 改动必须保持文件真源、lock、identity、no-follow、sender validation 和 ownership 复核；renderer 改动必须保持 Query/cache owner 和用户可见行为。

**Tech Stack:** Electron main process、React 19、TypeScript、TanStack Query、Vitest、Node test runner、ESLint、Prettier、electron-vite。

---

## File Map

- `src/main/memoryFiles.ts`：workspace index rebuild、Memory summary refresh、finalized Segment/Supplement lookup、candidate scan。
- `src/main/recordingDrafts.ts`：recording draft append/read/finalize、finalized audio read/save、runtime cache cleanup。
- `src/main/workspaceFiles.ts`：workspace open、snapshot refresh、index refresh、rename。
- `src/main/workspaceIpc.ts`：open/rename IPC validation and call flow。
- `src/main/doubaoStreamingAsr.ts`：live ASR frame compression, parsing, reconnect replay, redaction。
- `src/main/recordingTranscriptionSessions.ts`：PCM replay buffer、session merge、close paths。
- `src/main/backfillAudioDataSource.ts`：finalized audio remux/read/base64 source。
- `src/main/backfillRuntime.ts`：automatic scan、target revalidation、enqueue。
- `src/main/backfillQueue.ts`：queue structure、manual counts、cancel。
- `src/main/backfillScanner.ts`：eligible target selection。
- `src/main/doubaoAucTurboClient.ts`：Turbo request body。
- `src/main/workspaceMemorySpaceRegistry.ts`：registry size budget、rename reconciliation。
- `src/renderer/src/App.tsx`：snapshot merge、detail merge、visibility refresh、pending delete grouping。
- `src/renderer/src/workspace/MemoryStudio.tsx`：Segment strip、playback state、audio resource cache、tab model。
- `src/renderer/src/workspace/RecordingOverlay.tsx`：live transcript application、waveform buffer、draft playback Blob。
- `src/renderer/src/workspace/recording/recordingTimeline.ts`：recording transcript merge and markdown generation。
- `src/renderer/src/workspace/recording/RecordingTranscriptPreview.tsx`：long transcript focus/render。
- `src/renderer/src/workspace/segmentDeleteProjection.ts`：pending delete projection complexity。
- `src/renderer/src/workspace/MemoryRail.tsx`：memory sorting/date row model。
- `package.json`、`eslint.config.js`、`vitest.config.ts`、`tsconfig.main.test.json`、`scripts/*.mjs`、`test/**/*.ts`、`src/renderer/src/**/*.test.*`：verification/tooling/test cost。
- `docs/current/electron.md`、`docs/current/data.md`、`docs/current/flow.md`、`docs/current/frontend.md`、`docs/current/quality.md`：对应边界变化的当前真源。

## Ordered Execution

1. 先执行 P1：T01-T08。
2. 再执行 P2：T09-T20。
3. 再执行 P3：T21-T37。
4. 最后执行 P4：T38-T61。
5. 每个任务都必须先写行为测试或 benchmark 保护；纯 tooling/test helper cleanup 可用 focused regression 代替产品行为 TDD。
6. 每批完成后运行对应 focused tests；P1/P2/P3/P4 每批末尾运行 `npm run verify:quick`。
7. 涉及 strict/build/tooling 的最终批次运行 `npm run verify:strict`。

## Review Gates

- 不把低优先级任务丢弃；只能在源码证据证明被更高优先级任务自然覆盖时勾选并备注。
- 不修改 `workspaceDirectoryTransactions.ts` 的安全模型，除非有独立 spec 和安全证明。
- 不引入兼容层、generic runtime、generic IPC、generic queue framework。
- 不在 renderer 暴露 raw path、audio bytes、base64、X-Api-Key、ffmpeg path 或 Electron/Node API。
- 不通过 DB、Zustand 或新 package 解决当前问题，除非单独完成 official/open-source reuse evaluation 并更新 current docs。

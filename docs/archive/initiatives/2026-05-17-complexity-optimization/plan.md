# 复杂度与性能收敛 Plan

## 执行原则

- 按 P1 到 P4 顺序推进；低优先级问题也作为任务保留。
- 每个实现 slice 必须小到能独立 TDD、验证和回滚。
- 先修产品热路径，再修验证工具链，再修测试常数和低风险分配。
- Main process 文件真源与 Electron 安全边界优先保守，不能为省扫描放松 no-follow、identity、lock、sender 或 ownership 复核。
- Renderer 优化优先减少不必要渲染、重复 Blob/decode、重复 Query invalidation，不引入全局 store，除非出现明确跨 subtree state owner。
- Tooling 优化不能降低 standalone command 的安全性；例如 `npm run build` 仍必须保持 standalone typecheck 能力。

## 分批顺序

### Batch 1：P1 文件真源与录音热路径

目标：先消除全 workspace 重扫、录音 finalize 热路径重扫、global segment lookup 嵌套扫描和 live ASR 主线程同步压缩。

任务：

- T01 index rebuild directory-aware scan。
- T02 finalize targeted refresh。
- T03 global segment lookup owner-aware。
- T04 live ASR gzip coalesce/async path。
- T05 transcript merge sorted invariant。
- T06 backfill audio streaming/remux memory cap。
- T08 workspace snapshot/index single rebuild。

验证：

- 对应 main tests 先 RED 后 GREEN。
- ASR frame/order/reconnect tests。
- finalize 大量无关 memories 的 scan-count regression。
- `npm run test:main`。

### Batch 2：P1/P2 renderer 大对象与 cache 热路径

目标：长录音和大 Memory Studio 下 renderer 不再每 tick、每 segment、每 visibility refresh 做全量重活。

任务：

- T07 Segment strip virtualization 或 lightweight preview。
- T13 playback state isolation。
- T14 primary segment audio cache。
- T15 visibility refresh invalidation narrowing。
- T16 renderer live ASR markdown batching。

验证：

- Renderer 行为测试。
- 大 segment-count render benchmark。
- `npm run verify:memory-studio-layout`。
- `npm run test:renderer`。

### Batch 3：P2 backfill queue、scanner、registry

目标：补转录后台任务在大 workspace、批量 same-memory target 和大 queue 下保持有界。

任务：

- T09 backfill target revalidation narrowing。
- T10 workspace scan top-K。
- T11 queue deque。
- T12 PCM replay ring/deque。
- T17 registry serialized byte budget。
- T18 rename reconciliation candidate counting。

验证：

- Backfill runtime/queue/scanner tests。
- Registry max-size read-after-write test。
- 10k queue 和 100k projection benchmark。

### Batch 4：P3 main/renderer 中等复杂度修复

目标：减少常见 mutation、open/rename、audio read、scanner、Turbo request 和 renderer merge 的重复工作。

任务：

- T21 single-memory index refresh insert/splice。
- T22 targeted finalized content read helper。
- T23 zero-copy audio read。
- T24 open/rename validation reuse。
- T25 memory snapshot merge no full sort。
- T26 segment/supplement merge no full sort。
- T27 visibility refresh coalescing。
- T28 waveform ring buffer。
- T29 draft playback Blob cache。
- T30 backfill scanner bounded selector。
- T31 queue counts and cancel one-pass。
- T32 Turbo request cap before stringify。
- T33 inbound gzip oversize/async threshold。

验证：

- Focused main and renderer tests per task。
- `npm run verify:quick` after the batch。

### Batch 5：P2/P3/P4 verification tooling

目标：减少验证重复工作和无界等待，同时保持门禁语义。

任务：

- T19 `verify:strict` avoid duplicate typecheck。
- T20 ESLint global ignores。
- T34 split pure renderer test bucket。
- T35 titlebar measurement raw pixel buffer。
- T36 Memory Studio layout script timeouts。
- T37 App test focused coverage split。
- T52 Memory Studio layout measurement sampling mode。

验证：

- `npm run lint`。
- `npm run lint:strict`。
- `npm run test:renderer` repeated stability runs for Vitest split。
- `npm run verify:titlebar:self-test`。
- Layout script stalled endpoint and socket close tests。
- `npm run verify:strict`。

### Batch 6：P4 low-level allocations and test cleanup

目标：收口剩余低优先级任务，降低长期维护和测试成本。

任务：

- T38-T61 全部低优先级项目。

验证：

- 对应 focused tests。
- 全量 `npm run verify:quick`。

## 文档更新规则

- Electron surface、ASR IPC、permission、protocol、main process runtime boundary 变化：更新 `docs/current/electron.md`。
- Query key、cache ownership、durable source、registry cap、file projection 变化：更新 `docs/current/data.md`。
- lifecycle、queue、background job、recovery、transaction、concurrency 变化：更新 `docs/current/flow.md`。
- React structure、component state、layout、test-visible UI ownership 变化：更新 `docs/current/frontend.md`。
- verification commands、test runner、lint、benchmark、error handling 或 diagnostics 变化：更新 `docs/current/quality.md`。

# 验证记录

## RED / GREEN / REFACTOR

- RED 1：`npx vitest run src/renderer/src/App.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx src/renderer/src/workspace/RecordingOverlay.test.tsx --testNamePattern "current memory target|forbidden|saved memory detail|loaded workspace"` 失败，原因是 `RecordingOverlay` 忽略 memory detail 传入的 existing memory target，`finalizeRecordingDraft` payload 缺少 `memoryId`。
- GREEN 1：新增显式 `RecordingTarget`，App Home/New memory 使用 `new-memory` target，Memory detail 使用 `existing-memory` target，`RecordingOverlay` finalize payload 按 target 传入 `memoryId`；同一 Task 11 targeted 命令通过，3 个文件、41 个测试。
- GREEN 2：`npm run typecheck` 通过，renderer/main TypeScript 均为 exit 0。
- REVIEW RED 2：ycksimplify 效率审查指出 existing-memory finalize 后没有 invalidate `memory-detail` query；由于该 query `staleTime: Infinity`，detail 页面会继续显示旧 recordings projection。
- GREEN 3：`App.test.tsx` 增加 detail 录音 start/stop 行为测试，断言 finalize payload 包含当前 `memoryId`，并等待 `getMemoryDetail` 第二次读取；App finalize 后 seed workspace snapshot 并 invalidate 当前 memory detail query。
- REFACTOR 1：移除 App 中可由 `recordingTarget` 派生的 `recordingOpen` state；forbidden capability regex 改为 `\bauth\b`，避免裸 `auth` 误伤普通单词。
- REVIEW RED 3：Claude CLI 修复后复审指出 `src/renderer/src/App.tsx` 格式失败，`verify:quick` 会被 `format:check` 阻断。
- GREEN 4：`npx prettier --write src/renderer/src/App.tsx` 修复格式，并用 targeted `prettier --check` 验证通过。

## 命令验证

待执行：

```bash
npx vitest run src/renderer/src/App.test.tsx --testNamePattern "finalizes a recording from memory detail"
npx vitest run src/renderer/src/App.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx src/renderer/src/workspace/RecordingOverlay.test.tsx
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
```

已执行：

- `npx vitest run src/renderer/src/App.test.tsx --testNamePattern "finalizes a recording from memory detail"` 通过，1 个文件、1 个测试。
- `npx vitest run src/renderer/src/App.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx src/renderer/src/workspace/RecordingOverlay.test.tsx` 通过，3 个文件、42 个测试。
- `npm run typecheck` 通过。
- `npx prettier --check src/renderer/src/App.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx docs/current/data.md docs/current/flow.md docs/current/quality.md docs/specs/2026-05-07-1556-first-product-slice-task-11-app-integration/README.md docs/specs/2026-05-07-1556-first-product-slice-task-11-app-integration/review.md docs/specs/2026-05-07-1556-first-product-slice-task-11-app-integration/verification.md` 通过。
- Context7：`/tanstack/query` 官方文档确认 `queryClient.invalidateQueries({ queryKey })` 默认标记匹配 query stale，并 refetch active matching query；当前 memory detail cache 刷新方式符合该口径。
- `npm run verify:quick` 通过：typecheck、main/preload 249 tests、renderer 17 files / 96 tests、lint、format check 均为 exit 0。
- `git diff --check` 通过。
- `diff -u AGENTS.md .claude/CLAUDE.md` 通过。
- `find docs/specs -mindepth 1 -maxdepth 1 -print` 输出 `docs/specs/2026-05-07-1556-first-product-slice-task-11-app-integration`。
- 归档后重新执行 `find docs/specs -mindepth 1 -maxdepth 1 -print`，无输出。
- 归档和 initiative 更新后重新执行 `npm run verify:quick`，仍通过：typecheck、main/preload 249 tests、renderer 17 files / 96 tests、lint、format check 均为 exit 0。
- 归档和 initiative 更新后重新执行 `git diff --check`、`diff -u AGENTS.md .claude/CLAUDE.md` 和 `find docs/specs -mindepth 1 -maxdepth 1 -print`，均为 exit 0，`find` 无输出。

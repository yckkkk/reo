# Verification

## RED

- `npx vitest run src/renderer/src/workspace/MemoryDetailPage.test.tsx src/renderer/src/workspace/workspaceApi.test.ts`：失败，`./MemoryDetailPage` 不存在。
- `npx vitest run src/renderer/src/workspace/WorkspaceHome.test.tsx`：失败，Home memory card 还不是可打开 detail 的 command。
- `npx vitest run src/renderer/src/App.test.tsx src/renderer/src/workspace/WorkspaceHome.test.tsx src/renderer/src/workspace/MemoryDetailPage.test.tsx`：失败，App 还没有 Home ↔ detail route state。
- `npx vitest run src/renderer/src/workspace/MemoryDetailPage.test.tsx`：失败，`hasTranscript: true` 时仍显示 `No transcript saved.`。
- `npm run test:main -- --test-name-pattern "reads memory detail with bounded recordings and saved content flags"`：失败，`MemoryDetail` 合同没有 `recordingCount`、`recordingsTruncated`、`hasTranscript`、`hasReflections`。

## GREEN

- `npx vitest run src/renderer/src/workspace/MemoryDetailPage.test.tsx src/renderer/src/workspace/workspaceApi.test.ts`：通过，Memory detail 页面和 query option 渲染文件真源 detail。
- `npx vitest run src/renderer/src/workspace/WorkspaceHome.test.tsx`：通过，Home memory card 可以打开当前 memory。
- `npx vitest run src/renderer/src/App.test.tsx src/renderer/src/workspace/WorkspaceHome.test.tsx src/renderer/src/workspace/MemoryDetailPage.test.tsx`：通过，App Home ↔ detail ↔ Home route 工作。
- `npx vitest run src/renderer/src/workspace/MemoryDetailPage.test.tsx src/renderer/src/workspace/workspaceQueries.test.ts && npm run test:main -- --test-name-pattern "reads memory detail with bounded recordings and saved content flags"`：通过，renderer 使用 saved flags，main detail 有界 preview。
- `npx vitest run src/renderer/src/workspace/MemoryDetailPage.test.tsx src/renderer/src/workspace/workspaceQueries.test.ts src/renderer/src/workspace/WorkspaceHome.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx src/renderer/src/workspace/workspaceApi.test.ts && npm run typecheck`：通过。

## Runtime

- Computer Use 启动 Electron dev app，打开临时 Reo workspace `/private/tmp/reo-task5-create-runtime`。
- Home 显示 `Runtime memory detail` memory card、`1 recording`、`1 min 1 sec` 和 `Transcript` 状态。
- 点击 memory card 后进入 detail：显示 `Runtime memory detail`、`MAY 7, 2026`、`Record memory`、`VOICE RECORDINGS`、`Runtime recording`、`1 min 1 sec`、`4 B`、`Transcript saved.`、`No reflections saved.` 和 `Saved memory content appears here.`。
- Detail 页面未显示 More、Rename、Delete、Show in folder、Export、Films、photo、video、file、AI 等未交付 command。
- 点击 sidebar 左下角主题按钮切换深色模式后，detail 页面仍保持信息层级、可读文本、card surface、section divider 和 action 可辨识。
- Back control 复验为 compact secondary button，没有横向拉伸成整行。

## Review

- Claude CLI：PASS，无 BLOCKER/MAJOR。
- `$ycksimplify` 三路审查：两个 MAJOR 已修复并用 RED/GREEN 覆盖；当前未遗留 BLOCKER/MAJOR。

## Final

- `npm run verify:quick`：归档后重新运行通过。覆盖 typecheck、main tests 248/248、renderer tests 74/74、lint、format check。
- `git diff --check`：通过，无 whitespace error。
- `diff -u AGENTS.md .claude/CLAUDE.md`：通过，无差异。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：归档后无输出，active specs 为空。

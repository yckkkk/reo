# Task 5：Home local search、月份分组和 memory cards

创建时间：2026-05-07 09:37 America/Los_Angeles

## 目标

把 loaded workspace Home 从基础 `Memory Content` 列表推进到当前 first product slice 的 Home 交付形态：`All memories` header、本地搜索、月份分组、memory card、录音空状态和禁止 future capability。搜索只过滤当前已加载 workspace snapshot，不声称 global/full-text/semantic search。

## 范围

- 修改 `src/renderer/src/workspace/WorkspaceHome.tsx`。
- 新增 feature components：`MemorySection.tsx`、`MemoryCard.tsx`。
- 修改 `src/renderer/src/workspace/WorkspaceHome.test.tsx`。
- 必要时修改 `src/renderer/src/workspace/workspaceQueries.ts`，但不得把 Home local search 放入 query key。
- 引入 `date-fns`，仅用于当前月份 heading 和排序 consumer。
- 更新 `docs/current/frontend.md`、`docs/current/data.md`、`docs/current/quality.md`。

## 不做

- 不实现 memory detail navigation、More menu、filter drawer、global search、full-text search、tag/entity/semantic search。
- 不显示 photo、video、file、film、sharing、sync、auth user、AI、camera 或 global search。
- 不创建 Zustand store、search service、generic filtering framework 或 route registry。
- 不把 snapshot local search 写入 TanStack Query key。
- 不修改 main process、IPC、DB schema 或 filesystem truth。

## 设计约束

- Home 必须继续运行在 Task 4 的 `AppShell` 内，不另建 page shell。
- Header 使用 `All memories`，说明文案只描述当前 workspace 中的记忆。
- Search 使用 native input semantics：role `searchbox`，accessible name `Search memories`。
- Memory card 只显示当前 snapshot 已有字段：title、created date/month、recording count、duration summary、transcript/reflections presence。
- Month sections 由 memory `createdAt` 分组，最新月份在前，同月内最新 memory 在前。
- Empty state 分两类：workspace 无 memories；search 无匹配结果。两者都不得出现 future capability。
- Record memory 是当前唯一创建内容入口。
- 复用优先：Button/Input 已存在；日期格式使用 `date-fns` 官方函数；不自研日期库或复杂搜索引擎。
- 简化约束：Searchbox 直接使用 `Input` primitive，不为单一 consumer 创建薄 wrapper。

## RED 目标

1. Home 显示 `All memories`，而不是以 workspace title 作为主标题。
2. Search 输入只过滤当前 snapshot 的 memory cards，不显示 global search 文案。
3. Memories 按月份分组，heading 形如 `May 2026`。
4. 空 workspace 显示 recordings scoped empty state，不暗示 photo/video/file/film。
5. Memory card 显示 title、日期、recording count、duration summary 和 transcript/reflections 状态。
6. `Record memory` 仍为唯一 action，并继续触发 `onStartRecording`。

## 验证命令

```bash
npx vitest run src/renderer/src/workspace/WorkspaceHome.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx
npm run verify:quick
npm run build
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
git status --short
```

## 停止条件

- 需要改变 workspace snapshot contract 才能实现当前行为。
- 需要引入 DB/index/full-text search 才能让测试通过。
- 对抗审查出现 unresolved BLOCKER/MAJOR。

# 审查

## 当前结论

- `$ycksimplify` 三路审查：无 BLOCKER。
- 代码复用审查：无 MAJOR；MINOR 指出 `MemorySearchBar` 是单 consumer 薄 wrapper。处理：删除并内联 `Input`。
- 代码质量审查：无 BLOCKER；MAJOR 指出排序/搜索测试不足、长 title/description 溢出风险。处理：补 DOM 顺序、month/date/status/no-match 搜索测试，并为 header/card title 增加 `min-w-0` / `break-words`。
- 效率审查：无 BLOCKER；MAJOR 指出每次 render 重复 date parse/format/sort。处理：用 `useMemo` 建立 memory view model，搜索只匹配预计算 `searchText`。
- Claude CLI 前端审查：无 BLOCKER；建议把 search/count 区域从粉色卡片降级为轻量 inline toolbar，并删除 `MemoryCard` 中无布局价值的 wrapper。处理：采纳。
- Codex `$ycksimplify` 复查：无 BLOCKER/MAJOR；发现 `MemoryCard` 在无 Transcript/Reflections 时仍渲染空状态容器。处理：仅在存在状态标签时渲染该容器。
- 当前无 unresolved BLOCKER/MAJOR。

## 关注点

- 不把 Home local search 扩张为 global/full-text/semantic search。
- 不引入 generic filtering/search framework。
- 不新增没有真实 consumer 的 UI primitive。
- 不显示 future media/file/auth/AI 能力。
- Memory card 必须只展示当前 snapshot 已有字段。
- Runtime 发现 `WorkspaceEntryDialog` 的 Radix DialogTitle/Description warning；这是 app-shell/dialog accessibility debt，不是 Task 5 Home memories 改动引入。下一个 app-shell/theme task 必须修复，不应在 Task 5 diff 中混入。

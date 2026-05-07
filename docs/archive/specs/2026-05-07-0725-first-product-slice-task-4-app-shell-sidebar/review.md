# 审查

## 当前结论

Task 4 已完成 Claude 前端审查修复。当前无已知 BLOCKER/MAJOR；提交前仍需完成固定门禁和 spec 归档。

## 简化检查清单

- 使用 shadcn/Radix/lucide source，不自研 tooltip、separator 或 icon primitives；Home `+` 通过 Button `accentCircle` variant 承载。
- AppShell 只表达当前 shell invariant：sidebar layer、panel layer、resize clamp、covered/expanded motion、starter/loaded nav。
- Create workspace 不作为独立 page，必须从 Home `+` 打开 Dialog。
- Workspace entry Dialog 的 create/open 使用单一 action lock；pending 时禁用 sibling action 与 close control。
- 不创建 route registry、layout framework、generic nav item factory 或 speculative settings/sidebar store。
- 只在 drag/controlled width 的必要位置使用 state；无跨 subtree owner 前不引入 Zustand。
- 不添加 future capability placeholders。

## 对抗审查

- 用户审查，2026-05-07 08:10 PDT：MAJOR，Create workspace 独立页面是 MVP/玩具化形态；参考图不存在 Create workspace 页面，入口应是 Home `+`。处理：新增 Starter Home + `WorkspaceEntryDialog`，删除 current `WorkspaceEntryPage`。
- 自审，2026-05-07 08:15 PDT：MAJOR，Dialog 缺可见 close control 且 create form 重复品牌文案。处理：`WorkspaceEntryDialog` 组合 `DialogClose` 与 lucide close control，form header 去重。
- 自审，2026-05-07 08:17 PDT：MAJOR，Button `primary` 使用 Signal Blue 填充违反 Reo design system。处理：primary 回到 Obsidian，Home `+` 使用小型 Signal Blue accent circle。
- `$ycksimplify` 复用审查，2026-05-07 08:47 PDT：MAJOR，Home `+` 使用 raw button，绕过 Button primitive。处理：新增 Button `accentCircle` variant 与 `iconLarge` size，`WorkspaceStarterHome` 改用 Button。
- `$ycksimplify` 质量/效率审查，2026-05-07 08:47 PDT：MAJOR，Workspace entry Dialog pending ownership 分散，create/open 可并发且异常路径可能卡住 pending。处理：`WorkspaceEntryDialog` 收敛单一 action lock，create/open branch 用 start/finish 回调与 `try/finally` 收口。
- `$ycksimplify` 质量审查，2026-05-07 08:47 PDT：MAJOR，AppShell test 导出并断言 motion class、窗口控制 exact class，泄漏实现细节。处理：`PANEL_MOTION_CLASS` 不再 export，tests 改用 role/name 与行为断言。
- Claude CLI 前端 + `/simplify` 审查，2026-05-07 09:15 PDT：MAJOR，Radix Separator resize handle 在构建后实际只剩 1px，拖拽命中区不达标。处理：保留 Radix Separator 语义，给 resize handle 设置 8px 真实 inline width、hover/focus affordance，并补 renderer test。
- Claude CLI 前端 + `/simplify` 审查，2026-05-07 09:15 PDT：MAJOR，AppShell hide/show sidebar 使用 raw button，绕过 Button primitive。处理：新增 Button `ghostIcon` variant 与 `icon` size，AppShell 使用 Button `asChild` 承载 TooltipTrigger。
- Claude CLI 前端 + `/simplify` 审查，2026-05-07 09:15 PDT：MAJOR，WorkspaceEntryDialog close 使用 raw button，绕过 Button primitive。处理：Dialog close control 改为 Button `ghostIcon` + `iconMedium` + DialogClose。
- Claude CLI 前端 + `/simplify` 审查，2026-05-07 09:15 PDT：MAJOR，Button `accentCircle` hover class 没有真实视觉变化。处理：`accentCircle` hover 改为 Obsidian background/border，并同步 Button test 与 design-system usage rule。
- Claude CLI 前端 + `/simplify` 审查，2026-05-07 09:15 PDT：MINOR，macOS window control 旁 icon 位置偏近、form accessible name 与 Dialog title 重复、pending action state/ref 双轨。处理：window control 改为 `left-96 top-12`；form name 改为 `Workspace details`；pending action 删除 ref，finish 使用 functional state update。

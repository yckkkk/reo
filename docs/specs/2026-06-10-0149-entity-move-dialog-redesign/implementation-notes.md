# 实现笔记 — 移动弹层重新设计

## 进度

- **Task 0**：切分支 `feat/entity-move-dialog-redesign`，建实现笔记。
- **Phase 1（模型 + TDD）**
  - 新增 `entityMoveTree.ts`：`EntityMoveTargetSelection`、`selectionKey`、`moveSourceKey`、`moveDialogTitle`、`initialExpansion`、`countSelectableLeaves`、`projectMoveTree`、`MoveTreeRow`。
  - 新增 `entityMoveTree.test.ts`（15 用例）：helper + 三模式投影 + 折叠/展开 + 当前位置禁用 + 空文件夹 + 搜索过滤 + 无匹配。
  - **偏离计划（必要）**：`renderer-node` vitest project 用显式 include 列表（非 glob），新增纯逻辑 `.test.ts` 必须注册；已在 `vitest.config.ts` 加入 `entityMoveTree.test.ts`。
  - RED 验证：`Cannot find module './entityMoveTree'`；GREEN：15/15 通过；typecheck 干净。
  - 提交 `9b85b346`。
- **Phase 2（组件重写）**
  - 重写 `EntityMoveDialog.tsx`：4 个 state（selection/query/expandedSpaces/expandedMemories），消费 `projectMoveTree`，统一行视图（folder 带 chevron+子项数，leaf 带选中 Check），搜索框 + 源上下文头部。props/契约不变，re-export `EntityMoveTargetSelection`，App 未改。
  - 重写 `EntityMoveDialog.test.tsx`（4 用例）：源上下文+当前位置禁用、展开折叠空间后选择确认、搜索过滤确认、移动记忆直选空间。
  - typecheck 干净；组件测试 4/4 通过。
  - **偏离计划（必要）**：移除 `// eslint-disable-next-line react-hooks/exhaustive-deps`——该项目未注册 `react-hooks/exhaustive-deps` 规则，inline disable 指令本身报错且该规则未启用，删除后无影响。
  - 提交 `7cc89c3d`、`c74a278d`。
- **收口验证**
  - `npm run verify:quick`：`test:main` 1136 测试 0 失败；`lint:strict` 干净；`format:check` 通过（首次失败仅因新文件未 prettier 化，已 `prettier --write` 修复 renderer 文件与本目录 spec 文档）。
  - 4 个目标文件 eslint/prettier/typecheck 全绿；`entityMoveTree.test.ts` + `EntityMoveDialog.test.tsx` 合计 19/19 通过。
  - 提交 `chore: format move dialog files and drop unregistered eslint-disable`。

## 待办（交给用户在新 session）

- **Phase gate**：对本分支 diff 跑 `/review` 与 `/simplify`，按结果修正。
- **运行时视觉核对（尚未做，需启动 Electron app）**：三种 source 各触发一次——移动片段（空间折叠、源空间自动展开、当前记忆禁用、展开他空间选目标）、移动补充（空间+Memory 两级折叠、源路径自动展开、片段叶子可选）、移动记忆（扁平空间列表、当前空间禁用、无折叠无计数）。核对选中高亮(bg-secondary+Check)、hover(bg-accent)、搜索过滤、空空间灰显；截图存本目录。
- **文档纪律**：确认 `docs/current/frontend.md` 无需更新（组件内部重做，未改已记录的稳定模型/契约/边界）。
- **收口**：spec 归档到 `docs/archive/specs/`；按 finishing-a-development-branch 决定合并/PR。

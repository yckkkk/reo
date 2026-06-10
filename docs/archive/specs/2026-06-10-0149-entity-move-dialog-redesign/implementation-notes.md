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

## 运行时缺陷修复（第一次截图后）

- **症状**：行被撑成约 136px 高，整列竖向铺开、巨大空隙。
- **根因**：本项目 Tailwind v4 只显式定义了 `--spacing-{4,8,12,16,20,24,28,32,36,40,48,56,64,72,96,160}`；**未定义的数字键不会报错，而是回退到 `calc(0.25rem * N)`（即 4px×N）**。组件用了未定义键 `min-h-34`→136px、`pr-10`→40px、`py-1`/`space-y-1`→4px。原 `EntityMoveDialog` 也藏着同样的 `min-h-34/gap-10/px-10`，只因片段行从不渲染而未暴露。
- **修复**：`min-h-34`→`min-h-32`、`pr-10`→`pr-12`、`py-1`→`py-4`、`space-y-1`→`space-y-4`；并补竖向节奏 `mt-20`(搜索)、`mt-12`(列表)。静态核对：文件内全部 spacing utility 现都命中已定义键。
- 复查：eslint/prettier/typecheck 干净；组件测试 4/4。

## 复审与精简收口

- **`/code-review high`（相对 `main`）**：发现 1 个 P2 correctness 问题：选择一个目标后再输入搜索词把该目标过滤掉，`selection` 仍保留，导致「移动」按钮可用并可确认不可见目标。
- **修复**：`EntityMoveDialog.tsx` 新增 `visibleSelection` 派生值，只有当前选择仍出现在可见、可选 leaf row 中时才允许确认；`onConfirm` 与按钮 disabled 都消费该派生值。
- **TDD 证据**：新增组件测试 `disables confirm when search hides the selected target`。RED 阶段失败在 `expect(...).toBeDisabled()`；GREEN 后 `EntityMoveDialog.test.tsx` 5/5 通过。
- **复审结果**：修复后再次跑 `codex review --uncommitted`，未发现新的 correctness issue。
- **`/simplify` 质量清理**：`entityMoveTree.ts` 保持 feature-local，不引入树库；把重复的 folder row、leaf row、搜索态可见列表和 disabled reason 合并逻辑收敛到 `folderRow`、`leafRow`、`visibleRows`、`firstDisabledReason`。`MoveTreeRow` 保留显式 folder/leaf 判别联合类型，行为不变。
- **契约复核**：`EntityMoveDialog` props、`EntityMoveTargetSelection` re-export、`onConfirm` selection 形状不变；`App.tsx`、IPC、main、schema、preload 无改动。
- **Tailwind spacing 复核**：改后相关 TSX 内 spacing utility 只使用已定义键（`8/12/16/20/32/36`）或 bracket value（`[48vh]`、`[460px]`），无新的 Tailwind v4 fallback spacing 陷阱。
- **targeted 验证**：
  - `npx vitest run --project renderer-node src/renderer/src/workspace/entityMoveTree.test.ts --reporter verbose`：15/15 通过。
  - `npx vitest run --project renderer-jsdom-components src/renderer/src/workspace/EntityMoveDialog.test.tsx --reporter verbose`：5/5 通过。
  - `npx tsc -p tsconfig.json --noEmit`：通过。
  - `npm run lint:strict -- src/renderer/src/workspace/entityMoveTree.ts src/renderer/src/workspace/EntityMoveDialog.tsx src/renderer/src/workspace/EntityMoveDialog.test.tsx`：通过。
  - `git diff --check`：通过。

## 运行时视觉证据

- 本地 Vite harness 渲染真实 `EntityMoveDialog` 和 renderer CSS，通过 Chrome DevTools Protocol 抓取三种 source 模式。Codex Browser 当前不可用，故使用同 repo 现有 CDP 风格的本地浏览器验证路径。
- 截图：
  - `artifacts/entity-move-memory.png`
  - `artifacts/entity-move-segment.png`
  - `artifacts/entity-move-supplement.png`
- 测量：`artifacts/entity-move-dialog-runtime-metrics.json`。三种模式均无水平溢出，row 高度 32px，`oversizedRows: []`，选中目标后「移动」按钮可用。
- 目测核对：移动记忆为扁平空间列表；移动片段为 workspace -> memory 两层；移动补充内容为 workspace -> memory -> segment 三层；当前位置禁用只出现在 leaf；空文件夹显示计数 0 且不可展开；选中态使用 `bg-secondary` + Check。

## 文档判断

- 已复核 `docs/current/frontend.md` 的变更门禁。本次只改 feature-local 弹层内部投影、渲染和验证证据，没有改变 React structure、reusable component 合同、Tailwind/shadcn setup、forms owner、UI state owner、UI data fetching 模型、设计系统不变量或当前能力索引，因此 `docs/current/frontend.md` 无需更新。
- 最终 `npm run verify:quick` 放在 spec 归档之后执行，避免对归档前路径状态做最终 clean 声明。

# 路径类实体操作组 Spec

创建时间：2026-05-20 09:04 America/Los_Angeles

## 目标

本轮目标是在 Memory Studio 各类 More 菜单中抽出稳定重复的路径类实体操作组，减少重复 JSX、icon、separator、toast 和错误处理逻辑，同时保留每个业务菜单自己的语义边界。

## 边界

只抽取以下四个路径类动作：

- 用默认应用打开
- 在访达中显示
- 复制相对路径
- 复制绝对路径

共享组负责这些动作的 icon、分组结构、separator、成功复制 toast、typed error toast 和 Promise reject fallback。是否存在相对路径由调用方传入的 action 决定。

## 推荐路径

新增 feature-local 的 `EntityPathActionGroup` 或同等命名组件，放在 `src/renderer/src/workspace`。它只接收路径动作 bindings，不接收重命名、删除、转录、编辑、清空或业务状态。

`EntityActionMenu` 继续作为实体菜单壳，组合路径组、可选转录组和重命名/删除组。`SegmentContentActionsMenu` 继续作为正文/转录 slot 菜单壳，组合路径组和 slot 自己的编辑、重命名、清空动作。

`SegmentActionsMenu`、`SegmentSupplementActionsMenu` 和 `SegmentContentActionsMenu` 的用户可见菜单顺序、文案、禁用行为和触发方式保持不变。

## 非目标

- 不创建万能 `EntityActionMenu` 配置矩阵。
- 不把编辑、重命名、清空、删除、生成转录或重新生成转录放入共享配置。
- 不新增 IPC、DB、preload surface、Electron security surface、Zustand store 或新依赖。
- 不改变 Memory Space、Memory、Segment、SegmentSupplement 和 primary content slot 的产品语义。
- 不做视觉 redesign。

## 任务清单

- [x] RED：补充或调整 renderer 测试，证明共享路径组能渲染默认打开、访达显示、复制相对路径、复制绝对路径，且没有相对路径 action 时不显示相对路径项。
- [x] RED：补充或调整现有菜单测试，证明 Segment、SegmentSupplement 和 SegmentContent 菜单仍保持当前用户可见顺序与业务动作。
- [x] GREEN：实现 feature-local 路径类操作组，并让现有菜单复用它。
- [x] REFACTOR：删除重复路径 action handler、icon JSX 和 copy toast 处理，只保留业务菜单自己的壳与业务动作。
- [x] 文档：必要时更新 `docs/current/frontend.md` 或 `docs/current/quality.md`，只写当前事实。
- [x] 验证：运行 focused renderer tests、`npm run verify:quick` 和 `git diff --check`。

## 审查与验证记录

- Subagent 审查：PASS，无 blocker/major。
- RED：`npm run test:renderer -- src/renderer/src/workspace/EntityPathActionGroup.test.tsx` 失败，原因是 `./EntityPathActionGroup` 模块不存在。
- GREEN focused：`npm run test:renderer -- src/renderer/src/workspace/EntityPathActionGroup.test.tsx` 通过，6 个测试通过。
- 菜单 focused：`npm run test:renderer -- src/renderer/src/workspace/entityActionMenu.test.tsx src/renderer/src/workspace/SegmentActionsMenu.test.tsx src/renderer/src/workspace/SegmentSupplementActionsMenu.test.tsx src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx src/renderer/src/workspace/EntityPathActionGroup.test.tsx` 通过，5 个文件 33 个测试通过。
- 完整验证：`npm run verify:quick` 通过，包含 main tests 815 个、renderer tests 494 个、`lint:strict` 和 `format:check`。
- Diff 检查：`git diff --check` 通过。

## 验收标准

- Memory Studio 中 Segment、SegmentSupplement 和 primary content slot More 菜单用户可见行为不变。
- 路径类动作的 success/error toast 行为由一个共享路径组覆盖。
- `EntityActionMenu` 不再直接拥有路径菜单项 JSX，但仍是实体菜单壳。
- `SegmentContentActionsMenu` 不再复制路径动作处理逻辑，但仍只表达正文/转录 slot 操作。
- 没有新增 IPC、DB、preload、Electron 安全边界或产品模型变更。
- `npm run verify:quick` 和 `git diff --check` 在当前快照通过。

# Memory 列表项封面设计稿

- Started: 2026-06-01 22:49 PDT
- Completed: 2026-06-02
- Type: implementation
- Scope: MemoryRail Memory 列表项封面、文件合同、reset/undo 和同步模型

## 目标

把 Memory 列表项从纯文字卡片推进到“左侧 1/3 默认封面图、右侧 2/3 文本和 More 操作”的可运行实现，并让 agent 直接替换 `cover/` 图片后通过现有 file truth 同步刷新。

## 当前假设

- “列表项”指当前 `MemoryRailCard` 所代表的 Memory item，不是 Segment 横向预览卡，也不是 sidebar Memory Space item。
- 默认封面先使用 6 张 Codex 生成图，未来实现时按 Memory identity 做稳定随机，不把随机结果写入 `.reo` 语义真源。
- Memory 列表项只显示 Memory 级信息：标题、更新时间和片段总数；不显示 `录音 / 笔记 / 补充` breakdown，因为这些属于 Segment / SegmentSupplement 层级。
- 当前 `docs/archive/initiatives/2026-05-28-hero-expression-surfaces` 已归档为失效方向；本方向用封面图替代 MemoryIcon / Segment 渐变卡一类抽象 Hero 表达。

## 状态覆盖

- 默认：封面 + 标题 + 更新时间/片段数。
- Hover：灰度填充增强，More 变清晰。
- Selected：使用灰度选中面与 `aria-current`，不显示品牌红圆点，不给普通文字或 chrome 加品牌红。
- Focus：保留明显键盘 focus ring。
- Menu open：More 保持打开态，并展示菜单相对位置。
- Long title：标题两行截断，meta 和 More 不被挤压。
- Loading：封面和文本 skeleton。
- Compact rail：在当前 240px Memory rail 约束下的缩小版。

## 设计依据

- Reo 设计系统要求同平面列表项不使用 border / shadow，状态以 `card -> secondary/accent` 灰度阶梯表达。
- `Practical UI` Ch.4 的 grouping / hierarchy 建议用于封面、标题、meta 和 actions 的分组与优先级。
- `Practical UI` Ch.1 的 interaction states 建议用于默认、hover、selected、focus、menu open 的显式状态。
- `Practical UI` Ch.7 的 target size 建议用于 More 操作的可点击区域。

## 预览

打开 `index.html` 查看设计稿。

## 文件合同与同步

封面文件合同、默认模板位置、More 菜单 reset 行为和同步模型见 `cover-contract.md`。

## 实现状态

- MemoryRail item 已改为 Reo 240px rail 内的 compact 左图右文布局：80px cover 贴边、右侧保留 title、更新时间和片段数，更新时间与片段数分两行显示，不显示录音/笔记/补充 breakdown。
- 默认封面模板已放入 `src/renderer/src/workspace/covers/defaults/`，renderer 按 `memoryId` 稳定映射。
- Memory 自定义封面使用 `memories/<memory-directory>/cover/`，通过 `reo-attachment://<workspaceId>/memories/<memoryId>/cover/<filename>?v=<version>` 读取。
- More 菜单已新增 `恢复随机默认图片`；默认封面时 disabled，自定义封面时 reset 到 `.reo/trash/memory-covers/<restoreToken>` 并支持 undo restore。
- 加载骨架设计已在 `index.html` 中更新为同一 compact 左图右文比例；当前运行时代码没有独立 MemoryRail loading owner，不新增 dormant skeleton state。

## 验证

- `MAIN_TEST_FILES="test/main/memoryCovers.test.ts,test/main/memoryFiles.test.ts,test/main/workspaceContract.test.ts,test/main/appProtocol.test.ts,test/main/workspaceBridgeSurface.test.ts" npm run test:main`
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/MemoryRail.test.tsx src/renderer/src/workspace/MemoryActionsMenu.test.tsx src/renderer/src/workspace/WorkspaceTitlebar.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx src/renderer/src/workspace/RecordingOverlay.test.tsx`
- `npm run test:renderer -- --project renderer-node src/renderer/src/workspace/covers/memoryCoverSource.test.ts`
- `npm run typecheck:quick`
- `npm run verify:quick`

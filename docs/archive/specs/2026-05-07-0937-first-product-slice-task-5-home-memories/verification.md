# 验证

## 初始状态

- Task 4 已归档并提交：`baa31882b36cdf66336ba781c4f5da88ff6a9b73`。
- `git status --short` 在安装 `date-fns` 与创建本 spec 前为空。
- `find docs/specs -mindepth 1 -maxdepth 1 -print` 在创建本 spec 前为空。

## Research

- Context7 `/date-fns/date-fns`，2026-05-07 09:38 PDT：`format` 用于 month heading，`compareAsc` 可用于 Date 排序；本实现需要 descending order 时反转比较方向。
- Context7 `/websites/radix-ui_primitives`，2026-05-07 10:25 PDT：`Separator.Root` 默认 horizontal；`decorative=true` 时作为纯装饰分隔并被 screen reader 忽略。Task 5 使用 Reo 已有 `Separator` primitive 做 header/month visual divider。

## RED/GREEN/REFACTOR 记录

- RED 通过：
  - `npx vitest run src/renderer/src/workspace/WorkspaceHome.test.tsx`
  - 结果：失败，`WorkspaceHome` 仍显示 workspace title、`Memory Content` 与 recording list；缺少 `All memories`、`Search memories`、月份分组、memory card 元数据与 `No memories yet.` 空状态。
- GREEN 通过：
  - `npx vitest run src/renderer/src/workspace/WorkspaceHome.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx`
  - 结果：2 个 test files、4 个 tests 通过。
  - `npx vitest run src/renderer/src/App.test.tsx src/renderer/src/workspace/WorkspaceHome.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx`
  - 结果：3 个 test files、8 个 tests 通过；App 级断言同步为 `All memories` header、workspace title 标签和 `Search memories` 输入。
- REFACTOR checkpoint：
  - `npm run typecheck` 通过。
  - 删除非交互 card hover affordance，避免未实现 detail navigation 的误导性交互。
  - 去除子组件从 `WorkspaceHome` 导入 parent type 的类型耦合。
  - 新增样式只使用 Reo token 范围内的 spacing、radius、surface、border 和 typography。
- `$ycksimplify` review fix：
  - 删除单 consumer `MemorySearchBar` 薄 wrapper，searchbox 改为直接使用 `Input` primitive。
  - 使用 `useMemo` 从 `snapshot.memories` 建立倒序 memory view model，预计算 month/date/duration/count/searchText，避免每次 search keystroke 反复 date parse/format/sort。
  - 补充 DOM 顺序、month/date/status/no-match search、aria-label-only future capability 负向测试。
  - 为 workspace title/description 和 card title 增加换行约束，降低长文本溢出风险。
  - `npx vitest run src/renderer/src/App.test.tsx src/renderer/src/workspace/WorkspaceHome.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx` 通过：3 个 test files、8 个 tests。
  - `npm run typecheck` 通过。
  - `npm run lint` 通过。
  - `npm run format:check` 通过。
- Claude CLI 前端 refinement：
  - 命令形态：`claude --model claude-opus-4-7 --effort max "..."`。
  - 结果：CLI 可用，未遇到 quota/reset blocker；采纳 search/count inline toolbar、删除无效 card wrapper。
  - Claude 自测：`npx vitest run src/renderer/src/App.test.tsx src/renderer/src/workspace/WorkspaceHome.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx` 通过：3 个 test files、8 个 tests。
- Codex simplify refinement：
  - `MemoryCard` 只在 `hasTranscript || hasReflections` 时渲染状态 tag 容器，避免无状态 memory card 产生空 DOM 和额外 margin。

## Runtime / UI evidence

- Reference review：
  - 已对照 `/Users/yck/Downloads/PM/设计参考/记忆录音/workspace页面.png`：参考图用于验证 `All memories`、search/action 工具区、月份分组、横向内容节奏；Reo 当前 slice 不显示 photo/film/future nav，不复制参考图的粉色 palette、StoryAtlas brand、film controls 或 account/auth 区。
  - 已对照 `/Users/yck/Downloads/PM/设计参考/记忆录音/home页面-sidebar展开态.png`：参考图用于验证 sidebar + 主 panel 的 page hierarchy；Task 5 保持 Task 4 的 Reo shell，不新增 railbar 或未实现 route。
- Computer Use runtime：
  - 启动 `npm run dev`，Electron renderer URL 为 `localhost:5173/`。
  - Starter Home：验证左侧 240px sidebar、左上 sidebar icon-only collapse control、主 panel `All memories`、create workspace `+` action。
  - Sidebar covered 状态：点击 hide sidebar 后主 panel 覆盖 sidebar，左侧贴合窗口边缘；这保持 Task 4 shell 行为。
  - Loaded Home：通过真实 create workspace flow 创建 `/private/tmp/reo-task5-create-runtime`，进入 loaded workspace 后验证 `DAILY MEMORY` workspace label、`All memories` header、`Private notes` description、`Search memories` searchbox、`0 memories` count、`No memories yet.` 空状态和单一 `Record memory` action。
  - Fixture open attempt：`/private/tmp/reo-task5-home-fixture` open flow 在 pending 中未完成；未作为 Task 5 通过证据。Memory card/search/month 的非空状态由 Vitest 行为测试覆盖。
  - Runtime warning：打开 `WorkspaceEntryDialog` 时 dev console 输出 Radix `DialogContent` 缺 `DialogTitle`/description warning。该问题属于已存在 app-shell/dialog accessibility debt，不由 Task 5 Home memories 引入；下一个 app-shell/theme task 必须修复。

## 固定门禁

- `npm run verify:quick` 通过：main 247 tests、renderer 12 files / 67 tests、typecheck、lint、format:check 均通过。
- `npm run build` 通过：main/preload/renderer production build 成功。
- `git diff --check` 通过：无 whitespace error。
- `diff -u AGENTS.md .claude/CLAUDE.md` 通过：无差异。
- `find docs/specs -mindepth 1 -maxdepth 1 -print` 当前输出本 spec：`docs/specs/2026-05-07-0937-first-product-slice-task-5-home-memories`；归档后需复跑并应为空。
- `git status --short` 当前只包含 Task 5 范围内源码、docs/current、initiative、package 和本 spec 变更；无用户范围外 dirty worktree。

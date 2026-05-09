# Memory Studio 目标设计规划

## 背景

用户确认目标设计图中的内容、布局、信息架构和状态就是想要的产品形态；差异只在设计系统。Reo 实现必须保留目标设计内容，并把视觉、组件和交互映射到当前 Reo 设计系统和工程边界。

## 目标

- 归档已完成但仍留在 `docs/specs/*` 的旧 spec。
- 创建一个 active initiative 承接 AppShell、Memory Studio、录音、回放和后续 asset 的跨 session 实现。
- 给出逐步实现顺序，避免一次性扩大架构面。
- 明确未实现能力不能作为 current build 假入口出现。
- 明确现有 AppShell sidebar 保持不变，不作为 Slice 1 的重构对象。
- 明确右侧 Memory 列表属于 Workspace 层级，中间片段时间线只属于当前选中 Memory，不能表示整个 workspace 的全部内容。
- 允许后续 agent 在每个 slice 前审查表、字段和技术栈基础设施缺口，但不得扩大为一次性全栈建设。

## 成功标准

- `docs/specs/*` 只包含当前规划 spec。
- `docs/initiatives/README.md` 指向唯一 active initiative。
- Initiative 记录目标设计内容、边界、完成条件和实现顺序。
- 实现顺序把 AppShell/loaded workspace frame、Memory Studio、录音、回放和 asset 能力拆成可验证 slice。
- Initiative 和 current 文档记录 Workspace、Memory、Asset 三层 UI 关系：右侧切换 Memory，中间展示当前 Memory，片段时间线展示当前 Memory 内的 Asset。
- Initiative 记录基础设施审查门，覆盖 React、TypeScript、electron-vite、Tailwind v4、shadcn/Radix、Zustand、TanStack Query、React Hook Form、Zod、Better Auth、Drizzle、`better-sqlite3`、electron-updater、date-fns、Sentry、`electron-log`、Electron Forge 和 Vitest。
- 规划说明 TDD 豁免原因。

## 范围

- 文档规划与长期任务入口。
- 不修改 renderer、main、preload、IPC、文件模型或测试。
- 不引入依赖。
- 不实现视觉重构。

## TDD 豁免

本 slice 只创建规划文档和长期任务入口，不改变 runtime 行为。TDD 豁免；验证使用文档结构检查、格式检查和 `npm run verify:quick`。

## 采用依据

- React 官方文档：组件 state 与 UI tree 位置绑定；需要按 memory/session 重置局部 state 时使用 key 或明确组件边界；派生 UI 数据优先在 render 中计算。
- Tailwind CSS v4 官方文档：`@theme` 定义设计 token，并生成可运行时引用的 CSS variables；Reo 新视觉状态必须先映射到 token 或 usage rule。
- shadcn/ui 官方文档：shadcn/ui 是 source-owned open code，不是传统组件库；新增 primitive 必须进入项目源码并按 Reo 设计系统定制。

## 验证计划

- 检查 `docs/specs/*` 当前只包含本 spec。
- 检查 active initiative 索引。
- 运行 `npm run verify:quick`。

## 验证记录

- `find docs/specs -mindepth 1 -maxdepth 2 -type f -print | sort` 只返回本 spec 的 `README.md` 和 `spec.md`。
- `docs/initiatives/README.md` 指向唯一 active initiative：`2026-05-08-memory-studio-design-convergence`。
- `git diff --check` 通过。
- `npm run verify:quick` 通过：typecheck、main tests、renderer tests、lint 和 format check 全部完成。

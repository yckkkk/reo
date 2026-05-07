# Task 6A：主题切换与 App Shell 可访问性

创建时间：2026-05-07 10:43 America/Los_Angeles

## 目标

把 Reo 当前 App Shell 从单一浅色界面推进到可交付的浅色/深色双主题基础。深色模式必须由 Reo 设计系统 token 驱动，不得在业务组件里散落一次性暗色 class。

本 slice 只处理当前 first product slice 已实现的界面：App Shell、侧边栏、Home、Workspace entry dialog、Recording overlay 的现有 token 覆盖面。不会新增 settings、账号、系统主题跟随或持久化能力。

## 范围

- 侧边栏左下角增加 icon-only 浅色/深色切换按钮。
- 使用 lucide `Moon` / `Sun`，不使用 emoji。
- 主题状态放在 `App` 层，确保 starter home 切到 loaded workspace 后保持当前主题。
- App Shell 根节点暴露 `data-theme="light|dark"`，让 Tailwind v4 与 CSS 变量级联共同生效。
- `theme.css` 补充深色 token：背景、面板、文字、弱文字、描边、阴影、品牌强调色、录音光谱色。
- 通过 Radix/shadcn 既有 `Button`、`Tooltip`、`Dialog` primitive 组合，不新增 generic theme provider 或二次包装层。
- 修复当前 workspace entry dialog 可访问性 warning 的实现风险：Dialog 必须有明确 `Title` 与 `Description` 关联。

## 非范围

- 不新增系统主题跟随。
- 不新增本地持久化。
- 不新增 settings 页面。
- 不修改 DB、IPC、preload 或文件系统协议。
- 不改变 Task 4 已验收的 sidebar 240-520px 拖拽、覆盖动画和面板边界。

## 设计约束

- 深色模式不是简单反色：主背景避免纯黑，面板层级使用逐级抬升的暖中性色，文字对比保持 AA 级可读。
- 浅色模式视觉应保持 Task 4/5 已验收结果，除必要 token 级兼容外不做视觉漂移。
- 切换按钮属于 sidebar 工具区，不属于 nav；位置固定在左下角，icon-only，tooltip 提供操作名称。
- 深色 token 必须覆盖 Reo 语义色，而不是给每个页面写 `dark:` 分支。
- 精简要求：不引入 ThemeProvider、localStorage、matchMedia、Zustand 或额外 runtime 兜底。

## TDD 验收

- RED：`AppShell` 测试必须先失败，证明没有主题切换按钮与 `data-theme`。
- RED：`App` 测试必须先失败，证明主题无法在创建 workspace 后保持。
- GREEN：点击 `Switch to dark mode` 后 App Shell 根节点变为 `data-theme="dark"`，按钮文案变为 `Switch to light mode`。
- GREEN：创建 workspace 后仍保持 `data-theme="dark"`。
- GREEN：Workspace entry dialog 的 `role="dialog"` 有可访问名称与描述。
- REFACTOR：不得增加无当前用途的 theme abstraction。

## 验证

- `npx vitest run src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/App.test.tsx`
- `npm run verify:quick`
- `git diff --check`
- `diff -u AGENTS.md .claude/CLAUDE.md`
- `find docs/specs -mindepth 1 -maxdepth 1 -print`
- 运行时使用 Computer Use 检查浅色、深色、切回浅色、创建 dialog、创建 workspace 后主题保持。

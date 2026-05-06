# 规格

## 当前事实

- 工作区起始状态干净。
- `docs/specs` 起始为空。
- 当前没有 active initiative。
- Renderer 是 React 19 + TypeScript。
- Tailwind CSS v4 已安装，并通过 `@tailwindcss/vite` 接入 renderer build。
- Reo 设计系统源文件位于 `docs/current/design-system/`。
- Renderer 可执行主题文件是 `src/renderer/src/theme.css`。
- shadcn/ui 已选型，但当前未安装。
- 当前没有 `components.json`。
- 当前没有 `src/renderer/src/components/ui` 或 `src/renderer/src/lib/utils`。
- 当前 `tsconfig.json` 没有 `baseUrl` / `paths` alias。
- 当前 `electron.vite.config.ts` 没有 renderer resolve alias。
- 当前没有真实 reusable component consumer。

## 官方文档核对

- Context7 shadcn/ui library id：`/shadcn-ui/ui`。
- shadcn/ui Vite 文档要求既有 Vite 项目先具备 Tailwind CSS，再配置 TypeScript alias、Vite alias，之后运行 CLI init。
- `components.json` 用于让 shadcn CLI 理解项目结构和生成 component source。
- Tailwind CSS v4 下 `components.json` 的 `tailwind.config` 留空，`tailwind.css` 指向导入 Tailwind 的 CSS 文件。
- shadcn/ui 不是普通 runtime component package；它把 component source 放入项目内，项目需要承担这些源码的维护边界。

## 当前判断

本 slice 不安装 shadcn/ui，不创建 `components.json`，不创建 `components/ui`，不创建 `lib/utils`。

理由：

- 当前没有真实 reusable component consumer。
- 当前没有需要 Radix primitive 或 shadcn component source 才能表达的 UI 行为。
- 空组件层会违反 Reo 的浅目录和不保留占位目录规则。
- 当前更低风险路径是先记录启动条件，等真实 component pressure 出现时再初始化。

## shadcn/ui 初始化条件

只有同时满足以下条件时，才允许初始化 shadcn/ui：

- 当前 slice 有至少一个真实 UI component consumer。
- 该 component 需要 reusable primitive、accessible interaction primitive，或明确的 shared visual invariant。
- 初始化同批定义 renderer import alias，并同步 `tsconfig.json` 与 `electron.vite.config.ts`。
- 初始化同批创建 `components.json`，并让 `tailwind.css` 指向 `src/renderer/src/index.css`。
- Tailwind token 与视觉规则仍以 Reo design system 为准。
- 生成的 component source 必须立即被真实 consumer 使用。

## 成功标准

- `docs/current/frontend.md` 写清当前不初始化 shadcn/ui 和组件层。
- `docs/current/frontend.md` 写清 shadcn/ui 初始化条件。
- 不新增依赖。
- 不新增 `components.json`、`components/ui`、`lib/utils` 或 alias。
- 不改变 runtime 行为。
- `npm run verify:quick` 通过。
- `npm run build` 通过。
- 提交前独立 review 通过。

## 非目标

- 不安装 shadcn/ui。
- 不安装 Radix、lucide、class-variance-authority、clsx 或 tailwind-merge。
- 不创建 reusable component layer。
- 不做 UI feature。
- 不做 visual redesign。
- 不做 forms、query、state foundation。
- 不做 preload、IPC、DB、auth、updater、packaging 或 runtime integration。
- 不引入 Vitest。

## TDD 判断

本 slice 是文档边界和决策更新，不改变 runtime 行为，不新增交互行为。

TDD 豁免：不执行 RED/GREEN/REFACTOR；以官方文档核对、`verify:quick`、build 和独立 review 作为验证。

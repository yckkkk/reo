# 规格

## 当前事实

- 当前 renderer 是 React 19 + TypeScript。
- 当前 renderer 入口是 `src/renderer/src/main.tsx`。
- 当前样式入口是 `src/renderer/src/index.css`。
- 当前 `electron.vite.config.ts` 只配置 React plugin。
- Tailwind CSS v4 已选型但未安装。
- shadcn/ui 已选型但未安装。
- 当前没有 reusable component layer。

## 官方文档核对

- Tailwind CSS v4 官方 Vite 接入方式是安装 `tailwindcss` 和 `@tailwindcss/vite`。
- Vite config 需要加入 `@tailwindcss/vite` plugin。
- CSS 入口需要 `@import "tailwindcss"`。
- Tailwind v4 使用 CSS-first theme variables 定义项目 token。

## 设计系统判断

用户已提供 Reo 设计系统，当前作为 Reo 的设计系统真源。本 slice 以用户提供的 Tailwind v4 `@theme` block 和本地设计系统源文件为 token authority。

已核对页面内容：

- design token sections。
- component previews。
- usage rules。
- CSS custom properties。
- Tailwind v4 token block。
- do / don't guidelines。

本 slice 采用以下基础 token：

- 颜色：Eggshell、Powder、Chalk、Fog、Gravel、Slate、Cinder、Obsidian、Signal Blue、Ember、Voice Spectrum。
- 字体族：Waldenburg、WaldenburgFH、Inter、Geist Mono，均先使用 fallback，不引入远程字体加载。
- 尺寸：caption、body、body-lg、subheading、heading-sm、heading、heading-lg、display，并使用独立 `leading-*` / `tracking-*` token。
- 间距：4px 基础单位，常用 4-160px scale。
- 形状：md、lg、xl、2xl、2xl-2、3xl、3xl-2、pill radius。
- 阴影：`shadow-subtle` 到 `shadow-subtle-9`。

Cinder 使用有效 CSS hex `#57534f`。

## 成功标准

- Tailwind v4 通过 `electron-vite` renderer build 生效。
- `src/renderer/src/theme.css` 包含 Reo token foundation。
- `src/renderer/src/index.css` 包含 Tailwind import 和 renderer theme import。
- `src/renderer/src/main.tsx` 使用 Tailwind utility class，不再依赖旧 `.app-shell` / `.app-panel` 页面类。
- 现有占位界面仍是 Reo 基础屏，不扩展产品功能。
- `docs/current/frontend.md` 写清 Tailwind 已建立、shadcn 仍未安装。
- 根 `README.md` 当前事实准确。
- 不新增 shadcn/ui、Radix、lucide、forms、query、state、preload、IPC、DB、auth、Forge、updater、packaging、runtime integration。
- `npm run verify:quick` 通过。
- `npm run build` 通过。
- 提交前独立 review 通过。
- 收口后 `docs/specs` 为空。

## 非目标

- 不做完整产品 UI。
- 不做 shadcn/ui 初始化。
- 不创建 reusable component layer。
- 不引入字体加载方案。
- 不做主题切换。
- 不做 browser/component 测试平台。
- 不新增 runtime 或 Electron surface。

## TDD 判断

本 slice 是 styling/config foundation。没有业务行为变化，不新增交互行为。若最终只改变样式接入、样式 token、文档和 package config，TDD 豁免；以 build、verify 和独立 review 作为本 slice 验证。

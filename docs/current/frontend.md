# 前端

本文档是 React、样式、组件和 UI state 的当前真源。

## 当前事实

- Renderer 是 React 19 + TypeScript。
- Tailwind CSS v4 已安装，并通过 `@tailwindcss/vite` 接入 renderer build。
- Reo 设计系统源文件位于 `docs/current/design-system/`。
- Reo 设计系统包含 tokens、component shape、surfaces、elevation、layout 和 usage rules。
- 当前 styling foundation 使用 Reo 设计系统 token：暖白底、黑色主文字、低饱和中性色、蓝/橙小型点缀、细边界和轻量阴影。
- Renderer 可执行主题文件是 `src/renderer/src/theme.css`。
- shadcn/ui 已选型，但当前未安装。
- Zustand、TanStack Query、React Hook Form、Zod 已选型，但当前未安装。

## 技术方向

- 直接使用 React 19 模式。
- 使用 Tailwind CSS v4 作为 styling foundation。
- Tailwind token 优先写在 `src/renderer/src/theme.css` 的 `@theme static` 中。
- 组件和页面设计必须先核对 Reo 设计系统真源。
- 使用 shadcn/ui 和 Radix primitives 建立 reusable components。
- 有现成 lucide icon 时使用 lucide。
- 表单使用 React Hook Form + Zod。
- 来自 main/server boundary 的 async data 使用 TanStack Query。
- Zustand 只用于需要跨 component subtree 保留的本地 client state。

## 组件规则

- Reusable components 必须小、明确、可读。
- 没有真实组件前，不创建 design-system layer。
- 不得把 card 放进另一个 card。
- 不得为 shadcn/ui 创建没有真实 invariant 的 generic wrapper。
- 项目 UI primitives 建立后，业务组件必须通过项目 primitives 使用。
- UI 文案必须在 mobile 和 desktop 上不溢出。

## 样式规则

- Component foundation 建立后，优先使用 token 和 primitive variants。
- 当前业务样式优先使用 Tailwind utility class 和已定义 token。
- 不得在业务组件中散落硬编码视觉常量。
- 不得为单个 screen 创建一次性 palette。
- 避免不服务产品 workflow 的装饰性 UI。

## 设计系统规则

- 页面底色使用 Eggshell，主要文字使用 Obsidian，边界使用 Chalk，辅助文字使用 Gravel 或 Slate。
- Signal Blue 和 Ember 只用于小型圆点、avatar 或状态指示，不用于正文、背景填充或按钮。
- 32px 及以上标题使用 Waldenburg 300、负 tracking 和紧凑 line-height。
- 正文和通用 UI 文案使用 Inter；产品族标签使用 WaldenburgFH 700。
- 按钮和 pill tag 使用 fully rounded 形状；输入控件保持 0 radius。
- Card 和 panel 使用 16-20px radius，并保持轻量边界或 hairline shadow。
- Geist Mono 只用于代码、技术注记和机器生成标记。

## 变更门禁

任何 React structure、reusable components、Tailwind/shadcn setup、forms、UI state、UI data fetching 的项目级模式变化，都必须更新本文档。

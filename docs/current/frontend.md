# 前端

本文档是 React、样式、组件和 UI state 的当前真源。

## 当前事实

- Renderer 是 React 19 + TypeScript。
- Tailwind CSS v4 已选型，但当前未安装。
- shadcn/ui 已选型，但当前未安装。
- Zustand、TanStack Query、React Hook Form、Zod 已选型，但当前未安装。

## 技术方向

- 直接使用 React 19 模式。
- 使用 Tailwind CSS v4 作为 styling foundation。
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
- 不得在业务组件中散落硬编码视觉常量。
- 不得为单个 screen 创建一次性 palette。
- 避免不服务产品 workflow 的装饰性 UI。

## 变更门禁

任何 React structure、reusable components、Tailwind/shadcn setup、forms、UI state、UI data fetching 的项目级模式变化，都必须更新本文档。

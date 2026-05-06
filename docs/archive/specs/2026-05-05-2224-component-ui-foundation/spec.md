# 规格

## 当前事实

- HEAD：`6bd7a51 docs: define state form query gate`。
- 工作区起始干净。
- `docs/specs` 起始为空。
- `docs/current/frontend.md` 已记录 shadcn/ui 已选型但当前未安装。
- 当前没有 `components.json`、renderer import alias、`components/ui` 或 `lib/utils`。
- 当前没有真实 reusable component consumer。
- Renderer 当前是单个静态 shell。
- 当前 `package.json` 没有 shadcn/ui 相关 dependencies。

## 官方资料核对

- Context7：`/shadcn-ui/ui`。
- shadcn/ui Vite 官方文档：`https://ui.shadcn.com/docs/installation/vite`。
- shadcn/ui `components.json` 官方文档：`https://ui.shadcn.com/docs/components-json`。
- 官方 Vite setup 需要配置 alias、`components.json`、Tailwind CSS path 和 component source。
- Tailwind v4 项目中 `components.json` 的 Tailwind config 应保持空值。
- shadcn/ui 是代码分发模型，生成的 component source 会成为项目源码，需要真实 owner 和 consumer。

## 判断

本 slice 不初始化 shadcn/ui。

理由：

- 没有真实 reusable component consumer。
- 当前只有单个静态 shell，不需要抽出 project primitive。
- 初始化 shadcn/ui 会创建 `components.json`、alias、`lib/utils` 和 component source，但没有真实用途。
- 无 consumer 生成 component source 会违反 Reo 不保留占位实现和不创建空组件层的规则。

## 成功标准

- 确认 `docs/current/frontend.md` 已包含 shadcn/ui 初始化门槛。
- 不新增 `components.json`。
- 不新增 `components/ui`。
- 不新增 `lib/utils`。
- 不新增 renderer import alias。
- 不安装 shadcn/ui 相关 package。
- 不修改 runtime code。
- `npm run verify:quick` 通过。
- `npm run build` 通过。
- `git diff --check` 通过。
- docs lifecycle checks 通过。
- 多轮 subagent review 和 Claude CLI review 通过。

## 非目标

- 不初始化 shadcn/ui。
- 不生成 Button、Card、Dialog、Form 或任何 ui component source。
- 不配置 renderer alias。
- 不安装 Radix、lucide、class-variance-authority、clsx、tailwind-merge 或 shadcn CLI related dependencies。
- 不做产品 UI 或业务 screen。

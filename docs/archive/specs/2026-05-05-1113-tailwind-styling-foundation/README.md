# Tailwind Styling 基础

创建时间：2026-05-05 11:13 America/Los_Angeles
状态：已完成

## 目的

建立 Reo 当前 Styling foundation：接入 Tailwind CSS v4，写入 Reo 设计系统 token，并保持现有占位界面的小范围可验证。

## 当前判断

当前继续 Styling slice。Electron foundation 和 Quality/Test foundation 已收口；`docs/current/architecture.md` 的默认顺序下一步是 Styling 与组件基础。

本 slice 只做 Tailwind v4 与基础 token。当前 renderer 只有一个占位 screen，没有真实 reusable component 压力，因此不安装 shadcn/ui，不创建 design-system layer。

## 设计输入

- Reo 设计系统源文件：`../../../current/design-system/`
- 视觉方向：type-first、低饱和暖白底、黑色主文字、细边界、蓝/橙只作为小型状态或品牌点缀。

## 优先阅读

- `../../../../AGENTS.md`
- `../../../../README.md`
- `../../../README.md`
- `../../../current/foundation.md`
- `../../../current/architecture.md`
- `../../../current/frontend.md`
- `../../../current/quality.md`

## 产出

- 安装 Tailwind CSS v4 与 Vite plugin。
- 配置 `electron-vite` renderer 使用 Tailwind Vite plugin。
- 在 renderer CSS 建立 Reo token foundation。
- 使用 Tailwind utility class 驱动现有占位界面。
- 更新 `docs/current/frontend.md` 和根 `README.md` 的当前事实。
- 记录验证结果和独立审查意见。

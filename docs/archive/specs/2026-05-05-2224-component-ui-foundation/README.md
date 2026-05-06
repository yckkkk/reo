# Component UI Foundation

## 状态

Archived spec。

## 时间

2026-05-05 22:24 America/Los_Angeles。

## 目标

重新判断 Reo 是否已有真实 reusable component consumer，足以初始化 shadcn/ui、`components.json`、renderer alias 和 component source。

## 结论

当前不初始化 shadcn/ui。

原因：

- Renderer 当前只有单个静态 shell。
- 当前没有第二个真实 component consumer。
- 当前没有 reusable primitive、accessible interaction primitive 或 shared visual invariant 压力。
- 当前没有表单、dialog、menu、button group、card list 或其他真实组件需求。

因此本 slice 只确认既有 gate，保持不安装依赖、不创建 `components.json`、不创建 `components/ui`、不创建 `lib/utils`、不配置 renderer alias。

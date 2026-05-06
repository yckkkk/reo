# State Form Query Foundation

## 状态

Archived spec。

## 时间

2026-05-05 22:11 America/Los_Angeles。

## 目标

判断 Reo 是否已经存在真实 async data、local UI state、form state 或 untrusted runtime boundary，足以引入 TanStack Query、Zustand、React Hook Form 或 Zod。

## 结论

当前不引入 query/store/form/validation packages。

原因：

- Renderer 当前是静态 shell。
- 当前没有 main/server-backed async data。
- 当前没有 mutation、query invalidation 或 optimistic update。
- 当前没有跨 component subtree 的 local UI state。
- 当前没有 form submit、form draft 或 field validation。
- 当前没有需要 Zod 校验的不可信 runtime boundary。

因此本 slice 只记录启用门槛，不安装依赖、不创建 provider/store/form/schema。

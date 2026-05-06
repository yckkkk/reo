# 规格

## 当前事实

- HEAD：`d5b98a3 docs: define auth foundation gate`。
- 工作区起始干净。
- `docs/specs` 起始为空。
- Renderer 当前是静态 shell。
- 当前没有 async data consumer。
- 当前没有 mutation、query invalidation 或 optimistic update path。
- 当前没有跨 component subtree 的 local UI state。
- 当前没有 form submit、form draft 或 field validation。
- 当前没有 untrusted runtime boundary consumer。
- 当前 `package.json` 没有 `@tanstack/react-query`、`zustand`、`react-hook-form`、`@hookform/resolvers` 或 `zod`。

## 官方资料核对

- Context7：`/tanstack/query`、`/pmndrs/zustand`、`/react-hook-form/documentation`。
- TanStack Query 官方文档：query keys 驱动 cache；mutation 后需要 targeted invalidation 或 rollback。
- Zustand 官方文档：store 通过 `create` 建立；persist middleware 需要 storage key、partialize、version、migrate 等 ownership。
- React Hook Form 官方文档：`useForm` 管理真实 form register、handleSubmit、formState/errors。
- Zod 官方文档：schema 用于 parse/safeParse runtime validation，并可用 `z.infer` 推导类型。

## 判断

本 slice 不新增 TanStack Query、Zustand、React Hook Form 或 Zod。

理由：

- 没有 async data，创建 QueryClient provider 只会变成空 provider。
- 没有 mutation，无法定义 query key、invalidation 或 optimistic rollback。
- 没有跨树 client state，创建 Zustand store 只会变成空 global state。
- 没有 persisted state，无法定义 storage/version/migration/recovery。
- 没有 form，安装 React Hook Form 或 resolver 没有 consumer。
- 没有 untrusted runtime boundary，安装 Zod 只会诱导 decorative schema。

## 成功标准

- `docs/current/data.md` 写清当前无 query/store/form consumer 以及启用门槛。
- `docs/current/flow.md` 写清当前无 mutation/invalidation/form submit/persisted-state migration flow。
- `docs/current/frontend.md` 写清当前不安装 TanStack Query、Zustand、React Hook Form 或 Zod。
- `docs/current/quality.md` 写清 Zod 只用于真实 untrusted boundary，当前不安装。
- 不新增 provider、store、form、schema、query key、resolver 或 package。
- 不修改 `package.json` 或 `package-lock.json`。
- 不修改 runtime code。
- `npm run verify:quick` 通过。
- `npm run build` 通过。
- `git diff --check` 通过。
- docs lifecycle checks 通过。
- 多轮 subagent review 和 Claude CLI review 通过。

## 非目标

- 不安装 `@tanstack/react-query`。
- 不安装 `zustand`。
- 不安装 `react-hook-form`。
- 不安装 `@hookform/resolvers`。
- 不安装 `zod`。
- 不创建 QueryClient provider。
- 不创建 Zustand store。
- 不创建 form 或 validation schema。
- 不做产品功能。

# 规格

## 当前事实

- 工作区起始状态干净。
- `docs/specs` 起始为空。
- `docs/initiatives` 起始没有 active initiative。
- HEAD 为 `57d5d09 docs: define component foundation boundary`。
- 当前已安装 React、React DOM、Electron、Vite、electron-vite、TypeScript、ESLint、Prettier、Tailwind CSS。
- 当前未建立 preload、IPC、auth、database、updater、packaging、Sentry、logging、shadcn/ui、Vitest。

## 审查结论

10 天 initiative 合理，但只作为长期路线图。它不授权单 session 大实现，不授权一次性安装依赖，也不覆盖当前 session spec。

如果执行时某个子任务没有真实 consumer，正确结果是 no-op/defer，并更新 docs 说明当前边界，而不是创建空壳。

## 成功标准

- 创建 `docs/initiatives/2026-05-05-foundation-completion/README.md`。
- 创建 `spec.md`、`plan.md`、`tasks.md`、`review.md`。
- 更新 `docs/initiatives/README.md` active initiative 索引。
- 计划用中文写。
- 覆盖 10 个候选子任务的审查、排序、验收门槛和非目标。
- 记录 Context7 与官方资料核对。
- 计划审查包含 scope challenge、what already exists、NOT in scope、failure modes、test strategy、parallelization/sequence analysis、outside voice / independent challenge。
- 不改产品代码，不安装依赖。
- 完成后归档本 spec。

## 非目标

- 不执行 Task 02 或任何后续实现 slice。
- 不安装 Vitest、Drizzle、Better Auth、TanStack Query、Zustand、RHF、Zod、shadcn/ui、Forge、updater、Sentry、electron-log。
- 不新增 preload、IPC、database、auth、updater、packaging、logging 或 telemetry surface。
- 不创建 product feature、agent runtime、voice、business screen 或 DB domain model。

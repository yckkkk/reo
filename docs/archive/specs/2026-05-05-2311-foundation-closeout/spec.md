# 规格

## 当前事实

- HEAD：`55aa848 docs: define packaging update gate`。
- 工作区起始干净。
- `docs/specs` 起始为空。
- 起始 active initiative：`docs/initiatives/2026-05-05-foundation-completion/`。
- 本 slice 已将 initiative 移入 `docs/archive/initiatives/2026-05-05-foundation-completion/`；`docs/initiatives/README.md` 当前记录没有 active initiative。
- Task 01-09 已完成并有 archived spec。
- 当前已安装：React、React DOM、Electron、Vite、electron-vite、TypeScript、ESLint、Prettier、Tailwind CSS。
- 当前未安装或未建立：Vitest、preload、IPC、database、auth、TanStack Query、Zustand、React Hook Form、Zod、shadcn/ui、logging/Sentry、Electron Forge、`electron-updater`、`@electron/fuses`。

## 审计结论

`docs/current/*` 已覆盖 Task 01-09 的长期事实：

- `docs/current/foundation.md`：技术路线与“只在对应 slice 证明用途时安装”原则。
- `docs/current/architecture.md`：当前最小 Electron + React + TypeScript + Vite 架构，无 preload/IPC/DB/auth/packaging。
- `docs/current/electron.md`：Electron security baseline、no preload/IPC、no diagnostics bridge、no packaging/update，以及 Forge/updater/fuse gates。
- `docs/current/frontend.md`：Tailwind v4/design-system 当前事实、shadcn/ui gate、query/store/form gate。
- `docs/current/quality.md`：verify command、Vitest gate、error/logging/Sentry gate、packaging/update verification gate。
- `docs/current/data.md`：DB/auth/query/store/form/Zod ownership gates。
- `docs/current/flow.md`：no IPC/auth/DB/query/form/update lifecycle，以及 future flow rules。

当前不新增 `docs/decisions/*`：

- 已有 decisions 覆盖 agent docs system 和 Electron build/security baseline。
- Task 01-09 主要产生 current truth gates，而不是新的长期 ADR。
- 若后续真实引入 Forge、DB、auth、preload/IPC 或 updater，再按对应 slice 决定是否新增 ADR。

## 成功标准

- 创建本 closeout spec。
- 审计所有 completed slice。
- 创建 initiative closeout summary、verification matrix 和 handoff。
- `docs/initiatives/README.md` 不再列出 active initiative。
- `docs/initiatives/2026-05-05-foundation-completion/` 移入 `docs/archive/initiatives/2026-05-05-foundation-completion/`。
- `docs/specs` 在归档后为空。
- 不新增依赖。
- 不修改 runtime code。
- `npm run verify:quick` 通过。
- `npm run build` 通过。
- `git diff --check` 通过。
- docs lifecycle checks 通过。
- 多轮 subagent review 和 Claude CLI review 通过。

## 非目标

- 不安装任何 foundation dependency。
- 不创建 product feature。
- 不创建 new ADR 作为占位。
- 不修改 source runtime。
- 不创建 next product feature spec。

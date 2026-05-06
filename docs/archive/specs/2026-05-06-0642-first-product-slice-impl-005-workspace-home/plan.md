# 执行计划

## 当前真源输入

- 归档实现计划：`docs/archive/specs/2026-05-06-0452-first-product-slice-implementation-plan/plan.md`
- 当前 frontend 真源：`docs/current/frontend.md`
- 当前数据边界：`docs/current/data.md`
- 当前质量门禁：`docs/current/quality.md`
- 当前 workspace creation flow：`src/renderer/src/workspace/CreateWorkspaceForm.tsx`

## 设计决策

- DB schema：本切片不引入 DB、migration 或 table relationship。
- 数据获取模式：继续使用 IMPL-004 的 renderer session state 和 workspace snapshot cache，不新增 IPC channel。
- cache/query/state ownership：`WorkspaceHome` 接收 `WorkspaceSession` props，不保存 `workspaceHandle` 到 DOM 或 Query key。
- shadcn/ui：手动初始化 `components.json` 和 Button/Label source，使用官方 shadcn source 结构并 retokenize 到 Reo tokens。
- Alias：创建 renderer `@/* -> src/renderer/src/*` alias，同步 `tsconfig.json`、`electron.vite.config.ts`、`vitest.config.ts`。
- Component ownership：Button/Label 是 reusable primitives；WorkspaceHome 是 feature-local business component。
- Accessibility：Record action 是 visible text button；Button/Label 必须有 role/name、focus-visible、disabled state；home 不使用 emoji。

## TDD 顺序

1. RED：Button/Label primitives 缺失；WorkspaceHome 缺失；home 禁止未来能力测试失败。
2. GREEN：安装精确依赖，创建 alias、components.json、`cn`、Button、Label、WorkspaceHome。
3. GREEN：CreateWorkspaceForm 改用 Button/Label，App loaded state 改用 WorkspaceHome。
4. REFACTOR：retokenize class、消除重复、重跑 renderer/quick verification。

## 验证命令

- `npm run test:renderer`
- `npm run verify:quick`
- `npm run build`
- reference DOM evidence：home title、single record action、`Memory Content`、no future controls
- `git diff --check`
- `diff -u AGENTS.md .claude/CLAUDE.md`
- `find docs/specs -mindepth 1 -maxdepth 1 -print`

## 提交

提交信息：`feat: add workspace home interface`

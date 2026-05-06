# 验证

## 当前状态

归档后验证通过，独立 review 通过。

## TDD

本 slice 是文档边界和决策更新，不改变 runtime 行为，不新增交互行为。

TDD 豁免：不执行 RED/GREEN/REFACTOR。

## Context7 核对

- shadcn/ui：`/shadcn-ui/ui`。

## 官方网络核对

- shadcn/ui Vite installation：<https://ui.shadcn.com/docs/installation/vite>
- shadcn/ui components.json：<https://ui.shadcn.com/docs/components-json>

## 初始验证

- `npx prettier --write docs/current/frontend.md docs/specs/2026-05-05-2013-component-foundation-boundary/*.md`：通过，无文件变化。
- `npm run verify:quick`：通过。
  - `typecheck`：通过。
  - `test:main`：4 个 Node test runner 测试通过。
  - `lint`：通过。
  - `format:check`：通过。
- `npm run build`：通过。
- `git diff --check`：通过，无输出。
- `diff -u AGENTS.md .claude/CLAUDE.md`：通过，无输出。
- `git ls-files out dist build .vite .tmp`：通过，无输出。
- `git ls-files --others --exclude-standard`：只列出当前 active spec 文件。

## 依赖与文件边界核对

- 未新增 dependency 或 devDependency。
- 未新增 `components.json`。
- 未新增 `components/ui`。
- 未新增 `lib/utils`。
- 未新增 renderer import alias。

## 归档后验证

- `npm run verify:quick`：通过。
  - `typecheck`：通过。
  - `test:main`：4 个 Node test runner 测试通过。
  - `lint`：通过。
  - `format:check`：通过。
- `npm run build`：通过。
- `git diff --check`：通过，无输出。
- `diff -u AGENTS.md .claude/CLAUDE.md`：通过，无输出。
- `git ls-files out dist build .vite .tmp`：通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：通过，无输出。
- `git status --short`：显示 `docs/current/frontend.md` 修改和本归档 spec 未追踪。
- `git ls-files --others --exclude-standard`：只列出本归档 spec 文件。

## 独立审查

独立 `$review` 风格 subagent 结果：PASS。

审查范围：

- 完整未提交 diff。
- untracked files。
- docs lifecycle discipline。
- `docs/current/frontend.md` 和 `docs/current/quality.md`。
- 是否引入 shadcn/ui、Radix、lucide、class-variance-authority、clsx 或 tailwind-merge。
- 是否创建 `components.json`、`components/ui`、`lib/utils` 或 renderer alias。
- 是否扩大到 UI feature、测试平台、DB、auth、IPC、preload、updater、packaging 或 runtime integration。

审查依据：

- Context7 shadcn/ui 文档。
- shadcn/ui Vite installation 官方文档。
- shadcn/ui components.json 官方文档。
- shadcn/ui manual installation 官方文档。

审查结论：

- 无阻断项。
- 当前改动范围限于 `docs/current/frontend.md` 和本归档 spec。
- `docs/specs` 为空。
- 未新增依赖、component source、CLI config 或 alias。
- “等待真实 reusable component consumer 出现后，再同批配置 alias、`components.json` 和 component source”符合官方规则与 Reo 当前事实。

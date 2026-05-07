# Task 3：Workspace entry create/open flow

创建时间：2026-05-07 06:56 America/Los_Angeles

## 目标

把 first product slice 的 workspace entry 从单一路径创建表单推进到可交付入口：同一入口支持创建新 workspace 与打开现有 workspace，使用 React Hook Form + Zod 做 submit-time validation，folder picker 只保留 main process 返回的 `selectionToken` 和安全展示名，create/open 错误分支互不污染，并在成功后 seed TanStack Query workspace snapshot。

## 范围

- Renderer UI：`WorkspaceEntryPage.tsx`、`CreateWorkspaceForm.tsx`、`OpenWorkspaceAction.tsx`、`FolderPickerField.tsx`、`WorkspaceErrorBanner.tsx`。
- shadcn source：`components/ui/input.tsx`，必须同批被真实 form consumer 使用。
- App integration：`App.tsx`、`App.test.tsx`。
- Renderer API tests：`CreateWorkspaceForm.test.tsx`、必要时补 `workspaceApi.test.ts`。
- Docs/current：`docs/current/frontend.md`，必要时同步 `docs/current/flow.md`、`docs/current/data.md`。

## 不做

- 不实现 app shell、sidebar、Home search、memory cards、recording drawer 或 waveform。
- 不新增 DB、Drizzle、Better Auth、Zustand、Sentry、electron-log、Forge、updater。
- 不暴露 raw absolute path、`displayPath` 到 IPC initialize/open payload、Query key 或 durable files。
- 不创建 generic form layer、generic runtime、generic service layer 或 generic IPC bridge。
- 不显示 photo、video、file、film、sharing、sync、auth、AI 或 global search 等未实现能力。

## 设计约束

- Practical UI 表单规则：单列布局、label 永远可见且靠近字段、不要用 placeholder 代替 label、提交按钮保持可点击并在 submit 时验证，错误文案直接说明用户下一步。
- Reo design system 优先：Eggshell 背景、Card White 表面、Obsidian/Cinder 正文、Gravel 辅助文字、Ember 错误、Signal Blue focus；输入控件保持 0 radius。
- `Input` 只能作为 shadcn/ui source-owned primitive 使用，不再包无 invariant 的二次 wrapper。
- Create form draft owner 是 React Hook Form；folder selection 的 `selectionToken/displayPath` 通过 RHF 字段参与验证，但只在 renderer 当前表单生命周期内存在。
- `displayPath` 只能用于展示，并且必须拒绝 `/` 或 `\`；`initializeWorkspace` request 只发送 `selectionToken/title/description`，`openWorkspace` request 只发送 `selectionToken`。
- `selectionToken` 是 main-owned one-shot capability；initialize/open 返回错误后 renderer 不得复用旧 token，create branch 只保留 title/description。
- Entry state 明确拆分 `idle`、`creating`、`opening`、`create-error`、`open-error`；open 错误不能覆盖 create draft。
- Create errors 显示为 create 分支：`conflict`、`permission`、`invalid`、`expired`。Open errors 显示为 open 分支：`missing`、`locked`、`corrupt`、`unsupported`。

## RED 目标

1. Submit 空表单时显示 title 与 folder validation，焦点回到 title，不通过 disabled button trap 阻止提交。
2. 打开现有 workspace 不清空 create draft，不显示 create conflict。
3. Create submit 只发送 `selectionToken/title/description`，不发送 `displayPath`、`folderPath` 或 raw path。
4. Open flow 只发送 `selectionToken`，成功后进入 loaded workspace state 并 seed snapshot。
5. OS dialog cancel 保留 create draft，焦点回到触发按钮。
6. Create `AGENTS.md` conflict 保留 title/description/folder selection，并显示 create error。
7. Open locked/missing/corrupt/unsupported 等错误显示为 open error，不清空 create draft。
8. `displayPath` 含 `/` 或 `\` 时不能进入 UI 展示或 submit payload。
9. Entry page 不显示未实现 future capability controls。

## 验证命令

RED/GREEN targeted：

```bash
npx vitest run src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/App.test.tsx
```

固定提交前门禁：

```bash
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
git status --short
```

## 停止条件

- 出现 unresolved BLOCKER/MAJOR。
- `docs/specs/*` 中出现非当前 task 的 active spec。
- 需要改 main process selection token、workspace lock 或 file transaction 才能继续；这些不属于 Task 3。
- shadcn input source 引入额外未证明的组件、依赖或样式面。
- 验证失败且无法在当前 entry flow 范围内通过 TDD 修复。

# 验证

## 初始状态

- Task 2 已归档并提交：`af0d16751d3ecb432369a35dc8213fd85f5c2444`。
- `git status --short --branch`：仅显示 `## feat/first-product-slice-impl`。
- `find docs/specs -mindepth 1 -maxdepth 1 -print` 在创建本 spec 前为空。

## RED/GREEN/REFACTOR 记录

- RED，2026-05-07 06:58 PDT：
  - `npx vitest run src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/App.test.tsx` FAIL。
  - 失败 1：`CreateWorkspaceForm.test.tsx` 无法 resolve `./WorkspaceEntryPage`，证明 entry page/open branch 尚不存在。
  - 失败 2：`App.test.tsx` 找不到 `Open workspace` button，证明当前 App entry 仍是 create-only。
- GREEN，2026-05-07 07:03 PDT：
  - 新增 `WorkspaceEntryPage`、`OpenWorkspaceAction`、`FolderPickerField`、`WorkspaceErrorBanner`。
  - 通过 `npx shadcn@4.7.0 add input` 引入 `components/ui/input.tsx`，并 retokenize 到 Reo input 规则，同批用于 create form。
  - `CreateWorkspaceForm` 改为 RHF + Zod submit-time validation；submit button 默认可点击，folder selection 写入 RHF `selectionToken/displayPath`，initialize request 不包含 `displayPath` 或 raw path。
  - App entry 改为 `WorkspaceEntryPage`，open branch 成功后进入 workspace loaded state。
  - `npx vitest run src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/App.test.tsx` PASS：2 个文件、12 个 tests 全部通过。
- `$ycksimplify` 后 RED，2026-05-07 07:11 PDT：
  - `npx vitest run src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/App.test.tsx` FAIL。
  - 新增 3 个 tests 失败：create folder picker pending 时重复点击发起 2 次 OS dialog；initialize error 后再次 submit 复用已消费 token；open action pending 时重复点击发起 2 次 OS dialog。
- `$ycksimplify` 后 GREEN/REFACTOR，2026-05-07 07:13 PDT：
  - 新增 `workspaceFolderSelection.ts`，集中 `chooseDirectory -> canceled/error -> safe displayPath` 选择边界。
  - `FolderPickerField` 和 `OpenWorkspaceAction` 加 pending guard；pending 期间 early return 并禁用当前按钮。
  - `CreateWorkspaceForm` 在 initialize failure 后清除 `selectionToken/displayPath`，保留 title/description；displayPath Zod schema 复用 `isSafeWorkspaceDisplayPath`。
  - `npx vitest run src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/App.test.tsx` PASS：2 个文件、15 个 tests 全部通过。
  - `npm run typecheck` PASS。
  - `npm run format:check` PASS。
- 固定门禁，2026-05-07 07:22 PDT：
  - `npm run verify:quick` PASS：typecheck、main 246、renderer 55、lint、format 全部通过。
  - `git diff --check` PASS，空输出。
  - `diff -u AGENTS.md .claude/CLAUDE.md` PASS，空输出。
  - `find docs/specs -mindepth 1 -maxdepth 1 -print` PASS，只列出 `docs/specs/2026-05-07-0656-first-product-slice-task-3-workspace-entry`。
- 归档后固定门禁，2026-05-07：
  - `npm run verify:quick` PASS：typecheck、main 246、renderer 55、lint、format 全部通过。
  - `git diff --check` PASS，空输出。
  - `diff -u AGENTS.md .claude/CLAUDE.md` PASS，空输出。
  - `find docs/specs -mindepth 1 -maxdepth 1 -print` PASS，空输出。

## 固定门禁

- Pending：
  - `npm run verify:quick`
  - `git diff --check`
  - `diff -u AGENTS.md .claude/CLAUDE.md`
  - `find docs/specs -mindepth 1 -maxdepth 1 -print`
  - `git status --short`

# Verification

## RED

- `npx vitest run src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/App.test.tsx`
  - RED 失败点 1：`AppShell` 找不到 `Switch to dark mode` icon-only button。
  - RED 失败点 2：点击创建 workspace 前后没有 `data-theme="dark"` 可断言。
  - RED 失败点 3：Workspace entry dialog 没有可访问 description 断言。
- 运行开发服务器时，Radix 输出 Dialog accessibility warning：`DialogContent` 未正确关联 `DialogTitle` / `DialogDescription`。根因是业务组件手写 `aria-describedby` 与 `id`，绕开了 Radix 自动关联的 title/description context。

## GREEN

- `src/renderer/src/app-shell/AppShell.test.tsx`
  - 覆盖 sidebar 左下角 `Switch to dark mode` / `Switch to light mode` 切换。
  - 覆盖 App shell 根节点 `data-theme` 从 `light` 切到 `dark`。
- `src/renderer/src/App.test.tsx`
  - 覆盖 starter shell 切到 dark 后创建 workspace，loaded shell 继续保持 dark。
  - 覆盖 document root `data-theme`，确保 Radix portal 继承当前主题。
  - 覆盖 Workspace entry dialog 的 role/name/description。
- Dialog 实现改为让 Radix `DialogTitle` / `DialogDescription` 自动生成并关联 `aria-labelledby` / `aria-describedby`，不再手写冲突 id。
- 深色模式通过 Reo token 覆盖实现，未新增 ThemeProvider、localStorage、matchMedia、Zustand 或业务级暗色 class。

## Runtime

- 使用 Computer Use 运行 `npm run dev` 后完成实际操作验证：
  - 默认进入浅色 App shell，sidebar 左下角按钮为 `Switch to dark mode`。
  - 点击后切到深色，按钮变为 `Switch to light mode`，App shell、content panel、Workspace entry dialog 和 overlay surface 均使用深色 token。
  - 打开 create workspace dialog 时没有 Radix accessibility warning。
  - 通过系统 folder picker 创建 `/private/tmp/reo-task5-create-runtime` workspace 后，loaded Home 保持 dark theme。
  - 再次点击 theme toggle 可切回浅色。

## Final

- `node -e "JSON.parse(require('fs').readFileSync('docs/current/design-system/tokens.json','utf8')); console.log('tokens json ok')"`：PASS。
- `npx prettier --write src/renderer/src/theme.css docs/current/design-system/theme.css docs/current/design-system/variables.css docs/current/design-system/DESIGN.md docs/current/design-system/tokens.json`：PASS。
- `npm run typecheck`：PASS。
- `npm run lint`：PASS。
- `npm run format:check`：PASS。
- `npx vitest run src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx src/renderer/src/components/ui/button.test.tsx`：PASS，4 files / 17 tests。
- `npm run verify:quick`：PASS，main 247 tests、renderer 69 tests、typecheck、lint、format 全部通过。
- `git diff --check`：PASS，无 whitespace error。
- `diff -u AGENTS.md .claude/CLAUDE.md`：PASS，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：归档前仅输出本 spec；归档后 workspace 根目录应无 active spec。
- `npm run build`：PASS，main/preload/renderer production build 完成。

## 归档后回归

- 归档后再次运行 `npm run verify:quick` 时发现 renderer 全量测试失败：`App.test.tsx` 点击 sidebar 主题按钮触发 Radix Tooltip Popper，jsdom 缺少 `ResizeObserver`，导致 `Workspace content` main 被卸载。
- 修复：在 `src/renderer/src/test/setup.ts` 增加最小 `ResizeObserver` 测试替身；这是 jsdom 测试环境补齐浏览器 API，不进入产品 runtime。
- 该失败发生后已把 spec 从 archive 移回 `docs/specs/`，修复并重新验证后再归档。
- `npx vitest run src/renderer/src/App.test.tsx`：PASS，1 file / 5 tests。
- `npm run test:renderer`：PASS，12 files / 69 tests。
- `npm run typecheck`、`npm run lint`、`npm run format:check`：PASS。
- 修复后重新运行 `npm run verify:quick`：PASS，main 247 tests、renderer 69 tests、typecheck、lint、format 全部通过。

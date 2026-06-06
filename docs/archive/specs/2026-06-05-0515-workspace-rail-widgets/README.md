# M3 Workspace Rail Widgets

## Goal

在 M2 shared generative runtime 基础上，为 Workspace 级 widget 建立首个真实挂载点：右侧 rail 与记忆列表并列的 tab 区。widget 使用同一 HTML bundle / state / bridge 能力，但属于当前记忆空间，不属于某个 Memory、Segment 或 SegmentSupplement。

## Success Criteria

- Workspace root 下的 `widgets/` 文件真源可以被扫描、投影、排序、删除/恢复和进入 needs-review。
- 现有作品 preview URL 从 `reo-artifact://` 改为 `reo-render://`，并扩展到 workspace widget；底层命名表达“agent-created UI render host”，不占用未来 AI runtime 概念。
- 右侧 rail 打开后显示单个 `新增` 菜单、中段横向 tab strip、折叠按钮；`新增` 菜单承载 `新建记忆` 和 `新建 Widget`，中段包含记忆列表 icon 与 widget icon，widget tab 支持拖拽排序和 hover more 菜单。
- 同一时间只挂载当前 rail tab：记忆列表或一个 widget。关闭 rail 或切 tab 会卸载 widget iframe；长期状态只依赖 `state.json`。
- `新建 Widget` 只复制创建 prompt，不创建空对象；首个推荐目标是 Workspace 总览 widget。
- widget bridge 支持 workspace read、state read/write、agent prompt、title update，以及窄 `ui.selectMemory({ memoryId })` host action；该 action 只切换主内容当前 Memory，不切换 rail tab。
- widget icon 默认使用 Reo 本地图标；可选 `assets/icon.svg` 作为单色 mask，缺失或损坏回退默认图标。

## Decisions

- **Owner**: widget 是 Workspace-level side-rail object，属于当前 memory space。
- **Storage**: user-visible source 放在 `widgets/<widget-id--title>/widget.md`，bundle 为同目录 `entry.html`、`runtime.json`、`state.json`、`assets/`；`.reo` 只保存 Reo-managed manifest/order/trash。
- **Declaration**: `widget.md` 显式声明 `kind: widget`、`format: html`、`mount: workspace-rail`。unsupported mount 进入 needs-review。
- **Ordering**: widget tab 顺序可拖拽，持久化在 `.reo/workspace.json` 的 Workspace-level presentation field，并和 `widgets/` 文件真源归一化。
- **Lifecycle**: session 内记住当前 rail tab；切换或重新打开 workspace 时默认回到记忆列表。
- **Faults**: 新候选缺字段、unsupported mount、缺失或过大 entry 进入 needs-review；已识别 widget 入口后续损坏仍显示 tab，点开诊断面。
- **Menu**: widget tab more 菜单提供刷新页面、让 Agent 更新、重命名、删除/恢复、Finder/open/copy path；不做 settings panel。
- **Overflow**: `新增` 菜单和折叠按钮固定，中段 tab strip 横向滚动。
- **Default widget**: M3 不自动写用户文件；`新建 Widget` prompt 推荐创建 Workspace 总览。

## Plan

1. 将 artifact render scheme 改名为 `reo-render://`，保留作品能力并同步 CSP、parser、protocol resolver、tests、current docs。
2. 建立 Workspace widget contract：schema/projection、file scan、needs-review、runtime target directory、state read/write、prompt-copy、title/path actions、delete/restore。
3. 扩展 snapshot projection，返回 widgets summary/order，并把 widget order 写入 `.reo/workspace.json`。
4. 改造右侧 rail header 为 fixed actions + scrollable tab strip，复用 content tab rail 的 hover more 交互。
5. 挂载当前 widget iframe，复用 shared render bridge，增加 widget context 和 `ui.selectMemory`。
6. 生成/更新 `reo-generative-runtime` 与作品相关 skill 文案，加入 widget 创建/更新 prompt 和 Workspace 总览模板。
7. 增加 focused unit/integration tests，再做 runtime 视觉/交互验证，最后运行 `npm run verify:quick`。

## Verification

- `npm run typecheck:quick`
- `MAIN_TEST_FILES=test/main/workspaceIpc.test.ts npm run test:main`
- `MAIN_TEST_FILES=test/main/artifactRuntimeIpc.test.ts npm run test:main`
- `MAIN_TEST_FILES=test/main/artifactProtocol.test.ts npm run test:main`
- `MAIN_TEST_FILES=test/main/appProtocol.test.ts npm run test:main`
- `MAIN_TEST_FILES=test/main/securityPolicy.test.ts npm run test:main`
- `MAIN_TEST_FILES=test/main/workspaceWidgets.test.ts npm run test:main`
- `MAIN_TEST_FILES=test/main/workspaceFiles.test.ts npm run test:main`
- `MAIN_TEST_FILES=test/main/workspaceBridgeSurface.test.ts npm run test:main`
- `npm run test:renderer -- src/renderer/src/workspace/artifactRuntimeBridge.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`
- `npm run test:renderer -- src/renderer/src/workspace/workspaceApi.test.ts src/renderer/src/workspace/WorkspaceTitlebar.test.tsx`
- `npm run test:renderer -- src/renderer/src/devWorkspaceScenario.test.tsx`
- Runtime visual check: local Electron verification shell loaded `http://localhost:5184/?reoScenario=memory-studio-rich`, expanded right rail, selected `Workspace 总览 Widget`, and asserted the `新增` menu, tab strip, selected widget tab, widget panel, MemoryRail unmount, no document overflow, and bounded icon/button sizes. Evidence: `artifacts/widget-rail-runtime.png` and `artifacts/widget-rail-runtime.json`。
- Final gate: `npm run verify:quick`。

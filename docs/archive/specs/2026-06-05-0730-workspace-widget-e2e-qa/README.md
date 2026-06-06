# Workspace Widget E2E QA

Timezone: America/Los_Angeles

## Goal

对 M3 Workspace Widget 做真实 Electron E2E 验证，并修复验证中发现的问题。验证必须从用户真实点击全局 `新增` 菜单并选择 `新建 Widget` 复制 prompt 开始，并使用 Codex CLI 以普通用户短句创建 widget，不使用测试式或工程式 prompt。

## State Machine

### S1 Prompt Copy

State: rail collapsed -> rail expanded -> `新增` menu opened -> `新建 Widget` selected -> system clipboard contains main-owned create-widget prompt.

Invariants:

- Selecting `新增 -> 新建 Widget` 不创建空 widget 文件。
- Clipboard prompt 不含 raw absolute path，不由 renderer 提供 prompt 字符串。
- Prompt 对普通用户需求可用，且使用 `widget` 命名。
- Titlebar 不再暴露独立 `+ Widget` 按钮；新增 Memory 和新增 Widget 由同一个 `+` 菜单承载。

### S2 Agent Writes Widget

State: copied prompt -> user sends short ordinary request to Codex CLI -> Codex writes `widgets/<id--title>/widget.md`, `entry.html`, `runtime.json`, `state.json`, optional `assets/`.

Invariants:

- Codex CLI prompt 模拟普通用户：短句、非工程术语、非测试意图。
- 写入只发生在当前 workspace 用户文件区，不写 `.reo` 技术真源。
- `widget.md` 声明 `kind: widget`、`format: html`、`mount: workspace-rail`。

### S3 File Truth Convergence

State: widget files appear -> Reo refresh/file watcher -> Workspace snapshot contains ready widget projection.

Invariants:

- `.reo/workspace.json.widgetTabOrder` 只保存 durable presentation order。
- 无 unresolved needs-review entry。
- `entry.html` / `runtime.json` / assets 变化会改变 preview version；`state.json` 变化不改变 preview version。

### S4 Runtime Mount And Size

State: rail expanded -> widget tab selected -> iframe mounted -> widget visible -> switch to Memory list/collapse -> iframe unmounted.

Invariants:

- Widget iframe 只在 active widget tab 且 rail expanded 时存在。
- Widget panel 尺寸受右侧 rail 约束，不造成 document overflow，不遮挡 titlebar 或主内容。
- Widget 可调用 bridge read/state/ui action；`ui.selectMemory` 只切主内容 Memory，不切走 widget tab。

### S5 Managed Skills And AGENTS

State: initialize/open workspace -> managed AGENTS block and skills installed/updated.

Invariants:

- Workspace `AGENTS.md` 默认托管块提到 widget 创建/更新入口。
- `skills/reo-generative-runtime` 明确包含 widget 文件合同、rail mount、bridge 和验证脚本。
- 打开已有 workspace 会补齐托管内容但保留用户自定义 AGENTS 内容。

## Scenarios

1. Real Electron click: expand rail, open `新增`, select `新建 Widget`; assert clipboard prompt side effect and no widget directory side effect.
2. Codex CLI write: feed copied prompt plus ordinary user request, then assert widget files and schema.
3. Reo convergence: refresh/open runtime, assert snapshot projection, tab order, needs-review, preview version behavior.
4. UI mount: click widget tab, measure panel, iframe, overflow, switching/collapse unmount, `ui.selectMemory`.
5. Managed workspace files: initialize/open workspace and assert AGENTS + skills contain widget guidance.

## Verification Log

### 2026-06-05

Workspace under test:

- `/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试`
- Workspace id: `ws_9c3f83a8-cb51-4c35-923f-0b68be4753ee`

Focused RED/GREEN:

- RED: `WorkspaceTitlebar.test.tsx` caught the filled `bg-secondary/45` rail strip and missing widget icon fallback.
- GREEN: `WorkspaceTitlebar.tsx` now keeps `workspace-rail-tab-strip` transparent, embeds Widget More inside the widget tab item, and renders a visible fallback icon.
- RED: `App.test.tsx -t "projects externally created workspace widgets"` caught `sameWorkspaceSnapshot` ignoring widgets, which prevented file-truth refresh from projecting externally created widgets.
- GREEN: `App.tsx` now compares widget projection length, order, icon and runtime fields.
- RED: `workspaceFiles.test.ts` caught missing `memory.memoryId` guidance after E2E exposed a generated widget that used `memory.id`.
- GREEN: managed `reo-generative-runtime` skill/reference and `copyWidgetAgentPrompt` now state that `workspace.memories` uses `memory.memoryId`, not `memory.id`.

Real UI / E2E evidence:

- `node .tmp/workspace-widget-e2e.mjs --scenario prompt-copy ...`
  - Artifact: `artifacts/test-workspace-prompt-copy-memoryid/`
  - Result: clipboard first line `# 创建一个 Reo Workspace 侧栏 Widget`; contains `kind: widget`, `format: html`, `mount: workspace-rail`, `widgets root: \`widgets\``, and `memory.memoryId` rule.
  - Side effect: widget file list unchanged after clicking `+ Widget`.
- Codex CLI create run used ordinary user wording: “帮我在右边加一个小面板，能看见记忆列表，点一下能打开。”
  - Created `widgets/wdg_20260605081953_a60052a6--Workspace-总览/`.
  - Independent `validate-runtime` and `reo-doctor` passed.
- `node .tmp/workspace-widget-e2e.mjs --scenario widget-update-prompt-copy ...`
  - Artifact: `artifacts/test-workspace-widget-update-prompt/`
  - Copied update prompt from real Widget More menu; contains widget directory and `memory.memoryId` rule.
- Codex CLI update run used ordinary user wording: “右边这个小面板里能看到记忆，但点不开。帮我把它修好，顺便别让界面空白。”
  - Updated `entry.html` to use `memory.memoryId` and preserve nonblank fallback states.
  - `validate-runtime`: ok, no issues.
  - `inspect-runtime`: ok, `usesBridge: true`, assets include `icon.svg`.
  - `reo-doctor`: ok, no issues.
- `node .tmp/workspace-widget-e2e.mjs --scenario widget-mount ...`
  - Artifact: `artifacts/test-workspace-widget-mount/`
  - Verified state machine S1-S5:
    - Rail strip background transparent; no `bg-secondary/45`, no padded filled shell.
    - More is hidden by default (`aria-hidden=true`, `tabindex=-1`, opacity <= 0.05, width <= 1), then hover reveals it inside the widget tab (`tabindex=0`).
    - Widget iframe mounts at `reo-render://widget-.../widgets/wdg_20260605081953_a60052a6/entry.html`.
    - Panel rect `239x752` converges with rail rect `240x752`; document/body scroll width stays `1200`.
    - Widget clicked `mem_20260519032914_666583be`, changing `state.json` from previous `mem_20260517063940_89533fee`.
    - Titlebar switched to `碎片记录` while widget tab stayed selected and iframe stayed mounted.
    - Switching to Memory tab unmounted iframe; switching back remounted it.

Targeted tests:

- `npm run test:renderer -- src/renderer/src/workspace/WorkspaceTitlebar.test.tsx`: pass, 4 tests.
- `npm run test:renderer -- src/renderer/src/App.test.tsx -t "projects externally created workspace widgets"`: pass, 1 test.
- `MAIN_TEST_FILES=test/main/workspaceFiles.test.ts npm run test:main`: pass, 63 tests.

### 2026-06-05 latest feedback pass

Focused RED/GREEN:

- RED: `WorkspaceTitlebar.test.tsx` caught the old split create actions (`新建记忆` plus standalone `新建 Widget`) and the widget More reveal using `ml-[6px]`.
- GREEN: titlebar actions now expose one icon-only `新增` menu with `新建记忆` and `新建 Widget`; right rail tabs render only after rail expansion; widget More reveal uses `ml-[2px]` and stays embedded inside the tab pill.
- GREEN: `TooltipProvider` defaults `disableHoverableContent=true`, so tooltip content no longer keeps the hover popover alive after the pointer leaves the trigger.
- RED: `workspaceFiles.test.ts` caught missing narrow-text guidance in managed `reo-generative-runtime`.
- GREEN: runtime skill, `templates.md`, validation reference, and widget agent prompts now require `min-width: 0`, `text-overflow: ellipsis`, `white-space: nowrap`, and `overflow-wrap: anywhere`.

Real UI / E2E evidence:

- `node .tmp/workspace-widget-e2e.mjs --scenario prompt-copy ...`
  - Artifact: `artifacts/latest-prompt-copy/`
  - Collapsed projection: no rail tab strip, global `新增` present, standalone `新建 Widget` absent.
  - Expanded projection: memory tab present, global `新增` present, standalone `新建 Widget` absent.
  - Clipboard first line `# 创建一个 Reo Workspace 侧栏 Widget`; contains widget contract, `memory.memoryId`, and responsive text rule; no absolute path or component terminology; widget file list unchanged.
- `node .tmp/workspace-widget-e2e.mjs --scenario tooltip-exit ...`
  - Artifact: `artifacts/latest-tooltip-exit/`
  - Hover over rail toggle showed tooltip; moving pointer off the trigger unmounted it in 163ms.
- `node .tmp/workspace-widget-e2e.mjs --scenario widget-update-prompt-copy ...`
  - Artifact: `artifacts/latest-widget-update-prompt/`
  - Real Widget More menu copied update prompt with widget directory, `memory.memoryId`, and responsive text rule; no absolute path or component terminology.
- `node .tmp/workspace-widget-e2e.mjs --scenario widget-mount ...`
  - Artifact: `artifacts/latest-widget-mount/`
  - Rail strip remains transparent; widget icon fallback visible; More hidden by default and hover-revealed inside tab with `group-hover/widget-tab:ml-[2px]`.
  - Widget panel rect `239x752` converges with rail rect `240x752`; host document/body scroll width remains `1200`.
  - Widget iframe text projection at width `239`: document/body scroll width `239`; `.memory-main` min-width `0px` and overflow hidden; `.memory-title`/`.memory-meta` are block ellipsis nowrap; status uses `overflow-wrap:anywhere`.
  - Widget selected a different Memory and persisted `stores.ui.lastSelectedMemoryId` in `state.json`; Memory tab switch unmounted iframe and widget tab switch remounted it.

### 2026-06-05 widget icon expand flash pass

Focused RED/GREEN:

- RED: `WorkspaceTitlebar.test.tsx` caught custom widget icons leaving a blank icon slot while the custom `<img>` was still loading.
- GREEN: custom widget icons now reserve the same 16px icon slot, show the fallback icon while the custom image is pending, then switch to the custom image without opacity transition once it loads.

Real UI / E2E evidence:

- `node .tmp/workspace-widget-e2e.mjs --scenario widget-icon-expand ...`
  - Artifact: `artifacts/latest-widget-icon-expand-no-blank/`
  - State machine: collapsed rail -> click expand -> sample widget icon DOM for 500ms.
  - Result: 54 samples; every mounted sample had exactly one visible icon: fallback while custom was pending, custom after load.

### 2026-06-05 final Widget QA pass

Focused RED/GREEN:

- RED: `WorkspaceTitlebar.test.tsx` caught Memory rail tab missing the same outer shell as Widget tabs.
- GREEN: Memory tab and Widget tabs now share `group/rail-tab` outer shell; active/hover/focus fill lives on the shell, and inner tab buttons stay transparent.
- RED: `test/main/securityPolicy.test.ts` caught app-shell CSP blocking `reo-render:` images for custom Widget icons.
- GREEN: production and development `img-src` now include `reo-render:` while `connect-src` still does not.
- RED: `workspaceIpc.test.ts` caught create-widget prompt missing `AGENTS.md`.
- GREEN: Widget prompt now explicitly tells Codex to read current `AGENTS.md` before runtime/design skills and stays on Widget terminology.

Real UI / E2E evidence:

- `node .tmp/workspace-widget-e2e.mjs --scenario prompt-copy ...`
  - Artifact: `artifacts/latest-prompt-copy-after-agents/`
  - Clipboard first line `# 创建一个 Reo Workspace 侧栏 Widget`; contains `AGENTS.md`, widget contract, `memory.memoryId`, responsive text rules; no absolute path, no component/组件 terminology; widget file list unchanged.
- `node .tmp/workspace-widget-e2e.mjs --scenario widget-update-prompt-copy ...`
  - Artifact: `artifacts/latest-widget-update-prompt-after-agents/`
  - Real Widget More menu copied update prompt with `AGENTS.md`, widget directory, `memory.memoryId`, and responsive text rules; no absolute path, no component/组件 terminology.
- `node .tmp/workspace-widget-e2e.mjs --scenario widget-mount ...`
  - Artifact: `artifacts/latest-widget-mount-after-rail-shell/`
  - Widget panel rect `239x752` converged with rail rect `240x752`; runtime document/body scroll width `239`; selected Memory persisted to `state.json`.
- `node .tmp/workspace-widget-e2e.mjs --scenario widget-icon-expand ...`
  - Artifact: `artifacts/latest-widget-icon-expand-no-blank/`
  - Result: 54 samples; no blank icon slot, no frame with custom and fallback both visible.
- `node .tmp/workspace-widget-e2e.mjs --scenario tooltip-exit ...`
  - Artifact: `artifacts/latest-tooltip-exit-final/`
  - Tooltip unmounted 164ms after pointer left the rail toggle trigger.
- `node .tmp/workspace-widget-e2e.mjs --scenario multi-widget-icons ...`
  - Artifact: `artifacts/latest-multi-widget-after-codex/`
  - Three Widget tabs projected: `Workspace 总览 Widget`, `第二个 Widget Widget`, `今日空间总览 Widget`; every tab loaded custom icon with `naturalWidth: 150`, no fallback, More hidden by default and revealed on hover.
- `node .tmp/workspace-widget-e2e.mjs --scenario rail-tab-motion ...`
  - Artifact: `artifacts/latest-rail-tab-motion-final/`
  - Expand samples projected Memory tab and three Widget tabs together in the same unfilled strip; collapse samples unmounted strip, Memory tab, and Widget tabs together with no partial projection.

### 2026-06-05 Widget reorder model pass

Focused RED/GREEN:

- RED: `WorkspaceTitlebar.test.tsx -t "reorders Widget tabs"` caught Widget tab reorder using drop-only target insertion instead of the content tab rail model.
- GREEN: Widget tabs now use the same before/after midpoint model as the main content tab rail: dragOver projects local pending order, drop does not commit, and dragEnd submits the durable order.
- RED: `App.test.tsx -t "submits consecutive Widget tab reorder gestures"` covers a second reorder while the first write is still pending.
- GREEN: Widget reorder no longer uses the global workspace action gate; later reorder mutations are not dropped, and stale earlier responses cannot overwrite the latest order.

Real UI / E2E evidence:

- `node .tmp/workspace-widget-e2e.mjs --scenario widget-reorder ...`
  - Artifact: `artifacts/latest-widget-reorder/`
  - State machine: expanded rail with three Widget tabs -> drag third Widget before first -> UI projection changes -> `.reo/workspace.json.widgetTabOrder` persists first order -> drag remaining Widget before the moved Widget -> UI and metadata converge to the second order.
  - Invariants: Widget id set unchanged; UI tab order and metadata order converge after each drag; only durable side effect is `.reo/workspace.json.widgetTabOrder`.
  - Final order: `wdg_20260605095155_99c581bf`, `wdg_20260605093400_b7c3d9e1`, `wdg_20260605081953_a60052a6`.

Codex CLI dogfood:

- UI copied create-widget prompt, then Codex CLI was invoked with ordinary user wording: “我想要一个右侧小工具，打开后能看到今天这个空间的大概情况，最近的记忆放前面，点名字可以跳过去。样式清爽一点就好。”
- Codex CLI read `AGENTS.md`, `skills/reo-generative-runtime/SKILL.md`, runtime references/scripts, `skills/reo-works-design/SKILL.md`, and design references before writing files.
- Codex CLI created `widgets/wdg_20260605095155_99c581bf--今日空间总览/` with `widget.md`, `entry.html`, `runtime.json`, `state.json`, and `assets/icon.svg`.
- Independent validation:
  - `node skills/reo-generative-runtime/scripts/validate-runtime.mjs widgets/wdg_20260605095155_99c581bf--今日空间总览`: ok, no issues.
  - `node skills/reo-doctor/scripts/reo-doctor.mjs`: ok, no issues.
- `node .tmp/workspace-widget-e2e.mjs --scenario codex-widget-projection ...`
  - Artifact: `artifacts/latest-codex-widget-projection/`
  - Codex-created Widget tab appeared from file truth with custom icon; mounted iframe src contained `wdg_20260605095155_99c581bf`; runtime width `239` had no horizontal overflow; clicking a Memory wrote `stores.ui.lastSelectedMemoryId` in that Widget `state.json` and switched host titlebar.

### 2026-06-05 reorder double-model and copied-prompt pass

Focused RED/GREEN:

- RED: `App.test.tsx -t "rolls back failed consecutive Widget reorders to the last confirmed file-truth order"` reproduced the high-risk branch behind “先显示无法调整，再调整成功”: a stale/failed earlier reorder could fight with a later successful reorder baseline.
- GREEN: `App.tsx` now keeps a per-workspace Widget reorder baseline with mutation ids. Stale failures do not show a toast or roll back the latest started mutation; the latest failure rolls back only to the last confirmed file-truth order.
- GREEN: `WorkspaceTitlebar.tsx` clears pending Widget order before calling `onReorderWidgets`, closing the reentrant drag-end window.
- RED/GREEN: `workspaceWidgets.test.ts` now fails closed when duplicate `widget.md` ids exist; `workspaceWidgets.ts` no longer resolves an arbitrary first duplicate.
- GREEN: `workspaceFiles.ts` preserves current `widgetTabOrder` when title metadata writes race with Widget order persistence.

Subagent review/ycksimplify findings addressed:

- Widget reorder was aligned to the main content tab rail model: dragOver projects pending order, drop does not commit, dragEnd submits.
- Main Widget order persistence no longer scans widgets twice for the successful return path.
- Duplicate Widget ids now surface as needs-review style failure instead of mutating an arbitrary duplicate directory.
- Current docs were corrected: Widget projection no longer documents a non-existent `summary`, and quality guidance names the unified `新增 -> 新建记忆` entry.

Codex CLI copied-prompt dogfood:

- Real UI copied the create-widget prompt from `新增 -> 新建 Widget`, saved at `artifacts/latest-runtime/prompt-copy.txt`.
- Codex CLI was invoked with that copied prompt plus ordinary user wording: “帮我做一个很小的提醒 Widget，看看最近有没有要处理的事，窄一点也别挤在一起。图标也简单做一个。”
- Codex CLI read workspace `AGENTS.md`, `skills/reo-generative-runtime/SKILL.md`, runtime references/scripts, `skills/reo-works-design/SKILL.md`, and design references.
- Codex CLI created `widgets/wdg_20260605195958_6d9db460--待处理提醒/` with `widget.md`, `entry.html`, `runtime.json`, `state.json`, and `assets/icon.svg`.
- Codex CLI validation passed:
  - `node skills/reo-generative-runtime/scripts/validate-runtime.mjs widgets/wdg_20260605195958_6d9db460--待处理提醒`: ok, no issues.
  - `node skills/reo-generative-runtime/scripts/inspect-runtime.mjs widgets/wdg_20260605195958_6d9db460--待处理提醒`: ok, `usesBridge: true`, assets include `icon.svg`.

Real UI / E2E evidence in `/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试`:

- `node .tmp/workspace-widget-e2e.mjs --scenario prompt-copy ...`
  - Artifact: `artifacts/latest-runtime/prompt-copy-result.json`
  - Collapsed rail has no tab strip; expanded rail has Memory tab plus Widget tabs; titlebar exposes one global `新增` menu and no standalone `新建 Widget` button.
  - Clipboard prompt contains `AGENTS.md`, Widget contract, `memory.memoryId`, responsive text rules; no absolute path, no component/组件 terminology; widget file list unchanged after click.
- `node .tmp/workspace-widget-e2e.mjs --scenario widget-update-prompt-copy ...`
  - Artifact: `artifacts/latest-runtime/widget-update-prompt-result.json`
  - Real Widget More menu copied update prompt with widget directory, `AGENTS.md`, `memory.memoryId`, responsive text rules; no absolute path or component terminology.
- `node .tmp/workspace-widget-e2e.mjs --scenario copied-prompt-widget-projection ...`
  - Artifact: `artifacts/latest-runtime/copied-prompt-widget-projection-result.json`
  - New `待处理提醒 Widget` was projected from file truth with custom icon visible and fallback opacity `0`; iframe rect `239x752` stayed inside rail rect `240x752`; host scroll width stayed `1200`.
  - Runtime width `239` had no horizontal overflow; reminder text used `overflow-wrap:anywhere`, memory title used ellipsis; clicking a reminder changed `state.json` progress from `0` to `1`; clicking Memory wrote `stores.ui.lastSelectedMemoryId` and kept the Widget tab mounted.
- `node .tmp/workspace-widget-e2e.mjs --scenario widget-reorder ...`
  - Artifact: `artifacts/latest-runtime/widget-reorder-result.json`
  - Four Widget tabs were projected. Two reorder gestures converged UI order and `.reo/workspace.json.widgetTabOrder` to the same four-id order; no “无法调整 Widget 顺序” toast was observed.
  - CDP cannot monkey-patch `window.reoWorkspace.updateWidgetTabOrder` because preload exposes it as non-writable/non-configurable; E2E therefore asserts visible toast absence, UI projection, and metadata convergence, while focused renderer tests cover stale failure branches.
- `node .tmp/workspace-widget-e2e.mjs --scenario multi-widget-icons ...`
  - Artifact: `artifacts/latest-runtime/multi-widget-icons-result.json`
  - Four Widget tabs loaded custom icons with `naturalWidth:150`; fallback DOM remained but opacity `0`; each tab revealed only its embedded More action on hover.
- `node .tmp/workspace-widget-e2e.mjs --scenario widget-icon-expand ...`
  - Artifact: `artifacts/latest-runtime/widget-icon-expand-result.json`
  - Expand sampling saw fallback visible while custom icon was pending, then custom visible with fallback opacity `0`; no blank icon slot and no visible overlap.
- `node .tmp/workspace-widget-e2e.mjs --scenario rail-tab-motion ...`
  - Artifact: `artifacts/latest-runtime/rail-tab-motion-result.json`
  - Memory tab and all Widget tabs mount together in one transparent strip and unmount together on collapse; active/hover fill belongs to shared rail tab shells.
- `node .tmp/workspace-widget-e2e.mjs --scenario tooltip-exit ...`
  - Artifact: `artifacts/latest-runtime/tooltip-exit-result.json`
  - Tooltip unmounted about `160ms` after pointer left the rail toggle trigger.

Targeted verification:

- `npm run test:renderer -- src/renderer/src/App.test.tsx -t "Widget"`: pass, 2 tests.
- `npm run test:renderer -- src/renderer/src/workspace/WorkspaceTitlebar.test.tsx`: pass, 6 tests.
- `MAIN_TEST_FILES=test/main/workspaceWidgets.test.ts npm run test:main`: pass, 12 tests.
- `MAIN_TEST_FILES=test/main/workspaceIpc.test.ts npm run test:main -- --test-name-pattern "updateMemorySpaceTitle"`: pass, 7 tests.
- `npm run typecheck:quick`: pass.

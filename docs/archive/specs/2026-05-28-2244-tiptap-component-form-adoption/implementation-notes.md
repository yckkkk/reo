# Implementation Notes — Tiptap 组件形态收敛

实施过程中的运行记录：每个 Phase 完成后追加实际改动、验证输出、视觉验证结论与偏离计划之处。

## 关键技术约束（实施时务必遵守）

- 阴影 canonical 值必须在 `tokens.json` / `variables.css` / 两份 `theme.css` / contract test **五处逐字一致**；renderer 与 mirror `theme.css` 由 `designSystemTokens.test.ts` 强制相等。
- `reo-float-motion`（transform-based）**只**用于 popper 定位浮层（Dropdown/Tooltip）；自居中的 Dialog/AlertDialog 用 `reo-fade-motion`（opacity-only），否则会覆盖 `translate(-50%,-50%)` 居中。
- 6px / 18px 无设计系统 token，用 component-local 任意值 `p-[6px]` / `rounded-[18px]`；不新增全局 token。
- `chromeCss` 断言要求 Tiptap chrome 仍含 `var(--shadow-float)`——tooltip.scss 已满足，勿删。

## Phase 进度

- [x] Phase 0 · 共享 elevation token
- [x] Phase 1 · Tier 1 Dropdown + Tooltip + 动效（含视觉签收 gate）
- [x] Phase 2 · Tier 2 Dialog/AlertDialog fade + 阴影继承验证
- [x] Phase 3 · Tier 3 Button 文本按钮圆角
- [x] Phase 4 · 文档 change gate + 收口归档

## 范围调整

- **2026-05-28 用户追加要求：corner-shape squircle**。所有本任务触碰的圆角都用 squircle 让圆角更流畅。实现：把现有 `@utility reo-card-squircle { corner-shape: squircle }` **泛化重命名为 `reo-squircle`**（纯 corner-shape 工具，名字更准），更新唯一源 consumer `card-surface.tsx` + 4 处测试断言（`MemoryRail.test`、`LoadedWorkspaceFrame.test` ×3）；然后 `reo-squircle` 应用到 dropdown content+item、tooltip、dialog/alert-dialog content、Button base。`reo-segment-card-squircle`（bundle 了 clamp radius）保持不动。Phase 4 文档需把 squircle 写入 frontend.md / DESIGN.md。
- **2026-05-28 Phase 1 视觉复查**：第一轮 Phase 1 已对齐外层 chrome / motion / squircle，但 Reo `DropdownMenuItem` 仍是 `text-ui-xs font-regular`，没有对齐 Tiptap menu item 实际继承的 `tiptap-button` 形态（14px / 500 / 1.15 line-height / 32px height / 12px radius）。Reo `TooltipContent` 也仍是 `text-caption` 10px，低于 Tiptap tooltip 的 12px / 500。修正方向：共享 Reo dropdown item 改为 `text-body font-medium leading-[1.15]`，tooltip pill 改为 `text-ui-sm font-medium leading-[1.2]`，仍保持 Reo token owner 与 no-arrow 设计。
- **2026-05-29 Phase 1 圆角共存复查**：不能只看 `DropdownMenuItem` 自身。sidebar 菜单触发器的 open/hover 填充由 Reo `Button` primitive 承担；Tiptap dropdown item / popover 内部选中填充由 `.tiptap-button`、`.tiptap-card`、`.tiptap-tooltip` 等 editor primitive 承担。为避免同一浮层家族内 squircle 与旧 round 共存，本轮只补 `corner-shape: squircle` / `reo-squircle`，不改变半径阶梯或品牌语义。
- **2026-05-29 Phase 1 菜单字号与 sidebar 激活态复查**：用户复查指出 sidebar 列表项激活态存在两套填充样式，且 Reo / Tiptap 下拉菜单字体偏大偏粗。最终收敛为：sidebar 首页、资料库和记忆空间 active row 均使用 `bg-secondary text-foreground`、12px radius 和 squircle；Reo `DropdownMenuItem` 与 Tiptap dropdown item 均使用 13px / 500 / 1.15 / 32px。

## 运行记录

- **Phase 0（token）**：5 处阴影源（tokens.json / variables.css / 两份 theme.css / contract test）改为多层 elevation 并逐字一致；`--tt-shadow-elevated-md` 改为 `var(--shadow-float)`（编辑器观感不变）。`test:main` 926/926 绿（含 mirror-sync 与 shadow contract），`typecheck:quick` 绿；已通过前序 `verify:quick` 并提交。
- **Phase 1 复查修正（dropdown/tooltip 字体）**：TDD 判断为视觉 primitive class/token 调整，属于当前质量规则豁免面；用现有 primitive 行为断言 + 新增 tooltip primitive 断言 + runtime 视觉验证替代。Root cause 是第一轮只同步了外层 chrome，没有同步 Tiptap item/tooltip 的实际 typography。
- **Phase 1 复查修正（圆角 owner）**：运行时采样确认 Reo sidebar 菜单 item 已是 `12px` + `corner-shape: squircle`，但 sidebar 菜单触发器 open 填充仍是 Button base 的旧 `round`，且 Tiptap dropdown/popover 内部 button/card/tooltip/input 仍未带 squircle。修正为：Reo `Button` base 加 `reo-squircle`；Tiptap floating primitive 保留原半径值，只补 `corner-shape: squircle`，消除新旧圆角形态共存。
- **Phase 1 targeted verification**：`npm run test:renderer -- dropdown-menu tooltip button AppShell` 通过（6 files / 34 tests）；`npm run typecheck:quick` 通过。
- **Phase 1 runtime 视觉证据**：dev renderer `http://localhost:5183/?reoScenario=memory-studio-rich` 采样 dark/light；截图写入 `artifacts/dark|light-sidebar-dropdown.png`、`dark|light-tiptap-dropdown.png`、`dark|light-reo-tooltip.png`、`dark|light-tiptap-popover.png`；computed style 写入 `artifacts/phase1-runtime-evidence.json`。关键值：Reo sidebar menu item `12px / squircle / 14px / 500 / 32px`，Tiptap dropdown item `12px / squircle / 14px / 500`，Reo tooltip `8px / squircle / 12px / 500 / no arrow`，Tiptap popover card `18px / squircle`。
- **Phase 1 final sidebar/menu runtime 证据**：用户复查后的最终采样写入 `artifacts/phase1-sidebar-active-memory.png`、`phase1-sidebar-active-home.png`、`phase1-reo-dropdown-13px.png`、`phase1-tiptap-dropdown-13px.png` 和 `artifacts/phase1-sidebar-menu-runtime-evidence.json`。关键值：sidebar memory active row 和 Home active button 均为 `bg-secondary / text-foreground / 12px / squircle / 32px`；Reo dropdown item 与 Tiptap dropdown item 均为 `13px / 500 / 1.15 / 12px / squircle / 32px`。
- **Phase 1 gate verification**：第一次 `npm run verify:quick` 在最后 `format:check` 因 `artifacts/phase1-runtime-evidence.json` 未格式化失败；Prettier 格式化该 evidence JSON 后，重新运行 `npm run verify:quick` 通过（typecheck、`test:main` 926、renderer 全批次 8+6+46 files / 32+40+533 tests、`lint:strict`、`format:check`）。
- **Phase 2 Context7**：按 current 约束尝试查询 Radix UI Dialog / AlertDialog 当前文档，Context7 返回 `fetch failed`；本阶段回退到本仓库安装的 `@radix-ui/react-dialog` / `@radix-ui/react-alert-dialog` 1.1.15 包源码与 runtime `data-state` 采样。源码确认 Dialog / AlertDialog Overlay 和 Content 均由 Radix Presence 保留 closed state 以支持 CSS animation。
- **Phase 2（Dialog / AlertDialog）**：`DialogOverlay`、`DialogContent`、`AlertDialogOverlay`、`AlertDialogContent` 加 `reo-fade-motion`；未使用 `reo-float-motion`，避免覆盖自居中 modal 的 translate 规则。新增 primitive 断言保护 overlay/content 使用 fade motion 且 content 保留 `sm:-translate-x-1/2 sm:-translate-y-1/2` 类。
- **Phase 3（Button）**：Button default size 从 `rounded-lg` 改为 `rounded-md`；Button base 保留 `reo-squircle`，iconLarge 仍是 `rounded-lg`，品牌/语义 variant 不变。button primitive 测试同步 default radius 断言。
- **Phase 2/3 targeted verification**：`npm run test:renderer -- dialog alert-dialog` 通过（4 files / 6 tests）；`npm run test:renderer -- button` 通过（3 files / 14 tests）；`npm run typecheck:quick` 通过。
- **Phase 4（current / decision）**：更新 `docs/current/frontend.md` 与 `docs/current/design-system/DESIGN.md` 的当前浮层 chrome、motion、squircle utility、Button radius 和 Tiptap elevation 派生规则；新增 `docs/decisions/0007-floating-and-button-form-adopts-tiptap.md`。
- **Phase 2/3 runtime 视觉证据**：dev renderer `http://localhost:5183/?reoScenario=memory-studio-rich` 采样 dark/light；截图写入 `artifacts/dark|light-dialog.png`、`dark|light-alert-dialog.png`、`dark|light-toast.png`、`dark|light-recording-drawer.png`；computed style 写入 `artifacts/phase2-3-runtime-evidence.json`。关键值：Dialog/AlertDialog content `reo-fade-in` + 多层 `shadow-modal`，默认保存按钮 `12px / squircle / 500`，Undo toast `20px` + 多层 `shadow-float`。RecordingOverlay 使用 generic Drawer primitive，但全屏沉浸式 owner 明确覆盖 `shadow-none`；本任务不把全屏编辑 surface 当成浮层 chrome 强行加阴影。

# Implementation Notes — Tiptap 组件形态收敛

实施过程中的运行记录：每个 Phase 完成后追加实际改动、验证输出、视觉验证结论与偏离计划之处。

## 关键技术约束（实施时务必遵守）

- 阴影 canonical 值必须在 `tokens.json` / `variables.css` / 两份 `theme.css` / contract test **五处逐字一致**；renderer 与 mirror `theme.css` 由 `designSystemTokens.test.ts` 强制相等。
- `reo-float-motion`（transform-based）**只**用于 popper 定位浮层（Dropdown/Tooltip）；自居中的 Dialog/AlertDialog 用 `reo-fade-motion`（opacity-only），否则会覆盖 `translate(-50%,-50%)` 居中。
- 6px / 18px 无设计系统 token，用 component-local 任意值 `p-[6px]` / `rounded-[18px]`；不新增全局 token。
- `chromeCss` 断言要求 Tiptap chrome 仍含 `var(--shadow-float)`——tooltip.scss 已满足，勿删。

## Phase 进度

- [ ] Phase 0 · 共享 elevation token
- [ ] Phase 1 · Tier 1 Dropdown + Tooltip + 动效（含视觉签收 gate）
- [ ] Phase 2 · Tier 2 Dialog/AlertDialog fade + 阴影继承验证
- [ ] Phase 3 · Tier 3 Button 文本按钮圆角
- [ ] Phase 4 · 文档 change gate + 收口归档

## 范围调整

- **2026-05-28 用户追加要求：corner-shape squircle**。所有本任务触碰的圆角都用 squircle 让圆角更流畅。实现：把现有 `@utility reo-card-squircle { corner-shape: squircle }` **泛化重命名为 `reo-squircle`**（纯 corner-shape 工具，名字更准），更新唯一源 consumer `card-surface.tsx` + 4 处测试断言（`MemoryRail.test`、`LoadedWorkspaceFrame.test` ×3）；然后 `reo-squircle` 应用到 dropdown content+item、tooltip、dialog/alert-dialog content、Button base。`reo-segment-card-squircle`（bundle 了 clamp radius）保持不动。Phase 4 文档需把 squircle 写入 frontend.md / DESIGN.md。

## 运行记录

- **Phase 0（token）**：5 处阴影源（tokens.json / variables.css / 两份 theme.css / contract test）改为多层 elevation 并逐字一致；`--tt-shadow-elevated-md` 改为 `var(--shadow-float)`（编辑器观感不变）。`test:main` 926/926 绿（含 mirror-sync 与 shadow contract），`typecheck:quick` 绿。verify:quick + commit 进行中。

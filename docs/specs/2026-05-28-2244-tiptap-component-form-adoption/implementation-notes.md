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

## 运行记录

（按 Phase 追加）

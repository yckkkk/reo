# Tiptap 组件形态收敛（Reo 浮层 + 按钮采用 Tiptap 组件设计）

- Started: 2026-05-28
- Status: completed；archived
- 设计真源落点（收口时更新）：`docs/current/frontend.md`、`docs/current/design-system/DESIGN.md`、`docs/decisions/*`

## 目标

把 Tiptap Simple Editor 模板的**组件设计语言**（形状 / 圆角 / 内距 / item hover / 动效 / 精细多层 elevation）升为 Reo 浮层与按钮 primitive 的设计标准——「Tiptap 的观感 + Reo 拥有 token」。实现落在 Reo 自己的 shadcn/Radix primitive 上，**不**把编辑器专用 `tiptap-ui-primitive/*` 外溢到全 App。

设计数值来自 Tiptap 组件设计；canonical token 仍住在 Reo（`theme.css` / `DESIGN.md`），Tiptap 的 `--tt-*` 变量反过来 derive 自 Reo token，全系统收敛成一套 elevation/chrome/motion 语言。

## 背景与判断

- 触发：用户在编辑器工具栏 hover 时发现 Tiptap 浮层（tooltip / dropdown）比 Reo 浮层好看。
- Survey 全部 Tiptap primitive vs Reo 对应组件后的事实判断：
  - 浮层家族（dropdown / tooltip / popover + 阴影）是 Tiptap **明显赢面**。
  - 关键差异不是单一 token：Tiptap 是「圆角卡片套圆角条目 + 4 层精细阴影 + 方向动效」的整套组件设计；tooltip 是「干净 pill、无箭头、500 字重、有动效」。
  - Reo 的 `--shadow-float` 是单层、dropdown/tooltip 进入动效弱（tooltip 无动效），是设计系统的浮层 elevation 缺陷。
  - **Input / Separator 不换**：Reo input 本就无可见边框 + ring 聚焦，与全局一致；Reo separator 故意透明（同平面不画线规则）。换成 Tiptap 反而引入边框/可见线，违背用户克制审美。
  - **Badge / Card / toolbar / button-group / spacer**：无 Reo 对应或角色不同，不动。
- 用户审美：克制 / 偏 Tiptap form（见 memory `user-aesthetic-clean-minimal`），主动要求去掉 tooltip 箭头。

## 范围

### Tier 1 — 完整采用 Tiptap 组件设计

**DropdownMenu**（`components/ui/dropdown-menu.tsx`）

- 容器 chrome：内距 `6px`、圆角 `18px`（= item 圆角 12px + 内距 6px 的嵌套关系）、精细多层阴影。
- 条目：圆角 `12px`（`rounded-md`，同时对齐 Reo 自己「菜单 action 用 rounded-md」规则，修当前 `rounded-lg` 不一致）、高 32px、内距 8px、gap 4px、13px/500/1.15、icon 16px、克制灰阶 hover（`bg-accent` / `bg-secondary` 阶梯）。
- 动效：`scale(.95) + 淡入 + 方向位移` 进入/退出，`cubic-bezier(.16,1,.3,1)`，reduced-motion 关闭。替换当前只有进入、无退出的 `reo-dropdown-menu-enter`。

**Tooltip**（`components/ui/tooltip.tsx`）

- **去掉箭头**（干净浮起 pill）。
- 圆角 `8px`、内距 `6px/8px`、字重 `500`、精细阴影。
- 补淡入 + 缩放进入/退出动效（当前无）。

### Tier 2 — elevation / 动效一致性（所有浮层）

`Dialog` / `AlertDialog` / `Drawer` / `Toast` 通过共享 `--shadow-float` / `--shadow-modal` **自动**拿到精细多层阴影。额外：

- Dialog / AlertDialog：进入动效曲线对齐新标准；圆角维持 `20px`（tooltip 8 < dropdown 18 < modal 20 是连贯尺度阶梯）。
- Toast：维持 `20px`，吃新阴影。
- 沉浸式 Drawer（录音/笔记全窗）：保留自身 280ms 进入动效（全窗 surface，不属浮层 chrome），只吃新阴影。

### Tier 3 — Button 形态（保品牌语义）

`components/ui/button.tsx`：把**形态**对齐 Tiptap——文本按钮圆角 `16px → 12px`、hover/sizing 节奏对齐 Tiptap toolbar 按钮观感。**品牌/语义不动**：

- `default`(primary) 仍中性 `bg-primary`、`destructive` 仍红、`secondary` 仍灰阶、`ghostIcon` 仍透明灰阶 hover。
- FAB trigger / 录音主 CTA 仍 `bg-brand-ember`，全圆例外保留在各自 owner。

### 共享 token（影响全部浮层）

```
--shadow-float（浅色）单层 → 4 层精细 elevation（来自 Tiptap --tt-shadow-elevated-md）
--shadow-float（深色）单层 → 4 层深色
--shadow-modal           单层 → 更强 4 层（modal 浮得更高）
--tt-shadow-elevated-md       → var(--shadow-float)   （Tiptap 改为引用 Reo，消灭两套定义）
```

### 范围外（带理由）

| 组件                            | 不动理由                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| Input                           | Reo 本就无可见边框 + ring 聚焦，与全局一致；换 Tiptap 引入边框，不更干净 |
| Separator                       | Reo 故意透明（同平面不画线规则）；换 Tiptap 引入可见线，违背克制审美     |
| Badge                           | Reo 无 badge primitive、无当前 consumer；shadcn 边界规则不预先造         |
| Card（`card-surface`）          | 角色不同（Memory/Segment 方圆卡）；浮层 chrome 已在 Tier 1               |
| toolbar / button-group / spacer | 编辑器布局专用，全 App 无对应，不外溢                                    |

## 不变量（不动）

- Reo brand/semantic 层：`primary` 中性黑白、`ring` 中性、`destructive` 红、`brand-ember` 表达入口；不重新引入品牌红到普通控件。
- Tiptap editor primitive 内部不写 Reo-specific 视觉分支（retokenize 方向不变）；本任务方向是「Reo primitive 采用 Tiptap 组件**形态**」，不是反向改 Tiptap。
- Input / Separator 维持现状。
- 录音 overlay 行为不回归（live ASR、recovery snapshot、PCM tail、pause/scrub/resume、completion backfill、recovery marker flush）。

## 设计系统不变量修订（change gate / 硬红线）

本任务改动 `docs/current/*` 记录的浮层 chrome / 阴影 / 圆角 / 动效不变量，收口时必须：

- 更新 `docs/current/frontend.md`：浮层 primitive 形态、`--shadow-float/-modal` 多层 elevation、按钮圆角、Tiptap 与 Reo 收敛为一套 elevation 语言。
- 更新 `docs/current/design-system/DESIGN.md`：组件规则（Dropdown/Tooltip/Button 形态）、shadow 规则、`--tt-shadow-elevated-md` derive 关系；同步 mirror token 与 contract test。
- `docs/decisions/*` 记一条：「浮层 + 按钮 primitive 采用 Tiptap 组件形态为基线（form 取 Tiptap，brand/semantic 留 Reo）」。

## 验证

- TDD 风险面：视觉 / 设计系统改动，按 CLAUDE.md 属轻量验证面，不写形式化假测试。
- 现有 `dropdown-menu.test` / `tooltip`（如有）/ `button.test` 行为单测保持绿；`designSystemTokens.test.ts` 同步并保持绿；typecheck 通过。
- **运行时视觉验证（强制）**：dev browser 场景 `?reoScenario=memory-studio-rich`，浅色 + 深色，浮层 + 按钮前后截图，进本 spec artifacts。
- **分步落地**：Tier 1（Tooltip + DropdownMenu）先做 → 真机前后截图 → 用户签收观感 → 再推 Tier 2 / Tier 3。

## 成功标准

浮层与按钮观感对齐 Tiptap，且 Reo 品牌语义与清洁原则不回退。判据是**融洽**，不是「最少视觉元素」。

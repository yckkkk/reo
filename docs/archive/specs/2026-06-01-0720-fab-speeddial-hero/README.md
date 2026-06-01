# FAB SpeedDial Trigger Hero 化

- Created: 2026-06-01 07:20 PDT (UTC-0700)
- Initiative: `docs/initiatives/2026-05-28-hero-expression-surfaces`（里程碑 1）
- 设计真源: `docs/current/design-system/DESIGN.md` Hero Token 规则

## 目标

把底部 Floating Action Button Speed Dial 的 trigger 从实色 `bg-brand-ember`
升级为 Hero 表达入口：接入已就位但零 consumer 的 `--brand-gradient` 与
`--shadow-hero-{fill,edge}`，让表达入口呈现「火」渐变 + 克制光感，浅/深色都成立。

这是 Hero token family 从「token 已落、组件未建」推进到「FAB 有真实 consumer」的第一步。

## 范围

仅 `components/ui/floating-action-button-speed-dial.tsx` 的 trigger 视觉层，外加随之
更新的既有单测断言与 DESIGN.md 当前真源表。**不**触碰：FAB 几何（diameter/radius/
shell）、展开半圆动画、action 项样式、a11y 行为；**不**触碰 RecordingOverlay / MemoryIcon /
Segment（属里程碑 2-4）。

## 改动

1. trigger 背景：`!bg-brand-ember` → `!bg-[image:radial-gradient(...specular...),var(--brand-gradient)]`
   - base：`--brand-gradient`（ember→red→magenta 火渐变，token 浅/深各一版自适应）
   - 叠层：顶部克制白色 radial specular sheen（CSS gradient，不用 backdrop-filter / SVG filter / WebGL）
2. trigger 光感：`!shadow-[var(--shadow-hero-fill),var(--shadow-hero-edge)]`
   - 走 Tailwind shadow 机制（`--tw-shadow`），与 `focus-visible:ring` 在同一 box-shadow 栈共存
3. hover：移除 `hover:!bg-brand-ember`（无变化）→ `hover:!brightness-[1.05]`，
   `!transition-[filter] !duration-150 !ease-out`，`motion-reduce:!transition-none`
4. 保留：`!size`/`!rounded-full`/`!border-0`/`!text-destructive-foreground`/focus ring 全套

## 验收标准

- trigger 在浅色/深色下都呈现火渐变 + Hero 光感，强度以「融洽」为判据（用户偏克制）。
- focus-visible 时 Hero 光感与 focus ring 同时可见（box-shadow 栈共存验证）。
- 录音/笔记 action、半圆展开、ESC 关闭、focus 管理、几何不回归。
- 既有 FAB trigger 单测从 `!bg-brand-ember` 改为锁 Hero 耐久 token 类后全绿。
- typecheck + 相关单测通过；运行时浅/深色视觉证据入 implementation-notes。

## doc 影响（硬红线）

接入改变设计系统当前真源与能力索引，随本 spec 更新 `DESIGN.md` Hero Token 表：

- `--brand-gradient` / `--shadow-hero-*` 行：「暂无 TSX consumer」→「FAB trigger 已接入」
- `bg-brand-ember` 行：收窄为「FAB action 与录音主 CTA 的实色品牌入口」（trigger 不再实色）

## 验证策略

纯 renderer 设计层，不命中 TDD 红线（无 IPC/DB/事务/安全边界/并发）。
更新既有组件单测 + typecheck + 运行时浅/深色视觉验证；强度运行时核对，必要时下调或退役 specular。
收口前过 `/review` + `/simplify`（phase-gate）。

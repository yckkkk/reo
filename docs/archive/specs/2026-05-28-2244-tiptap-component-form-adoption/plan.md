# Tiptap 组件形态收敛 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Tiptap Simple Editor 模板的组件设计形态（精细多层 elevation、圆角卡片套圆角条目的浮层 chrome、干净 tooltip pill、方向感进入/退出动效、按钮圆角）升为 Reo 自有 shadcn/Radix primitive 的设计标准，全系统收敛成一套 elevation/chrome/motion 语言。

**Architecture:** Reo 仍是 token owner——canonical 多层阴影写进 `--shadow-float` / `--shadow-modal`，Tiptap 的 `--tt-shadow-elevated-md` 反过来 `var(--shadow-float)` 派生（Tiptap 编辑器观感不变，只是 Reo 浮层升到同一水平）。浮层动效区分两类 surface：**popper 定位**的 Dropdown/Tooltip 用 transform-based `reo-float-motion`（Radix 用 popper wrapper 定位，content 自身 transform 空闲，安全）；**自居中**的 Dialog/AlertDialog 用 opacity-only `reo-fade-motion`（它们靠 `translate(-50%,-50%)` 居中，动效绝不能碰 transform）。

**Tech Stack:** React 19 + TypeScript、Tailwind CSS v4、shadcn/ui、Radix primitives、Vitest。设计 token 同步受 `test/main/designSystemTokens.test.ts` contract 守护（renderer `theme.css` 与 `docs/current/design-system/*` mirror 必须逐字一致）。

---

## File Structure

**Phase 0 · 共享 elevation token（同步多文件，contract 守护）**

- Modify: `test/main/designSystemTokens.test.ts`（`shadowContract` 期望值）
- Modify: `docs/current/design-system/tokens.json`（shadow.float/modal $value，light+dark）
- Modify: `docs/current/design-system/variables.css`（`--shadow-float/-modal`，light+dark）
- Modify: `docs/current/design-system/theme.css`（mirror，light+dark）
- Modify: `src/renderer/src/theme.css`（renderer，light+dark）
- Modify: `src/renderer/src/styles/tiptap-template-variables.scss`（`--tt-shadow-elevated-md` → `var(--shadow-float)`）

**Phase 1 · Tier 1（Dropdown + Tooltip + 动效）**

- Modify: `src/renderer/src/index.css`（新增 `reo-float-*`/`reo-fade-*` keyframes + `reo-float-motion` 选择器 + reduced-motion；移除旧 `reo-dropdown-menu-enter`）
- Modify: `src/renderer/src/components/ui/dropdown-menu.tsx`（content chrome + item radius/gap + motion class）
- Modify: `src/renderer/src/components/ui/dropdown-menu.test.tsx`（同步 class 断言）
- Modify: `src/renderer/src/components/ui/tooltip.tsx`（去箭头 + pill 形态 + motion class）

**Phase 2 · Tier 2（Dialog/AlertDialog/Drawer/Toast elevation 一致性）**

- Modify: `src/renderer/src/components/ui/dialog.tsx`（overlay + content 加 `reo-fade-motion`）
- Modify: `src/renderer/src/components/ui/alert-dialog.tsx`（同上）
- （Toast/Drawer 不改代码：阴影经 Phase 0 token 自动继承，自身动效保留）

**Phase 3 · Tier 3（Button 文本按钮圆角）**

- Modify: `src/renderer/src/components/ui/button.tsx`（`default` size `rounded-lg` → `rounded-md`）
- Modify: `src/renderer/src/components/ui/button.test.tsx`（同步断言）

**Phase 4 · 设计系统不变量修订（change gate）**

- Modify: `docs/current/frontend.md`
- Modify: `docs/current/design-system/DESIGN.md`
- Create: `docs/decisions/0007-floating-and-button-form-adopts-tiptap.md`

---

## Phase 0 · 共享 elevation token

Canonical 阴影值（单行，跨 tokens.json / CSS / contract 逐字一致）：

```
FLOAT light : 0 16px 48px rgb(17 24 39 / 0.04), 0 12px 24px rgb(17 24 39 / 0.04), 0 6px 8px rgb(17 24 39 / 0.02), 0 2px 3px rgb(17 24 39 / 0.02)
FLOAT dark  : 0 16px 48px rgb(0 0 0 / 0.5), 0 12px 24px rgb(0 0 0 / 0.24), 0 6px 8px rgb(0 0 0 / 0.22), 0 2px 3px rgb(0 0 0 / 0.12)
MODAL light : 0 32px 64px rgb(17 24 39 / 0.08), 0 16px 32px rgb(17 24 39 / 0.06), 0 8px 16px rgb(17 24 39 / 0.04), 0 2px 4px rgb(17 24 39 / 0.03)
MODAL dark  : 0 32px 64px rgb(0 0 0 / 0.6), 0 16px 32px rgb(0 0 0 / 0.32), 0 8px 16px rgb(0 0 0 / 0.28), 0 2px 4px rgb(0 0 0 / 0.16)
```

### Task 0.1: 把 contract test 切到新值（RED）

**Files:** Modify `test/main/designSystemTokens.test.ts:92-94, 103-104`

- [ ] **Step 1: 改 `shadowContract` 期望值**

```ts
// light（约 line 92）
const shadowContract = {
  float: '0 16px 48px rgb(17 24 39 / 0.04), 0 12px 24px rgb(17 24 39 / 0.04), 0 6px 8px rgb(17 24 39 / 0.02), 0 2px 3px rgb(17 24 39 / 0.02)',
  modal: '0 32px 64px rgb(17 24 39 / 0.08), 0 16px 32px rgb(17 24 39 / 0.06), 0 8px 16px rgb(17 24 39 / 0.04), 0 2px 4px rgb(17 24 39 / 0.03)',
```

```ts
// dark（约 line 103）
  float: '0 16px 48px rgb(0 0 0 / 0.5), 0 12px 24px rgb(0 0 0 / 0.24), 0 6px 8px rgb(0 0 0 / 0.22), 0 2px 3px rgb(0 0 0 / 0.12)',
  modal: '0 32px 64px rgb(0 0 0 / 0.6), 0 16px 32px rgb(0 0 0 / 0.32), 0 8px 16px rgb(0 0 0 / 0.28), 0 2px 4px rgb(0 0 0 / 0.16)',
```

- [ ] **Step 2: 跑 contract test 确认 FAIL**

Run: `npm run test:main -- designSystemTokens`
Expected: FAIL —— light/dark shadow float/modal 不匹配（源文件仍是旧单层值）。

### Task 0.2: 更新 tokens.json

**Files:** Modify `docs/current/design-system/tokens.json:105-106, 129-130`

- [ ] **Step 1:** light 块（line 105-106）`$value` 改为 FLOAT light / MODAL light；dark 块（line 129-130）改为 FLOAT dark / MODAL dark。`$type` 保持 `"shadow"`。

### Task 0.3: 更新 variables.css mirror

**Files:** Modify `docs/current/design-system/variables.css:58-59, 112-113`

- [ ] **Step 1:** `--shadow-float`/`--shadow-modal` light（58-59）与 dark（112-113）改为对应 canonical 值（单行）。

### Task 0.4: 更新 design-system theme.css mirror

**Files:** Modify `docs/current/design-system/theme.css:163-164, 213-214`

- [ ] **Step 1:** 同 0.3 的四个值，写进 mirror theme.css 对应行。

### Task 0.5: 更新 renderer theme.css

**Files:** Modify `src/renderer/src/theme.css:163-164, 213-214`

- [ ] **Step 1:** 与 mirror **逐字一致**地写入四个值（`runtime and design-system CSS project the same semantic tokens` 测试要求两者相等）。

- [ ] **Step 2: 跑 contract test 确认 GREEN**

Run: `npm run test:main -- designSystemTokens`
Expected: PASS（shadow contract + mirror 同步 + tokens.json 三方一致）。

### Task 0.6: Tiptap 阴影派生自 Reo

**Files:** Modify `src/renderer/src/styles/tiptap-template-variables.scss:126-128`（light 定义）+ `:206-208`（dark override）

- [ ] **Step 1:** 把 `:root` 内 `--tt-shadow-elevated-md` 的多层字面值替换为：

```scss
--tt-shadow-elevated-md: var(--shadow-float);
```

并**删除** `.dark` 块内的 `--tt-shadow-elevated-md` override（line 206-208 整段），因为 `--shadow-float` 本身已 theme-aware。

- [ ] **Step 2: 跑 contract test + typecheck**

Run: `npm run test:main -- designSystemTokens && npm run typecheck:quick`
Expected: PASS（`chromeCss` 仍含 `var(--shadow-float)`——tooltip.scss 与新派生都满足）。

### Task 0.7: Commit

- [ ] **Step 1:**

```bash
git add test/main/designSystemTokens.test.ts docs/current/design-system/tokens.json docs/current/design-system/variables.css docs/current/design-system/theme.css src/renderer/src/theme.css src/renderer/src/styles/tiptap-template-variables.scss
git commit -m "feat(design-system): elevate shadow-float/modal to refined multi-layer; tiptap derives from reo"
```

### Phase 0 gate

- [ ] `npm run verify:quick` 全绿。
- [ ] `/review` 与 `/simplify` 通过，处理发现项后再进入 Phase 1。

---

## Phase 1 · Tier 1（Dropdown + Tooltip + 动效）

### Task 1.1: 浮层动效 keyframes 与选择器

**Files:** Modify `src/renderer/src/index.css`

- [ ] **Step 1: 移除旧 dropdown 动效**

删除 `@keyframes reo-dropdown-menu-enter`（约 line 149-158）、`@utility reo-dropdown-menu-enter`（约 line 266-269）、以及 reduced-motion 段内 `.reo-dropdown-menu-enter { animation: none }`（约 line 251-253）。

- [ ] **Step 2: 新增浮层动效（两类 surface）**

```css
/* Popper 定位浮层（Dropdown / Tooltip）：transform 安全，Radix 用 wrapper 定位 */
@keyframes reo-float-in {
  from {
    opacity: 0;
    transform: scale(0.96) translate(var(--reo-float-x, 0px), var(--reo-float-y, 0px));
  }
  to {
    opacity: 1;
    transform: scale(1) translate(0px, 0px);
  }
}
@keyframes reo-float-out {
  from {
    opacity: 1;
    transform: scale(1) translate(0px, 0px);
  }
  to {
    opacity: 0;
    transform: scale(0.96) translate(var(--reo-float-x, 0px), var(--reo-float-y, 0px));
  }
}

/* 自居中浮层（Dialog / AlertDialog）：靠 translate 居中，动效只能碰 opacity */
@keyframes reo-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes reo-fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@utility reo-float-motion {
  transform-origin: var(--radix-popper-transform-origin, center);
}

.reo-float-motion[data-side='bottom'] {
  --reo-float-y: -4px;
}
.reo-float-motion[data-side='top'] {
  --reo-float-y: 4px;
}
.reo-float-motion[data-side='left'] {
  --reo-float-x: 4px;
}
.reo-float-motion[data-side='right'] {
  --reo-float-x: -4px;
}

.reo-float-motion[data-state='open'],
.reo-float-motion[data-state='delayed-open'],
.reo-float-motion[data-state='instant-open'] {
  animation: reo-float-in 150ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.reo-float-motion[data-state='closed'] {
  animation: reo-float-out 120ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.reo-fade-motion[data-state='open'] {
  animation: reo-fade-in 150ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.reo-fade-motion[data-state='closed'] {
  animation: reo-fade-out 120ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@media (prefers-reduced-motion: reduce) {
  .reo-float-motion[data-state],
  .reo-fade-motion[data-state] {
    animation: none;
  }
}
```

（`data-state` 覆盖 tooltip 的 `delayed-open`/`instant-open` 与 menu/dialog 的 `open`/`closed`；退出动效由 Radix Presence 检测到 `reo-float-out`/`reo-fade-out` 后延迟卸载触发。）

### Task 1.2: DropdownMenu chrome + item + motion

**Files:** Modify `src/renderer/src/components/ui/dropdown-menu.tsx:26`（content）+ `:43`（item）

- [ ] **Step 1: content className**

```tsx
        className={cn(
          'reo-float-motion z-50 min-w-160 overflow-hidden rounded-[18px] border-0 bg-popover p-[6px] text-popover-foreground shadow-float outline-none',
          className
        )}
```

（`reo-dropdown-menu-enter`→`reo-float-motion`，`rounded-lg`→`rounded-[18px]`，`p-4`→`p-[6px]`。）

- [ ] **Step 2: item className**——把 `gap-8 rounded-lg` 改为 `gap-4 rounded-md`：

```tsx
        'relative flex min-h-32 w-full cursor-default select-none items-center gap-4 rounded-md px-8 text-left text-ui-xs font-regular leading-ui-xs outline-none transition-colors duration-150 ease-out',
```

### Task 1.3: 同步 dropdown-menu 测试断言

**Files:** Modify `src/renderer/src/components/ui/dropdown-menu.test.tsx:23-31`（content）+ `:33-43`（item）

- [ ] **Step 1:** content 断言把 `'rounded-lg'`→`'rounded-[18px]'`、`'p-4'`→`'p-[6px]'`、`'reo-dropdown-menu-enter'`→`'reo-float-motion'`。item 断言把 `'rounded-lg'`→`'rounded-md'`。

- [ ] **Step 2: 跑 dropdown 测试**

Run: `npm run test:renderer -- dropdown-menu`
Expected: PASS。

### Task 1.4: Tooltip 去箭头 + pill 形态 + motion

**Files:** Modify `src/renderer/src/components/ui/tooltip.tsx:37-45`

- [ ] **Step 1:** content className 改为（去 `origin-(...)` 改用 motion 类、`rounded-md`→`rounded-sm`、`py-4`→`py-[6px]`、加 `font-medium`、加 `reo-float-motion`）：

```tsx
        className={cn(
          'reo-float-motion z-50 w-fit rounded-sm border-0 bg-popover px-8 py-[6px] text-caption font-medium leading-caption text-popover-foreground shadow-float',
          className
        )}
```

- [ ] **Step 2: 删除箭头**——移除 `<TooltipPrimitive.Arrow ... />` 整个元素（line 44）；`children` 直接作为唯一子节点。

- [ ] **Step 3: 渲染冒烟**

Run: `npm run test:renderer -- tooltip`
Expected: PASS（无 tooltip 专属测试时只确认无回归）；再跑 `npm run typecheck:quick` 确认无未用引用报错。

### Task 1.5: Commit

- [ ] **Step 1:**

```bash
git add src/renderer/src/index.css src/renderer/src/components/ui/dropdown-menu.tsx src/renderer/src/components/ui/dropdown-menu.test.tsx src/renderer/src/components/ui/tooltip.tsx
git commit -m "feat(design-system): dropdown + tooltip adopt tiptap component form and motion"
```

### Phase 1 gate（含强制运行时视觉验证 + 用户签收）

- [ ] `npm run verify:quick` 全绿。
- [ ] `/review` 与 `/simplify` 通过。
- [ ] **运行时视觉验证**：`npm run dev` 起 renderer dev server；浏览器开 Vite renderer URL + `?reoScenario=memory-studio-rich`。
  - 浅色 + 深色各截图：Segment 卡 More 下拉菜单（hover item）、titlebar 右侧 icon 按钮 hover tooltip（确认无箭头）、进入/退出动效。
  - 截图存 `docs/specs/2026-05-28-2244-tiptap-component-form-adoption/artifacts/`。
- [ ] **把浅色/深色前后截图交用户签收观感**，确认后再进入 Phase 2/3。

---

## Phase 2 · Tier 2（Dialog/AlertDialog/Drawer/Toast elevation 一致性）

阴影已由 Phase 0 token 自动继承（这四者都用 `shadow-float`/`shadow-modal`）。本阶段只为自居中 modal 补 centering-safe 的 opacity 进入/退出动效。

### Task 2.1: Dialog 进入动效（opacity-only）

**Files:** Modify `src/renderer/src/components/ui/dialog.tsx:17`（overlay）+ `:34`（content）

- [ ] **Step 1:** overlay className 前缀加 `reo-fade-motion`：`'reo-fade-motion fixed inset-0 z-50 bg-scrim'`。
- [ ] **Step 2:** content className 前缀加 `reo-fade-motion`（**不要**加 `reo-float-motion`——会覆盖 `sm:-translate-x-1/2 sm:-translate-y-1/2` 居中 transform）。

### Task 2.2: AlertDialog 进入动效（opacity-only）

**Files:** Modify `src/renderer/src/components/ui/alert-dialog.tsx:18`（overlay）+ `:40`（content）

- [ ] **Step 1:** 同 2.1，overlay 与 content className 前缀各加 `reo-fade-motion`。

- [ ] **Step 2: 测试 + typecheck**

Run: `npm run test:renderer -- dialog alert-dialog && npm run typecheck:quick`
Expected: PASS（若无专属测试则确认相关 workspace 测试无回归）。

### Task 2.3: Commit

- [ ] **Step 1:**

```bash
git add src/renderer/src/components/ui/dialog.tsx src/renderer/src/components/ui/alert-dialog.tsx
git commit -m "feat(design-system): dialog + alert-dialog centering-safe fade entrance"
```

### Phase 2 gate

- [ ] `npm run verify:quick` 全绿。
- [ ] `/review` 与 `/simplify` 通过。
- [ ] 运行时视觉验证：浅色/深色截 Memory delete 确认弹层（AlertDialog）、创建记忆空间 Dialog、undo Toast、录音 Drawer，确认四者都拿到精细多层阴影、modal 居中不偏移。截图存 artifacts。

---

## Phase 3 · Tier 3（Button 文本按钮圆角）

仅 `default`（40px 文本按钮）圆角 `16→12`；icon 系列（icon 8 / iconMedium 12 / iconLarge 16）与品牌/语义 variant 不动（spec 范围限「文本按钮」，iconLarge 56px 保 16px 大面平衡）。

### Task 3.1: 改 default size 圆角

**Files:** Modify `src/renderer/src/components/ui/button.tsx:15`

- [ ] **Step 1:** `default: 'min-h-40 rounded-lg px-16'` → `default: 'min-h-40 rounded-md px-16'`。

### Task 3.2: 同步 button 测试断言

**Files:** Modify `src/renderer/src/components/ui/button.test.tsx:18`

- [ ] **Step 1:** 首个用例 `expect(button).toHaveClass('rounded-lg', 'font-medium', 'min-h-40')` → `'rounded-md'`。（iconLarge 用例的 `'rounded-lg'` **不动**。）

- [ ] **Step 2: 跑 button 测试**

Run: `npm run test:renderer -- button`
Expected: PASS。

### Task 3.3: Commit

- [ ] **Step 1:**

```bash
git add src/renderer/src/components/ui/button.tsx src/renderer/src/components/ui/button.test.tsx
git commit -m "feat(design-system): default text button radius 16->12 to match tiptap form"
```

### Phase 3 gate

- [ ] `npm run verify:quick` 全绿。
- [ ] `/review` 与 `/simplify` 通过。
- [ ] 运行时视觉验证：浅色/深色截主 CTA / 保存按钮，确认圆角与浮层节奏协调。

---

## Phase 4 · 设计系统不变量修订（change gate）

### Task 4.1: 更新 frontend.md

**Files:** Modify `docs/current/frontend.md`

- [ ] **Step 1:** 更新浮层 primitive 形态描述：
  - DropdownMenu：圆角卡片（18px）套圆角条目（`rounded-md`），内距 6px，`reo-float-motion` 方向感进入/退出。
  - Tooltip：无箭头 pill，`rounded-sm`，6/8 内距，`font-medium`，`reo-float-motion`。
  - `--shadow-float`/`--shadow-modal` 为精细多层 elevation；Tiptap `--tt-shadow-elevated-md` 派生自 `--shadow-float`，两套系统共用一套 elevation 语言。
  - Button：`default` 文本按钮 `rounded-md`。
  - 移除/改写描述旧单层阴影与 `reo-dropdown-menu-enter` 的句子。

### Task 4.2: 更新 DESIGN.md + mirror 同步

**Files:** Modify `docs/current/design-system/DESIGN.md`

- [ ] **Step 1:** 组件规则段：Dropdown/Tooltip/Button 形态更新；Hero/shadow 段：`--shadow-float`/`--shadow-modal` 改为「精细多层 elevation；Tiptap 派生」。确认与 tokens.json/CSS 一致（Phase 0 已改值，此处只改 prose）。

### Task 4.3: 写决策记录

**Files:** Create `docs/decisions/0007-floating-and-button-form-adopts-tiptap.md`

- [ ] **Step 1:** 记录长期决策：「浮层 + 文本按钮 primitive 采用 Tiptap 组件形态为基线——form（形状/圆角/内距/item hover/动效/多层 elevation）取 Tiptap，brand/semantic（中性 primary、red destructive、ember 表达入口）留 Reo；实现在 Reo 自有 shadcn/Radix primitive 上，不外溢 tiptap-ui-primitive；Input/Separator 维持 Reo（更干净）」。引用本 spec。

### Task 4.4: Commit + 收口

- [ ] **Step 1:**

```bash
git add docs/current/frontend.md docs/current/design-system/DESIGN.md docs/decisions/0007-floating-and-button-form-adopts-tiptap.md
git commit -m "docs(design-system): record floating + button form adopts tiptap component design"
```

- [ ] **Step 2: 全量验证**

Run: `npm run verify:quick`
Expected: PASS。

- [ ] **Step 3: spec 收口**——把稳定结论确认已进 `docs/current/*` 与 `docs/decisions/*`；spec（含 artifacts 截图）整目录移入 `docs/archive/specs/`。

---

## Self-Review

**1. Spec coverage**

- Tier 1 Dropdown → Task 1.1-1.3；Tooltip → 1.4。✓
- Tier 2 floats elevation → Phase 0 token（自动继承）+ Phase 2 modal fade。✓
- Tier 3 button form → Phase 3。✓
- 共享 token + Tiptap 派生 → Phase 0。✓
- change gate（frontend.md / DESIGN.md / decisions）→ Phase 4。✓
- 运行时视觉验证（浅色/深色）+ 分步签收 → Phase 1/2/3 gate。✓
- 范围外（Input/Separator/Badge/Card/toolbar）→ 计划未触碰，符合。✓

**2. Placeholder scan**：无 TBD/TODO；每个改动给出具体 className/值/命令。✓

**3. Type/naming consistency**：motion 类名全程一致——`reo-float-motion`（Dropdown/Tooltip）、`reo-fade-motion`（Dialog/AlertDialog）；keyframes `reo-float-in/out`、`reo-fade-in/out`；阴影 canonical 值四处逐字一致。✓

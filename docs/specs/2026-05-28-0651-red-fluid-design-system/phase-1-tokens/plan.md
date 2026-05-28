# Phase 1 · Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Reo's existing「黑色为主 Soft Flat」token system with spec Section 1 + Section 6 的「品牌红表达入口 + 黑白中性控件语义 + Fluid 多层 surface」骨架，遵循新命名规范。Task 8 review 后追加最小 Button primitive hover token 接入，避免 `primary-hover` 成为无 consumer semantic token，并将 `primary/ring` 从品牌红纠正为普通控件的中性语义。

**Architecture:** 双层 token 模型：raw 资产（`--brand-*`、`--surface-N`、`--shadow-hero-*`、新增 `--radius-3xl/4xl`）+ semantic 角色（shadcn 既有 `--primary`、`--card`、`--input` 等；surface 角色引用 `var(--surface-N)`，普通控件 primary/ring 使用中性黑白值）。tokens.json 与 variables.css 是设计系统源；theme.css 是 runtime 投影；DESIGN.md 是叙述；无 current consumer 的 gradient utility 延后到对应 consumer phase。

**Tech Stack:** Tailwind CSS v4（`@theme inline` + `@utility`）、CSS custom properties、color-mix(in oklab)、shadcn 既有 token API。

**TDD 红线判断（依 CLAUDE.md）：** Phase 1 主体是机械配置 + 重命名 + token 替换；Task 8 触发 reusable primitive consumer 与 token 语义纠偏，使用 focused contract test 保护 Button hover 和 token mirror，不把探索性视觉枚举写成长测。

**Task 8 correction:** 本 plan 早期任务块中仍保留初始执行草案；凡出现 `primary/ring -> brand-red` 或 Switch checked 为品牌红的旧片段，均由 Task 8 neutral primary 纠偏覆盖。当前事实以 `tokens.json`、三份 CSS mirror、`DESIGN.md` 和本文件顶部 Goal 为准。

---

## File Structure

| 文件                                                                                        | 责任                                                                          | 改动幅度                                                                             |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `docs/current/design-system/tokens.json`                                                    | W3C-style 结构化 token 源（设计系统的"数据"）                                 | 重写                                                                                 |
| `docs/current/design-system/variables.css`                                                  | CSS 变量源（设计系统的"实现"）                                                | 重写                                                                                 |
| `docs/current/design-system/DESIGN.md`                                                      | 设计系统叙述（设计系统的"语言"）                                              | 多节更新                                                                             |
| `src/renderer/src/theme.css`                                                                | runtime 主题（Tailwind v4 `@theme inline` + `:root` + `[data-theme='dark']`） | 重写                                                                                 |
| `src/renderer/src/index.css`                                                                | Tailwind 入口 + 全局 utility                                                  | Task 8 移除无 current consumer 的 `bg-brand-gradient`，并排除 `docs` source scanning |
| `docs/current/frontend.md`                                                                  | 前端真源叙述（避免与新设计系统矛盾）                                          | 第 11 行单句修正                                                                     |
| `docs/specs/2026-05-28-0651-red-fluid-design-system/phase-1-tokens/implementation-notes.md` | 执行证据                                                                      | 追加                                                                                 |

---

## Task 1 · 重写 tokens.json

**Files:**

- Modify: `docs/current/design-system/tokens.json`

- [ ] **Step 1: 用以下内容完整重写 `tokens.json`**

```json
{
  "color": {
    "brand-red": { "$value": "#dc2626", "$type": "color" },
    "brand-magenta": { "$value": "#d946ef", "$type": "color" },
    "brand-ember": { "$value": "#ff4704", "$type": "color" },

    "surface-1": { "$value": "#ffffff", "$type": "color" },
    "surface-2": { "$value": "#f4f4f5", "$type": "color" },
    "surface-3": { "$value": "#ebebed", "$type": "color" },
    "surface-4": { "$value": "#ffffff", "$type": "color" },

    "background": { "$value": "var(--surface-1)", "$type": "color" },
    "foreground": { "$value": "#18181b", "$type": "color" },
    "card": { "$value": "var(--surface-2)", "$type": "color" },
    "card-foreground": { "$value": "#18181b", "$type": "color" },
    "popover": { "$value": "var(--surface-4)", "$type": "color" },
    "popover-foreground": { "$value": "#18181b", "$type": "color" },
    "primary": { "$value": "var(--brand-red)", "$type": "color" },
    "primary-foreground": { "$value": "#ffffff", "$type": "color" },
    "primary-hover": {
      "$value": "color-mix(in oklab, var(--primary) 90%, var(--foreground))",
      "$type": "color"
    },
    "secondary": { "$value": "#e5e7eb", "$type": "color" },
    "secondary-foreground": { "$value": "#18181b", "$type": "color" },
    "muted": { "$value": "var(--surface-2)", "$type": "color" },
    "muted-foreground": { "$value": "#71717a", "$type": "color" },
    "accent": { "$value": "#e5e7eb", "$type": "color" },
    "accent-foreground": { "$value": "#18181b", "$type": "color" },
    "destructive": { "$value": "#b91c1c", "$type": "color" },
    "destructive-hover": {
      "$value": "color-mix(in oklab, var(--destructive) 82%, var(--destructive-foreground))",
      "$type": "color"
    },
    "destructive-foreground": { "$value": "#ffffff", "$type": "color" },
    "scrim": { "$value": "rgb(24 24 27 / 0.32)", "$type": "color" },
    "border": { "$value": "transparent", "$type": "color" },
    "input": { "$value": "var(--surface-3)", "$type": "color" },
    "ring": { "$value": "var(--brand-red)", "$type": "color" }
  },
  "dark": {
    "brand-red": { "$value": "#dc2626", "$type": "color" },
    "brand-magenta": { "$value": "#d946ef", "$type": "color" },
    "brand-ember": { "$value": "#ff4704", "$type": "color" },

    "surface-1": { "$value": "#09090b", "$type": "color" },
    "surface-2": { "$value": "#18181b", "$type": "color" },
    "surface-3": { "$value": "#1f1f23", "$type": "color" },
    "surface-4": { "$value": "#27272a", "$type": "color" },

    "background": { "$value": "var(--surface-1)", "$type": "color" },
    "foreground": { "$value": "#fafafa", "$type": "color" },
    "card": { "$value": "var(--surface-2)", "$type": "color" },
    "card-foreground": { "$value": "#fafafa", "$type": "color" },
    "popover": { "$value": "var(--surface-4)", "$type": "color" },
    "popover-foreground": { "$value": "#fafafa", "$type": "color" },
    "primary": { "$value": "var(--brand-red)", "$type": "color" },
    "primary-foreground": { "$value": "#ffffff", "$type": "color" },
    "primary-hover": {
      "$value": "color-mix(in oklab, var(--primary) 90%, var(--foreground))",
      "$type": "color"
    },
    "secondary": { "$value": "#27272a", "$type": "color" },
    "secondary-foreground": { "$value": "#fafafa", "$type": "color" },
    "muted": { "$value": "var(--surface-2)", "$type": "color" },
    "muted-foreground": { "$value": "#a1a1aa", "$type": "color" },
    "accent": {
      "$value": "color-mix(in oklab, var(--foreground) 10%, var(--popover))",
      "$type": "color"
    },
    "accent-foreground": { "$value": "#fafafa", "$type": "color" },
    "destructive": { "$value": "#b91c1c", "$type": "color" },
    "destructive-hover": {
      "$value": "color-mix(in oklab, var(--destructive) 82%, var(--destructive-foreground))",
      "$type": "color"
    },
    "destructive-foreground": { "$value": "#ffffff", "$type": "color" },
    "scrim": { "$value": "rgb(0 0 0 / 0.62)", "$type": "color" },
    "border": { "$value": "transparent", "$type": "color" },
    "input": { "$value": "var(--surface-3)", "$type": "color" },
    "ring": { "$value": "var(--brand-red)", "$type": "color" }
  },
  "gradient": {
    "brand-gradient-light": {
      "$value": "linear-gradient(135deg, #ff4704 0%, #dc2626 50%, #d946ef 100%)",
      "$type": "gradient"
    },
    "brand-gradient-dark": {
      "$value": "linear-gradient(135deg, color-mix(in oklab, #ff4704 92%, #09090b) 0%, color-mix(in oklab, #dc2626 92%, #09090b) 50%, color-mix(in oklab, #d946ef 92%, #09090b) 100%)",
      "$type": "gradient"
    }
  },
  "radius": {
    "base": { "$value": "16px", "$type": "dimension" },
    "sm": { "$value": "8px", "$type": "dimension" },
    "md": { "$value": "12px", "$type": "dimension" },
    "lg": { "$value": "16px", "$type": "dimension" },
    "xl": { "$value": "20px", "$type": "dimension" },
    "2xl": { "$value": "24px", "$type": "dimension" },
    "3xl": { "$value": "28px", "$type": "dimension" },
    "4xl": { "$value": "32px", "$type": "dimension" },
    "full": { "$value": "9999px", "$type": "dimension" }
  },
  "shadow": {
    "float": { "$value": "0 12px 32px rgb(0 0 0 / 0.08)", "$type": "shadow" },
    "modal": { "$value": "0 24px 64px rgb(0 0 0 / 0.12)", "$type": "shadow" },
    "hero-lift": {
      "$value": "0 24px 48px rgb(220 38 38 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.6)",
      "$type": "shadow"
    },
    "hero-fill": {
      "$value": "0 12px 24px rgb(220 38 38 / 0.18), inset 0 0 0 1px rgb(255 255 255 / 0.14)",
      "$type": "shadow"
    },
    "hero-inset": {
      "$value": "inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 -8px 16px rgb(0 0 0 / 0.12)",
      "$type": "shadow"
    },
    "hero-edge": {
      "$value": "inset 0 0 0 1px rgb(255 255 255 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.4)",
      "$type": "shadow"
    },
    "surface-inset": {
      "$value": "inset 0 1px 0 rgb(0 0 0 / 0.02)",
      "$type": "shadow"
    }
  },
  "darkShadow": {
    "float": { "$value": "0 12px 32px rgb(0 0 0 / 0.4)", "$type": "shadow" },
    "modal": { "$value": "0 24px 64px rgb(0 0 0 / 0.6)", "$type": "shadow" },
    "hero-lift": {
      "$value": "0 24px 48px rgb(220 38 38 / 0.22), inset 0 1px 0 rgb(255 255 255 / 0.06)",
      "$type": "shadow"
    },
    "hero-fill": {
      "$value": "0 12px 24px rgb(220 38 38 / 0.28), inset 0 0 0 1px rgb(255 255 255 / 0.14)",
      "$type": "shadow"
    },
    "hero-inset": {
      "$value": "inset 0 1px 0 rgb(255 255 255 / 0.25), inset 0 -8px 16px rgb(0 0 0 / 0.18)",
      "$type": "shadow"
    },
    "hero-edge": {
      "$value": "inset 0 0 0 1px rgb(255 255 255 / 0.05), inset 0 1px 0 rgb(255 255 255 / 0.2)",
      "$type": "shadow"
    },
    "surface-inset": {
      "$value": "inset 0 1px 0 rgb(255 255 255 / 0.04)",
      "$type": "shadow"
    }
  },
  "font": {
    "sans": {
      "$value": "'Waldenburg', 'Inter', ui-sans-serif, system-ui, sans-serif",
      "$type": "fontFamily"
    },
    "mono": {
      "$value": "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      "$type": "fontFamily"
    },
    "memory-serif": {
      "$value": "'Songti SC', STSong, 'Noto Serif CJK SC', serif",
      "$type": "fontFamily"
    }
  }
}
```

- [ ] **Step 2: 在 `implementation-notes.md` 追加 Task 1 证据**

```
## Task 1 · 重写 tokens.json
- 时间：<执行时间> PDT
- 改动：docs/current/design-system/tokens.json
- 验证：文件用 `cat` 读出后 JSON 结构有效（手动核对 brand/surface/gradient/shadow 各 section 都存在）
- 备注：tokens.json 是设计系统数据源；下游 variables.css 与 theme.css 必须与此严格对齐
```

- [ ] **Step 3: Commit**

```bash
git add docs/current/design-system/tokens.json docs/specs/2026-05-28-0651-red-fluid-design-system/phase-1-tokens/implementation-notes.md
git commit -m "feat(design-system): rewrite tokens.json for red fluid system

- replace primary/ring with brand-red (#dc2626)
- replace destructive with #b91c1c (separate from primary red by lightness)
- add brand-red, brand-magenta, brand-gradient (light + dark)
- add surface-1..surface-4 raw elevation layer
- add radius-3xl (28px) and radius-4xl (32px)
- add shadow-hero-lift, hero-fill, hero-inset, hero-edge, surface-inset
- semantic tokens (background/card/input/popover) reference surface-N

Part of spec docs/specs/2026-05-28-0651-red-fluid-design-system Phase 1."
```

---

## Task 2 · 重写 variables.css

**Files:**

- Modify: `docs/current/design-system/variables.css`

- [ ] **Step 1: 用以下内容完整重写 `variables.css`**

```css
:root,
[data-theme='light'] {
  color-scheme: light;

  /* Layer 1 · raw brand assets */
  --brand-red: #dc2626;
  --brand-magenta: #d946ef;
  --brand-ember: #ff4704;
  --brand-gradient: linear-gradient(
    135deg,
    var(--brand-ember) 0%,
    var(--brand-red) 50%,
    var(--brand-magenta) 100%
  );

  /* Layer 1 · raw surface elevation */
  --surface-1: #ffffff;
  --surface-2: #f4f4f5;
  --surface-3: #ebebed;
  --surface-4: #ffffff;

  /* Layer 2 · semantic shadcn roles */
  --background: var(--surface-1);
  --foreground: #18181b;
  --card: var(--surface-2);
  --card-foreground: #18181b;
  --popover: var(--surface-4);
  --popover-foreground: #18181b;
  --primary: var(--brand-red);
  --primary-foreground: #ffffff;
  --primary-hover: color-mix(in oklab, var(--primary) 90%, var(--foreground));
  --secondary: #e5e7eb;
  --secondary-foreground: #18181b;
  --muted: var(--surface-2);
  --muted-foreground: #71717a;
  --accent: #e5e7eb;
  --accent-foreground: #18181b;
  --destructive: #b91c1c;
  --destructive-hover: color-mix(in oklab, var(--destructive) 82%, var(--destructive-foreground));
  --destructive-foreground: #ffffff;
  --scrim: rgb(24 24 27 / 0.32);
  --border: transparent;
  --input: var(--surface-3);
  --ring: var(--brand-red);

  /* Layer 3 · radius scale */
  --radius: 16px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-3xl: 28px;
  --radius-4xl: 32px;
  --radius-full: 9999px;

  /* Layer 4 · effect tokens */
  --shadow-float: 0 12px 32px rgb(0 0 0 / 0.08);
  --shadow-modal: 0 24px 64px rgb(0 0 0 / 0.12);
  --shadow-hero-lift: 0 24px 48px rgb(220 38 38 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.6);
  --shadow-hero-fill: 0 12px 24px rgb(220 38 38 / 0.18), inset 0 0 0 1px rgb(255 255 255 / 0.14);
  --shadow-hero-inset: inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 -8px 16px rgb(0 0 0 / 0.12);
  --shadow-hero-edge: inset 0 0 0 1px rgb(255 255 255 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.4);
  --shadow-surface-inset: inset 0 1px 0 rgb(0 0 0 / 0.02);
}

[data-theme='dark'] {
  color-scheme: dark;

  /* Layer 1 · raw brand assets */
  --brand-red: #dc2626;
  --brand-magenta: #d946ef;
  --brand-ember: #ff4704;
  --brand-gradient: linear-gradient(
    135deg,
    color-mix(in oklab, var(--brand-ember) 92%, #09090b) 0%,
    color-mix(in oklab, var(--brand-red) 92%, #09090b) 50%,
    color-mix(in oklab, var(--brand-magenta) 92%, #09090b) 100%
  );

  /* Layer 1 · raw surface elevation */
  --surface-1: #09090b;
  --surface-2: #18181b;
  --surface-3: #1f1f23;
  --surface-4: #27272a;

  /* Layer 2 · semantic shadcn roles */
  --background: var(--surface-1);
  --foreground: #fafafa;
  --card: var(--surface-2);
  --card-foreground: #fafafa;
  --popover: var(--surface-4);
  --popover-foreground: #fafafa;
  --primary: var(--brand-red);
  --primary-foreground: #ffffff;
  --primary-hover: color-mix(in oklab, var(--primary) 90%, var(--foreground));
  --secondary: #27272a;
  --secondary-foreground: #fafafa;
  --muted: var(--surface-2);
  --muted-foreground: #a1a1aa;
  --accent: color-mix(in oklab, var(--foreground) 10%, var(--popover));
  --accent-foreground: #fafafa;
  --destructive: #b91c1c;
  --destructive-hover: color-mix(in oklab, var(--destructive) 82%, var(--destructive-foreground));
  --destructive-foreground: #ffffff;
  --scrim: rgb(0 0 0 / 0.62);
  --border: transparent;
  --input: var(--surface-3);
  --ring: var(--brand-red);

  /* Layer 4 · effect tokens (dark variants) */
  --shadow-float: 0 12px 32px rgb(0 0 0 / 0.4);
  --shadow-modal: 0 24px 64px rgb(0 0 0 / 0.6);
  --shadow-hero-lift: 0 24px 48px rgb(220 38 38 / 0.22), inset 0 1px 0 rgb(255 255 255 / 0.06);
  --shadow-hero-fill: 0 12px 24px rgb(220 38 38 / 0.28), inset 0 0 0 1px rgb(255 255 255 / 0.14);
  --shadow-hero-inset: inset 0 1px 0 rgb(255 255 255 / 0.25), inset 0 -8px 16px rgb(0 0 0 / 0.18);
  --shadow-hero-edge: inset 0 0 0 1px rgb(255 255 255 / 0.05), inset 0 1px 0 rgb(255 255 255 / 0.2);
  --shadow-surface-inset: inset 0 1px 0 rgb(255 255 255 / 0.04);
}
```

- [ ] **Step 2: 在 `implementation-notes.md` 追加 Task 2 证据**

```
## Task 2 · 重写 variables.css
- 时间：<执行时间> PDT
- 改动：docs/current/design-system/variables.css
- 验证：与 tokens.json 比对，所有 raw + semantic + radius + shadow token 一一对应；dark mode 包含完整 Layer 1 + Layer 2 + Layer 4 覆盖（Layer 3 radius 继承自 :root）
- 备注：variables.css 未被 runtime build 直接引用，只是 design-system 源文件镜像；runtime 真源是 theme.css
```

- [ ] **Step 3: Commit**

```bash
git add docs/current/design-system/variables.css docs/specs/2026-05-28-0651-red-fluid-design-system/phase-1-tokens/implementation-notes.md
git commit -m "feat(design-system): rewrite variables.css mirror for red fluid system"
```

---

## Task 3 · 更新 DESIGN.md

**Files:**

- Modify: `docs/current/design-system/DESIGN.md`

- [ ] **Step 1: 用以下内容完整重写 `DESIGN.md`**

```markdown
# Reo Red Fluid Design System

本文档记录 Reo 当前视觉规则。可执行 token 以 `theme.css`、`variables.css`、`tokens.json` 和 `src/renderer/src/theme.css` 为准。

## 核心定义

Reo 使用品牌红表达入口、黑白中性控件语义、Fluid 多层 surface 骨架和扁平阅读层组成统一设计系统。界面优先保护表达意愿与阅读专注：品牌红 (`--brand-red`) 承载 Reo "录音/记录" 与品牌表达语义，不占用 `primary` 或 `ring`；`primary` 与 `ring` 是普通控件的高对比中性语义；多层 surface 在容器层提供 4 级 elevation；Hero 表面（FAB、RecordingOverlay、MemoryIcon、Segment 渐变卡）穿戴 brand-gradient 与玻璃光感；扁平阅读层（Input、Textarea、Tab、List row、Toolbar pill、Dropdown item）不上 gradient、不上玻璃，保护可读。

干净由排版与信息层级承担，不靠剥除视觉元素实现。融洽是设计正确的判据。

## Token 双层模型

Reo token 分为两层：

- **Layer 1 · raw 资产**：`--brand-{red,magenta,ember,gradient}`、`--surface-{1,2,3,4}`、`--shadow-{hero-lift,hero-fill,hero-inset,hero-edge,surface-inset}`。raw 层只在设计系统源文件与 semantic 层内被引用。
- **Layer 2 · semantic 角色**：shadcn 既有约定（`--background`、`--card`、`--popover`、`--primary`、`--ring`、`--input` 等），通过 `var(--raw-token)` 引用 raw 层。业务 TSX 只消费 semantic 层。

完整命名规范见 `docs/specs/2026-05-28-0651-red-fluid-design-system/README.md#section-6-token-命名规范`。该规范是 Token 维护的最终判据。

## 视觉语义

- `background` (= `surface-1`)：页面画布，light 纯白，dark 极深灰。
- `card` (= `surface-2`)：同平面容器与普通控件填充。
- `surface-3` (= `input`)：表单输入背景与强选中态。
- `popover` (= `surface-4`)：临时浮层 surface。
- `secondary` / `accent`：hover、active、selected 的灰度阶梯。
- `primary`：普通主动作、Switch checked 和状态点的高对比中性填充；light 为 `#18181b`，dark 为 `#fafafa`。
- `primary-hover`：普通主动作 hover，向当前 `background` 混合，保持 light / dark 下可见但克制。
- `ring`：focus ring，跟随 `primary`，不使用品牌红。
- `destructive` (`#b91c1c`)：删除、清空、放弃；红色只表达危险，不承担普通主动作。
- `brand-ember` (`#ff4704`)：Reo 既有品牌身份名，保留作为 FAB action 实色与 brand-gradient 暖头。
- `brand-gradient`：Hero 表达入口的"火"渐变 ember → red → magenta。
- `muted-foreground`：次级文本、弱 icon、placeholder 与 disabled 文案。
- `border`：透明。默认不使用线条表达同平面分割。

## 三条铁律（保留）

1. **Zero Border Policy**：同一平面的 Card、Button、Input、列表项、tab 和内容区不用 border 分割。难以区分时增加间距或调整填充，不加线。新 surface 阶梯之间靠 inset highlight 与 tint 落差区分，不画 1px 描边。
2. **Strict Z-Axis Elevation**：基础平面组件不使用 shadow。只有 Tooltip、Dropdown Menu、Dialog/Modal、Drawer 和 Toast 可使用 `shadow-float` 或 `shadow-modal`。Hero 表面通过 `shadow-hero-{lift,fill,inset,edge}` 表达"光"，不与 elevation 阶梯比较。
3. **Grayscale State Interaction**：hover、active、selected 默认通过 `card → secondary/accent` 灰度阶梯表达；Memory hue tint 仅出现在 MemoryRailCard 选中态、MemoryStudioSegmentCard 选中态与 MemoryIcon 内部，不渗到 chrome、不渗到文本色、不渗到 focus ring。

## 组件规则

- Button 默认文本动作 `rounded-lg`，compact `rounded-md`；32px icon button `rounded-sm`，40px icon button + menu action `rounded-md`；titlebar Breadcrumb trigger `rounded-sm`；primary 使用中性 `bg-primary`，hover `bg-primary-hover`；secondary/ghost 灰度填充；destructive 使用 `bg-destructive`（深红 `#b91c1c`），hover `bg-destructive-hover`；FAB trigger、FAB action、录音主 CTA 与 Segment strip overlay arrow 保持全圆，FAB trigger 和录音主 CTA 仍使用 `bg-brand-ember`。
- Input 与 Textarea 使用 `bg-input` (= `surface-3`)、无边框、无阴影；focus 与 invalid 只用中性 ring。
- Dropdown、Tooltip、Dialog、AlertDialog、Drawer 和 Toast 使用 `bg-popover` (= `surface-4`)，按浮层级别使用 `shadow-float` 或 `shadow-modal`。
- Tabs 使用 rounded segment button，不用 underline border。
- Memory card 使用 `ReoCardSurface` 默认形态，Segment preview card 使用 `ReoCardSurface` 的 `segmentPreview` 形态；通过灰度填充表达状态（选中态另叠 Memory hue tint，由对应组件接入），不使用常态 border、blur 或 shadow。
- `rounded-full` 只用于 FAB trigger、FAB action、录音主按钮、Segment strip overlay arrow、圆点、timeline marker 和 drawer/waveform handle；普通按钮、icon button、menu action 和 Breadcrumb trigger 使用方圆角。
- 可滚动内容边缘裁切使用 `edge-fade-y` / `edge-fade-x`；纵向文本容器组合 `scrollbar-hover` 默认隐藏滚动条。

## Hero 表面规则

Hero 不参与 elevation 阶梯（即不存在 `surface-5`），只挂在表达入口与身份载体上：

| 表达                     | Hero token 组合                                                                           | Owner                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| FAB SpeedDial trigger    | `--brand-gradient` + `--shadow-hero-fill` + `--shadow-hero-edge` + 静态 specular          | `components/ui/floating-action-button-speed-dial.tsx` |
| FAB SpeedDial action     | `--brand-ember` 实色（不上 gradient）                                                     | 同上                                                  |
| RecordingOverlay 主 CTA  | `--brand-gradient` + `--shadow-hero-fill` + `--shadow-hero-edge` + pulse ring（录音中）   | `RecordingHeroCta.tsx`（Phase 5 创建）                |
| RecordingOverlay surface | `--surface-1` + 顶部 30vh aurora mask                                                     | `RecordingAuroraOverlay.tsx`（Phase 5 创建）          |
| MemoryIcon primitive     | 多层 CSS gradient + `--shadow-hero-inset` + `--shadow-hero-lift` + 静态/可 hover specular | `components/ui/memory-icon.tsx`（Phase 2 创建）       |

## 命名规范关键约束

- 全部使用 kebab-case
- raw 层不带状态后缀（`--brand-red-hover` 是错误命名；hover 是 semantic 层状态）
- 渐变 token 使用完整词 `gradient`，不缩写
- 同 token 不得同时承载 raw 值与 semantic 角色
- 不引入未使用的 token
- 完整规范见 `docs/specs/2026-05-28-0651-red-fluid-design-system/README.md#section-6-token-命名规范`

## Electron 规则（保留）

- 标题栏拖拽区使用 `.drag-region`；交互控件使用 `.no-drag-region` 或等价 `-webkit-app-region: no-drag`。
- 全局默认不可选中文本；输入、textarea、contenteditable、转录、日志、路径和其他需要复制的内容必须显式 `select-text` 或 `.selectable-text`。
- 常规交互动效 `duration-150 ease-out`；结构动效上限 `duration-200 ease-out`；reduced motion 下关闭。
- `edge-fade-y`、`edge-fade-x`、`scrollbar-hover`、`reo-card-squircle`、`reo-segment-card-squircle` 和 `reo-content-tab-panel-motion` 是 renderer root CSS 中的 Tailwind v4 `@utility`；它们属于设计系统级可复用 utility，不进入业务私有 class。

## Token 维护

- 业务 TSX 只能消费 Layer 2 semantic 角色 token。
- 不为单个组件新增颜色、surface、radius、shadow 或 motion token。
- 只有当同一视觉不变量被多个真实组件稳定复用，且无法用当前 semantic token 表达时，才允许扩展。
- 任何新 token 必须落入 spec Section 6.7 reserved prefix 表中的某一个 prefix。
- shadcn/ui 新增 source 后必须移除生成代码中的同平面 border、默认 shadow 和硬编码颜色。
```

- [ ] **Step 2: 在 `implementation-notes.md` 追加 Task 3 证据**

```
## Task 3 · 更新 DESIGN.md
- 时间：<执行时间> PDT
- 改动：docs/current/design-system/DESIGN.md
- 验证：阅读修订后 DESIGN.md，确认它不再描述 "黑色为主 Soft Flat"，而是 "品牌红 + Fluid 多层 surface + 扁平阅读层"；Hero 表面表格与 spec Section 4.1 / 4.2 一致；命名规范关键约束指向 spec README#section-6
- 备注：narrative 文档，runtime 不消费；只服务 agent 阅读
```

- [ ] **Step 3: Commit**

```bash
git add docs/current/design-system/DESIGN.md docs/specs/2026-05-28-0651-red-fluid-design-system/phase-1-tokens/implementation-notes.md
git commit -m "docs(design-system): describe red fluid system + token naming convention reference"
```

---

## Task 4 · 重写 theme.css（runtime 投影）

**Files:**

- Modify: `src/renderer/src/theme.css`

- [ ] **Step 1: 用以下内容完整重写 `theme.css`**

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary-hover: var(--primary-hover);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-hover: var(--destructive-hover);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-scrim: var(--scrim);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-brand-red: var(--brand-red);
  --color-brand-magenta: var(--brand-magenta);
  --color-brand-ember: var(--brand-ember);

  --color-surface-1: var(--surface-1);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);
  --color-surface-4: var(--surface-4);

  --font-sans: 'Waldenburg', 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --font-memory-serif: 'Songti SC', STSong, 'Noto Serif CJK SC', serif;

  --tracking-heading: 0;
  --tracking-heading-lg: 0;
  --tracking-display: 0;
  --tracking-wide: 0.05em;
  --tracking-wider: 0.1em;

  --text-caption: 10px;
  --leading-caption: 1.4;
  --text-ui-xs: 11px;
  --leading-ui-xs: 1.5;
  --text-ui-sm: 12px;
  --leading-ui-sm: 1.6;
  --text-ui-md: 13px;
  --leading-ui-md: 1.6;
  --text-body: 14px;
  --leading-body: 1.6;
  --text-body-lg: 16px;
  --leading-body-lg: 1.6;
  --text-subheading: 18px;
  --leading-subheading: 1.5;
  --text-heading-sm: 20px;
  --leading-heading-sm: 1.4;
  --text-heading: 32px;
  --leading-heading: 1.2;
  --text-heading-lg: 36px;
  --leading-heading-lg: 1.2;
  --text-display: 48px;
  --leading-display: 1.1;

  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 600;

  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-56: 56px;
  --spacing-64: 64px;
  --spacing-72: 72px;
  --spacing-96: 96px;
  --spacing-160: 160px;

  --container-form: 720px;

  --radius: 16px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-3xl: 28px;
  --radius-4xl: 32px;
  --radius-full: 9999px;

  --shadow-float: var(--shadow-float);
  --shadow-modal: var(--shadow-modal);
  --shadow-hero-lift: var(--shadow-hero-lift);
  --shadow-hero-fill: var(--shadow-hero-fill);
  --shadow-hero-inset: var(--shadow-hero-inset);
  --shadow-hero-edge: var(--shadow-hero-edge);
  --shadow-surface-inset: var(--shadow-surface-inset);
}

:root,
[data-theme='light'] {
  color-scheme: light;

  --brand-red: #dc2626;
  --brand-magenta: #d946ef;
  --brand-ember: #ff4704;
  --brand-gradient: linear-gradient(
    135deg,
    var(--brand-ember) 0%,
    var(--brand-red) 50%,
    var(--brand-magenta) 100%
  );

  --surface-1: #ffffff;
  --surface-2: #f4f4f5;
  --surface-3: #ebebed;
  --surface-4: #ffffff;

  --background: var(--surface-1);
  --foreground: #18181b;
  --card: var(--surface-2);
  --card-foreground: #18181b;
  --popover: var(--surface-4);
  --popover-foreground: #18181b;
  --primary: var(--brand-red);
  --primary-foreground: #ffffff;
  --primary-hover: color-mix(in oklab, var(--primary) 90%, var(--foreground));
  --secondary: #e5e7eb;
  --secondary-foreground: #18181b;
  --muted: var(--surface-2);
  --muted-foreground: #71717a;
  --accent: #e5e7eb;
  --accent-foreground: #18181b;
  --destructive: #b91c1c;
  --destructive-hover: color-mix(in oklab, var(--destructive) 82%, var(--destructive-foreground));
  --destructive-foreground: #ffffff;
  --scrim: rgb(24 24 27 / 0.32);
  --border: transparent;
  --input: var(--surface-3);
  --ring: var(--brand-red);

  --shadow-float: 0 12px 32px rgb(0 0 0 / 0.08);
  --shadow-modal: 0 24px 64px rgb(0 0 0 / 0.12);
  --shadow-hero-lift: 0 24px 48px rgb(220 38 38 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.6);
  --shadow-hero-fill: 0 12px 24px rgb(220 38 38 / 0.18), inset 0 0 0 1px rgb(255 255 255 / 0.14);
  --shadow-hero-inset: inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 -8px 16px rgb(0 0 0 / 0.12);
  --shadow-hero-edge: inset 0 0 0 1px rgb(255 255 255 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.4);
  --shadow-surface-inset: inset 0 1px 0 rgb(0 0 0 / 0.02);
}

[data-theme='dark'] {
  color-scheme: dark;

  --brand-red: #dc2626;
  --brand-magenta: #d946ef;
  --brand-ember: #ff4704;
  --brand-gradient: linear-gradient(
    135deg,
    color-mix(in oklab, var(--brand-ember) 92%, #09090b) 0%,
    color-mix(in oklab, var(--brand-red) 92%, #09090b) 50%,
    color-mix(in oklab, var(--brand-magenta) 92%, #09090b) 100%
  );

  --surface-1: #09090b;
  --surface-2: #18181b;
  --surface-3: #1f1f23;
  --surface-4: #27272a;

  --background: var(--surface-1);
  --foreground: #fafafa;
  --card: var(--surface-2);
  --card-foreground: #fafafa;
  --popover: var(--surface-4);
  --popover-foreground: #fafafa;
  --primary: var(--brand-red);
  --primary-foreground: #ffffff;
  --primary-hover: color-mix(in oklab, var(--primary) 90%, var(--foreground));
  --secondary: #27272a;
  --secondary-foreground: #fafafa;
  --muted: var(--surface-2);
  --muted-foreground: #a1a1aa;
  --accent: color-mix(in oklab, var(--foreground) 10%, var(--popover));
  --accent-foreground: #fafafa;
  --destructive: #b91c1c;
  --destructive-hover: color-mix(in oklab, var(--destructive) 82%, var(--destructive-foreground));
  --destructive-foreground: #ffffff;
  --scrim: rgb(0 0 0 / 0.62);
  --border: transparent;
  --input: var(--surface-3);
  --ring: var(--brand-red);

  --shadow-float: 0 12px 32px rgb(0 0 0 / 0.4);
  --shadow-modal: 0 24px 64px rgb(0 0 0 / 0.6);
  --shadow-hero-lift: 0 24px 48px rgb(220 38 38 / 0.22), inset 0 1px 0 rgb(255 255 255 / 0.06);
  --shadow-hero-fill: 0 12px 24px rgb(220 38 38 / 0.28), inset 0 0 0 1px rgb(255 255 255 / 0.14);
  --shadow-hero-inset: inset 0 1px 0 rgb(255 255 255 / 0.25), inset 0 -8px 16px rgb(0 0 0 / 0.18);
  --shadow-hero-edge: inset 0 0 0 1px rgb(255 255 255 / 0.05), inset 0 1px 0 rgb(255 255 255 / 0.2);
  --shadow-surface-inset: inset 0 1px 0 rgb(255 255 255 / 0.04);
}
```

- [ ] **Step 2: 在 `implementation-notes.md` 追加 Task 4 证据**

```
## Task 4 · 重写 theme.css runtime
- 时间：<执行时间> PDT
- 改动：src/renderer/src/theme.css
- 验证：与 variables.css 严格对齐；@theme inline 块暴露所有新 token 给 Tailwind v4；:root/[data-theme='dark'] 包含 raw + semantic + shadow 完整定义
- 备注：theme.css 是 Tailwind v4 的真源；shadcn 组件通过 Tailwind utility 自动消费新 token
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/theme.css docs/specs/2026-05-28-0651-red-fluid-design-system/phase-1-tokens/implementation-notes.md
git commit -m "feat(theme): replace runtime tokens with red fluid system

- primary/ring -> brand-red (#dc2626)
- destructive -> #b91c1c (separate from primary by lightness)
- input -> surface-3 (slightly darker than card)
- add surface-1..4 raw elevation layer
- add brand-red, brand-magenta, brand-gradient
- add radius-3xl (28px), radius-4xl (32px)
- add shadow-hero-{lift,fill,inset,edge}, shadow-surface-inset
- expose new tokens via Tailwind v4 @theme inline

Part of spec docs/specs/2026-05-28-0651-red-fluid-design-system Phase 1."
```

---

## Task 5 · bg-brand-gradient utility（Task 8 已回滚）

Task 5 初始执行后，Task 8 review 判定该 utility 没有 current TSX consumer。最终 Phase 1 不保留 `bg-brand-gradient`；它延后到 FAB 或 RecordingOverlay owner phase。Phase 1 只保留 `--brand-gradient` raw token，不在 `src/renderer/src/index.css` 暴露无 owner utility。

---

## Task 6 · 修正 frontend.md 第 11 行设计系统描述

**Files:**

- Modify: `docs/current/frontend.md:11`

- [ ] **Step 1: 用 Edit 替换当前 frontend.md 中的描述句**

把 `docs/current/frontend.md` 第 11 行附近这一段：

```
- 当前设计系统是黑色为主、ember 和 destructive red 为辅的 Soft Flat Design System：纯白或极深灰画布、低对比灰度容器、无同平面描边、基础组件无阴影、浮层使用克制 Z 轴投影、黑色用于核心动作和明确状态，ember 用于表达入口和录音主按钮，destructive red 用于删除、清空、放弃等危险动作。
```

替换为：

```
- 当前设计系统是品牌红表达入口、黑白中性控件语义、Fluid 多层 surface 为骨架、保留扁平阅读层的 Red Fluid Design System：raw 资产 (`--brand-red`、`--brand-magenta`、`--brand-ember`、`--brand-gradient`、`--surface-1..4`) 与 semantic 角色（shadcn 既有 token）分层；同平面无描边、基础组件无阴影、浮层使用 `--shadow-float` / `--shadow-modal`；普通 `primary`、`primary-hover` 和 `ring` 是 light/dark 下的中性黑白控件语义；品牌红 (`#dc2626`) 只留给 brand / recording / Hero raw 资产；`destructive` (`#b91c1c`) 只表达危险动作；`--brand-ember` 是当前 FAB 和录音主 CTA 的实色入口，`--brand-gradient` 是 Hero raw 资产但暂无 TSX consumer。完整规范见 `docs/current/design-system/DESIGN.md`。
```

- [ ] **Step 2: 在 `implementation-notes.md` 追加 Task 6 证据**

```
## Task 6 · 修正 frontend.md 设计系统描述
- 时间：<执行时间> PDT
- 改动：docs/current/frontend.md 第 11 行附近
- 验证：阅读修订后该行，确认它准确描述新系统，且不重复 DESIGN.md 全部内容（只做指针）
- 备注：frontend.md 其余 Hero 表面映射段落延后到 Phase 6 文档收口阶段统一更新（Phase 5 之后再写当前事实）
```

- [ ] **Step 3: Commit**

```bash
git add docs/current/frontend.md docs/specs/2026-05-28-0651-red-fluid-design-system/phase-1-tokens/implementation-notes.md
git commit -m "docs(frontend): update design system tagline to red fluid system"
```

---

## Task 7 · verify:quick + 视觉 smoke

**Files:**

- 仅运行命令，不改文件

- [ ] **Step 1: 跑 verify:quick**

Run: `npm run verify:quick`

Expected: 全部通过，无 type error，无 lint error，无 test failure。如果失败：

- 如果是 type error 涉及 `bg-primary-hover` 之类的 Tailwind class 不存在 — 说明 Tailwind v4 未生成 `*-hover` color utility（默认只生成 background-color/text-color/border-color 的基础色）。预期不该失败，因为本次没有 TSX 改动。
- 如果是其他失败：在 implementation-notes 记录，然后判断是预存问题还是本 phase 引入。

- [ ] **Step 2: 启动 dev server 并视觉 smoke**

Run: `npm run dev`（后台启动）

打开 Reo 窗口后，手动核对：

1. AppShell sidebar 在 light / dark 两个主题下渲染正常，普通 `bg-primary` 控件保持中性黑白
2. WorkspaceStarterHome、loaded WorkspaceFrame 切换正常
3. 切换 light → dark → 跟随系统三个偏好，主题正确切换
4. 主动作按钮（保存笔记、Memory create dialog 的提交）显示中性 `bg-primary`
5. 焦点环（点击 Input 后 Tab 切走再回来）为中性 ring
6. 删除确认 AlertDialog 中的"删除"按钮是深红 `#b91c1c`，与 primary 红有明显亮度差
7. Switch（语音设置中的"启用豆包语音识别"）checked 时为中性 `bg-primary`
8. DropdownMenu、Tooltip 浮层正常显示，无 shadow / token 缺失
9. Memory Studio 内 Segment card、转录区域文本可读，无对比度问题
10. Input / Textarea 背景比 card 略深一档（surface-3 vs surface-2）

每一项截图或文字记录到 implementation-notes。

- [ ] **Step 3: 关闭 dev server 后在 `implementation-notes.md` 追加 Task 7 证据**

```
## Task 7 · verify:quick + 视觉 smoke
- 时间：<执行时间> PDT
- 改动：无文件改动
- 验证：
  - npm run verify:quick: <pass/fail + 摘要>
  - npm run dev 视觉 smoke 10 项：<逐项打勾或记录问题>
- 备注：<任何意外行为>
```

- [ ] **Step 4: Commit implementation-notes 更新**

```bash
git add docs/specs/2026-05-28-0651-red-fluid-design-system/phase-1-tokens/implementation-notes.md
git commit -m "docs(spec): record Phase 1 verify + smoke evidence"
```

---

## Task 8 · 过 /review 与 /simplify 门禁

**Files:**

- review/simplify 后产生小修复：`src/renderer/src/index.css`、Button primitive、token contract test、current docs、phase spec 和 runtime evidence artifacts

- [x] **Step 1: 跑 /review**

Run: `/code-review` 或调用 `review` skill 检查本 phase 的 diff。

Expected: 无 correctness bug、无无主 token、无 raw 层泄漏到业务消费点（本 phase 不应该有业务消费点；提前落地的 Hero token/utility 必须能追溯到 Phase 2/4/5 owner）。

把 /review 输出关键发现记录到 implementation-notes。

- [x] **Step 2: 跑 /simplify**

Run: `/simplify` 应用 review 的 reuse/simplification 建议（如有）。

如有改动：

```bash
git add -p
git commit -m "refactor(theme): <simplification description>"
```

如无改动：在 implementation-notes 记录 "/simplify 无可应用建议"。

- [x] **Step 3: 在 `implementation-notes.md` 追加 Task 8 证据**

```
## Task 8 · /review + /simplify 门禁
- 时间：<执行时间> PDT
- 改动：<可能的 simplify commit>
- 验证：
  - /review 关键发现：<列出>
  - /simplify 是否产生 commit：<是 / 否，及简述>
- 备注：phase-gate 通过，可进入 Phase 2 (MemoryIcon primitive)
```

- [x] **Step 4: 最终 Commit（如有 simplify 改动）**

```bash
git add docs/specs/2026-05-28-0651-red-fluid-design-system/phase-1-tokens/implementation-notes.md
git commit -m "docs(spec): record Phase 1 review + simplify gate evidence"
```

---

## Self-Review

**1. Spec coverage:**

| Spec 要求                                                                                                                                             | 实现 task                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Section 1.1 颜色 token（brand-red / brand-magenta / brand-ember / brand-gradient / primary / primary-hover / ring / destructive / destructive-hover） | Task 1（tokens.json）+ Task 2（variables.css）+ Task 4（theme.css） |
| Section 1.2 surface-1..4 + 与 background/card/input/popover 映射                                                                                      | Task 1 + Task 2 + Task 4                                            |
| Section 1.3 radius scale 含 3xl / 4xl                                                                                                                 | Task 1 + Task 2 + Task 4                                            |
| Section 1.4 shadow stack 含 hero-{lift,fill,inset,edge} + surface-inset                                                                               | Task 1 + Task 2 + Task 4                                            |
| Section 5.1 Phase 1 范围（token 文件 + current docs + Task 8 最小 Button hover consumer）                                                             | Task 1-8                                                            |
| Section 6 命名规范（raw / semantic 分层、reserved prefix）                                                                                            | DESIGN.md（Task 3）+ 完整规范引用 spec README                       |
| `bg-brand-gradient` utility（Phase 4 / 5 需要）                                                                                                       | Task 5 初始执行；Task 8 已移除，延后到 owner phase                  |
| TDD 红线判断（Phase 1 豁免）                                                                                                                          | Plan header 明确说明；Task 7 用 verify:quick + 视觉 smoke 代替      |
| phase-gate /review + /simplify                                                                                                                        | Task 8                                                              |
| implementation-notes 持续追加                                                                                                                         | 每个 Task 都有追加步骤                                              |

**2. Placeholder scan:** 已扫描，无 TBD / TODO / "implement later" / "appropriate error handling"。所有代码块为完整可粘贴内容。

**3. Type consistency:** Token 名称在 tokens.json / variables.css / theme.css 三处严格一致（同名同语义）；shadow inset 顺序在所有文件一致；color-mix 表达式逐字相同。

**4. 风险：** `--shadow-X: var(--shadow-X);` 在 `@theme inline` 中的自引用模式与现有 `theme.css` 一致；这是 Tailwind v4 对动态 CSS 变量的标准写法。Task 8 已排除 `docs` source scanning，避免 spec prose 里的 Tailwind-like 类名反向生成 runtime CSS；`bg-brand-gradient` 不保留到 Phase 1 runtime，延后到真实 owner primitive 接入时再落。

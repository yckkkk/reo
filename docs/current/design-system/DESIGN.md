# Reo 设计系统

本文档记录 Reo 当前视觉规则。可执行 token 以 `theme.css`、`variables.css`、`tokens.json` 和 `src/renderer/src/theme.css` 为准。

## Implementation Framework

- Reo tokens/theme are the visual source of truth.
- Tailwind CSS v4 + shadcn/ui + Radix primitives are the UI implementation framework.
- shadcn/ui source and Radix behavior must be retokenized to Reo visual rules.
- Do not invent a parallel custom component framework when shadcn/ui or Radix already covers the interaction primitive.

## 基调

- Product temperament：安静、克制、温柔、有时间感的私人表达工作室。
- 第一视觉印象应让用户愿意慢慢说话、慢慢回想、慢慢沉淀；不得像管理后台、项目协作工具、数据库前端、学习打卡软件或效率压迫界面。
- Theme：light 为默认主题，dark 通过同名 token 覆盖实现。
- 页面基底使用 Eggshell，保持接近白色但带轻微暖调。
- 主要文字使用 Obsidian，边界使用 Chalk，辅助文字使用 Gravel 或 Slate。
- 高饱和颜色只作为小型 avatar、圆点或状态指示使用，不作为正文、按钮或大面积背景色。
- 视觉层级主要由字号、字重、间距、hairline shadow 和低饱和 surface 建立。
- 视觉质量接近 iPhone 和 Mac 用户熟悉的高级感：留白充足、层级清晰、边界轻盈、交互有节奏，按钮和状态都像被认真放置过。
- 美感来自对注意力的尊重，不来自装饰，也不来自极端简化。允许留白，但留白必须服务表达、回看和继续补充。
- 时间线、多模态片段、声音波形和回顾提示用于呈现 memory 的生命感；不得把录音、图片、视频和笔记表现为普通附件堆叠。
- Dark theme 不是简单反色：背景避免纯黑，面板使用逐级抬升的暖中性色，scrim 不复用文字 token。

## Tokens — Colors

| Name                    | Value                 | Token                       | Role                                                                                         |
| ----------------------- | --------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| Eggshell                | `#fdfcfc`             | `--color-eggshell`          | 页面背景和 primary surface                                                                   |
| Powder                  | `#f5f3f1`             | `--color-powder`            | Secondary surface、hover state、active row                                                   |
| Chalk                   | `#e5e5e5`             | `--color-chalk`             | Border、divider、card outline、button outline                                                |
| Fog                     | `#b1b0b0`             | `--color-fog`               | Disabled state、placeholder、低强调图形                                                      |
| Gravel                  | `#777169`             | `--color-gravel`            | Secondary body text、nav item、subheading、caption                                           |
| Slate                   | `#a59f97`             | `--color-slate`             | Tertiary text、icon stroke、deemphasized label                                               |
| Cinder                  | `#57534f`             | `--color-cinder`            | Mid-tone text、light surface 上的 secondary heading                                          |
| Obsidian                | `#000000`             | `--color-obsidian`          | Primary text、filled action background、logo mark                                            |
| Signal Blue             | `#0447ff`             | `--color-signal-blue`       | Reo accent，仅用于小型圆形 UI 元素，不用于正文或 pill button                                 |
| Ember                   | `#ff4704`             | `--color-ember`             | Secondary Reo avatar accent，仅用于小型圆形 UI 元素                                          |
| Voice Spectrum          | `#3d75d8`             | `--color-voice-spectrum`    | Reo voice spectrum mark 的基础色                                                             |
| Voice Spectrum Gradient | `conic-gradient(...)` | `--gradient-voice-spectrum` | Reo voice spectrum mark gradient；完整值位于 `variables.css` 和 `src/renderer/src/theme.css` |
| Card White              | `#ffffff`             | `--color-card-white`        | 需要从 Eggshell 基底中分离出来的 card 和 contained form surface                              |
| Scrim                   | `#0f0e0d`             | `--color-scrim`             | Dialog、drawer 和 overlay 遮罩基色；不得复用 text token                                      |

## Tokens — 深色主题颜色

深色主题使用与浅色主题相同的 token 名称，由 `data-theme="dark"` 覆盖值。

| 名称           | 深色值    | Token                    | 用途                             |
| -------------- | --------- | ------------------------ | -------------------------------- |
| Eggshell       | `#151412` | `--color-eggshell`       | 深色页面背景和基础 surface       |
| Powder         | `#1d1b18` | `--color-powder`         | 深色次级抬升 surface             |
| Chalk          | `#393631` | `--color-chalk`          | 深色边界和分隔线                 |
| Fog            | `#6f675f` | `--color-fog`            | 深色 disabled 和 placeholder     |
| Gravel         | `#b5ada2` | `--color-gravel`         | 深色次级正文                     |
| Slate          | `#8f877d` | `--color-slate`          | 深色三级文字和 icon stroke       |
| Cinder         | `#d8d1c8` | `--color-cinder`         | 深色中强调标题和导航文字         |
| Obsidian       | `#f7f2ea` | `--color-obsidian`       | 深色主文字和 filled control 文字 |
| Signal Blue    | `#7f9cff` | `--color-signal-blue`    | 深色强调圆形 control 和焦点色    |
| Ember          | `#ff8a63` | `--color-ember`          | 深色次级状态强调色               |
| Voice Spectrum | `#8db0ff` | `--color-voice-spectrum` | 深色 voice spectrum 基础色       |
| Card White     | `#24221f` | `--color-card-white`     | 深色 contained card 和表单面板   |
| Scrim          | `#0f0e0d` | `--color-scrim`          | 深色 overlay 遮罩基色            |

深色主题同步覆盖 `--gradient-voice-spectrum`，保持 voice spectrum 在深色 surface 上仍有可读的亮蓝/青色层次。

## Tokens — Typography

### Waldenburg

- Token：`--font-waldenburg`。
- Role：32px 及以上 display、section heading。
- Weight：300。
- Sizes：32px、36px、48px。
- Line height：1.08-1.17。
- Letter spacing：32px 使用 -0.64px，36px 使用 -0.72px，48px 使用 -0.96px。
- Rule：display heading 不使用 300 以上的 Waldenburg weight。

### WaldenburgFH

- Token：`--font-waldenburgfh`。
- Role：product-family label、compact label、icon badge。
- Weight：700。
- Size：14px。
- Line height：1.10。
- Letter spacing：0.7px。
- Rule：只用于紧凑标签，不用于正文或大标题。

### Inter

- Token：`--font-inter`。
- Role：body copy、UI label、navigation、button、caption。
- Weights：400、500。
- Sizes：10px、11px、12px、13px、14px、15px、16px、18px、20px。
- Line height：1.0-2.06。
- OpenType features：`"kern" 1`。

### Geist Mono

- Token：`--font-geist-mono`。
- Role：code、technical annotation、machine-style inline marker。
- Weight：400。
- Size：13px。
- Line height：1.69。

### Type Scale

| Role       | Size | Line Height | Letter Spacing | Token               |
| ---------- | ---- | ----------- | -------------- | ------------------- |
| caption    | 10px | 1.2         | —              | `--text-caption`    |
| ui-xs      | 11px | 1.35        | —              | `--text-ui-xs`      |
| ui-sm      | 12px | 1.4         | —              | `--text-ui-sm`      |
| ui-md      | 13px | 1.43        | —              | `--text-ui-md`      |
| body       | 14px | 1.43        | —              | `--text-body`       |
| body-lg    | 16px | 1.5         | —              | `--text-body-lg`    |
| subheading | 18px | 1.44        | —              | `--text-subheading` |
| heading-sm | 20px | 1.4         | —              | `--text-heading-sm` |
| heading    | 32px | 1.17        | -0.64px        | `--text-heading`    |
| heading-lg | 36px | 1.13        | -0.72px        | `--text-heading-lg` |
| display    | 48px | 1.08        | -0.96px        | `--text-display`    |

## Tokens — Spacing & Shapes

Base unit：4px。

### Spacing Scale

| Name                  | Value | Token                             |
| --------------------- | ----- | --------------------------------- |
| 4                     | 4px   | `--spacing-4`                     |
| 8                     | 8px   | `--spacing-8`                     |
| 12                    | 12px  | `--spacing-12`                    |
| 16                    | 16px  | `--spacing-16`                    |
| 20                    | 20px  | `--spacing-20`                    |
| 24                    | 24px  | `--spacing-24`                    |
| 28                    | 28px  | `--spacing-28`                    |
| 32                    | 32px  | `--spacing-32`                    |
| 36                    | 36px  | `--spacing-36`                    |
| 40                    | 40px  | `--spacing-40`                    |
| 48                    | 48px  | `--spacing-48`                    |
| 56                    | 56px  | `--spacing-56`                    |
| 64                    | 64px  | `--spacing-64`                    |
| 72                    | 72px  | `--spacing-72`                    |
| 96                    | 96px  | `--spacing-96`                    |
| 160                   | 160px | `--spacing-160`                   |
| titlebar              | 48px  | `--spacing-titlebar`              |
| titlebar-control-left | 80px  | `--spacing-titlebar-control-left` |
| titlebar-control-top  | 2px   | `--spacing-titlebar-control-top`  |
| titlebar-control-size | 32px  | `--spacing-titlebar-control-size` |
| titlebar-control-gap  | 4px   | `--spacing-titlebar-control-gap`  |
| panel-titlebar-x      | 28px  | `--spacing-panel-titlebar-x`      |
| sidebar-content-top   | 56px  | `--spacing-sidebar-content-top`   |

### Layout Tokens

| Name                   | Value | Token                                                              | Role                                                                                                                   |
| ---------------------- | ----- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| App Titlebar Height    | 48px  | `--spacing-titlebar` / `layout.titlebar-height`                    | Borderless app titlebar height; app content may visually continue underneath it.                                       |
| Titlebar Control Left  | 80px  | `--spacing-titlebar-control-left` / `layout.titlebar-control-left` | Left edge for the sidebar hide/show control after the native traffic-light cluster.                                    |
| Titlebar Control Top   | 2px   | `--spacing-titlebar-control-top` / `layout.titlebar-control-top`   | Top edge for titlebar controls, aligned to the native traffic-light vertical center.                                   |
| Titlebar Control Size  | 32px  | `--spacing-titlebar-control-size`                                  | Hit target size for AppShell titlebar icon controls.                                                                   |
| Titlebar Control Gap   | 4px   | `--spacing-titlebar-control-gap`                                   | Horizontal gap from the sidebar hide/show control box to the workspace panel titlebar content when sidebar is covered. |
| Panel Titlebar Padding | 28px  | `--spacing-panel-titlebar-x`                                       | Horizontal inset inside workspace panel titlebar content.                                                              |
| Sidebar Content Top    | 56px  | `--spacing-sidebar-content-top`                                    | 48px titlebar plus 8px breathing room before sidebar navigation starts.                                                |

### Border Radius

| Element | Value  | Token              |
| ------- | ------ | ------------------ |
| tags    | 9999px | `--radius-tags`    |
| cards   | 16px   | `--radius-cards`   |
| badges  | 12px   | `--radius-badges`  |
| inputs  | 8px    | `--radius-inputs`  |
| modals  | 24px   | `--radius-modals`  |
| panels  | 20px   | `--radius-panels`  |
| buttons | 8px    | `--radius-buttons` |

### Shadows

| Name     | Token               |
| -------- | ------------------- |
| subtle   | `--shadow-subtle`   |
| subtle-2 | `--shadow-subtle-2` |
| subtle-3 | `--shadow-subtle-3` |
| subtle-4 | `--shadow-subtle-4` |
| subtle-5 | `--shadow-subtle-5` |
| subtle-6 | `--shadow-subtle-6` |
| subtle-7 | `--shadow-subtle-7` |
| subtle-8 | `--shadow-subtle-8` |
| subtle-9 | `--shadow-subtle-9` |

## Surfaces

| Level | Name           | Value     | Purpose                                        |
| ----- | -------------- | --------- | ---------------------------------------------- |
| 0     | Page Ground    | `#fdfcfc` | Page-level background                          |
| 1     | Powder Surface | `#f5f3f1` | Section highlight、hover、active row           |
| 2     | Card White     | `#ffffff` | Card、contained form surface                   |
| 3     | Obsidian       | `#000000` | Primary filled action、logo mark、dark surface |

## Components

### Filled Button

- Role：primary action。
- Background：`#000000`。
- Text：`#fdfcfc`。
- Radius：`8px`。
- Padding：horizontal 16px。
- Border：1px solid `#e5e5e5`。
- Label：Inter 500 13px；compact action 使用 Inter 500 12px。

### Secondary Button

- Role：secondary action。
- Background：`#ffffff`。
- Text：`#000000`。
- Radius：`8px`。
- Padding：horizontal 12px。
- Border：1px solid `#e5e5e5`。

### Accent Circle Button

- Role：explicit circular icon-only accent action。
- Background：Signal Blue。
- Text/Icon：`#ffffff`。
- Shape：circle。
- Minimum size：40px。
- Hover：background and border switch to Obsidian，保持 icon/text 为 Card White。
- Usage：only when a product flow explicitly needs a circular accent control；most buttons and sidebar icon buttons use 8px radius.

### Segmented Control

- Role：mode selector、tab selector。
- Background：transparent。
- Text：`#000000`。
- Radius：18px。
- Padding：8px 12px。
- Border：1px solid `#e5e5e5`。
- Active state：filled pill treatment。

### Compact Action Button

- Role：inline secondary action。
- Background：transparent。
- Text：`#000000`。
- Radius：12px。
- Padding：0 8-12px。
- Border：1px solid `#e5e5e5`。

### Product Card

- Role：interactive product surface。
- Background：`#ffffff`。
- Radius：16px。
- Shadow：hairline shadow only。
- Inner rows use Powder active state and 4px row highlight radius.
- Avatar or status dots stay within 8-32px.

### Navigation Bar

- Background：`#fdfcfc`。
- Height：36px。
- Max width：1200px。
- Nav labels：Inter 400 14px。
- Product labels：WaldenburgFH 700 14px with 0.7px tracking。
- Scroll boundary：1px solid `#e5e5e5` when needed。

### App Titlebar

- Height：48px。
- Background：transparent over the active shell surface。
- Border：none。
- The titlebar is a named AppShell layout slot, not an unstructured floating button layer。
- Main content panels reserve a matching 48px titlebar slot before page content starts。
- The titlebar drag region uses Electron `-webkit-app-region: drag`; interactive controls inside it use `no-drag`。
- Sidebar hide/show controls align to the native traffic-light row via explicit control top and size tokens。
- Workspace title text and the right MemoryRail collapse control use the left sidebar hide/show icon center as their vertical alignment baseline。
- Sidebar content starts below titlebar height plus 8px spacing。
- Sidebar hide/show control sits in the 48px titlebar layer, uses the 80px titlebar control-left token and 2px titlebar control-top token, and aligns to the native traffic-light row instead of centering itself in the full 48px titlebar height。
- When sidebar is covered, workspace panel titlebar content uses titlebar control left, control size, control gap and panel titlebar x padding to place the workspace title to the right of the sidebar hide/show icon。
- Titlebar must not introduce a visible separator line between the sidebar/page and the content panel。

### Section Divider Label

- Inter 400 12px。
- Color：`#777169`。
- No background。
- No border。
- Spacing to heading：8-12px。

### Text Input

- Background：transparent or `#ffffff`。
- Text：Inter 400 13px `#000000`，compact 使用 Inter 400 12px。
- Placeholder：Inter 400 13px `#a59f97`。
- Radius：8px。
- Transparent variant uses bottom border.
- Contained variant uses 1px Chalk border and subtle inset shadow.

### Textarea

- Background：`#ffffff`。
- Text：Inter 400 12px `#000000`。
- Placeholder：Inter 400 12px `#a59f97`。
- Radius：8px。
- Minimum height：72px。
- Border：1px solid Chalk。
- Focus：Signal Blue border。
- Usage：compact multiline metadata or note fields inside contained form rows；do not use display-scale typography inside textarea surfaces.

### Field Group

- Role：contained form rows with label、hint、control 和 validation。
- Divider：`--color-chalk` hairline，只存在于 rows 之间。
- Row spacing：vertical 16px；label/hint column 使用 `--field-label-min-width` 到 `--field-label-max-width`。
- Label：Inter 500 12px。
- Hint/Error：Inter 400 11px。

### Compact Menu

- Role：sidebar 记忆空间 action menu。
- Surface：Card White，1px Chalk border，subtle shadow。
- Radius：12px。
- Item：32px min-height，Inter 400 11px，icon 16px。
- Placement：anchor menu left edge to the trigger button left edge when opened from a compact header action.
- Naming：menu surface must have an accessible name；every menu item must expose a text accessible name.

### Typographic Feature Block

- Background：transparent。
- Border：0。
- Radius：0px。
- Heading：Inter 500 16px `#000000`。
- Body：Inter 400 14px `#777169`。
- Colored dot prefix may use Ember or Signal Blue.

## Rules

- Use Waldenburg 300 with negative tracking for headings at 32px and above.
- Use 8px radius for most buttons and inputs; only tags and explicit circular icon controls use 9999px.
- Use 16-20px radius for card and panel surfaces.
- Keep text, surface, border, and button colors near monochrome.
- Use Signal Blue and Ember only for small avatar dots, status indicators, focus rings, or explicit circular accent controls.
- Scrim 只用于 overlay 遮罩；不得把 Obsidian 当遮罩色，因为 Obsidian 在深色模式中是文字色。
- Use Geist Mono only for code, technical annotation, and machine-style markers.
- Use hairline elevation only; avoid heavy shadows.
- Use Eggshell for page-level surface; use Card White only for framed card and contained form surfaces.
- Do not create ad hoc palettes in product components.
- Do not put display-scale type inside compact controls, panels, or cards.
- Icon-only controls must expose a concrete accessible name on the button; never rely on DOM order or unnamed button positions.
- Do not use emoji in UI for icons, status, decoration, empty states, buttons, labels, or emotional tone.
- Use lucide icons when a symbol is needed and a matching icon exists; otherwise use text, Reo token status dots, or simple product graphics.
- Keep product UI software-like and engineered: clear hierarchy, precise controls, accessible states, and restrained motion. Do not make Reo feel toy-like.

## Layout

- Page max width：1200px。
- Section gap：80-120px。
- Card padding：16-24px。
- Element gap：8-12px。
- Major layouts should stay type-first and surface-light.
- White cards may sit on Eggshell ground; page sections should not become nested card stacks.

## Source Files

The canonical source files in this directory are:

- `theme.css`: Tailwind v4 `@theme static` token source.
- `variables.css`: CSS custom properties source.
- `tokens.json`: structured design token source.

Do not copy token blocks from this document into runtime code. Use the source files above so Tailwind tokens, CSS variables, and structured tokens stay aligned.

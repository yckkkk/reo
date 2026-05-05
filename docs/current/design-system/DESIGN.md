# Reo 设计系统

本文档记录 Reo 当前视觉规则。可执行 token 以 `theme.css`、`variables.css`、`tokens.json` 和 `src/renderer/src/theme.css` 为准。

## 基调

- Theme：light。
- 页面基底使用 Eggshell，保持接近白色但带轻微暖调。
- 主要文字使用 Obsidian，边界使用 Chalk，辅助文字使用 Gravel 或 Slate。
- 高饱和颜色只作为小型 avatar、圆点或状态指示使用，不作为正文、按钮或大面积背景色。
- 视觉层级主要由字号、字重、间距、hairline shadow 和低饱和 surface 建立。

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
| Signal Blue             | `#0447ff`             | `--color-signal-blue`       | Reo brand avatar accent，仅用于小型圆形 UI 元素                                              |
| Ember                   | `#ff4704`             | `--color-ember`             | Secondary Reo avatar accent，仅用于小型圆形 UI 元素                                          |
| Voice Spectrum          | `#3d75d8`             | `--color-voice-spectrum`    | Reo voice spectrum mark 的基础色                                                             |
| Voice Spectrum Gradient | `conic-gradient(...)` | `--gradient-voice-spectrum` | Reo voice spectrum mark gradient；完整值位于 `variables.css` 和 `src/renderer/src/theme.css` |
| Card White              | `#ffffff`             | `--color-card-white`        | 需要从 Eggshell 基底中分离出来的 card 和 contained form surface                              |

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
- Sizes：10px、12px、13px、14px、15px、16px、18px、20px。
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

| Name | Value | Token           |
| ---- | ----- | --------------- |
| 4    | 4px   | `--spacing-4`   |
| 8    | 8px   | `--spacing-8`   |
| 12   | 12px  | `--spacing-12`  |
| 16   | 16px  | `--spacing-16`  |
| 20   | 20px  | `--spacing-20`  |
| 24   | 24px  | `--spacing-24`  |
| 28   | 28px  | `--spacing-28`  |
| 32   | 32px  | `--spacing-32`  |
| 36   | 36px  | `--spacing-36`  |
| 40   | 40px  | `--spacing-40`  |
| 48   | 48px  | `--spacing-48`  |
| 56   | 56px  | `--spacing-56`  |
| 64   | 64px  | `--spacing-64`  |
| 72   | 72px  | `--spacing-72`  |
| 96   | 96px  | `--spacing-96`  |
| 160  | 160px | `--spacing-160` |

### Border Radius

| Element | Value  | Token              |
| ------- | ------ | ------------------ |
| tags    | 9999px | `--radius-tags`    |
| cards   | 16px   | `--radius-cards`   |
| badges  | 12px   | `--radius-badges`  |
| inputs  | 0px    | `--radius-inputs`  |
| modals  | 24px   | `--radius-modals`  |
| panels  | 20px   | `--radius-panels`  |
| buttons | 9999px | `--radius-buttons` |

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

### Filled Pill Button

- Role：primary action。
- Background：`#000000`。
- Text：`#fdfcfc`。
- Radius：`9999px`。
- Padding：horizontal 16px。
- Border：1px solid `#e5e5e5`。
- Label：Inter 500 14px；product-family label 可使用 WaldenburgFH 700 14px。

### Ghost Pill Button

- Role：secondary action。
- Background：`#ffffff`。
- Text：`#000000`。
- Radius：`9999px`。
- Padding：horizontal 12px。
- Border：1px solid `#e5e5e5`。

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

### Section Divider Label

- Inter 400 14px。
- Color：`#777169`。
- No background。
- No border。
- Spacing to heading：8-12px。

### Text Input

- Background：transparent or `#ffffff`。
- Text：Inter 400 14px `#000000`。
- Placeholder：Inter 400 14px `#a59f97`。
- Radius：0px。
- Transparent variant uses bottom border.
- Contained variant uses 1px Chalk border and subtle inset shadow.

### Typographic Feature Block

- Background：transparent。
- Border：0。
- Radius：0px。
- Heading：Inter 500 16px `#000000`。
- Body：Inter 400 14px `#777169`。
- Colored dot prefix may use Ember or Signal Blue.

## Rules

- Use Waldenburg 300 with negative tracking for headings at 32px and above.
- Use 9999px radius for button and pill tags.
- Use 16-20px radius for card and panel surfaces.
- Use 0px radius for input fields.
- Keep text, surface, border, and button colors near monochrome.
- Use Signal Blue and Ember only for small avatar dots or status indicators.
- Use Geist Mono only for code, technical annotation, and machine-style markers.
- Use hairline elevation only; avoid heavy shadows.
- Use Eggshell for page-level surface; use Card White only for framed card and contained form surfaces.
- Do not create ad hoc palettes in product components.
- Do not put display-scale type inside compact controls, panels, or cards.

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

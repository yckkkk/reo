# Reo 设计系统

本文档记录 Reo 当前视觉规则。可执行 token 以 `theme.css`、`variables.css`、`tokens.json` 和 `src/renderer/src/theme.css` 为准。

## Implementation Framework

- Reo tokens/theme are the visual source of truth.
- Tailwind CSS v4 + shadcn/ui + Radix primitives are the UI implementation framework.
- shadcn/ui source and Radix behavior must be retokenized to Reo visual rules.
- Do not invent a parallel custom component framework when shadcn/ui or Radix already covers the interaction primitive.
- Product components must consume Reo tokens、primitive variants and documented patterns. If a needed visual rule is missing, update this design-system source first, then implement the component; do not hide one-off visual constants in feature components.

## 基调

- Product temperament：现代扁平矢量插画风 + 毛玻璃 + 北欧极简 + 日式留白的私人记忆工作室，安静、清晰、有时间感。
- 第一视觉印象应让用户愿意慢慢说话、慢慢回想、慢慢沉淀；不得像管理后台、项目协作工具、数据库前端、学习打卡软件、效率压迫界面或粗糙 MVP。
- 设计气质的具体落点：北欧极简使用低饱和度色彩和克制设计语言；现代扁平矢量插画使用几何图形、纯色面和无描边插画对象；毛玻璃效果使用背景模糊与半透明质感做空间聚焦；日式留白使用大面积负空间和不对称平衡建立呼吸感。
- Theme：light 为默认主题，dark 通过同名 token 覆盖实现。
- 页面基底使用 Eggshell，保持接近白色但带轻微暖调。
- 主要文字使用 Obsidian，边界使用 Chalk，辅助文字使用 Gravel 或 Slate。
- 功能色使用降噪后的低饱和自然色：Signal Blue 映射为石板灰，Ember 映射为燕麦色，Vector accent 只做小面积纯色点缀；不得用高纯度警示色制造完成感。
- 视觉层级由字号、字重、间距、纯色块、1px/2px 实线、明确状态色、克制的毛玻璃 surface 和环境光阴影建立；产品 content surface 不使用阴影堆叠。
- 视觉质量接近 iPhone 和 Mac 用户熟悉的高级感：留白充足、层级清晰、边界干净、交互有节奏，按钮和状态都像被认真放置过。
- 美感来自对注意力的尊重，不来自装饰，也不来自极端简化。允许留白，但留白必须服务表达、回看和继续补充。
- 时间线、多模态片段、声音波形和回顾提示用于呈现 memory 的生命感；录音片段使用扁平矢量卡片、动态波形和等宽时间表达，不表现为普通附件堆叠。
- Dark theme 不是简单反色：背景避免纯黑，面板使用中性色、实线边界、同名 token 和必要的玻璃化遮罩表达空间关系，scrim 不复用文字 token。

## Glass Vector

- 毛玻璃用于表达工作区、overlay、录音沉浸层、dialog/scrim 和侧栏关系的空间聚焦；它必须服务注意力和当前操作，不作为通用装饰。
- 现代扁平矢量用于表达 Memory、Segment、SegmentAttachment、波形、时间轴、图标和按钮状态；插画性对象优先使用几何纯色面和无描边形体，交互性容器才使用 1px/2px token 边界。
- 北欧极简要求页面 palette 保持低饱和、材料克制和功能诚实；高饱和色只能做小面积状态或品牌焦点。
- 日式留白要求主要页面保留大面积负空间、非等分排布和不对称平衡；留白必须服务表达和回看，不得变成空洞占位。
- Hover/active/focus 使用纯色切换、颜色反转、border 色、focus ring、轻量 opacity 和明确 motion；避免用大阴影、悬浮位移或缩放模拟物理厚度。
- 结构性动效可以存在，例如 MemoryRail 折叠滑入/滑出、FAB speed dial 展开、录音波形律动、dialog 进入/退出；动效必须解释状态变化，而不是装饰性漂浮。
- 图标使用 lucide 或等粗纯色几何；图形元素由基础线段、圆点、矩形、波形 bars 和纯色块构成。
- 工程标签、时间、计数和机器感数据使用 Geist Mono、全大写或等宽数字、适度 tracking；正文和标题使用 sans-serif 或 Reo 标题字体。
- Recording Segment card 是扁平矢量对象：aspect-square、2px solid border、22-24px radius、标题直入、底部动态 bars + 等宽时间，不放 `SEG 01` 这类表格标签。

## Tokens — Colors

| Name                   | Value                    | Token                            | Role                                                               |
| ---------------------- | ------------------------ | -------------------------------- | ------------------------------------------------------------------ |
| Eggshell               | `#f2f0eb`                | `--color-eggshell`               | 暖灰白主背景，承载北欧极简和日式留白                               |
| Powder                 | `#eae7df`                | `--color-powder`                 | 稍深暖灰，次级背景、hover 和柔和分区                               |
| Chalk                  | `#dcd5c6`                | `--color-chalk`                  | 米色边界、分隔线和扁平矢量太阳色                                   |
| Fog                    | `#a3b1b6`                | `--color-fog`                    | 雾霾蓝，disabled、placeholder、远山色和低饱和媒体色                |
| Gravel                 | `#859499`                | `--color-gravel`                 | 石板灰，次级文本、数据标签和 muted icon                            |
| Slate                  | `#7a8b80`                | `--color-slate`                  | 鼠尾草绿，主强调色和矢量植物色                                     |
| Cinder                 | `#6a7b70`                | `--color-cinder`                 | 深鼠尾草绿，hover、active 和中强调文本                             |
| Obsidian               | `#4a5559`                | `--color-obsidian`               | 深石板灰，主文本和 filled action 背景                              |
| Signal Blue            | `#859499`                | `--color-signal-blue`            | 降噪后的交互焦点色，映射为石板灰                                   |
| Ember                  | `#d2b48c`                | `--color-ember`                  | 降噪后的温暖燕麦色，用于录音和少量温度提示                         |
| Vector Mint            | `#8b9b90`                | `--color-vector-mint`            | 低饱和现代扁平矢量点缀                                             |
| Vector Sun             | `#dcd5c6`                | `--color-vector-sun`             | 低饱和现代扁平矢量点缀                                             |
| Vector Coral           | `#cba896`                | `--color-vector-coral`           | 低饱和现代扁平矢量点缀                                             |
| Vector Lilac           | `#b0b5c0`                | `--color-vector-lilac`           | 低饱和现代扁平矢量点缀                                             |
| Voice Spectrum         | `#a3b1b6`                | `--color-voice-spectrum`         | 真实音频波形和声谱基础色                                           |
| Card Glass             | `rgb(255 255 255 / 0.3)` | `--color-card-glass`             | 毛玻璃卡片和 contained surface 的半透明基础色                      |
| On Accent              | `#f2f0eb`                | `--color-on-accent`              | filled/accent 控件上的文字和图标色；不得复用 glass surface token   |
| Scrim                  | `rgb(74 85 89 / 0.4)`    | `--color-scrim`                  | Dialog、drawer、录音 overlay 和玻璃化遮罩基色；不得复用 text token |
| Glass Border           | `rgb(255 255 255 / 0.5)` | `--color-glass-border`           | 毛玻璃 surface 默认边界                                            |
| Glass Border Highlight | `rgb(255 255 255 / 0.8)` | `--color-glass-border-highlight` | 毛玻璃高亮边界和 primary control 边界                              |

## Tokens — 深色主题颜色

深色主题使用与浅色主题相同的 token 名称，由 `data-theme="dark"` 覆盖值。

| 名称                   | 深色值                    | Token                            | 用途                             |
| ---------------------- | ------------------------- | -------------------------------- | -------------------------------- |
| Eggshell               | `#1e2021`                 | `--color-eggshell`               | 深石板页面背景                   |
| Powder                 | `#252829`                 | `--color-powder`                 | 深色次级 surface                 |
| Chalk                  | `#343a3c`                 | `--color-chalk`                  | 深色边界和分隔线                 |
| Fog                    | `#4a5559`                 | `--color-fog`                    | 深色 disabled 和 placeholder     |
| Gravel                 | `#7a8b80`                 | `--color-gravel`                 | 深色次级正文                     |
| Slate                  | `#859499`                 | `--color-slate`                  | 深色主强调和 icon stroke         |
| Cinder                 | `#a3b1b6`                 | `--color-cinder`                 | 深色 hover、active 和中强调标题  |
| Obsidian               | `#f2f0eb`                 | `--color-obsidian`               | 暗色界面主文本和浅色 filled 控件 |
| Signal Blue            | `#a3b1b6`                 | `--color-signal-blue`            | 深色降噪交互焦点色               |
| Ember                  | `#d2b48c`                 | `--color-ember`                  | 深色温暖燕麦状态强调             |
| Vector Mint            | `#8b9b90`                 | `--color-vector-mint`            | 深色扁平矢量纯色点缀             |
| Vector Sun             | `#dcd5c6`                 | `--color-vector-sun`             | 深色扁平矢量纯色点缀             |
| Vector Coral           | `#cba896`                 | `--color-vector-coral`           | 深色扁平矢量纯色点缀             |
| Vector Lilac           | `#b0b5c0`                 | `--color-vector-lilac`           | 深色扁平矢量纯色点缀             |
| Voice Spectrum         | `#a3b1b6`                 | `--color-voice-spectrum`         | 深色真实音频波形色               |
| Card Glass             | `rgb(37 40 41 / 0.4)`     | `--color-card-glass`             | 深色毛玻璃 card surface          |
| On Accent              | `#1e2021`                 | `--color-on-accent`              | 深色 filled/accent 控件文字      |
| Scrim                  | `rgb(15 14 13 / 0.8)`     | `--color-scrim`                  | 深色 overlay 遮罩基色            |
| Glass Border           | `rgb(255 255 255 / 0.08)` | `--color-glass-border`           | 深色毛玻璃边界                   |
| Glass Border Highlight | `rgb(255 255 255 / 0.15)` | `--color-glass-border-highlight` | 深色高亮边界                     |

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
- Weight：600。
- Size：14px。
- Line height：1.10。
- Letter spacing：0.7px。
- Rule：只用于紧凑标签，不用于正文或大标题。

### Inter

- Token：`--font-inter`。
- Role：body copy、UI label、navigation、button、caption。
- Weights：400、500、600。
- Sizes：10px、11px、12px、13px、14px、15px、16px、18px、20px。
- Line height：1.4-1.6 for UI/body，1.1-1.4 for heading。
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
| caption    | 10px | 1.4         | —              | `--text-caption`    |
| ui-xs      | 11px | 1.5         | —              | `--text-ui-xs`      |
| ui-sm      | 12px | 1.6         | —              | `--text-ui-sm`      |
| ui-md      | 13px | 1.6         | —              | `--text-ui-md`      |
| body       | 14px | 1.6         | —              | `--text-body`       |
| body-lg    | 16px | 1.6         | —              | `--text-body-lg`    |
| subheading | 18px | 1.5         | —              | `--text-subheading` |
| heading-sm | 20px | 1.4         | -0.02em        | `--text-heading-sm` |
| heading    | 32px | 1.2         | -0.02em        | `--text-heading`    |
| heading-lg | 36px | 1.2         | -0.02em        | `--text-heading-lg` |
| display    | 48px | 1.1         | -0.04em        | `--text-display`    |

### Tracking Tokens

| Name    | Value     | Token                | Role                   |
| ------- | --------- | -------------------- | ---------------------- |
| tight   | `-0.02em` | `--tracking-tight`   | Compact display text   |
| normal  | `0`       | `--tracking-normal`  | Default text           |
| wide    | `0.05em`  | `--tracking-wide`    | Engineering label      |
| wider   | `0.1em`   | `--tracking-wider`   | Uppercase/system label |
| widest  | `0.2em`   | `--tracking-widest`  | Sparse technical label |
| heading | `-0.02em` | `--tracking-heading` | Heading text           |
| display | `-0.04em` | `--tracking-display` | Display text           |

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
| cards   | 32px   | `--radius-cards`   |
| badges  | 16px   | `--radius-badges`  |
| inputs  | 12px   | `--radius-inputs`  |
| modals  | 32px   | `--radius-modals`  |
| panels  | 24px   | `--radius-panels`  |
| buttons | 9999px | `--radius-buttons` |

### Shadow Tokens

| Name   | Token             | Value                                    | Role                               |
| ------ | ----------------- | ---------------------------------------- | ---------------------------------- |
| subtle | `--shadow-subtle` | `0 4px 12px rgb(122 139 128 / 0.05)`     | Low-noise ambient shadow           |
| glass  | `--shadow-glass`  | `0 8px 32px 0 rgb(122 139 128 / 0.1)`    | Glass surface environmental shadow |
| float  | `--shadow-float`  | `0 20px 40px -10px rgb(74 85 89 / 0.15)` | High emphasis floating surface     |

### Blur Tokens

| Name     | Token             | Value |
| -------- | ----------------- | ----- |
| glass-sm | `--blur-glass-sm` | 8px   |
| glass-md | `--blur-glass-md` | 16px  |
| glass-lg | `--blur-glass-lg` | 24px  |

### Glass Tokens

| Name                   | Token                            | Role                           |
| ---------------------- | -------------------------------- | ------------------------------ |
| Scrim Overlay          | `--glass-scrim-overlay`          | Dialog/Drawer 普通遮罩         |
| Recording Overlay      | `--glass-recording-overlay`      | 录音沉浸层背景                 |
| Recording Overlay Blur | `--glass-recording-overlay-blur` | 录音沉浸层毛玻璃模糊           |
| Glass Control Hover    | `--glass-control-hover`          | 录音层透明 icon control hover  |
| Glass Ember Hover      | `--glass-ember-hover`            | 录音层 Ember text action hover |
| Recording Primary Halo | `--recording-primary-halo`       | 录音主圆形按钮的品牌 halo      |

## Surfaces

| Level | Name           | Value                    | Purpose                                             |
| ----- | -------------- | ------------------------ | --------------------------------------------------- |
| 0     | Page Ground    | `#f2f0eb`                | Warm page background                                |
| 1     | Powder Surface | `#eae7df`                | Section highlight、hover、active row                |
| 2     | Card Glass     | `rgb(255 255 255 / 0.3)` | Glass card、contained form surface、floating panels |
| 3     | Obsidian       | `#4a5559`                | Primary filled action、logo mark、dark surface      |

## Glass Surfaces

- App shell 主面板、Dialog overlay、Drawer/recording overlay 和右侧 rail 的空间关系只能使用已命名 glass token 或本文档记录的 primitive pattern，例如 `--color-card-glass`、`--color-glass-border`、`--shadow-glass`、`--blur-glass-lg`、`--glass-scrim-overlay`、`--glass-recording-overlay`、`--glass-recording-overlay-blur`、`--glass-control-hover`、`--glass-ember-hover` 和 `--recording-primary-halo`。
- Dialog/Drawer 普通遮罩使用 `--glass-scrim-overlay`；录音沉浸层使用 `--glass-recording-overlay` + `--glass-recording-overlay-blur` + 去饱和背景；录音 control hover/halo 使用对应 glass token。
- 玻璃化 surface 必须保留清晰文字对比、可见边界和稳定 hit target；不得让正文、按钮或 icon 因透明叠加变得灰、糊或难以点击。
- Memory Studio 的 Segment card 是 glass-vector 内容对象：使用 Card Glass surface、2px token border、真实或当前片段的波形表达、等宽时间和明确 selected border；不得回到普通列表或附件堆叠。
- 若透明或 blur 无法提升焦点、层级或转场理解，应退回纯色块、实线边界和 typography。

## Components

### Filled Button

- Role：primary action。
- Background：`--color-obsidian`。
- Text/Icon：`--color-on-accent`。
- Radius：`--radius-buttons`。
- Padding：horizontal 16px。
- Border：1px solid `--color-obsidian`。
- Label：Inter 500 13px；compact action 使用 Inter 500 12px。

### Secondary Button

- Role：secondary action。
- Background：`--color-card-glass` + `--blur-glass-sm`。
- Text：`--color-obsidian`。
- Radius：`--radius-buttons`。
- Padding：horizontal 12px。
- Border：1px solid `--color-glass-border`。

### Accent Circle Button

- Role：explicit circular icon-only accent action。
- Background：Signal Blue；recording primary circle may use Ember。
- Text/Icon：`--color-on-accent`。
- Shape：circle。
- Minimum size：40px。
- Hover：background and border switch to Obsidian，保持 icon/text 为 On Accent。
- Usage：only when a product flow explicitly needs a circular accent control；recording primary start button is the only current large Ember circle；ordinary command buttons use the pill radius token and sidebar icon buttons remain circular hit targets.

### Segmented Control

- Role：mode selector、tab selector。
- Background：transparent。
- Text：`--color-obsidian`。
- Radius：`--radius-buttons`。
- Padding：8px 12px。
- Border：1px solid `--color-glass-border`。
- Active state：filled pill treatment。

### Compact Action Button

- Role：inline secondary action。
- Background：transparent。
- Text：`--color-obsidian`。
- Radius：`--radius-buttons`。
- Padding：0 8-12px。
- Border：1px solid `--color-glass-border`。

### Product Card

- Role：interactive product surface。
- Background：`--color-card-glass` + relevant glass blur token。
- Radius：`--radius-cards` for large product cards；Memory Studio compact Segment cards use `--radius-panels`。
- Border：1px or 2px solid Glass Border / Signal Blue。
- Inner rows use Powder active state and 4px row highlight radius.
- Avatar or status dots stay within 8-32px.

### Navigation Bar

- Background：`--color-eggshell`。
- Height：36px。
- Max width：1200px。
- Nav labels：Inter 400 14px。
- Product labels：WaldenburgFH 700 14px with 0.7px tracking。
- Scroll boundary：1px solid `--color-chalk` when needed。

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
- Color：`--color-gravel`。
- No background。
- No border。
- Spacing to heading：8-12px。

### Text Input

- Background：transparent or `--color-card-glass` + `--blur-glass-sm`。
- Text：Inter 400 13px `--color-obsidian`，compact 使用 Inter 400 12px。
- Placeholder：Inter 400 13px `--color-slate`。
- Radius：`--radius-inputs`。
- Transparent variant uses bottom border.
- Contained variant uses 1px Glass Border.

### Textarea

- Background：`--color-card-glass` + `--blur-glass-sm`。
- Text：Inter 400 12px `--color-obsidian`。
- Placeholder：Inter 400 12px `--color-slate`。
- Radius：`--radius-inputs`。
- Minimum height：72px。
- Border：1px solid Glass Border。
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
- Surface：Card Glass + `--blur-glass-md`，1px Glass Border。
- Radius：12px。
- Item：32px min-height，Inter 400 11px，icon 16px。
- Placement：anchor menu left edge to the trigger button left edge when opened from a compact header action.
- Naming：menu surface must have an accessible name；every menu item must expose a text accessible name.

### Typographic Feature Block

- Background：transparent。
- Border：0。
- Radius：0px。
- Heading：Inter 500 16px `--color-obsidian`。
- Body：Inter 400 14px `--color-gravel`。
- Colored dot prefix may use Ember or Signal Blue.

## Rules

- Use Waldenburg 300 or Inter 600 with token tracking for headings at 32px and above.
- Use `--radius-buttons` for pill buttons, `--radius-inputs` for fields, `--radius-panels`/`--radius-cards` for glass-vector content surfaces.
- Keep text, surface, border, and button colors in the Nordic low-saturation palette.
- Use Signal Blue and Ember only for status indicators、focus rings、waveform emphasis or explicit circular accent controls. Ember may be used by the recording primary circle, but not by page backgrounds, ordinary cards, body text, or default pill buttons.
- Scrim 只用于 overlay 遮罩；不得把 Obsidian 当遮罩色，因为 Obsidian 在深色模式中是文字色。
- Use Geist Mono for code, technical annotation, time, counts, and machine-style data labels.
- Product content surfaces may use the named subtle/glass/float shadow tokens only when paired with a glass surface and clear border; do not create ad hoc shadow stacks.
- Use Eggshell for page-level surface; use Card Glass only for framed card、contained form surface、floating menu、dialog 和 rail。
- Do not create ad hoc palettes in product components.
- Do not create one-off component aesthetics in feature code. Size、radius、color、surface、motion、icon weight、waveform rhythm and overlay treatment must trace back to Reo tokens or this document.
- New design tokens are added only for stable cross-component invariants or named primitive patterns. A single feature-specific measurement stays as local geometry only when it is tied to that feature's layout, and obsolete token aliases must be removed instead of kept as compatibility affordances.
- Do not put display-scale type inside compact controls, panels, or cards.
- Icon-only controls must expose a concrete accessible name on the button; never rely on DOM order or unnamed button positions.
- Do not use emoji in UI for icons, status, decoration, empty states, buttons, labels, or emotional tone.
- Use lucide icons when a symbol is needed and a matching icon exists; otherwise use text, Reo token status dots, or simple product graphics.
- Keep product UI software-like and engineered: clear hierarchy, precise controls, accessible states, glass-vector layering, and flat vector motion. Do not make Reo feel toy-like.

## Layout

- Page max width：1200px。
- Section gap：120-160px。
- Card padding：32-56px。
- Element gap：8-12px。
- Major layouts should stay type-first and surface-light.
- Glass cards may sit on Eggshell ground; page sections should not become nested card stacks.

## Source Files

The canonical source files in this directory are:

- `theme.css`: Tailwind v4 `@theme static` token source.
- `variables.css`: CSS custom properties source.
- `tokens.json`: structured design token source.

Do not copy token blocks from this document into runtime code. Use the source files above so Tailwind tokens, CSS variables, and structured tokens stay aligned.

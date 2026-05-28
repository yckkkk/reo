# Reo Red Fluid Design System

本文档记录 Reo 当前视觉规则。可执行 token 以 `theme.css`、`variables.css`、`tokens.json` 和 `src/renderer/src/theme.css` 为准。

## 核心定义

Reo 使用品牌红为主、Fluid 多层 surface 为骨架、保留扁平阅读层的统一设计系统。界面优先保护表达意愿与阅读专注：品牌红 (`--brand-red`) 承载 Reo "录音/记录" 的语义，作为 primary、ring、主 CTA 的色相载体；多层 surface 在容器层提供 4 级 elevation；Hero 表面（FAB、RecordingOverlay、MemoryIcon、Segment 渐变卡）穿戴 brand-gradient 与玻璃光感；扁平阅读层（Input、Textarea、Tab、List row、Toolbar pill、Dropdown item）不上 gradient、不上玻璃，保护可读。

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
- `primary` (= `brand-red`)：主动作、focus ring；替换历史黑色 primary。
- `primary-hover`：主动作 hover。
- `destructive` (`#b91c1c`)：删除、清空、放弃；色相同为红，靠位置与上下文与 `primary` 区分，不靠色相。
- `brand-ember` (`#ff4704`)：Reo 既有品牌身份名，保留作为 FAB action 实色与 brand-gradient 暖头。
- `brand-gradient`：Hero 表达入口的"火"渐变 ember → red → magenta。
- `muted-foreground`：次级文本、弱 icon、placeholder 与 disabled 文案。
- `border`：透明。默认不使用线条表达同平面分割。

## 三条铁律

1. **Zero Border Policy**：同一平面的 Card、Button、Input、列表项、tab 和内容区不用 border 分割。难以区分时增加间距或调整填充，不加线。新 surface 阶梯之间靠 inset highlight 与 tint 落差区分，不画 1px 描边。
2. **Strict Z-Axis Elevation**：基础平面组件不使用 shadow。只有 Tooltip、Dropdown Menu、Dialog/Modal、Drawer 和 Toast 可使用 `shadow-float` 或 `shadow-modal`。Hero 表面通过 `shadow-hero-{lift,fill,inset,edge}` 表达"光"，不与 elevation 阶梯比较。
3. **Grayscale State Interaction**：hover、active、selected 默认通过 `card → secondary/accent` 灰度阶梯表达；Memory hue tint 仅出现在 MemoryRailCard 选中态、MemoryStudioSegmentCard 选中态与 MemoryIcon 内部，不渗到 chrome、不渗到文本色、不渗到 focus ring。

## 组件规则

- Button 默认文本动作 `rounded-lg`，compact `rounded-md`；32px icon button `rounded-sm`，40px icon button + menu action `rounded-md`；titlebar Breadcrumb trigger `rounded-sm`；primary 使用 `bg-primary`（品牌红），hover `bg-primary-hover`；secondary/ghost 灰度填充；destructive 使用 `bg-destructive`（深红 `#b91c1c`），hover `bg-destructive-hover`；FAB trigger 使用 `bg-brand-gradient` + `shadow-hero-fill` + `shadow-hero-edge`，FAB action、录音主 CTA 与 Segment strip overlay arrow 保持全圆。
- Input 与 Textarea 使用 `bg-input` (= `surface-3`)、无边框、无阴影；focus 与 invalid 只用 ring（品牌红）。
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

## Electron 规则

- 标题栏拖拽区使用 `.drag-region`；交互控件使用 `.no-drag-region` 或等价 `-webkit-app-region: no-drag`。
- 全局默认不可选中文本；输入、textarea、contenteditable、转录、日志、路径和其他需要复制的内容必须显式 `select-text` 或 `.selectable-text`。
- 常规交互动效 `duration-150 ease-out`；结构动效上限 `duration-200 ease-out`；reduced motion 下关闭。
- `edge-fade-y`、`edge-fade-x`、`scrollbar-hover`、`reo-card-squircle`、`reo-segment-card-squircle` 与新增 `bg-brand-gradient` 是 renderer root CSS 中的 Tailwind v4 `@utility`；它们属于设计系统级可复用 utility，不进入业务私有 class。

## Token 维护

- 业务 TSX 只能消费 Layer 2 semantic 角色 token。
- 不为单个组件新增颜色、surface、radius、shadow 或 motion token。
- 只有当同一视觉不变量被多个真实组件稳定复用，且无法用当前 semantic token 表达时，才允许扩展。
- 任何新 token 必须落入 spec Section 6.7 reserved prefix 表中的某一个 prefix。
- shadcn/ui 新增 source 后必须移除生成代码中的同平面 border、默认 shadow 和硬编码颜色。

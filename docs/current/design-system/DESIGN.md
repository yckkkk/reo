# Reo Red Fluid Design System

本文档记录 Reo 当前视觉规则。可执行 token 以 `theme.css`、`variables.css`、`tokens.json` 和 `src/renderer/src/theme.css` 为准。

## 核心定义

Reo 使用品牌红表达入口、黑白中性控件语义、Fluid 多层 surface 骨架和扁平阅读层组成统一设计系统。界面优先保护表达意愿与阅读专注：品牌红 (`--brand-red`) 承载 Reo "录音/记录" 与品牌表达语义，不占用 `primary` 或 `ring`；`primary` 与 `ring` 是普通控件的高对比中性语义；多层 surface 在容器层提供 4 级 elevation；Hero token family 为 FAB、RecordingOverlay、MemoryIcon 和 Segment 渐变卡提供统一语言；扁平阅读层（Input、Textarea、Tab、List row、Toolbar pill、Dropdown item）不上 gradient、不上玻璃，保护可读。

干净由排版与信息层级承担，不靠剥除视觉元素实现。融洽是设计正确的判据。

## Token 双层模型

Reo token 分为两层：

- **Layer 1 · raw 资产**：`--brand-{red,magenta,ember,gradient}`、`--surface-{1,2,3,4}`、`--shadow-{hero-lift,hero-fill,hero-inset,hero-edge,surface-inset}`。raw 层只在设计系统源文件、semantic 层或明确 owner primitive 内被引用。
- **Layer 2 · semantic 角色**：shadcn 既有约定（`--background`、`--card`、`--popover`、`--primary`、`--ring`、`--input`、`--shadow-float`、`--shadow-modal` 等），可引用 raw 层或承载稳定中性色。业务 TSX 只消费 semantic 层。

本文件的命名规范关键约束是当前 token 维护判据。

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

## 三条铁律

1. **Zero Border Policy**：同一平面的 Card、Button、Input、列表项、tab 和内容区不用 border 分割。难以区分时增加间距或调整填充，不加线。新 surface 阶梯之间靠 inset highlight 与 tint 落差区分，不画 1px 描边。
2. **Strict Z-Axis Elevation**：基础平面组件不使用 shadow。只有 Tooltip、Dropdown Menu、Dialog/Modal、Drawer 和 Toast 可使用精细多层 `shadow-float` 或 `shadow-modal`。Hero 表面通过 `shadow-hero-{lift,fill,inset,edge}` 表达"光"，不与 elevation 阶梯比较。
3. **Grayscale State Interaction**：hover、active、selected 默认通过 `card → secondary/accent` 灰度阶梯表达；Memory hue tint 仅出现在 MemoryRailCard 选中态、MemoryStudioSegmentCard 选中态与 MemoryIcon 内部，不渗到 chrome、不渗到文本色、不渗到 focus ring。

## 组件规则

- Button 默认文本动作和 compact 动作使用 `rounded-md`；32px icon button `rounded-sm`，40px icon button + menu action `rounded-md`，56px icon button `rounded-lg`；titlebar Breadcrumb trigger `rounded-sm`；Button base 使用 `reo-squircle`；primary 使用中性 `bg-primary`，当前 Button primitive hover 使用 `bg-primary-hover`；secondary/ghost 灰度填充；destructive 使用 `bg-destructive`（深红 `#b91c1c`），hover 使用 `bg-destructive-hover`；当前 FAB trigger、FAB action、录音主 CTA 与 Segment strip overlay arrow 保持全圆，FAB trigger 和录音主 CTA 仍使用 `bg-brand-ember`。
- Switch 使用 Radix mechanics；轨道默认 `bg-secondary`，checked 通过 `data-[state=checked]:bg-primary` 投影到中性 `--primary`，thumb 使用 `bg-background` 并通过 Radix checked state 位移，不使用描边或阴影。
- Input 与 Textarea 使用 `bg-input` (= `surface-3`)、无边框、无阴影；focus 与 invalid 只用中性 ring。
- Dropdown、Tooltip、Dialog、AlertDialog、Drawer 和 Toast 使用 `bg-popover` (= `surface-4`)，按浮层级别使用精细多层 `shadow-float` 或 `shadow-modal`。Tiptap `--tt-shadow-elevated-md` 派生自 `--shadow-float`。
- DropdownMenu content 使用 `reo-float-motion reo-squircle`、`rounded-[18px]`、`p-[6px]`；menu item 使用 `reo-squircle rounded-md`、32px 最小高度、8px 横向内距、4px gap 和 13px/500/1.15 typography。Tiptap dropdown item 在 template primitive 内使用同一 13px/500/1.15 typography。Tooltip content 使用无箭头 pill，`reo-float-motion reo-squircle`、`rounded-sm`、8px/6px 内距和 12px/500/1.2 typography。Dialog 与 AlertDialog 使用 `reo-fade-motion`，不使用 transform-based float motion。
- Tabs 使用 rounded segment button，不用 underline border。
- Memory card 使用 `ReoCardSurface` 默认形态，Segment preview card 使用 `ReoCardSurface` 的 `segmentPreview` 形态；通过灰度填充表达状态（选中态另叠 Memory hue tint，由对应组件接入），不使用常态 border、blur 或 shadow。
- `rounded-full` 只用于 FAB trigger、FAB action、录音主按钮、Segment strip overlay arrow、圆点、timeline marker 和 drawer/waveform handle；普通按钮、icon button、menu action 和 Breadcrumb trigger 使用方圆角。
- 可滚动内容边缘裁切使用 `edge-fade-y` / `edge-fade-x`；纵向文本容器组合 `scrollbar-hover` 默认隐藏滚动条。

## Hero Token 规则

Hero 不参与 elevation 阶梯（即不存在 `surface-5`）。当前 Hero raw asset 已落 token；组件接入以源码当前形态为准：

| 资产或 utility     | 当前规则                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `--brand-gradient` | Hero raw 资产；当前暂无 TSX consumer，owner 为 FAB、RecordingOverlay、MemoryIcon 或 Segment     |
| `--shadow-hero-*`  | Hero effect token；当前暂无 TSX consumer，owner 为 FAB、RecordingOverlay、MemoryIcon 或 Segment |
| `bg-brand-ember`   | 当前 FAB trigger、FAB action 和录音主 CTA 的实色品牌入口                                        |
| `--shadow-float`   | Tooltip、DropdownMenu、Toast 等浮层的精细多层 elevation                                         |
| `--shadow-modal`   | Dialog、AlertDialog、Drawer 等 modal surface 的精细多层 elevation                               |

## 命名规范关键约束

- 全部使用 kebab-case
- raw 层不带状态后缀（`--brand-red-hover` 是错误命名；hover 是 semantic 层状态）
- 渐变 token 使用完整词 `gradient`，不缩写
- 同 token 不得同时承载 raw 值与 semantic 角色
- 不引入无 owner 的 token；无当前 consumer 的 raw asset 必须在本文定义明确 owner。
- 新 token 必须落入当前命名规范中的保留 prefix，并有当前 consumer 或本文定义的 owner。

## Electron 规则

- 标题栏拖拽区使用 `.drag-region`；交互控件使用 `.no-drag-region` 或等价 `-webkit-app-region: no-drag`。
- 全局默认不可选中文本；输入、textarea、contenteditable、转录、日志、路径和其他需要复制的内容必须显式 `select-text` 或 `.selectable-text`。
- 常规交互动效 `duration-150 ease-out`；结构动效上限 `duration-200 ease-out`；reduced motion 下关闭。
- `edge-fade-y`、`edge-fade-x`、`scrollbar-hover`、`reo-squircle`、`reo-segment-card-squircle`、`reo-float-motion` 和 `reo-fade-motion` 是 renderer root CSS 中的 Tailwind v4 `@utility` 或全局 motion selector；它们属于设计系统级可复用 utility，不进入业务私有 class。

## Token 维护

- 业务 TSX 默认消费 Layer 2 semantic 角色 token；raw token 只能由明确 owner primitive 接入。
- 不为单个组件新增颜色、surface、radius、shadow 或 motion token。
- 只有当同一视觉不变量被多个真实组件稳定复用，且无法用当前 semantic token 表达时，才允许扩展。
- 任何新 token 必须落入本文命名规范中的保留 prefix，并有当前 consumer 或本文定义的 owner。
- shadcn/ui 新增 source 后必须移除生成代码中的同平面 border、默认 shadow 和硬编码颜色。

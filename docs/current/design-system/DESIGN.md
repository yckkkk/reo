# Reo Soft Flat Design System

本文档记录 Reo 当前视觉规则。可执行 token 以 `theme.css`、`variables.css`、`tokens.json` 和 `src/renderer/src/theme.css` 为准。

## 核心定义

Reo 使用黑色为主、红色为辅的柔性扁平设计系统。界面优先保护内容和表达意愿，放弃同平面描边、硬阴影和装饰性玻璃层，依靠空间、低对比填充、灰度阶梯、黑色主动作和少量红色表达入口建立层级。

## 视觉语义

- `background`：页面画布，浅色为纯白，深色为极深灰。
- `card`：同平面容器和普通控件填充。
- `secondary` / `accent`：hover、active、selected 的灰度阶梯。
- `popover`：临时浮层 surface；深色下比底层更亮。
- `primary`：黑色主动作、焦点环和少量状态点；不使用蓝色主色。
- `destructive` / `brand-ember`：危险动作、录音主按钮和需要高注意力的热状态。
- `brand-ember`：表达入口 FAB 和录音主按钮。
- `muted-foreground`：次级文本、弱 icon、placeholder 和 disabled 文案。
- `border`：透明。默认不使用线条表达同平面分割。

## 三条铁律

1. Zero Border Policy：同一平面的 Card、Button、Input、列表项、tab 和内容区不用 border 分割。难以区分时增加间距或调整填充，不加线。
2. Strict Z-Axis Elevation：基础平面组件不使用 shadow。只有 Tooltip、Dropdown Menu、Dialog/Modal、Drawer 和 Toast 可使用 `shadow-float` 或 `shadow-modal`。
3. Grayscale State Interaction：hover、active、selected 通过 `card -> secondary/accent` 的灰度阶梯表达；黑色用于核心动作、focus ring 和状态点，红色只用于 FAB、录音主按钮和危险/高注意力状态。

## 组件规则

- Button 默认文本动作使用 `rounded-lg`，compact 文本动作使用 `rounded-md`；32px icon button 使用 `rounded-sm`，40px icon button 和 menu action 使用 `rounded-md`；titlebar Breadcrumb trigger 使用 `rounded-sm`；primary 使用黑色 `bg-primary`，secondary/ghost 使用灰度填充；destructive 使用 `bg-destructive`，hover 使用 `bg-destructive-hover` 表达可见但扁平的危险动作状态；FAB trigger 使用 `bg-brand-ember`，FAB action、录音主 CTA 和 Segment strip overlay arrow 保持全圆。
- Input 与 Textarea 使用 `bg-input`、无边框、无阴影；focus 与 invalid 只用 ring。
- Dropdown、Tooltip、Dialog、AlertDialog、Drawer 和 Toast 使用 `bg-popover text-popover-foreground`，并按浮层级别使用 `shadow-float` 或 `shadow-modal`。危险确认使用 AlertDialog 线性结构，不嵌套重内容卡；可撤销 toast 的 action 默认透明无描边，hover 只使用柔和填充，恢复 action 使用 icon+文字。
- Tabs 使用 rounded segment button，不用 underline border。
- Memory、Segment 和列表项使用灰度填充状态，不使用常态 border、blur 或 shadow。
- `rounded-full` 只用于 FAB trigger、FAB action、录音主按钮、Segment strip overlay arrow、圆点、timeline marker 和 drawer/waveform handle；普通按钮、icon button、menu action 和 Breadcrumb trigger 使用方圆角，不使用全圆。
- 可滚动内容需要表达边缘裁切时使用设计系统 edge fade utilities：纵向使用 `edge-fade-y`，横向使用 `edge-fade-x`。需要保留滚动能力但降低视觉噪音的纵向文本容器组合 `scrollbar-hover`，默认隐藏滚动条，hover 或 focus-within 时显示。业务组件不得各自实现一套 gradient overlay、mask 或 scrollbar 规则。

## Electron 规则

- 标题栏拖拽区使用 `.drag-region`；交互控件使用 `.no-drag-region` 或等价 `-webkit-app-region: no-drag`。
- 全局默认不可选中文本；输入、textarea、contenteditable、转录、日志、路径和其他需要复制的内容必须显式 `select-text` 或 `.selectable-text`。
- 常规交互动效使用 `duration-150 ease-out`；复杂结构 motion 上限 `duration-200 ease-out`；reduced motion 下关闭。
- `edge-fade-y`、`edge-fade-x` 和 `scrollbar-hover` 是 renderer root CSS 中的 Tailwind v4 `@utility`；它们属于设计系统级可复用 interaction utility，不进入业务私有 class。

## Token 维护

- 业务 TSX 只能消费现有语义 token。
- 不为单个组件新增颜色、surface、radius、shadow 或 motion token。
- 只有当同一视觉不变量被多个真实组件稳定复用，且无法用当前语义表达时，才允许扩展设计系统。`destructive-hover` 属于 destructive action 状态 token，由所有危险按钮消费，不是业务私有 token。
- shadcn/ui 新增 source 后必须移除生成代码中的同平面 border、默认 shadow 和硬编码颜色。

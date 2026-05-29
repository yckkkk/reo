# 0007 浮层与文本按钮 primitive 采用 Tiptap 组件形态

时间：2026-05-29 01:25 America/Los_Angeles
状态：已接受

## 决策

Reo 的 DropdownMenu、Tooltip、Dialog、AlertDialog、Toast、Drawer 和默认文本 Button 以 Tiptap Simple Editor 模板的组件形态作为当前视觉基线：形状、圆角、内距、item hover、动效和多层 elevation 向 Tiptap 对齐；品牌语义、危险语义、Electron 边界和本地文件真源仍由 Reo 拥有。

实现边界：

- Reo 是 token owner。`--shadow-float` 和 `--shadow-modal` 是 canonical elevation token；Tiptap `--tt-shadow-elevated-md` 派生自 `--shadow-float`。
- App 级浮层实现落在 Reo 自有 shadcn/Radix primitive 上，不把编辑器专用 `tiptap-ui-primitive/*` 作为全 App 依赖。
- DropdownMenu 与 Tooltip 使用 Popper 定位浮层 motion；Dialog 与 AlertDialog 使用 opacity-only fade motion，保留 content 自身的居中 transform。
- Button 的默认文本动作使用 `rounded-md`；primary、secondary、destructive、ghostIcon 和 `brand-ember` 的语义不改变。
- Input 与 Separator 保持 Reo 当前形态：Input 使用无可见边框 + ring 聚焦，Separator 保留语义与命中区但默认不画可见线。

## 理由

Tiptap 模板的浮层质量来自整套组件形态：圆角卡片套圆角条目、克制灰阶 hover、无箭头 tooltip、方向感进入/退出动效和精细多层 elevation。把这些形态收敛为 Reo primitive 的当前规则，可以让编辑器工具栏、App sidebar menu、entity menu、tooltip、toast 和 modal 共享同一套视觉语言，同时避免把品牌红或编辑器内部 primitive 外溢到全 App。

相关 spec：`docs/archive/specs/2026-05-28-2244-tiptap-component-form-adoption/`。

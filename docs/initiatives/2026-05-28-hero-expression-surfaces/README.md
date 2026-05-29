# Hero 表达入口建设

- Started: 2026-05-28
- Status: active（下一产品/代码开发长期任务；任务尚未完成，保留在 initiatives/）
- Type: 产品/代码开发 active initiative

## 目标

Red Fluid 设计系统的 token 层已落地：`--brand-gradient` 与 `--shadow-hero-{lift,fill,inset,edge}` 已在 `theme.css` 与 mirror 中定义，但当前**没有任何 TSX consumer**。本 initiative 承接把 Hero 表达入口从「token 已就位、组件未建设」推进到「每个 Hero token family 要么有真实 consumer，要么被显式退役」。

设计真源是 `docs/current/design-system/DESIGN.md` 的 Hero Token 规则；本 initiative 只记录跨 session 执行推进，不覆盖 current 真源。

## 完成条件

下列每个 Hero 表达入口，要么接入对应 Hero token 并通过运行时视觉验证（浅色/深色），要么显式退役该 token：

- **FAB SpeedDial trigger**：当前 `bg-brand-ember` 实色 → `--brand-gradient` + `--shadow-hero-fill` + `--shadow-hero-edge` + 静态 specular
- **MemoryIcon primitive**（`components/ui/memory-icon.tsx`，尚未创建）：多层 gradient + `--shadow-hero-inset` + `--shadow-hero-lift` + specular
- **RecordingOverlay 主 CTA**：gradient + hero shadow + 录音中 pulse ring
- **RecordingOverlay surface**：顶部 aurora mask
- **Segment 渐变预览卡**：Memory hue tint 表达

## 不变量

- 不重新引入品牌红到普通 `primary` / `ring` 控件——neutral 控件语义已收口，见 `DESIGN.md`。
- 不使用 `backdrop-filter` / SVG `<filter>` / WebGL；Hero 效果走 CSS gradient + inset shadow。
- 用户审美趋向克制（偏 Tiptap form，见 memory `user-aesthetic-clean-minimal`）；任何 Hero 效果以「融洽」为判据，可随时下调强度或退役 token。
- 不与当前 active spec 并行执行；创建下一 Hero spec 前先确认 `docs/specs/*` 为空。

## 来源

- 归档 spec：`docs/archive/specs/2026-05-28-0651-red-fluid-design-system/`（Phase 1 tokens 已完成，durable 真源已压缩进 `docs/current/design-system/DESIGN.md`）
- 设计真源：`docs/current/design-system/DESIGN.md`（Hero Token 规则）

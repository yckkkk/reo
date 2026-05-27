# Toast 统一类型化 API

## 目标

把分散的 4 种 toast 调用写法（`toast()` / `toast.success` / `toast.error` / `showReoUndoToast`）收敛到单一类型化入口 `showReoToast`，语义与 Figma `Toast` component set 的变体一一对应。

## 成功标准

- 新增 `showReoToast(input)` 单入口，覆盖 `neutral / success / error / warning / info` 五种语义类型 + `undo` 恢复行为。
- renderer 内所有 toast 调用点改用 `showReoToast`；移除 `showReoUndoToast` 导出。
- 现有 toast 行为保持不变：
  - 状态 toast 仍走 Sonner `toast[type]`，无额外 option 时只传 title（保持现有 `toast.error` spy 断言为单参）。
  - undo toast 的 `reo-undo-toast` class、`恢复` 操作、`closeButton:false`、`dismissible:false`、倒计时进度、`onAutoClose` 宽限提交完全一致。
- `npm run verify:quick` 通过。

## 范围边界

- 不改视觉：Figma 已 1:1 还原现状，code 与 Figma 已对齐。
- `warning/info`：按用户决定提供 helper 入口（当前可能暂无调用方）。
- 不引入 `loading` / 自定义图标 / 语义色（监控为后续话题）。

## 已知 design ↔ code gap（记录，不在本 spec 处理）

- 状态图标在 code 中统一 `muted-foreground`，非语义色。
- 无 `text/ui-xs` 文本样式，但存在 `--text-ui-xs: 11px` CSS token。

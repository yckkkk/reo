# 实现笔记

## Figma（已完成）

- Components 页（node 23:3）新增 `Toast` component set（id 70:10）。
- 12 变体：`Type`(Neutral/Success/Error/Warning/Info/Undo) × `Description`(True/False)。
- token 绑定：container `color/popover` + `radius/xl` + `effect/shadow-float`，padding/gap = `spacing/16·12·4`；title `text/ui-sm/medium → color/popover-foreground`；图标/关闭 `color/muted-foreground`；undo 进度条 `color/foreground` @54%。
- 图标（lucide，与 Sonner 默认语义对应）：success=circle-check、error=circle-alert、warning=triangle-alert、info=info、close=x、undo 操作=undo-2。

## 关键事实

- Sonner 2.0.7 提供 `toast.warning` / `toast.info`。
- 所有状态 toast 调用点仅传 `description`，无 id/duration/action/icon → 统一 API 只需 `{type,title,description?,durationMs?,undo?}`。
- 现有 `vi.spyOn(toast,'error'|'success')` 断言均为单参或负向 → `showReoToast` 无额外 option 时不得传第二参。
- undo toast 有大量 App.test 回归（reo-undo-toast class、恢复按钮、onAutoClose 宽限提交）→ ExternalToast 构造保持不变。

## 进度

- [完成] Phase 1：`toaster.test.tsx` 5 用例（type 映射 + neutral 基础 toast + undo ExternalToast 构造与 action.onClick）。RED→GREEN。`showReoToast` 落地，移除 `showReoUndoToast`。
- [完成] Phase 2：迁移调用点。
  - sed 机械替换 6 个 feature 文件 + App.tsx 的 `toast()/toast.success/toast.error`；App.tsx 3 个 undo 块手工改为 `undo:{onUndo,onAutoClose}`。
  - 9 个 component 测试的 toaster mock 注入「委托型」`showReoToast`（普通函数，避免 `resetAllMocks` 清空实现），路由到既有 `toast.*` spy，保留原断言语义。
- [完成] Phase 3 验证（targeted）：
  - `toaster.test.tsx` 5/5；`App.test.tsx` 128/128（undo 宽限/恢复/spy 全绿）；`RecordingOverlay.test.tsx` 90/90；其余 8 个迁移套件 53/53。
  - `tsc -p tsconfig.json` clean；改动文件 eslint --max-warnings=0 clean；prettier clean。
- [完成] `npm run verify:quick` 全绿：typecheck clean、test:main 40/40、test:renderer 509/509、lint:strict clean、format clean。

## 待办

- 阶段门 `/review` + `/simplify`（按项目约定，收口前执行）。

## 验证方式说明

- 状态 toast 映射由 `toaster.test.tsx` 单测锁定；undo 端到端行为由既有 `App.test.tsx` 回归守护。
- `showReoToast` 无 description/duration 时只传 title，保留既有 `vi.spyOn(toast,'error')` 单参断言。

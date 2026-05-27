# 执行清单

## Phase 1 — API + 测试（TDD）

1. 写 `toaster.test.tsx`（RED）：mock `sonner`，断言
   - `showReoToast({type, title})` → 调用对应 `toast[type]`，仅 title（无第二参）。
   - 带 `description` → `toast[type](title, { description })`。
   - 默认 type（neutral）→ 基础 `toast(title)`。
   - `warning/info` → `toast.warning/toast.info`。
   - `undo` → 基础 `toast(title, options)`，options 含 `className:'reo-undo-toast'`、`closeButton:false`、`dismissible:false`、`duration`、`--reo-toast-duration` style、`action`；action.onClick 触发 `toast.dismiss` + `onUndo`；`onAutoClose` 透传。
2. 在 `toaster.tsx` 实现 `showReoToast`，移除 `showReoUndoToast`（保留 `ReoToastUndoActionLabel` 内部使用）。
3. GREEN：跑 `toaster.test.tsx`。

## Phase 2 — 迁移调用点

机械替换（仅 `description` 一个可选字段）：

- `toast(X)` → `showReoToast({ title: X })`
- `toast.success(X[, {description}])` → `showReoToast({ type:'success', title:X[, description] })`
- `toast.error(X[, {description}])` → `showReoToast({ type:'error', title:X[, description] })`
- `showReoUndoToast({title,description,onUndo,onAutoClose,durationMs})` → `showReoToast({ title, description, durationMs, undo:{ onUndo, onAutoClose } })`

涉及文件：`App.tsx`、`workspace/RecordingOverlay.tsx`、`workspace/EntityPathActionGroup.tsx`、`workspace/MemoryStudio.tsx`、`workspace/MemoryTitleDialog.tsx`、`workspace/CreateWorkspaceForm.tsx`、`settings/VoiceSettingsPanel.tsx`。

## Phase 3 — 验证

- targeted：`toaster.test.tsx` + `App.test.tsx`（undo + spy 用例）+ `tsc`。
- 阶段门：`/review` + `/simplify`。
- 收口：`npm run verify:quick`。

## 验证证据

见 `implementation-notes.md`。

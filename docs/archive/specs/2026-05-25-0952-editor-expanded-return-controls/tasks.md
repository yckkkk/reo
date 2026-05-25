# 展开编辑态返回与缩放入口优化任务

- [x] 更新 `EditorExpandShell`：左上角恢复 `返回`，展开态右下角提供 Grip / `Minimize`。
- [x] 更新 `InlineMarkdownContentEditor`：新增 dirty 返回确认状态，并把保存并返回、放弃修改、继续编辑接到现有保存 / 取消路径。
- [x] 更新 focused renderer shell tests，覆盖返回与缩小的职责分离、dirty 缩小不触发保存 / 取消、pending 禁用。
- [x] 修复 immersive Drawer 内 AlertDialog 层级模型，确保 dirty 返回弹窗显示在全窗编辑器之上。
- [x] 收敛 workspace-local 沉浸式 titlebar 与弹窗 layer 复用，避免各入口手写 z-index / geometry。
- [x] 修复 Tiptap 高亮颜色保留 `--tt-color-highlight-*` token，避免深色模式落回浅色 hex。
- [x] 补充 owner-level dirty 返回测试，覆盖继续编辑、放弃修改、保存失败保留展开、保存成功收起。
- [x] 提交前运行 targeted renderer tests。
- [x] 提交前运行展开态视觉验证。
- [x] 提交前运行 `npm run verify:quick`。

# 全窗编辑动效统一

## 元信息

- 时间：2026-05-25 18:46 PDT
- 范围：NoteEditorOverlay 新建笔记 / 新建补充笔记、已有正文 / 转录 / 补充内容的展开编辑态、沉浸式编辑 surface 动效参数。
- 非范围：编辑器能力、Markdown 序列化、IPC / preload、文件事务、录音 overlay 业务流程、FAB SpeedDial 菜单自身展开动效。

## 目标

全窗编辑的进入和退出必须统一：

- 进入：窗口从下向上滑入。
- 退出：窗口从上向下滑出。
- 新建笔记、新建补充笔记、已有文本框展开、新建片段菜单进入全窗后，都使用同一个沉浸式编辑 surface 动效。
- 左上角返回、右下角缩小、保存成功自动退出都走同一个退出动效。
- 进入与退出都使用乐观态：先响应用户并播放界面动效，不因为后台保存、flow 清理或 React 卸载打断动画。

## 当前约束

- `ImmersiveWorkspaceSurface` 是沉浸式编辑 surface 的唯一外壳。
- Vaul `Drawer.Root` 支持 `direction="bottom"`；`direction="bottom"` 对应从下进入、向下退出。
- `EditorExpandShell` 的已有编辑展开态已经通过 `expanded=false` 保留组件完成退出动画。
- `NoteEditorOverlay` 的新建流程当前在 `onOpenChange(false)` 后由 App 直接清空 flow，容易立即卸载，不能保证退出动画完整。
- 保存中仍然必须阻止重复关闭或 flow 中断。

## 交互合同

- 打开新建笔记、打开新建补充笔记、打开已有文本框全窗态时，surface 使用同一 bottom drawer enter motion。
- 退出新建笔记 / 补充笔记时，App 先把 note editor flow 保留为 active 且 `open=false`，等 Vaul close animation 结束后再清理 flow。
- 新建笔记保存成功后立即进入关闭视觉态；后台结果已经成功后不等待额外 UI 操作。
- dirty 返回确认里的放弃关闭也走同一 close motion。
- 已有文本框左上角返回、右下角缩小和保存并返回保持现有语义，只共享同一更丝滑的 surface motion。
- reduced motion 下关闭全窗 surface 动画。

## 验证标准

- RED 测试先证明 NoteEditorOverlay 关闭请求后仍保留关闭态 dialog，动画结束后才卸载。
- RED 测试先证明保存成功自动退出同样保留关闭态 dialog，动画结束后才卸载。
- RED 测试先证明 `ImmersiveWorkspaceSurface` 在退出动效完成后只上报一次 close settled，并有 Reo 自己的沉浸式 motion class。
- GREEN 后运行相关 renderer tests。
- 提交前或声明项目干净前运行 `npm run verify:quick`。

## 实现结果

- `ImmersiveWorkspaceSurface` 统一沉浸式 surface motion class 和 overlay motion class，进入从下向上，退出向下滑出，进入和退出使用同一 280ms 曲线。
- `NoteEditorOverlay` 把退出动画完成事件交给 App；新建笔记和新建补充笔记关闭时，App 保留 active flow 且只把 `open` 置为 `false`，退出动效结束后再清理 flow。
- `noteEditorTarget` 只表示退出动画期间仍需挂载 overlay；笔记是否阻断 workspace flow、是否隐藏表达入口，由 `open=true` 决定。关闭态按用户已退出处理。
- 退出完成 API 使用 Reo 业务语义 `onExitAnimationEnd`，不把 Vaul Root 的 `onAnimationEnd(open)` 透给业务调用方；完成信号由 Reo 自己保证每次关闭只触发一次。
- 退出动效完成由 Reo 自己按 CSS motion token 时长兜底触发，DOM animation end 可提前完成；reduced motion 下立即完成。
- FAB Note、补充笔记保存、dirty 放弃和普通返回都验证关闭态 dialog 先保留、退出结束后卸载。

## 验证记录

- `npm run test:renderer -- src/renderer/src/workspace/ImmersiveWorkspaceSurface.test.tsx`
- `npm run test:renderer -- src/renderer/src/App.test.tsx -t "FAB Note"`
- `npm run test:renderer -- src/renderer/src/workspace/NoteEditorOverlay.test.tsx`
- `npm run test:renderer -- src/renderer/src/workspace/EditorExpandShell.test.tsx`
- `npm run test:renderer -- src/renderer/src/App.test.tsx -t "Note SegmentSupplement"`
- `npm run test:renderer -- src/renderer/src/App.test.tsx -t "Note"`
- `$review` 子审查：未发现阻断问题；残余风险为未跑 `verify:quick`、未做 live browser 视觉确认、未单补 beforeunload close 态测试。
- `$ycksimplify` 子审查后修复：退出完成三路径重复、无 consumer 时的无意义 timer/handler、Vaul `open` 布尔泄漏、App 级测试绑定 `data-state`、FAB Note fixture 重复、CSS 动画参数重复。
- `npm run test:renderer -- src/renderer/src/workspace/ImmersiveWorkspaceSurface.test.tsx`
- `npm run test:renderer -- src/renderer/src/App.test.tsx -t "FAB Note"`
- `npm run test:renderer -- src/renderer/src/App.test.tsx -t "Note SegmentSupplement"`
- `npm run test:renderer -- src/renderer/src/App.test.tsx -t "blocks workspace switching while a Note editor is open"`
- `npm run typecheck:quick`
- `npx eslint src/renderer/src/App.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/ImmersiveWorkspaceSurface.tsx src/renderer/src/workspace/ImmersiveWorkspaceSurface.test.tsx src/renderer/src/workspace/NoteEditorOverlay.tsx`
- `npx prettier --check docs/current/frontend.md docs/specs/2026-05-25-1846-note-editor-motion-unification/README.md src/renderer/src/App.tsx src/renderer/src/App.test.tsx src/renderer/src/index.css src/renderer/src/workspace/ImmersiveWorkspaceSurface.tsx src/renderer/src/workspace/ImmersiveWorkspaceSurface.test.tsx src/renderer/src/workspace/NoteEditorOverlay.tsx`

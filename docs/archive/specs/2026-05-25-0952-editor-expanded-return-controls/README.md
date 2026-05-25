# 展开编辑态返回与缩放入口优化

## 元信息

- 时间：2026-05-25 09:52 PDT
- 范围：Memory Studio 已有正文 / 转录 / 补充内容的内联 Markdown 编辑器展开态；沉浸式工作区弹窗层级模型；Tiptap 高亮 token 在深色模式下的显示
- 非范围：新建笔记 / 新建补充笔记的保存流程、IPC / preload、文件事务、Tiptap 能力边界

## 目标

展开态必须区分三个职责：

- 左上角 `返回`：离开当前沉浸式编辑流程。
- 右下角 Grip：只切换视图尺寸。
- 右上角 `取消 / 保存`：只处理当前编辑内容。

用户在展开态可以通过右下角快速缩小到内联卡片而不触碰内容；也可以通过左上角返回离开沉浸式编辑流程，并在有未保存修改时选择保存、放弃或继续编辑。

## 当前约束

- `InlineMarkdownContentEditor` 已经拥有 Markdown、dirty、pending、冲突和磁盘变更提示的 reducer。
- `expanded: boolean` 是纯视图状态。切换折叠 / 展开时允许 Tiptap surface 重挂载，内容由 reducer 保留。
- 已有 `saveMarkdown`、`cancelMarkdownEdit`、stale/conflict dialog 和右上角保存 / 取消逻辑必须复用。
- `保存并返回` 必须通过现有保存路径获得明确成功结果后再收起；不得复制第二套保存 mutation，也不得通过猜测 reducer 状态决定是否返回。
- `NoteEditorOverlay` 的新建笔记 / 新建补充笔记保存流程不参与本次行为调整；其 dirty 返回确认弹窗复用同一沉浸式弹窗层级。
- 保存中 pending 时不得通过返回、缩小、Esc 或 Drawer dismiss 改变可见流程。

## 交互合同

### 折叠态

- 内联编辑卡片右下角显示单弧 Grip。
- Hover / focus 时显示 `Maximize` 图标。
- 点击只请求 `expanded = true`。
- 不保存、不取消、不弹确认。

### 展开态标题栏

- 左上角显示 `ChevronLeft` 图标按钮，accessible name 为 `返回`。
- 标题显示当前 tab 标题，例如 `正文`、`转录`、`补充笔记1`。
- 右上角保持现有内容动作：只有 dirty 且非 pending 时显示 `取消 / 保存`。
- 右上角 `取消 / 保存` 执行后留在展开态，不自动返回或缩小。

### 展开态右下角

- 右下角继续显示单弧 Grip。
- Hover / focus 时显示 `Minimize` 图标。
- 点击只请求 `expanded = false`。
- dirty 时也不弹确认、不保存、不取消。

### 左上角返回

Clean 时：

- 直接 `expanded = false`，回到 Memory Studio 内联卡片视图。
- 当前 tab 和 Memory Studio selection 不改变。

Dirty 时：

- 打开返回确认弹窗。
- `保存并返回`：调用现有保存路径；保存成功后 `expanded = false`。保存失败、stale/conflict 或 attachment pending 时保留展开态，并继续使用现有错误、冲突或 pending 反馈。
- `放弃修改`：调用现有取消逻辑恢复到当前基线，然后 `expanded = false`。
- `继续编辑`：关闭弹窗，保留展开态和当前 dirty 内容。

## 状态模型

`InlineMarkdownContentEditor` 是状态 owner：

- `editorState` reducer：Markdown、baseline、dirty、pending、error、conflict、disk notice、focus。
- `expanded: boolean`：纯视图尺寸状态。
- `returnConfirmOpen: boolean`：仅表示 dirty 返回确认弹窗是否打开。
- 保存路径结果：现有 `saveMarkdown` 可以被调整为返回 success / failure boolean，或由等价的局部 helper 包装；结果只服务返回流程，不引入新的保存状态 owner。

`EditorExpandShell` 是展示外壳：

- 渲染折叠态 / 展开态 chrome。
- 发出 `onExpandedChange`、`onReturn`、`onCancel`、`onSave` 事件。
- 不拥有 dirty 判断、不执行保存、不解释保存结果。

## 失败与恢复

- 保存失败：留在展开态，显示现有错误。
- 保存 stale/conflict：留在展开态，显示现有冲突处理。
- 图片附件 pending：`保存并返回` 不应绕过现有 disabled / pending 边界。
- Drawer dismiss / Esc：clean 时等价于返回；dirty 时必须进入同一返回确认，而不是直接缩小或丢弃。
- Pending：返回、缩小和 dismiss 都被禁用或阻止。

## 验证计划

保留 focused renderer component tests，覆盖用户可见行为：

1. 折叠态右下角 Grip 点击只请求展开。
2. 展开态左上角显示 `返回`，右下角显示尺寸 Grip / `Minimize`，二者是不同按钮。
3. clean 返回直接收起到内联卡片。
4. dirty 返回打开三动作确认弹窗。
5. `保存并返回` 成功后收起；失败或 conflict 后保持展开。
6. `放弃修改` 调用现有取消逻辑并收起。
7. dirty 时右下角缩小不弹窗、不保存、不取消，只收起。
8. 右上角 `取消 / 保存` 保持现状，点击后不自动收起。

运行时视觉验证：

- 折叠态 Grip。
- 展开态右下角 `Minimize` hover / focus。
- 展开态 dirty 返回确认弹窗。

提交前运行：

```bash
npm run verify:quick
```

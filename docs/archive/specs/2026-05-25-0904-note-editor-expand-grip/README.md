# 内联编辑器「展开/缩小」视图

## 意图

为记忆空间底部的内联 Markdown 编辑卡片增加一个全窗"展开编辑态"。卡片右下角加一个单弧 Grip,hover 显示 lucide `Maximize` 图标,点击进入全窗;全窗标题栏右上角始终有 `Minimize` 退出按钮,产生改动后才出现"取消/保存"。

## 核心约束

- **展开/缩小是纯视图切换,与"编辑"解耦**。进入展开态不等于进入编辑;用户点击正文聚焦才开始编辑。
- **编辑会话只有一套状态机**:复用现有 `InlineMarkdownContentEditor` 的 reducer(内容 / dirty / 冲突)与 `saveMarkdown` / `cancelMarkdownEdit`。不新建编辑状态,不新设计"取消/保存"出现逻辑——它与记忆空间内联编辑完全相同(`showActions={dirty && !pending}`)。
- **外壳切换用重挂载**:展开/缩小通过条件渲染 `LightweightMarkdownEditorSurface` 到卡片或全窗。内容/ dirty/冲突在 reducer 中保留;切换时 Tiptap 重建,光标与撤销栈重置(已与视图解耦,可接受)。
- **不触碰新建流程**:`NoteEditorOverlay`(新建笔记/补充,右上角"保存笔记")完全不动。

## 实体

唯一新增状态:`InlineMarkdownContentEditor` 内部 `expanded: boolean`(默认 `false`),纯展示。

## 行为

### 视图切换

```
collapsed ──点击 Grip──▶ expanded
expanded  ──点击 Minimize / Esc / 下滑──▶ collapsed
```

- 切换不弹"放弃修改"确认(内容在 reducer 中始终安全)。
- 保存中(`pending`)锁定切换(`ImmersiveWorkspaceSurface` 的 `closeBlocked`)。
- `取消` / `保存` 后留在展开态;只有 `Minimize` 收起。

### Grip(折叠态卡片右下角)

- 始终显示,贴卡片右下圆角内,纯点击,无拖拽。
- 默认:低对比度单弧线(muted-foreground);hover:替换为 lucide `Maximize`(foreground)。
- 真实 `<button>`,`aria-label="展开为全屏"`(避免与"编辑"类按钮断言冲突)。

### 展开态外壳

复用 `ImmersiveWorkspaceSurface`(`immersive` + `fill`),与新建全窗同款全屏。

退出控件统一为**左上角单一"退出全屏"控件**,与新建全窗的左上角控件同位置;新建与展开共用此结构,避免"返回 + minimize"落点相同的冗余:

- 全窗左上角始终有一个退出控件(位置 = `TITLEBAR_CONTROL_LEFT` / `TITLEBAR_CONTROL_TOP`):
  - **新建笔记/补充流程**(`NoteEditorOverlay`,未改动):返回箭头 `ChevronLeft`,点击关闭创建(dirty 时确认放弃)。
  - **展开现有笔记流程**(`EditorExpandShell`):`Minimize` 图标,`aria-label="退出全屏"`,始终显示,点击 → `expanded = false`(收起到内联卡片)。
- 标题栏左侧(退出控件右侧):当前 tab 名称(如 `正文` / `补充笔记1`),从调用点透传。
- 标题栏右上角:只放主操作。展开场景仅 `dirty` 时出现 `取消` / `保存`(复用现有 handler),否则为空。
- 展开态编辑器 `showActions={false}` 且 `bordered={false}`(动作上移标题栏、去卡片边框);toolbar 其余不变。
- 进入展开态不自动聚焦编辑器(符合"点击正文才编辑")。
- 抽屉关闭(Esc / 下滑)= 退出全屏,即 `expanded = false`,不丢内容。

## 影响范围

- 改动集中在 `src/renderer/src/workspace/MemoryStudio.tsx` 的 `InlineMarkdownContentEditor`:新增 `expanded` 状态、条件渲染外壳、Grip、新增 `title` prop。
- 4 个调用点透传 tab 标题(正文转录 `segment-transcript`、补充转录、笔记正文 `SavedNoteSegmentContent`、补充笔记 `SavedNoteSegmentSupplementContent`),自动获得能力,行为统一。
- 录音橙色按钮属折叠态布局,展开时被全窗覆盖,不受影响。
- 复用现有 `ImmersiveWorkspaceSurface`、`LightweightMarkdownEditorSurface`、`Button`、`appShellGeometry` 标题栏常量;不引入新组件层。

## 成功标准

1. 折叠态卡片右下角始终显示单弧 Grip;hover 变 `Maximize`;点击进入全窗。
2. 全窗复用 immersive 全屏外壳,标题栏左显示 tab 名称,右上角始终有 `Minimize`。
3. 全窗内未改动时只显示 `Minimize`;产生改动后出现 `取消` / `保存`,行为与内联编辑一致。
4. `Minimize` / Esc / 下滑 收起回卡片,内容与 dirty 保留,无放弃确认。
5. `取消` / `保存` 复用现有逻辑,执行后留在展开态。
6. 保存中切换被锁定。
7. 新建笔记/补充全窗流程("保存笔记")行为不变。

## 验证

- 针对 `InlineMarkdownContentEditor` 的组件测试:Grip 点击 → 展开;Minimize → 折叠;dirty 时标题栏出现取消/保存并触发既有 handler;切换保留内容。
- `npm run verify:quick`(提交前)。
- 运行时视觉验证:折叠/展开两态截图,Grip hover 态。

# 展开编辑态返回与缩放入口优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重建展开编辑态的交互模型，让左上角返回、右下角缩放、右上角保存 / 取消分别拥有清晰职责。

**Architecture:** 不在现有 `Minimize` 上补丁式叠加行为。先把 `EditorExpandShell` 重构成纯 chrome 外壳：`onReturn` 表示流程离开，`onExpandedChange` 只表示尺寸变化。`InlineMarkdownContentEditor` 继续作为编辑状态 owner，并新增 dirty-return confirmation flow，复用现有保存 / 取消路径。

**Tech Stack:** React 19 + TypeScript、Radix AlertDialog、Vaul Drawer、lucide-react、Testing Library + Vitest。

---

## File Structure

- **Modify** `src/renderer/src/workspace/EditorExpandShell.tsx`  
  展示型外壳。负责折叠 / 展开 chrome、左上角返回按钮、右下角尺寸 Grip、右上角内容动作。不得拥有 dirty 决策或保存结果解释。

- **Modify** `src/renderer/src/workspace/EditorExpandShell.test.tsx`  
  保护 chrome 事件语义：返回和缩小是不同按钮，Drawer dismiss 走 `onReturn`，右下角缩小只触发 `onExpandedChange(false)`。

- **Modify** `src/renderer/src/workspace/MemoryStudio.tsx`  
  `InlineMarkdownContentEditor` 持有 dirty-return dialog state，复用 `saveMarkdown` / `cancelMarkdownEdit`。必要时调整 `saveMarkdown` 返回 boolean，表示保存是否成功。

- **Modify** `docs/specs/2026-05-25-0952-editor-expanded-return-controls/tasks.md`  
  实现时按任务更新勾选状态。

---

## Task 1: 重构 `EditorExpandShell` 的正确交互模型

**Files:**

- Modify: `src/renderer/src/workspace/EditorExpandShell.tsx`
- Modify: `src/renderer/src/workspace/EditorExpandShell.test.tsx`

### Architecture intent

`EditorExpandShell` 只表达 chrome 结构和用户事件，不做内容状态判断：

- `onReturn()`：用户想离开沉浸式编辑流程。
- `onExpandedChange(false)`：用户只想缩小视图。
- `onCancel()` / `onSave()`：用户执行内容动作。

Drawer `onOpenChange(false)` 必须走 `onReturn()`，因为 Esc / dismiss 在沉浸态语义上是离开流程，不是右下角缩小。

- [ ] **Step 1: 更新 failing tests，先锁住事件模型**

修改 `EditorExpandShell.test.tsx` 的 render helper，新增 `onReturn`：

```tsx
function renderShell(overrides: RenderOverrides = {}) {
  const props = {
    ariaLabelledBy: 'tab-1',
    cancelLabel: '取消',
    dirty: false,
    expanded: false,
    onCancel: vi.fn(),
    onExpandedChange: vi.fn(),
    onReturn: vi.fn(),
    onSave: vi.fn(),
    panelId: 'panel-1',
    pending: false,
    renderAsPanel: true,
    saveDisabled: false,
    saveLabel: '保存',
    title: '正文',
    ...overrides,
  };
  render(
    <EditorExpandShell {...props}>
      <div data-testid="editor-body">正文内容</div>
    </EditorExpandShell>
  );
  return props;
}
```

替换 / 新增这些测试：

```tsx
it('expanded: 左上角返回和右下角缩小是不同职责', async () => {
  const user = userEvent.setup();
  const props = renderShell({ expanded: true, dirty: true });

  await user.click(screen.getByRole('button', { name: '返回' }));
  expect(props.onReturn).toHaveBeenCalledOnce();
  expect(props.onExpandedChange).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: '缩小编辑器' }));
  expect(props.onExpandedChange).toHaveBeenCalledWith(false);
  expect(props.onReturn).toHaveBeenCalledOnce();
});

it('expanded: 右下角缩小在 dirty 时也不触发保存或取消', async () => {
  const user = userEvent.setup();
  const props = renderShell({ expanded: true, dirty: true });

  await user.click(screen.getByRole('button', { name: '缩小编辑器' }));

  expect(props.onExpandedChange).toHaveBeenCalledWith(false);
  expect(props.onSave).not.toHaveBeenCalled();
  expect(props.onCancel).not.toHaveBeenCalled();
  expect(props.onReturn).not.toHaveBeenCalled();
});
```

更新现有断言：

- 折叠态按钮 name 使用 `展开编辑器`。
- 展开态不再查询 `退出全屏`，而是查询 `返回` 和 `缩小编辑器`。
- Pending 时返回与缩小都 disabled，右上角动作隐藏。

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/EditorExpandShell.test.tsx
```

Expected: FAIL，原因包括 `onReturn` prop 不存在、`返回` 按钮不存在、`缩小编辑器` 按钮不存在。

- [ ] **Step 3: 实现外壳重构**

在 `EditorExpandShell.tsx`：

1. 把 import 从 `Maximize, Minimize` 改成 `ChevronLeft, Maximize, Minimize`。
2. Props 新增 `onReturn: () => void`。
3. 左上角 button 改为 `aria-label="返回"`，icon 为 `ChevronLeft`，点击 `onReturn()`。
4. 展开态右下角新增与折叠态同位置的 Grip button，`aria-label="缩小编辑器"`，点击 `onExpandedChange(false)`。
5. Drawer `onOpenChange(false)` 改为 `onReturn()`。
6. 保留 `closeBlocked={pending}`，并在 pending 时禁用返回和缩小。

建议在同文件内用一个小的 local component 消除重复 Grip JSX，避免两个角落实现漂移：

```tsx
type EditorCornerGripProps = {
  readonly disabled: boolean;
  readonly icon: 'maximize' | 'minimize';
  readonly label: string;
  readonly onClick: () => void;
};

function EditorCornerGrip({ disabled, icon, label, onClick }: EditorCornerGripProps) {
  const Icon = icon === 'maximize' ? Maximize : Minimize;

  return (
    <button
      aria-label={label}
      className="group absolute bottom-0 right-0 z-10 flex size-24 items-center justify-center rounded-tl-md text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:text-muted-foreground disabled:opacity-50"
      data-testid={`editor-${icon}-grip`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="block size-14 group-hover:hidden"
        fill="none"
        viewBox="0 0 14 14"
      >
        <path
          d="M2 12 A 10 10 0 0 0 12 2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      </svg>
      <Icon aria-hidden="true" className="hidden size-14 group-hover:block" />
    </button>
  );
}
```

Then use it:

```tsx
<EditorCornerGrip
  disabled={pending}
  icon="maximize"
  label="展开编辑器"
  onClick={() => onExpandedChange(true)}
/>
```

and in expanded stage:

```tsx
<EditorCornerGrip
  disabled={pending}
  icon="minimize"
  label="缩小编辑器"
  onClick={() => onExpandedChange(false)}
/>
```

- [ ] **Step 4: 运行 shell tests**

Run:

```bash
npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/EditorExpandShell.test.tsx
```

Expected: PASS。

---

## Task 2: 在 `InlineMarkdownContentEditor` 建立 dirty-return flow

**Files:**

- Modify: `src/renderer/src/workspace/MemoryStudio.tsx`

### Architecture intent

`InlineMarkdownContentEditor` 是唯一知道 dirty、pending、save result 和 cancel semantics 的 owner。不要把这些判断下放到 `EditorExpandShell`。返回流程不是 `expanded=false` 的别名，而是独立 intent：

```text
return intent
  ├─ clean -> expanded=false
  └─ dirty -> returnConfirmOpen=true
        ├─ save and return -> save success -> expanded=false
        ├─ discard -> cancel -> expanded=false
        └─ continue -> dialog close
```

- [ ] **Step 1: 让 shell 调用独立 `requestReturn`**

在 `InlineMarkdownContentEditor` 中新增：

```tsx
const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);

function requestReturnFromExpandedEditor() {
  if (editorState.pending || imageAttachment.pending) {
    return;
  }
  if (dirty) {
    setReturnConfirmOpen(true);
    return;
  }
  setExpanded(false);
}
```

传给 shell：

```tsx
<EditorExpandShell
  ...
  onReturn={requestReturnFromExpandedEditor}
  ...
/>
```

- [ ] **Step 2: 调整 `saveMarkdown` 返回明确结果**

把 `saveMarkdown` 的返回类型改为 `Promise<boolean>`。成功保存返回 `true`；失败、conflict、stale session、exception、attachment pending 返回 `false`。

关键分支：

```tsx
async function saveMarkdown(
  nextBaselineContentHash = editorState.activeBaselineContentHash,
  nextMarkdown = editorState.markdown
): Promise<boolean> {
  if (imageAttachment.pending) {
    return false;
  }
  flushSync(() => {
    dispatchEditorState({ type: 'save-started' });
  });
  const saveWorkspaceSessionKey = workspaceSessionKey;
  try {
    const result = await onSave(nextMarkdown, nextBaselineContentHash);
    if (latestWorkspaceSessionKeyRef.current !== saveWorkspaceSessionKey) {
      dispatchEditorState({ type: 'save-stale-session' });
      return false;
    }
    if (result.ok) {
      onSavedContent(result.saved);
      blurEditorSurface();
      dispatchEditorState({
        type: 'save-succeeded',
        ...(result.nextBaselineContentHash
          ? { nextBaselineContentHash: result.nextBaselineContentHash }
          : {}),
      });
      return true;
    }
    if (result.kind === 'conflict') {
      dispatchEditorState({ type: 'save-conflicted', conflict: result.conflict });
      return false;
    }
    dispatchEditorState({ type: 'save-failed', message: result.message });
    return false;
  } catch (error) {
    if (latestWorkspaceSessionKeyRef.current !== saveWorkspaceSessionKey) {
      dispatchEditorState({ type: 'save-stale-session' });
      return false;
    }
    dispatchEditorState({
      type: 'save-failed',
      message: unknownErrorDisplayMessage(error, failureCopy),
    });
    return false;
  }
}
```

Existing fire-and-forget callers stay as:

```tsx
onSave={() => void saveMarkdown()}
```

- [ ] **Step 3: 添加 dirty-return dialog**

`MemoryStudio.tsx` 当前已经直接 import `AlertDialog*` primitives 和 `Button`。复用这些已有 imports，不新增 wrapper，也不把三动作 dialog 塞进 `WorkspaceDangerConfirmDialog`，因为它只表达单一危险确认动作。

Render near the existing conflict dialog:

```tsx
<AlertDialog open={returnConfirmOpen} onOpenChange={setReturnConfirmOpen}>
  <AlertDialogContent className="flex flex-col gap-16 bg-popover shadow-modal sm:w-[min(420px,calc(100vw-40px))] sm:px-24 sm:py-24">
    <AlertDialogHeader>
      <AlertDialogTitle>保存未完成的修改？</AlertDialogTitle>
      <AlertDialogDescription>返回前可以保存当前修改，或放弃未保存内容。</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel asChild>
        <Button type="button" variant="secondary" disabled={disabled}>
          继续编辑
        </Button>
      </AlertDialogCancel>
      <AlertDialogAction asChild>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();
            cancelMarkdownEdit();
            setReturnConfirmOpen(false);
            setExpanded(false);
          }}
        >
          放弃修改
        </Button>
      </AlertDialogAction>
      <AlertDialogAction asChild>
        <Button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();
            void (async () => {
              const saved = await saveMarkdown();
              if (!saved) {
                return;
              }
              setReturnConfirmOpen(false);
              setExpanded(false);
            })();
          }}
        >
          保存并返回
        </Button>
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

If `AlertDialogFooter` button order feels too dense in runtime, keep the same actions but adjust only layout classes; do not change behavior.

- [ ] **Step 4: Close stale dialog on target/session change**

When `targetKey` changes or workspace session changes, close the return confirm:

```tsx
useEffect(() => {
  if (loadedTargetKeyRef.current !== targetKey) {
    setReturnConfirmOpen(false);
    ...
  }
  ...
}, [baselineContentHash, initialMarkdown, targetKey]);

useEffect(() => {
  latestWorkspaceSessionKeyRef.current = workspaceSessionKey;
  setReturnConfirmOpen(false);
  dispatchEditorState({ type: 'workspace-session-changed' });
}, [workspaceSessionKey]);
```

- [ ] **Step 5: Run TypeScript check for edited files via quick typecheck**

Run:

```bash
npm run typecheck:quick
```

Expected: PASS.

---

## Task 3: Add behavior tests for the integrated return flow

**Files:**

- Modify: `src/renderer/src/workspace/EditorExpandShell.test.tsx`
- Optional Modify: existing `MemoryStudio` inline editor tests if already local to this behavior

### Architecture intent

`EditorExpandShell.test.tsx` protects shell event separation. The dirty-return dialog behavior needs a test at the owner level if a focused `InlineMarkdownContentEditor` test harness already exists; otherwise add the highest-value assertions through the smallest existing Memory Studio component test surface. Do not create DOM-class microtests.

- [ ] **Step 1: Search for existing inline editor owner tests**

Run:

```bash
rg -n "InlineMarkdownContentEditor|保存并返回|磁盘内容已变化|inline text|展开为全屏|退出全屏|LightweightMarkdownEditorSurface" src/renderer/src/workspace -g '*.test.tsx'
```

Expected: identify whether `MemoryStudio` already has focused tests for inline edit save/cancel/conflict.

- [ ] **Step 2: Add owner-level tests where the existing harness is smallest**

Required behavioral assertions:

- Dirty return opens dialog with `保存并返回`、`放弃修改`、`继续编辑`.
- `继续编辑` leaves expanded dialog closed and editor still expanded.
- `放弃修改` calls existing cancel path and collapses.
- `保存并返回` collapses only when save result is success.
- Failed save / conflict keeps expanded.

Use user-facing roles and labels:

```tsx
await user.click(screen.getByRole('button', { name: '返回' }));
expect(screen.getByRole('alertdialog', { name: '保存未完成的修改？' })).toBeInTheDocument();

await user.click(screen.getByRole('button', { name: '继续编辑' }));
expect(screen.queryByRole('alertdialog', { name: '保存未完成的修改？' })).not.toBeInTheDocument();
expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument();
```

If no practical owner harness exists, do not invent a broad brittle Memory Studio fixture in this task. Instead:

- expand `EditorExpandShell.test.tsx` to fully cover event separation;
- add a focused reducer/helper test only if a small helper is extracted;
- record the remaining owner behavior for runtime validation in this spec.

- [ ] **Step 3: Run targeted renderer tests**

Run shell test:

```bash
npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/EditorExpandShell.test.tsx
```

Run any owner-level test file touched in Step 2:

```bash
npm run test:renderer -- --project renderer-jsdom-components <owner-test-file>
```

Expected: PASS.

---

## Task 4: Runtime visual validation

**Files:**

- No source edit unless validation exposes a bug.
- Update: `docs/specs/2026-05-25-0952-editor-expanded-return-controls/tasks.md`

- [ ] **Step 1: Start local dev runtime**

Run:

```bash
REMOTE_DEBUGGING_PORT=9233 npm run dev
```

Expected: Electron app launches.

- [ ] **Step 2: Validate the three required visual states**

Use the existing Memory Studio rich scenario or current local test workspace.

Required evidence:

- Folded inline editor: right-bottom Grip is visible and hover/focus reveals `Maximize`.
- Expanded editor: left-top `返回` appears; right-bottom Grip hover/focus reveals `Minimize`.
- Dirty expanded editor: clicking `返回` opens the three-action dialog with `保存并返回`、`放弃修改`、`继续编辑`.

If using screenshots, save under `/tmp` and mention paths in final. Do not commit screenshots.

- [ ] **Step 3: Stop dev runtime**

Stop any started dev process before final response.

---

## Task 5: Final verification and closeout

**Files:**

- Modify: `docs/specs/2026-05-25-0952-editor-expanded-return-controls/tasks.md`

- [ ] **Step 1: Mark completed tasks**

Update this spec's `tasks.md` checkboxes for completed implementation and validation work.

- [ ] **Step 2: Run full quick verification once**

Run:

```bash
npm run verify:quick
```

Expected: PASS.

- [ ] **Step 3: Review diff for patchiness**

Run:

```bash
git diff -- src/renderer/src/workspace/EditorExpandShell.tsx src/renderer/src/workspace/MemoryStudio.tsx src/renderer/src/workspace/EditorExpandShell.test.tsx docs/specs/2026-05-25-0952-editor-expanded-return-controls
```

Check:

- no duplicated save mutation;
- no dirty logic inside `EditorExpandShell`;
- no `退出全屏` titlebar control left behind;
- right-bottom resize control is the only shrink control;
- `返回` and Drawer dismiss use the same flow.

- [ ] **Step 4: Prepare final summary**

Final response must include:

- model-level change summary;
- tests run;
- runtime visual evidence;
- any skipped validation and why.

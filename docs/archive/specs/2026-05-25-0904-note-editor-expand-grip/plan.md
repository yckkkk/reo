# 内联编辑器「展开/缩小」视图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为记忆空间底部的内联 Markdown 编辑卡片增加单弧 Grip 触发的全窗「展开编辑态」,展开/缩小是纯视图切换,复用现有编辑状态机。

**Architecture:** 新建一个聚焦的展示型组件 `EditorExpandShell`,它根据 `expanded` 把编辑器子节点渲染到内联卡片(带右下角 Grip)或全窗 `ImmersiveWorkspaceSurface`(带标题栏 Minimize/取消/保存)。`InlineMarkdownContentEditor` 持有 `expanded` 状态并把 `LightweightMarkdownEditorSurface` 作为 children 传入;切换时 children 在两个位置间移动 → React 重挂载,内容/dirty 由现有 reducer 通过 `value` 保留。

**Tech Stack:** React + TypeScript、Tiptap(`LightweightMarkdownEditorSurface`)、vaul Drawer(`ImmersiveWorkspaceSurface`)、lucide-react(`Maximize`/`Minimize`)、Vitest + React Testing Library。

---

## File Structure

- **Create** `src/renderer/src/workspace/EditorExpandShell.tsx` — 展示型外壳组件,负责折叠/展开两种渲染 + Grip + 标题栏控件。无编辑逻辑。
- **Create** `src/renderer/src/workspace/EditorExpandShell.test.tsx` — 组件行为测试(Grip 点击、Minimize、dirty 时取消/保存、pending 隐藏动作)。
- **Modify** `src/renderer/src/workspace/MemoryStudio.tsx` — `InlineMarkdownContentEditor`:新增 `expanded` 状态与 `title` prop,用 `EditorExpandShell` 包裹 surface,`bordered`/`showActions` 随 `expanded` 变化;4 个调用点透传 `title`。

---

## Task 1: 创建 `EditorExpandShell` 组件(TDD)

**Files:**

- Create: `src/renderer/src/workspace/EditorExpandShell.tsx`
- Test: `src/renderer/src/workspace/EditorExpandShell.test.tsx`

- [ ] **Step 1: 写失败测试**

写入 `src/renderer/src/workspace/EditorExpandShell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EditorExpandShell } from './EditorExpandShell';

type RenderOverrides = Partial<Parameters<typeof EditorExpandShell>[0]>;

function renderShell(overrides: RenderOverrides = {}) {
  const props = {
    ariaLabelledBy: 'tab-1',
    cancelLabel: '取消',
    dirty: false,
    expanded: false,
    onCancel: vi.fn(),
    onExpandedChange: vi.fn(),
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

describe('EditorExpandShell', () => {
  it('collapsed: 显示 Grip,点击请求展开,不显示全窗控件', async () => {
    const user = userEvent.setup();
    const props = renderShell({ expanded: false });

    expect(screen.getByTestId('editor-body')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '退出全屏编辑' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '展开为全屏编辑' }));
    expect(props.onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('expanded(未改动): 显示全窗与 Minimize,点击请求收起,不显示取消/保存', async () => {
    const user = userEvent.setup();
    const props = renderShell({ expanded: true, dirty: false });

    expect(screen.getByRole('dialog', { name: '正文' })).toBeInTheDocument();
    expect(screen.getByTestId('editor-body')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '退出全屏编辑' }));
    expect(props.onExpandedChange).toHaveBeenCalledWith(false);
  });

  it('expanded(已改动): 显示取消/保存并连到 handler', async () => {
    const user = userEvent.setup();
    const props = renderShell({ expanded: true, dirty: true });

    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(props.onCancel).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(props.onSave).toHaveBeenCalledOnce();
  });

  it('expanded + pending: 即使 dirty 也隐藏取消/保存,仍显示 Minimize', () => {
    renderShell({ expanded: true, dirty: true, pending: true });

    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出全屏编辑' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/EditorExpandShell.test.tsx`
Expected: FAIL — `Failed to resolve import './EditorExpandShell'`(模块未创建)。

- [ ] **Step 3: 写最小实现**

写入 `src/renderer/src/workspace/EditorExpandShell.tsx`:

```tsx
import { Maximize, Minimize } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  TITLEBAR_ACTION_RIGHT,
  TITLEBAR_CONTROL_GAP,
  TITLEBAR_CONTROL_LEFT,
  TITLEBAR_CONTROL_SIZE,
  TITLEBAR_CONTROL_TOP,
} from '../app-shell/appShellGeometry';
import { ImmersiveWorkspaceSurface } from './ImmersiveWorkspaceSurface';

const EXPANDED_TITLEBAR_TITLE_LEFT =
  TITLEBAR_CONTROL_LEFT + TITLEBAR_CONTROL_SIZE + TITLEBAR_CONTROL_GAP;

type EditorExpandShellProps = {
  readonly ariaLabelledBy: string;
  readonly cancelButtonClassName?: string;
  readonly cancelLabel?: string;
  readonly children: ReactNode;
  readonly dirty: boolean;
  readonly expanded: boolean;
  readonly onCancel: () => void;
  readonly onExpandedChange: (expanded: boolean) => void;
  readonly onSave: () => void;
  readonly panelId: string;
  readonly pending: boolean;
  readonly renderAsPanel: boolean;
  readonly saveButtonClassName?: string;
  readonly saveDisabled: boolean;
  readonly saveLabel: string;
  readonly title: string;
};

export function EditorExpandShell({
  ariaLabelledBy,
  cancelButtonClassName,
  cancelLabel = '取消',
  children,
  dirty,
  expanded,
  onCancel,
  onExpandedChange,
  onSave,
  panelId,
  pending,
  renderAsPanel,
  saveButtonClassName,
  saveDisabled,
  saveLabel,
  title,
}: EditorExpandShellProps) {
  const showActions = dirty && !pending;

  return (
    <>
      {expanded ? null : (
        <div
          aria-labelledby={renderAsPanel ? ariaLabelledBy : undefined}
          className="relative mt-12 flex min-h-0 w-full flex-1"
          data-slot="memory-studio-inline-markdown-editor"
          id={panelId}
          role={renderAsPanel ? 'tabpanel' : undefined}
        >
          {children}
          <button
            aria-label="展开为全屏编辑"
            className="group absolute bottom-0 right-0 z-10 flex size-24 items-center justify-center rounded-tl-md text-muted-foreground transition-colors hover:text-foreground"
            data-testid="editor-expand-grip"
            onClick={() => onExpandedChange(true)}
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
            <Maximize aria-hidden="true" className="hidden size-14 group-hover:block" />
          </button>
        </div>
      )}

      <ImmersiveWorkspaceSurface
        closeBlocked={pending}
        description={title}
        fill
        immersive
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onExpandedChange(false);
          }
        }}
        open={expanded}
        title={title}
      >
        <span
          className="absolute z-10 flex h-32 max-w-[calc(100vw-280px)] items-center truncate text-body font-regular leading-body text-foreground"
          data-testid="editor-expand-titlebar-title"
          style={{ left: EXPANDED_TITLEBAR_TITLE_LEFT, top: TITLEBAR_CONTROL_TOP }}
        >
          {title}
        </span>
        <div
          className="absolute z-10 flex h-48 items-center gap-8"
          data-testid="editor-expand-titlebar-actions"
          style={{ right: TITLEBAR_ACTION_RIGHT, top: 0 }}
        >
          <Button
            aria-label="退出全屏编辑"
            className="text-muted-foreground hover:bg-secondary hover:text-foreground disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-100"
            data-vaul-no-drag
            disabled={pending}
            onClick={() => onExpandedChange(false)}
            size="icon"
            type="button"
            variant="ghostIcon"
          >
            <Minimize aria-hidden="true" className="size-16" />
          </Button>
          {showActions ? (
            <>
              <Button
                className={cancelButtonClassName}
                disabled={saveDisabled}
                onClick={onCancel}
                size="compact"
                type="button"
              >
                {cancelLabel}
              </Button>
              <Button
                className={saveButtonClassName}
                disabled={saveDisabled}
                onClick={onSave}
                size="compact"
                type="button"
              >
                {saveLabel}
              </Button>
            </>
          ) : null}
        </div>

        <section
          className="grid min-h-0 w-full flex-1 grid-rows-[minmax(0,1fr)] text-left"
          data-testid="editor-expand-stage"
          id={panelId}
          {...(renderAsPanel
            ? { role: 'tabpanel', 'aria-labelledby': ariaLabelledBy }
            : { 'aria-label': '笔记编辑器' })}
        >
          {children}
        </section>
      </ImmersiveWorkspaceSurface>
    </>
  );
}
```

注:`children`(编辑器 surface)在折叠态渲染于内联 `div`,展开态渲染于全窗 `section`;两者随 `expanded` 互斥(关闭时 vaul 不渲染 DrawerContent),切换时 React 重挂载 surface,符合 spec 选定的「重挂载」方案。`id={panelId}` 在任一时刻只挂载一处,无重复 id。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/EditorExpandShell.test.tsx`
Expected: PASS(4 个用例)。

> 若 `collapsed` 用例意外发现 `dialog`/Minimize(即 vaul 在 `open={false}` 仍渲染内容),说明运行时与预期不符,停止并改用「断言 Minimize 按钮缺失」已是当前断言;无需改测试。如确有渲染,记录到 implementation-notes.md 再调整,不要削弱断言去迁就实现。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/src/workspace/EditorExpandShell.tsx src/renderer/src/workspace/EditorExpandShell.test.tsx
git commit -m "feat(editor): add EditorExpandShell for inline/full-window view toggle"
```

---

## Task 2: 在 `InlineMarkdownContentEditor` 接入 `EditorExpandShell`

**Files:**

- Modify: `src/renderer/src/workspace/MemoryStudio.tsx`(props 类型 `2143-2166`、函数签名 `2168-2188`、返回结构 `2336-2438`)

- [ ] **Step 1: 给 `InlineMarkdownContentEditorProps` 增加 `title`**

在 `InlineMarkdownContentEditorProps<TSaved>`(MemoryStudio.tsx:2143)的字段中加入:

```tsx
  readonly title: string;
```

并在函数解构签名(MemoryStudio.tsx:2168 起的参数列表)中加入 `title,`(与其他参数同级,放在 `targetKey,` 附近即可)。

- [ ] **Step 2: 导入 `EditorExpandShell`**

在 MemoryStudio.tsx 顶部、`LightweightMarkdownEditorSurface` 导入(约 54-56 行)之后新增:

```tsx
import { EditorExpandShell } from './EditorExpandShell';
```

- [ ] **Step 3: 增加 `expanded` 状态**

在 `InlineMarkdownContentEditor` 函数体内,`const dirty = inlineMarkdownEditorIsDirty(editorState);`(约 2199 行)之后新增:

```tsx
const [expanded, setExpanded] = useState(false);
```

(`useState` 已在文件顶部导入,无需新增 import。)

- [ ] **Step 4: 用 `EditorExpandShell` 包裹 surface**

把返回结构中原本的内联包裹 `div`(MemoryStudio.tsx:2338-2344,即 `id={panelId} ... data-slot="memory-studio-inline-markdown-editor"` 那个 `div`)整体替换为 `EditorExpandShell`,并让 `LightweightMarkdownEditorSurface` 成为其 children。`AlertDialog`(2384 起)保持不变,留在外层 fragment 内。

将:

```tsx
      <div
        id={panelId}
        role={renderAsPanel ? 'tabpanel' : undefined}
        aria-labelledby={renderAsPanel ? ariaLabelledBy : undefined}
        className="mt-12 flex min-h-0 w-full flex-1"
        data-slot="memory-studio-inline-markdown-editor"
      >
        <LightweightMarkdownEditorSurface
```

替换为:

```tsx
      <EditorExpandShell
        ariaLabelledBy={ariaLabelledBy}
        cancelButtonClassName="min-w-56 rounded-xl !bg-secondary px-12 text-foreground !transition-none hover:!bg-secondary active:!bg-secondary focus-visible:!bg-secondary disabled:!bg-secondary disabled:text-foreground"
        dirty={dirty}
        expanded={expanded}
        onCancel={cancelMarkdownEdit}
        onExpandedChange={setExpanded}
        onSave={() => void saveMarkdown()}
        panelId={panelId}
        pending={editorState.pending}
        renderAsPanel={renderAsPanel}
        saveButtonClassName="min-w-56 rounded-xl !bg-foreground px-12 text-background !transition-none hover:!bg-foreground active:!bg-foreground focus-visible:!bg-foreground disabled:!bg-foreground disabled:text-background"
        saveDisabled={disabled}
        saveLabel={saveLabel}
        title={title}
      >
        <LightweightMarkdownEditorSurface
```

并把原 `div` 的闭合标签 `</div>`(2382-2383,即紧接 surface 之后的那个)替换为 `</EditorExpandShell>`。

- [ ] **Step 5: surface 的 `bordered` / `showActions` 随 `expanded` 变化**

在该 `LightweightMarkdownEditorSurface` 的 props 中:

- 新增 `bordered={!expanded}`(展开态无卡片边框,与全窗一致)。
- 把现有 `showActions={dirty && !editorState.pending}`(约 2369 行)改为 `showActions={!expanded && dirty && !editorState.pending}`(展开态下动作上移到标题栏,不在 toolbar 显示)。

surface 原有的 `onCancel` / `onSave` / `cancelButtonClassName` / `saveButtonClassName` / `saveDisabled` / `saveLabel` 等 props 全部保留不变——折叠态 toolbar 仍用它们。

- [ ] **Step 6: typecheck + 既有测试**

Run: `npm run typecheck:quick && npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/EditorExpandShell.test.tsx`
Expected: typecheck 报错指出 4 个 `InlineMarkdownContentEditor` 调用点缺少必填 `title`(将在 Task 3 修复);`EditorExpandShell` 测试仍 PASS。

> 本步预期 typecheck 因缺 `title` 而报错,这是 Task 3 的输入信号,不要在此处用可选 `title?` 绕过——`title` 是必填契约。

---

## Task 3: 4 个调用点透传 `title`

**Files:**

- Modify: `src/renderer/src/workspace/MemoryStudio.tsx`(调用点 `1993`、`2470`、`3960`、`4023`)

- [ ] **Step 1: 片段录音转录编辑器(约 3960)**

在该 `<InlineMarkdownContentEditor<SavedSegmentTranscriptContent>` 的 props 中新增:

```tsx
                    title={transcriptContentTab.title}
```

- [ ] **Step 2: 笔记片段正文编辑器(约 4023)**

在该 `<InlineMarkdownContentEditor<SavedNoteSegmentContent>` 的 props 中新增:

```tsx
                    title={transcriptContentTab.title}
```

- [ ] **Step 3: 补充笔记编辑器(约 2470)**

在该 `<InlineMarkdownContentEditor<SavedNoteSegmentSupplementContent>` 的 props 中新增:

```tsx
        title={supplement.title}
```

- [ ] **Step 4: 补充录音转录编辑器(约 1993)**

在该 `<InlineMarkdownContentEditor<SavedSegmentSupplementTranscriptContent>` 的 props 中新增:

```tsx
          title={supplement.title}
```

- [ ] **Step 5: typecheck + lint**

Run: `npm run typecheck:quick && npm run lint:strict`
Expected: PASS,无缺失 `title` 报错。

- [ ] **Step 6: 提交**

```bash
git add src/renderer/src/workspace/MemoryStudio.tsx
git commit -m "feat(editor): wire inline editor expand/collapse view with corner grip"
```

---

## Task 4: 全量验证与运行时视觉确认

**Files:** 无(验证)

- [ ] **Step 1: 提交前全量验证**

Run: `npm run verify:quick`
Expected: PASS(typecheck、main/renderer 测试、lint、format)。

> 若 `format:check` 报错,运行 `npm run format`(或 `prettier --write`)后重新 `verify:quick`,再补一次提交。

- [ ] **Step 2: 运行时视觉验证**

用 `/run` 启动应用,在记忆空间打开一个片段:

1. 确认内联编辑卡片右下角始终有单弧 Grip;hover 变 `Maximize` 图标。
2. 点击 Grip → 进入全窗;标题栏左显示当前 tab 名称,右上角只有 `Minimize`。
3. 在全窗里编辑产生改动 → 出现 `取消` / `保存`;点 `保存`/`取消` 后留在全窗。
4. 点 `Minimize` / Esc → 收起回卡片,内容保留。
5. 切换 `正文` / 补充 tab,确认每个内联编辑器都有 Grip 且行为一致。
6. 确认新建笔记/补充的全窗(右上角「保存笔记」)行为未变。

把折叠态、Grip hover 态、展开态截图作为验证证据存入本 spec 目录。

- [ ] **Step 3: 记录实现笔记**

在 `docs/specs/2026-05-25-0904-note-editor-expand-grip/implementation-notes.md` 记录:实际验证命令与输出摘要、运行时观察、任何与计划的偏差。

---

## Self-Review

**Spec coverage:**

- 单弧 Grip + hover Maximize + 点击展开 → Task 1 Step 3(grip button/SVG)、Task 4 视觉验证。
- 展开/缩小纯视图、不弹放弃确认 → `EditorExpandShell` 无确认逻辑;`onOpenChange` 仅 `onExpandedChange(false)`。
- 复用现有编辑状态机(dirty/save/cancel) → Task 2 传入 `dirty`/`cancelMarkdownEdit`/`saveMarkdown`,surface 动作 props 保留。
- 重挂载保留内容 → children 在两位置互斥渲染;内容经 reducer 的 `value` 保留。
- 全窗复用 ImmersiveWorkspaceSurface(immersive+fill) → Task 1 实现。
- 标题栏左 tab 名称 → `title` prop,Task 3 透传;右上角始终 Minimize、dirty 时取消/保存 → Task 1 `showActions` 逻辑。
- pending 锁定切换 → `closeBlocked={pending}` + Minimize `disabled={pending}` + 动作 `showActions` 含 `!pending`。
- 新建流程不变 → 未触碰 `NoteEditorOverlay`。
- 4 个调用点统一获得能力 → Task 3 覆盖全部 4 处。

**Placeholder scan:** 无 TODO/TBD;所有步骤含具体代码或命令。

**Type consistency:** `EditorExpandShell` props(`expanded`/`onExpandedChange`/`dirty`/`pending`/`title`/`renderAsPanel`/`panelId`/`ariaLabelledBy`/`saveDisabled`/`saveLabel`/`cancelLabel`)在 Task 1 定义,Task 2 传入一致;`title` 在 props 类型(Task 2 Step 1)与 4 个调用点(Task 3)一致。

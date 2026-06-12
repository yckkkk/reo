# 移动弹层重新设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `EntityMoveDialog` 从常态全展开的扁平树重做成「原地可折叠树 + 顶部搜索」的文件移动弹层，drop-in 替换内部，契约/IPC/main 不变。

**Architecture:** 把所有分支与可见性逻辑抽到纯函数模块 `entityMoveTree.ts`（按 source 模式 + 展开集 + 搜索 + 选择，投影出一维 `MoveTreeRow[]`），并对它做 TDD；`EntityMoveDialog.tsx` 退化为持有 `selection / query / expandedSpaces / expandedMemories` 四个 state，消费投影渲染统一行视图、搜索框与头部源上下文。

**Tech Stack:** React 19 + TypeScript、Tailwind v4（px 级 `--spacing-N`、`--text-ui-*` token）、shadcn `Dialog`/`Input`/`Button`、lucide-react、Vitest + Testing Library + user-event。

**风险面（决定 TDD）：** 用户可见的跨空间移动 workflow × 三种 source 模式分支 × 搜索可见性逻辑。核心投影函数必做行为 TDD；组件层做关键交互测试。

**相关真源：** `docs/specs/2026-06-10-0149-entity-move-dialog-redesign/README.md`；`docs/current/frontend.md`（设计系统 token、行为规则）。

**约定（项目记忆）：**

- 全程维护 `docs/specs/2026-06-10-0149-entity-move-dialog-redesign/implementation-notes.md`（每完成一步追加：做了什么、验证输出、截图路径）。
- 每个 Phase 收尾跑 `/review` + `/simplify` 通过后再进入下一 Phase。
- 任务进行中用 targeted 测试；`npm run verify:quick` 只在最后收口前跑一次。

---

## 文件结构

- Create `src/renderer/src/workspace/entityMoveTree.ts` — 纯模型：`EntityMoveTargetSelection` 类型、`selectionKey`、`moveSourceKey`、`moveDialogTitle`、`initialExpansion`、`countSelectableLeaves`、`projectMoveTree`、`MoveTreeRow` 类型。无 React、无 DOM。
- Create `src/renderer/src/workspace/entityMoveTree.test.ts` — 纯函数行为测试。
- Rewrite `src/renderer/src/workspace/EntityMoveDialog.tsx` — 仅渲染 + 4 个 state；从 `entityMoveTree` 导入模型；re-export `EntityMoveTargetSelection`（保持 `App.tsx` 导入不变）。
- Rewrite `src/renderer/src/workspace/EntityMoveDialog.test.tsx` — 折叠/展开、当前位置禁用、搜索过滤、三模式确认。
- 不改：`App.tsx`、`workspaceApi.ts`、`workspace-contract/*`、`src/main/*`、`src/preload/*`。

---

## Task 0: 建分支

- [ ] **Step 1: 从 main 切工作分支**

Run:

```bash
git checkout -b feat/entity-move-dialog-redesign
```

Expected: `Switched to a new branch 'feat/entity-move-dialog-redesign'`

- [ ] **Step 2: 建实现笔记**

Create `docs/specs/2026-06-10-0149-entity-move-dialog-redesign/implementation-notes.md`:

```markdown
# 实现笔记 — 移动弹层重新设计

## 进度

- (按步骤追加：做了什么 / 验证输出 / 截图路径)
```

---

## Phase 1 — 纯模型模块（TDD）

### Task 1: `entityMoveTree.ts` 模型与纯 helper

**Files:**

- Create: `src/renderer/src/workspace/entityMoveTree.ts`
- Test: `src/renderer/src/workspace/entityMoveTree.test.ts`

- [ ] **Step 1: 写失败测试（helper 部分）**

Create `src/renderer/src/workspace/entityMoveTree.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { EntityMoveTargets } from './workspaceApi';
import {
  countSelectableLeaves,
  initialExpansion,
  moveDialogTitle,
  moveSourceKey,
  selectionKey,
} from './entityMoveTree';

const memoryMoveTargets: EntityMoveTargets = {
  source: {
    type: 'memory',
    workspaceId: 'ws_a',
    memoryId: 'mem_a',
    title: '源记忆',
    breadcrumb: ['空间A'],
  },
  targetLevel: 'workspace',
  spaces: [
    { workspaceId: 'ws_a', title: '空间A', disabledReason: '当前位置', memories: [] },
    { workspaceId: 'ws_b', title: '空间B', disabledReason: null, memories: [] },
    { workspaceId: 'ws_c', title: '空间C', disabledReason: null, memories: [] },
  ],
};

const supplementMoveTargets: EntityMoveTargets = {
  source: {
    type: 'supplement',
    workspaceId: 'ws_a',
    memoryId: 'mem_a',
    segmentId: 'seg_a',
    supplementId: 'sup_a',
    title: '源补充',
    breadcrumb: ['空间A', '记忆A', '片段A'],
  },
  targetLevel: 'segment',
  spaces: [
    {
      workspaceId: 'ws_a',
      title: '空间A',
      disabledReason: null,
      memories: [
        {
          memoryId: 'mem_a',
          title: '记忆A',
          disabledReason: null,
          segments: [
            { segmentId: 'seg_a', title: '片段A', disabledReason: '当前位置' },
            { segmentId: 'seg_b', title: '片段B', disabledReason: null },
          ],
        },
      ],
    },
  ],
};

describe('selectionKey', () => {
  it('keys each selection depth distinctly', () => {
    expect(selectionKey({ targetWorkspaceId: 'w' })).toBe('w');
    expect(selectionKey({ targetWorkspaceId: 'w', targetMemoryId: 'm' })).toBe('w/m');
    expect(
      selectionKey({ targetWorkspaceId: 'w', targetMemoryId: 'm', targetSegmentId: 's' })
    ).toBe('w/m/s');
  });
});

describe('moveDialogTitle', () => {
  it('derives the title from the source type', () => {
    expect(moveDialogTitle(memoryMoveTargets)).toBe('移动记忆');
    expect(moveDialogTitle(supplementMoveTargets)).toBe('移动补充内容');
    expect(moveDialogTitle(null)).toBe('移动片段');
  });
});

describe('moveSourceKey', () => {
  it('builds a stable key per source identity', () => {
    expect(moveSourceKey(memoryMoveTargets)).toBe('ws_a/mem_a');
    expect(moveSourceKey(supplementMoveTargets)).toBe('ws_a/mem_a/seg_a/sup_a');
    expect(moveSourceKey(null)).toBe('none');
  });
});

describe('initialExpansion', () => {
  it('expands only the source space for shallow moves', () => {
    const result = initialExpansion(memoryMoveTargets);
    expect([...result.expandedSpaces]).toEqual(['ws_a']);
    expect([...result.expandedMemories]).toEqual([]);
  });

  it('expands the source space and source memory for supplement moves', () => {
    const result = initialExpansion(supplementMoveTargets);
    expect([...result.expandedSpaces]).toEqual(['ws_a']);
    expect([...result.expandedMemories]).toEqual(['ws_a/mem_a']);
  });
});

describe('countSelectableLeaves', () => {
  it('counts selectable spaces, excluding the current location', () => {
    expect(countSelectableLeaves(memoryMoveTargets)).toBe(2);
  });

  it('counts selectable segments, excluding the current location', () => {
    expect(countSelectableLeaves(supplementMoveTargets)).toBe(1);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/renderer/src/workspace/entityMoveTree.test.ts`
Expected: FAIL — `Failed to resolve import "./entityMoveTree"` / 函数未定义。

- [ ] **Step 3: 写最小实现（helper 部分）**

Create `src/renderer/src/workspace/entityMoveTree.ts`:

```ts
import type { EntityMoveTargets } from './workspaceApi';

export type EntityMoveTargetSelection =
  | { readonly targetWorkspaceId: string }
  | { readonly targetWorkspaceId: string; readonly targetMemoryId: string }
  | {
      readonly targetWorkspaceId: string;
      readonly targetMemoryId: string;
      readonly targetSegmentId: string;
    };

function memoryKey(workspaceId: string, memoryId: string): string {
  return `${workspaceId}/${memoryId}`;
}

export function selectionKey(selection: EntityMoveTargetSelection): string {
  if ('targetSegmentId' in selection) {
    return `${selection.targetWorkspaceId}/${selection.targetMemoryId}/${selection.targetSegmentId}`;
  }
  if ('targetMemoryId' in selection) {
    return `${selection.targetWorkspaceId}/${selection.targetMemoryId}`;
  }
  return selection.targetWorkspaceId;
}

export function moveSourceKey(targets: EntityMoveTargets | null): string {
  const source = targets?.source;
  if (!source) {
    return 'none';
  }
  if (source.type === 'memory') {
    return `${source.workspaceId}/${source.memoryId}`;
  }
  if (source.type === 'segment') {
    return `${source.workspaceId}/${source.memoryId}/${source.segmentId}`;
  }
  return `${source.workspaceId}/${source.memoryId}/${source.segmentId}/${source.supplementId}`;
}

export function moveDialogTitle(targets: EntityMoveTargets | null): string {
  if (targets?.source.type === 'memory') {
    return '移动记忆';
  }
  if (targets?.source.type === 'supplement') {
    return '移动补充内容';
  }
  return '移动片段';
}

export function initialExpansion(targets: EntityMoveTargets): {
  readonly expandedSpaces: ReadonlySet<string>;
  readonly expandedMemories: ReadonlySet<string>;
} {
  const { source } = targets;
  const expandedSpaces = new Set<string>([source.workspaceId]);
  const expandedMemories = new Set<string>();
  if (source.type === 'supplement') {
    expandedMemories.add(memoryKey(source.workspaceId, source.memoryId));
  }
  return { expandedSpaces, expandedMemories };
}

export function countSelectableLeaves(targets: EntityMoveTargets): number {
  if (targets.targetLevel === 'workspace') {
    return targets.spaces.filter((space) => !space.disabledReason).length;
  }
  if (targets.targetLevel === 'memory') {
    return targets.spaces.reduce(
      (count, space) =>
        count +
        space.memories.filter((memory) => !space.disabledReason && !memory.disabledReason).length,
      0
    );
  }
  return targets.spaces.reduce(
    (spaceCount, space) =>
      spaceCount +
      space.memories.reduce(
        (memoryCount, memory) =>
          memoryCount +
          memory.segments.filter(
            (segment) => !space.disabledReason && !memory.disabledReason && !segment.disabledReason
          ).length,
        0
      ),
    0
  );
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/renderer/src/workspace/entityMoveTree.test.ts`
Expected: PASS（helper describe 块全绿）。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/src/workspace/entityMoveTree.ts src/renderer/src/workspace/entityMoveTree.test.ts
git commit -m "feat: add entity move tree model helpers"
```

### Task 2: `projectMoveTree` 投影函数

**Files:**

- Modify: `src/renderer/src/workspace/entityMoveTree.ts`
- Test: `src/renderer/src/workspace/entityMoveTree.test.ts`

- [ ] **Step 1: 追加失败测试（投影部分）**

在 `entityMoveTree.test.ts` 顶部 import 增补 `projectMoveTree` 与类型，并复用既有 fixtures，新增一个 segment fixture，追加测试：

```ts
// 在 import 行加入 projectMoveTree
import {
  countSelectableLeaves,
  initialExpansion,
  moveDialogTitle,
  moveSourceKey,
  projectMoveTree,
  selectionKey,
} from './entityMoveTree';

const segmentMoveTargets: EntityMoveTargets = {
  source: {
    type: 'segment',
    workspaceId: 'ws_a',
    memoryId: 'mem_a',
    segmentId: 'seg_a',
    title: '源片段',
    breadcrumb: ['空间A', '记忆A'],
  },
  targetLevel: 'memory',
  spaces: [
    {
      workspaceId: 'ws_a',
      title: '空间A',
      disabledReason: null,
      memories: [
        { memoryId: 'mem_a', title: '记忆A', disabledReason: '当前位置', segments: [] },
        { memoryId: 'mem_b', title: '记忆B', disabledReason: null, segments: [] },
      ],
    },
    { workspaceId: 'ws_empty', title: '空空间', disabledReason: null, memories: [] },
  ],
};

const noQuery = '';

describe('projectMoveTree — memory move (workspace level)', () => {
  it('renders every space as a leaf and marks the current location disabled', () => {
    const rows = projectMoveTree({
      targets: memoryMoveTargets,
      expandedSpaces: new Set(),
      expandedMemories: new Set(),
      query: noQuery,
      selection: null,
    });
    expect(rows.map((row) => ({ title: row.title, role: row.role }))).toEqual([
      { title: '空间A', role: 'leaf' },
      { title: '空间B', role: 'leaf' },
      { title: '空间C', role: 'leaf' },
    ]);
    const current = rows.find((row) => row.title === '空间A');
    expect(current?.role === 'leaf' && current.disabledReason).toBe('当前位置');
  });

  it('marks the selected space', () => {
    const rows = projectMoveTree({
      targets: memoryMoveTargets,
      expandedSpaces: new Set(),
      expandedMemories: new Set(),
      query: noQuery,
      selection: { targetWorkspaceId: 'ws_b' },
    });
    const selectedTitles = rows
      .filter((row) => row.role === 'leaf' && row.selected)
      .map((r) => r.title);
    expect(selectedTitles).toEqual(['空间B']);
  });
});

describe('projectMoveTree — segment move (memory level)', () => {
  it('collapses memories under a folder until the space is expanded', () => {
    const collapsed = projectMoveTree({
      targets: segmentMoveTargets,
      expandedSpaces: new Set(),
      expandedMemories: new Set(),
      query: noQuery,
      selection: null,
    });
    // 仅文件夹行，没有 Memory 叶子
    expect(collapsed.every((row) => row.role === 'folder')).toBe(true);
    const spaceA = collapsed.find((row) => row.title === '空间A');
    expect(spaceA?.role === 'folder' && spaceA.childCount).toBe(2);
    expect(spaceA?.role === 'folder' && spaceA.expanded).toBe(false);
  });

  it('reveals memory leaves when the space is expanded and disables the current memory', () => {
    const rows = projectMoveTree({
      targets: segmentMoveTargets,
      expandedSpaces: new Set(['ws_a']),
      expandedMemories: new Set(),
      query: noQuery,
      selection: null,
    });
    const titles = rows.map((row) => row.title);
    expect(titles).toEqual(['空间A', '记忆A', '记忆B', '空空间']);
    const current = rows.find((row) => row.title === '记忆A');
    expect(current?.role === 'leaf' && current.disabledReason).toBe('当前位置');
    const sibling = rows.find((row) => row.title === '记忆B');
    expect(sibling?.role === 'leaf' && sibling.disabledReason).toBe(null);
  });

  it('renders an empty space as a non-expandable folder', () => {
    const rows = projectMoveTree({
      targets: segmentMoveTargets,
      expandedSpaces: new Set(['ws_empty']),
      expandedMemories: new Set(),
      query: noQuery,
      selection: null,
    });
    const empty = rows.find((row) => row.title === '空空间');
    expect(empty?.role === 'folder' && empty.expandable).toBe(false);
    expect(empty?.role === 'folder' && empty.childCount).toBe(0);
  });
});

describe('projectMoveTree — supplement move (segment level)', () => {
  it('reveals segment leaves only when both folders are expanded', () => {
    const rows = projectMoveTree({
      targets: supplementMoveTargets,
      expandedSpaces: new Set(['ws_a']),
      expandedMemories: new Set(['ws_a/mem_a']),
      query: noQuery,
      selection: { targetWorkspaceId: 'ws_a', targetMemoryId: 'mem_a', targetSegmentId: 'seg_b' },
    });
    expect(rows.map((row) => `${row.depth}:${row.title}`)).toEqual([
      '0:空间A',
      '1:记忆A',
      '2:片段A',
      '2:片段B',
    ]);
    const current = rows.find((row) => row.title === '片段A');
    expect(current?.role === 'leaf' && current.disabledReason).toBe('当前位置');
    const selected = rows.find((row) => row.title === '片段B');
    expect(selected?.role === 'leaf' && selected.selected).toBe(true);
  });
});

describe('projectMoveTree — search', () => {
  it('filters to matching paths and force-expands them', () => {
    const rows = projectMoveTree({
      targets: segmentMoveTargets,
      expandedSpaces: new Set(),
      expandedMemories: new Set(),
      query: '记忆B',
      selection: null,
    });
    // 空间A 文件夹 force-expanded，仅露出命中的 记忆B；空空间被过滤掉
    expect(rows.map((row) => row.title)).toEqual(['空间A', '记忆B']);
    const spaceA = rows.find((row) => row.title === '空间A');
    expect(spaceA?.role === 'folder' && spaceA.expanded).toBe(true);
  });

  it('returns no rows when nothing matches', () => {
    const rows = projectMoveTree({
      targets: segmentMoveTargets,
      expandedSpaces: new Set(),
      expandedMemories: new Set(),
      query: '不存在的名字',
      selection: null,
    });
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/renderer/src/workspace/entityMoveTree.test.ts`
Expected: FAIL — `projectMoveTree is not a function`。

- [ ] **Step 3: 实现 `projectMoveTree` + `MoveTreeRow`**

在 `entityMoveTree.ts` 末尾追加：

```ts
export type MoveTreeRow = {
  readonly key: string;
  readonly depth: 0 | 1 | 2;
  readonly title: string;
} & (
  | {
      readonly role: 'folder';
      readonly icon: 'space' | 'memory';
      readonly toggleKey: string;
      readonly toggleDepth: 0 | 1;
      readonly childCount: number;
      readonly expandable: boolean;
      readonly expanded: boolean;
    }
  | {
      readonly role: 'leaf';
      readonly icon: 'space' | 'memory' | 'segment';
      readonly selection: EntityMoveTargetSelection;
      readonly disabledReason: string | null;
      readonly selected: boolean;
    }
);

export function projectMoveTree(input: {
  readonly targets: EntityMoveTargets;
  readonly expandedSpaces: ReadonlySet<string>;
  readonly expandedMemories: ReadonlySet<string>;
  readonly query: string;
  readonly selection: EntityMoveTargetSelection | null;
}): readonly MoveTreeRow[] {
  const { targets, expandedSpaces, expandedMemories, query, selection } = input;
  const normalized = query.trim().toLowerCase();
  const searching = normalized.length > 0;
  const matches = (title: string) => !searching || title.toLowerCase().includes(normalized);
  const isSelected = (candidate: EntityMoveTargetSelection) =>
    selection !== null && selectionKey(selection) === selectionKey(candidate);

  const rows: MoveTreeRow[] = [];

  if (targets.targetLevel === 'workspace') {
    for (const space of targets.spaces) {
      if (!matches(space.title)) {
        continue;
      }
      const candidate: EntityMoveTargetSelection = { targetWorkspaceId: space.workspaceId };
      rows.push({
        key: space.workspaceId,
        depth: 0,
        title: space.title,
        role: 'leaf',
        icon: 'space',
        selection: candidate,
        disabledReason: space.disabledReason,
        selected: isSelected(candidate),
      });
    }
    return rows;
  }

  if (targets.targetLevel === 'memory') {
    for (const space of targets.spaces) {
      const spaceMatches = matches(space.title);
      const visibleMemories = space.memories.filter(
        (memory) => spaceMatches || matches(memory.title)
      );
      if (!spaceMatches && visibleMemories.length === 0) {
        continue;
      }
      const expandable = space.memories.length > 0;
      const expanded = expandable && (searching || expandedSpaces.has(space.workspaceId));
      rows.push({
        key: space.workspaceId,
        depth: 0,
        title: space.title,
        role: 'folder',
        icon: 'space',
        toggleKey: space.workspaceId,
        toggleDepth: 0,
        childCount: space.memories.length,
        expandable,
        expanded,
      });
      if (!expanded) {
        continue;
      }
      for (const memory of searching ? visibleMemories : space.memories) {
        const candidate: EntityMoveTargetSelection = {
          targetWorkspaceId: space.workspaceId,
          targetMemoryId: memory.memoryId,
        };
        rows.push({
          key: `${space.workspaceId}/${memory.memoryId}`,
          depth: 1,
          title: memory.title,
          role: 'leaf',
          icon: 'memory',
          selection: candidate,
          disabledReason: space.disabledReason ?? memory.disabledReason,
          selected: isSelected(candidate),
        });
      }
    }
    return rows;
  }

  for (const space of targets.spaces) {
    const spaceMatches = matches(space.title);
    const visibleMemories = space.memories.filter((memory) => {
      if (spaceMatches || matches(memory.title)) {
        return true;
      }
      return memory.segments.some((segment) => matches(segment.title));
    });
    if (!spaceMatches && visibleMemories.length === 0) {
      continue;
    }
    const spaceExpandable = space.memories.length > 0;
    const spaceExpanded = spaceExpandable && (searching || expandedSpaces.has(space.workspaceId));
    rows.push({
      key: space.workspaceId,
      depth: 0,
      title: space.title,
      role: 'folder',
      icon: 'space',
      toggleKey: space.workspaceId,
      toggleDepth: 0,
      childCount: space.memories.length,
      expandable: spaceExpandable,
      expanded: spaceExpanded,
    });
    if (!spaceExpanded) {
      continue;
    }
    for (const memory of searching ? visibleMemories : space.memories) {
      const memoryMatches = spaceMatches || matches(memory.title);
      const visibleSegments = memory.segments.filter(
        (segment) => memoryMatches || matches(segment.title)
      );
      const memoryToggleKey = `${space.workspaceId}/${memory.memoryId}`;
      const memoryExpandable = memory.segments.length > 0;
      const memoryExpanded =
        memoryExpandable && (searching || expandedMemories.has(memoryToggleKey));
      rows.push({
        key: memoryToggleKey,
        depth: 1,
        title: memory.title,
        role: 'folder',
        icon: 'memory',
        toggleKey: memoryToggleKey,
        toggleDepth: 1,
        childCount: memory.segments.length,
        expandable: memoryExpandable,
        expanded: memoryExpanded,
      });
      if (!memoryExpanded) {
        continue;
      }
      for (const segment of searching ? visibleSegments : memory.segments) {
        const candidate: EntityMoveTargetSelection = {
          targetWorkspaceId: space.workspaceId,
          targetMemoryId: memory.memoryId,
          targetSegmentId: segment.segmentId,
        };
        rows.push({
          key: `${memoryToggleKey}/${segment.segmentId}`,
          depth: 2,
          title: segment.title,
          role: 'leaf',
          icon: 'segment',
          selection: candidate,
          disabledReason: space.disabledReason ?? memory.disabledReason ?? segment.disabledReason,
          selected: isSelected(candidate),
        });
      }
    }
  }
  return rows;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/renderer/src/workspace/entityMoveTree.test.ts`
Expected: PASS（全部 describe 绿）。

- [ ] **Step 5: typecheck 模型模块**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 无新增 `entityMoveTree` 相关报错。（若工程用分包 tsconfig，按 `package.json` 的 typecheck 脚本运行。）

- [ ] **Step 6: 提交**

```bash
git add src/renderer/src/workspace/entityMoveTree.ts src/renderer/src/workspace/entityMoveTree.test.ts
git commit -m "feat: project entity move targets into a collapsible row model"
```

- [ ] **Step 7: Phase 1 gate**

依次运行 `/review` 与 `/simplify`，按结果修正后再进入 Phase 2。把结论与处理追加到 implementation-notes.md。

---

## Phase 2 — 组件重写

### Task 3: 重写 `EntityMoveDialog.tsx`

**Files:**

- Rewrite: `src/renderer/src/workspace/EntityMoveDialog.tsx`

- [ ] **Step 1: 整文件替换为新实现**

用以下内容覆盖 `src/renderer/src/workspace/EntityMoveDialog.tsx`：

```tsx
import { Check, ChevronRight, Folder, Layers3, NotebookText, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  countSelectableLeaves,
  initialExpansion,
  moveDialogTitle,
  moveSourceKey,
  projectMoveTree,
  type EntityMoveTargetSelection,
  type MoveTreeRow,
} from './entityMoveTree';
import type { EntityMoveTargets } from './workspaceApi';

export type { EntityMoveTargetSelection } from './entityMoveTree';

type EntityMoveDialogProps = {
  readonly disabled?: boolean;
  readonly onConfirm: (selection: EntityMoveTargetSelection) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly targets: EntityMoveTargets | null;
};

const ROW_INDENT_BASE = 12;
const ROW_INDENT_STEP = 22;

const ENTITY_ICON = {
  space: Folder,
  memory: NotebookText,
  segment: Layers3,
} as const;

function MoveTreeRowView({
  row,
  onToggle,
  onSelect,
}: {
  readonly row: MoveTreeRow;
  readonly onToggle: (toggleKey: string, toggleDepth: 0 | 1) => void;
  readonly onSelect: (selection: EntityMoveTargetSelection) => void;
}) {
  const paddingLeft = ROW_INDENT_BASE + row.depth * ROW_INDENT_STEP;
  const EntityIcon = ENTITY_ICON[row.icon];

  if (row.role === 'folder') {
    return (
      <button
        type="button"
        style={{ paddingLeft }}
        disabled={!row.expandable}
        aria-expanded={row.expandable ? row.expanded : undefined}
        onClick={() => row.expandable && onToggle(row.toggleKey, row.toggleDepth)}
        className={cn(
          'reo-squircle flex min-h-34 w-full items-center gap-8 rounded-md pr-10 text-left text-ui-md font-medium leading-ui-md text-foreground',
          'hover:bg-accent disabled:text-muted-foreground disabled:hover:bg-transparent'
        )}
      >
        <ChevronRight
          aria-hidden
          className={cn(
            'size-16 shrink-0 text-muted-foreground transition-transform duration-150 ease-out',
            row.expandable ? 'opacity-100' : 'opacity-0',
            row.expanded ? 'rotate-90' : 'rotate-0'
          )}
        />
        <EntityIcon className="size-16 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{row.title}</span>
        <span className="shrink-0 text-ui-sm leading-ui-sm tabular-nums text-muted-foreground">
          {row.childCount}
        </span>
      </button>
    );
  }

  const blocked = Boolean(row.disabledReason);
  return (
    <button
      type="button"
      style={{ paddingLeft }}
      disabled={blocked}
      aria-pressed={row.selected}
      onClick={() => {
        if (!blocked) {
          onSelect(row.selection);
        }
      }}
      className={cn(
        'reo-squircle flex min-h-34 w-full items-center gap-8 rounded-md pr-10 text-left text-ui-md leading-ui-md text-foreground',
        'hover:bg-accent disabled:text-muted-foreground disabled:hover:bg-transparent',
        row.selected && 'bg-secondary font-medium hover:bg-secondary'
      )}
    >
      <span className="size-16 shrink-0" aria-hidden />
      <EntityIcon className="size-16 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{row.title}</span>
      {row.disabledReason ? (
        <span className="shrink-0 text-ui-sm leading-ui-sm text-muted-foreground">
          {row.disabledReason}
        </span>
      ) : null}
      {row.selected ? <Check className="size-16 shrink-0 text-foreground" aria-hidden /> : null}
    </button>
  );
}

export function EntityMoveDialog({
  disabled = false,
  onConfirm,
  onOpenChange,
  open,
  targets,
}: EntityMoveDialogProps) {
  const [selection, setSelection] = useState<EntityMoveTargetSelection | null>(null);
  const [query, setQuery] = useState('');
  const [expandedSpaces, setExpandedSpaces] = useState<ReadonlySet<string>>(() => new Set());
  const [expandedMemories, setExpandedMemories] = useState<ReadonlySet<string>>(() => new Set());
  const sourceKey = moveSourceKey(targets);

  useEffect(() => {
    setSelection(null);
    setQuery('');
    if (targets) {
      const initial = initialExpansion(targets);
      setExpandedSpaces(initial.expandedSpaces);
      setExpandedMemories(initial.expandedMemories);
    } else {
      setExpandedSpaces(new Set());
      setExpandedMemories(new Set());
    }
    // 仅在弹层开合或 source 身份变化时重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sourceKey]);

  const rows = useMemo(
    () =>
      targets
        ? projectMoveTree({ targets, expandedSpaces, expandedMemories, query, selection })
        : [],
    [targets, expandedSpaces, expandedMemories, query, selection]
  );

  const selectableCount = useMemo(() => (targets ? countSelectableLeaves(targets) : 0), [targets]);

  function close(nextOpen: boolean) {
    if (!nextOpen) {
      setSelection(null);
    }
    onOpenChange(nextOpen);
  }

  function toggle(toggleKey: string, toggleDepth: 0 | 1) {
    const update = (prev: ReadonlySet<string>) => {
      const next = new Set(prev);
      if (next.has(toggleKey)) {
        next.delete(toggleKey);
      } else {
        next.add(toggleKey);
      }
      return next;
    };
    if (toggleDepth === 0) {
      setExpandedSpaces(update);
    } else {
      setExpandedMemories(update);
    }
  }

  const trimmedQuery = query.trim();
  const emptyMessage =
    selectableCount === 0
      ? '没有可用目标'
      : trimmedQuery.length > 0
        ? '无匹配结果'
        : '没有可用目标';

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{moveDialogTitle(targets)}</DialogTitle>
          {targets ? (
            <DialogDescription>
              正在移动「{targets.source.title}」· 现位于 {targets.source.breadcrumb.join(' › ')}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">选择移动目标。</DialogDescription>
          )}
        </DialogHeader>

        {targets ? (
          <>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-12 top-1/2 size-16 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                autoFocus
                aria-label="搜索移动目标"
                className="pl-36"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索目标"
                value={query}
              />
            </div>

            <div className="edge-fade-y scrollbar-hover max-h-[48vh] overflow-y-auto py-1">
              {rows.length > 0 ? (
                <div className="space-y-1">
                  {rows.map((row) => (
                    <MoveTreeRowView
                      key={row.key}
                      onSelect={setSelection}
                      onToggle={toggle}
                      row={row}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-12 py-8 text-ui-sm leading-ui-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              )}
            </div>
          </>
        ) : null}

        <div className="mt-20 flex justify-end gap-8">
          <Button type="button" variant="secondary" onClick={() => close(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={disabled || !selection}
            onClick={() => {
              if (selection) {
                onConfirm(selection);
              }
            }}
          >
            移动
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`（或 `package.json` 的 typecheck 脚本）
Expected: 无报错；确认 `App.tsx` 仍从 `./workspace/EntityMoveDialog` 正常解析 `EntityMoveTargetSelection`（re-export 生效）。

- [ ] **Step 3: 提交**

```bash
git add src/renderer/src/workspace/EntityMoveDialog.tsx
git commit -m "feat: rebuild entity move dialog as a searchable collapsible tree"
```

### Task 4: 组件交互测试

**Files:**

- Rewrite: `src/renderer/src/workspace/EntityMoveDialog.test.tsx`

- [ ] **Step 1: 整文件替换测试**

用以下内容覆盖 `src/renderer/src/workspace/EntityMoveDialog.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EntityMoveDialog } from './EntityMoveDialog';
import type { EntityMoveTargets } from './workspaceApi';

const segmentMoveTargets: EntityMoveTargets = {
  source: {
    type: 'segment',
    workspaceId: 'ws_source',
    memoryId: 'mem_source',
    segmentId: 'seg_source',
    title: '源片段',
    breadcrumb: ['当前空间', '当前记忆'],
  },
  targetLevel: 'memory',
  spaces: [
    {
      workspaceId: 'ws_source',
      title: '当前空间',
      disabledReason: null,
      memories: [
        { memoryId: 'mem_source', title: '当前记忆', disabledReason: '当前位置', segments: [] },
      ],
    },
    {
      workspaceId: 'ws_target',
      title: '草稿',
      disabledReason: null,
      memories: [{ memoryId: 'mem_target', title: '收件箱', disabledReason: null, segments: [] }],
    },
  ],
};

const memoryMoveTargets: EntityMoveTargets = {
  source: {
    type: 'memory',
    workspaceId: 'ws_source',
    memoryId: 'mem_source',
    title: '源记忆',
    breadcrumb: ['当前空间'],
  },
  targetLevel: 'workspace',
  spaces: [
    { workspaceId: 'ws_source', title: '当前空间', disabledReason: '当前位置', memories: [] },
    { workspaceId: 'ws_target', title: '归档空间', disabledReason: null, memories: [] },
  ],
};

describe('EntityMoveDialog', () => {
  it('shows source context and disables the current location', () => {
    render(
      <EntityMoveDialog
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open
        targets={segmentMoveTargets}
      />
    );
    expect(screen.getByRole('heading', { name: '移动片段' })).toBeInTheDocument();
    expect(screen.getByText(/正在移动「源片段」/)).toBeInTheDocument();
    // 源空间默认展开，当前记忆可见且禁用
    expect(screen.getByRole('button', { name: /当前记忆/ })).toBeDisabled();
  });

  it('expands a collapsed target space, selects a memory, and confirms', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <EntityMoveDialog
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
        open
        targets={segmentMoveTargets}
      />
    );

    // 目标空间默认折叠：收件箱尚不可见
    expect(screen.queryByRole('button', { name: '收件箱' })).toBeNull();

    await user.click(screen.getByRole('button', { name: /草稿/ }));
    await user.click(screen.getByRole('button', { name: '收件箱' }));
    await user.click(screen.getByRole('button', { name: '移动' }));

    expect(onConfirm).toHaveBeenCalledWith({
      targetWorkspaceId: 'ws_target',
      targetMemoryId: 'mem_target',
    });
  });

  it('filters the tree with the search box', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <EntityMoveDialog
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
        open
        targets={segmentMoveTargets}
      />
    );

    await user.type(screen.getByRole('textbox', { name: '搜索移动目标' }), '收件箱');

    // 命中路径强制展开，当前记忆被过滤掉
    expect(screen.queryByRole('button', { name: /当前记忆/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: '收件箱' }));
    await user.click(screen.getByRole('button', { name: '移动' }));
    expect(onConfirm).toHaveBeenCalledWith({
      targetWorkspaceId: 'ws_target',
      targetMemoryId: 'mem_target',
    });
  });

  it('selects a space directly when moving a memory', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <EntityMoveDialog
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
        open
        targets={memoryMoveTargets}
      />
    );

    expect(screen.getByRole('heading', { name: '移动记忆' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /当前空间/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '归档空间' }));
    await user.click(screen.getByRole('button', { name: '移动' }));
    expect(onConfirm).toHaveBeenCalledWith({ targetWorkspaceId: 'ws_target' });
  });
});
```

- [ ] **Step 2: 运行确认通过**

Run: `npx vitest run src/renderer/src/workspace/EntityMoveDialog.test.tsx`
Expected: PASS（4 个用例全绿）。若 `搜索移动目标` textbox 取不到，确认 `Input` 透传了 `aria-label`（它 spread `...props`，应可取到）。

- [ ] **Step 3: 提交**

```bash
git add src/renderer/src/workspace/EntityMoveDialog.test.tsx
git commit -m "test: cover collapsible search-driven entity move dialog"
```

- [ ] **Step 4: Phase 2 gate**

依次运行 `/review` 与 `/simplify`，按结果修正后再进入 Phase 3。结论追加到 implementation-notes.md。

---

## Phase 3 — 收口与运行时验证

### Task 5: 全量验证 + 视觉核对 + 文档

- [ ] **Step 1: 运行该 feature 的全部单测**

Run: `npx vitest run src/renderer/src/workspace/entityMoveTree.test.ts src/renderer/src/workspace/EntityMoveDialog.test.tsx`
Expected: 全绿。

- [ ] **Step 2: 提交前全量验证**

Run: `npm run verify:quick`
Expected: 通过（typecheck、lint、format、相关测试）。失败则修正后重跑，不得在未通过快照上宣称干净。

- [ ] **Step 3: 运行时视觉核对（三模式）**

用 `/run` 启动 app（或既有运行方式），分别触发：

- 在某 Segment More 触发「移动片段」→ 文件夹折叠、源空间自动展开、当前记忆禁用、展开他空间选目标。
- 在某 SegmentSupplement More 触发「移动补充内容」→ 空间与 Memory 两级折叠、源空间+源记忆自动展开、片段叶子可选。
- 在某 Memory More 触发「移动记忆」→ 扁平空间列表、当前空间禁用、无折叠无计数。
  对三种各截一张图，存入 spec 目录并在 implementation-notes.md 记录路径与观察（选中高亮、hover、搜索过滤、空空间灰显）。

- [ ] **Step 4: 文档纪律检查**

确认 `docs/current/frontend.md` 无需更新（本次是组件内部重做，未改变已记录的稳定模型/契约/边界；移动弹层内部结构本就未写入 current）。若发现任何 current 文档对移动弹层内部有过时描述，按事实最小化修正；否则不写。把判断结论一句话记入 implementation-notes.md。

- [ ] **Step 5: 归档 spec**

将 `docs/specs/2026-06-10-0149-entity-move-dialog-redesign/` 移入 `docs/archive/specs/`（该 spec 完成的是一次性 UI 重做，无遗留长期 initiative）。
Run:

```bash
git mv docs/specs/2026-06-10-0149-entity-move-dialog-redesign docs/archive/specs/2026-06-10-0149-entity-move-dialog-redesign
```

- [ ] **Step 6: 最终提交**

```bash
git add -A
git commit -m "chore: archive entity move dialog redesign spec"
```

- [ ] **Step 7: 收尾**

按 `superpowers:finishing-a-development-branch` 决定合并 / PR / 清理；向用户汇报验证证据（测试输出、三张截图、verify:quick 结果）。

---

## Self-Review

**Spec coverage：**

- 结构模型（folder/leaf 角色、三模式深度）→ Task 2 `projectMoveTree` + 测试。
- 「文件夹显子项数、叶子不显数字、不假计数」→ `MoveTreeRow` folder 才有 `childCount`；Task 2 测试断言 childCount。
- 选择永远是叶子、Confirm ⟺ selection≠null → 组件 `disabled={disabled || !selection}`；Task 4 确认流。
- 禁用态只在叶子、文件夹永不禁用、可选同空间其它目标 → Task 2「reveals memory leaves…disables current」用例。
- 空文件夹灰显不可展开 → Task 2「empty space」用例 + 组件 `disabled={!row.expandable}`、chevron opacity 0。
- 默认展开到当前位置 → `initialExpansion` + Task 1 用例 + Task 4「current 可见」。
- 搜索过滤 + 强制展开 + 无匹配 → Task 2 search 用例 + Task 4 search 用例 + `emptyMessage`。
- 没有可用目标 → `countSelectableLeaves` + `emptyMessage`。
- 头部源上下文 breadcrumb → 组件 DialogDescription + Task 4「shows source context」。
- 视觉：bg-secondary+Check 选中、hover bg-accent、无彩色点、token-only、缩进公式 → 组件 className（仅语义 token + 行 `paddingLeft = 12 + depth*22`）。
- 契约不变 → 不改 App/contract/main；re-export 类型；Task 3 Step 2 typecheck 校验。

**Placeholder scan：** 无 TBD/TODO/“类似上文”；每个代码步骤含完整代码与确切命令。

**Type consistency：** `projectMoveTree` 入参对象、`MoveTreeRow`（folder 含 `toggleKey/toggleDepth/childCount/expandable/expanded`；leaf 含 `selection/disabledReason/selected`）、`toggle(toggleKey, toggleDepth)`、`ENTITY_ICON[row.icon]`、re-export `EntityMoveTargetSelection` 在各 Task 间名称一致。`disabledReason` 在 leaf 用 `??` 链聚合祖先与自身（任一非 null 即禁用）。

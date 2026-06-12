import { describe, expect, it } from 'vitest';
import type { EntityMoveTargets } from './workspaceApi';
import {
  countSelectableLeaves,
  initialExpansion,
  moveDialogTitle,
  moveSourceKey,
  projectMoveTree,
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
      .map((row) => row.title);
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
    expect(rows.map((row) => row.title)).toEqual(['空间A', '记忆A', '记忆B', '空空间']);
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

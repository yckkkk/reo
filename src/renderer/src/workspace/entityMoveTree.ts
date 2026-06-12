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

type MoveTreeBaseRow = {
  readonly key: string;
  readonly depth: 0 | 1 | 2;
  readonly title: string;
};

type MoveTreeFolderRow = MoveTreeBaseRow & {
  readonly role: 'folder';
  readonly icon: 'space' | 'memory';
  readonly toggleKey: string;
  readonly toggleDepth: 0 | 1;
  readonly childCount: number;
  readonly expandable: boolean;
  readonly expanded: boolean;
};

type MoveTreeLeafRow = MoveTreeBaseRow & {
  readonly role: 'leaf';
  readonly icon: 'space' | 'memory' | 'segment';
  readonly selection: EntityMoveTargetSelection;
  readonly disabledReason: string | null;
  readonly selected: boolean;
};

export type MoveTreeRow = MoveTreeFolderRow | MoveTreeLeafRow;

function firstDisabledReason(...reasons: readonly (string | null)[]): string | null {
  return reasons.find((reason): reason is string => reason !== null) ?? null;
}

function visibleRows<T>(input: {
  readonly all: readonly T[];
  readonly searching: boolean;
  readonly visible: readonly T[];
}): readonly T[] {
  return input.searching ? input.visible : input.all;
}

function folderRow(
  input: Omit<MoveTreeFolderRow, 'role' | 'expandable' | 'expanded'> & {
    readonly shouldExpand: boolean;
  }
): MoveTreeFolderRow {
  const { shouldExpand, ...row } = input;
  const expandable = row.childCount > 0;
  return {
    ...row,
    role: 'folder',
    expandable,
    expanded: expandable && shouldExpand,
  };
}

function leafRow(
  input: Omit<MoveTreeLeafRow, 'role' | 'selected'> & {
    readonly currentSelection: EntityMoveTargetSelection | null;
  }
): MoveTreeLeafRow {
  const { currentSelection, ...row } = input;
  return {
    ...row,
    role: 'leaf',
    selected:
      currentSelection !== null && selectionKey(currentSelection) === selectionKey(row.selection),
  };
}

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

  const rows: MoveTreeRow[] = [];

  if (targets.targetLevel === 'workspace') {
    for (const space of targets.spaces) {
      if (!matches(space.title)) {
        continue;
      }
      const candidate: EntityMoveTargetSelection = { targetWorkspaceId: space.workspaceId };
      rows.push(
        leafRow({
          currentSelection: selection,
          disabledReason: space.disabledReason,
          icon: 'space',
          key: space.workspaceId,
          depth: 0,
          title: space.title,
          selection: candidate,
        })
      );
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
      const spaceRow = folderRow({
        key: space.workspaceId,
        depth: 0,
        title: space.title,
        icon: 'space',
        toggleKey: space.workspaceId,
        toggleDepth: 0,
        childCount: space.memories.length,
        shouldExpand: searching || expandedSpaces.has(space.workspaceId),
      });
      rows.push(spaceRow);
      if (!spaceRow.expanded) {
        continue;
      }
      for (const memory of visibleRows({
        all: space.memories,
        searching,
        visible: visibleMemories,
      })) {
        const candidate: EntityMoveTargetSelection = {
          targetWorkspaceId: space.workspaceId,
          targetMemoryId: memory.memoryId,
        };
        rows.push(
          leafRow({
            currentSelection: selection,
            disabledReason: firstDisabledReason(space.disabledReason, memory.disabledReason),
            icon: 'memory',
            key: memoryKey(space.workspaceId, memory.memoryId),
            depth: 1,
            title: memory.title,
            selection: candidate,
          })
        );
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
    const spaceRow = folderRow({
      key: space.workspaceId,
      depth: 0,
      title: space.title,
      icon: 'space',
      toggleKey: space.workspaceId,
      toggleDepth: 0,
      childCount: space.memories.length,
      shouldExpand: searching || expandedSpaces.has(space.workspaceId),
    });
    rows.push(spaceRow);
    if (!spaceRow.expanded) {
      continue;
    }
    for (const memory of visibleRows({
      all: space.memories,
      searching,
      visible: visibleMemories,
    })) {
      const memoryMatches = spaceMatches || matches(memory.title);
      const visibleSegments = memory.segments.filter(
        (segment) => memoryMatches || matches(segment.title)
      );
      const memoryToggleKey = memoryKey(space.workspaceId, memory.memoryId);
      const memoryRow = folderRow({
        key: memoryToggleKey,
        depth: 1,
        title: memory.title,
        icon: 'memory',
        toggleKey: memoryToggleKey,
        toggleDepth: 1,
        childCount: memory.segments.length,
        shouldExpand: searching || expandedMemories.has(memoryToggleKey),
      });
      rows.push(memoryRow);
      if (!memoryRow.expanded) {
        continue;
      }
      for (const segment of visibleRows({
        all: memory.segments,
        searching,
        visible: visibleSegments,
      })) {
        const candidate: EntityMoveTargetSelection = {
          targetWorkspaceId: space.workspaceId,
          targetMemoryId: memory.memoryId,
          targetSegmentId: segment.segmentId,
        };
        rows.push(
          leafRow({
            currentSelection: selection,
            disabledReason: firstDisabledReason(
              space.disabledReason,
              memory.disabledReason,
              segment.disabledReason
            ),
            icon: 'segment',
            key: `${memoryToggleKey}/${segment.segmentId}`,
            depth: 2,
            title: segment.title,
            selection: candidate,
          })
        );
      }
    }
  }
  return rows;
}

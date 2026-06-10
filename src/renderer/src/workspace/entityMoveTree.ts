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
          key: memoryKey(space.workspaceId, memory.memoryId),
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
      const memoryToggleKey = memoryKey(space.workspaceId, memory.memoryId);
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
          disabledReason:
            space.disabledReason ?? memory.disabledReason ?? segment.disabledReason,
          selected: isSelected(candidate),
        });
      }
    }
  }
  return rows;
}

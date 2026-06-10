import { Folder, FolderInput, Layers3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { EntityMoveTargets } from './workspaceApi';

export type EntityMoveTargetSelection =
  | {
      readonly targetWorkspaceId: string;
    }
  | {
      readonly targetWorkspaceId: string;
      readonly targetMemoryId: string;
    }
  | {
      readonly targetWorkspaceId: string;
      readonly targetMemoryId: string;
      readonly targetSegmentId: string;
    };

type EntityMoveDialogProps = {
  readonly disabled?: boolean;
  readonly onConfirm: (selection: EntityMoveTargetSelection) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly targets: EntityMoveTargets | null;
};

function moveDialogTitle(targets: EntityMoveTargets | null) {
  if (targets?.source.type === 'memory') {
    return '移动记忆';
  }
  if (targets?.source.type === 'supplement') {
    return '移动补充内容';
  }
  return '移动片段';
}

function selectionKey(selection: EntityMoveTargetSelection) {
  if ('targetSegmentId' in selection) {
    return `${selection.targetWorkspaceId}/${selection.targetMemoryId}/${selection.targetSegmentId}`;
  }
  if ('targetMemoryId' in selection) {
    return `${selection.targetWorkspaceId}/${selection.targetMemoryId}`;
  }
  return selection.targetWorkspaceId;
}

function targetMatchesSelection(
  current: EntityMoveTargetSelection | null,
  candidate: EntityMoveTargetSelection
) {
  return current ? selectionKey(current) === selectionKey(candidate) : false;
}

function moveSourceKey(targets: EntityMoveTargets | null) {
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

export function EntityMoveDialog({
  disabled = false,
  onConfirm,
  onOpenChange,
  open,
  targets,
}: EntityMoveDialogProps) {
  const [selection, setSelection] = useState<EntityMoveTargetSelection | null>(null);
  const sourceKey = moveSourceKey(targets);

  useEffect(() => {
    setSelection(null);
  }, [open, sourceKey]);

  const selectableCount = useMemo(() => {
    if (!targets) {
      return 0;
    }
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
              (segment) =>
                !space.disabledReason && !memory.disabledReason && !segment.disabledReason
            ).length,
          0
        ),
      0
    );
  }, [targets]);

  function close(nextOpen: boolean) {
    if (!nextOpen) {
      setSelection(null);
    }
    onOpenChange(nextOpen);
  }

  function choose(candidate: EntityMoveTargetSelection, blocked: boolean) {
    if (!blocked) {
      setSelection(candidate);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{moveDialogTitle(targets)}</DialogTitle>
          <DialogDescription className="sr-only">选择移动目标。</DialogDescription>
        </DialogHeader>
        <div className="max-h-[52vh] overflow-y-auto py-1">
          {targets ? (
            <div className="space-y-1">
              {targets.spaces.map((space) => {
                const spaceSelection = { targetWorkspaceId: space.workspaceId };
                const spaceBlocked = Boolean(space.disabledReason);
                const spaceSelectable = targets.targetLevel === 'workspace';
                return (
                  <div key={space.workspaceId} className="space-y-1">
                    <button
                      type="button"
                      className="flex min-h-40 w-full items-center gap-10 rounded-md px-10 text-left text-sm font-medium text-foreground hover:bg-accent disabled:cursor-default disabled:text-muted-foreground disabled:hover:bg-transparent"
                      aria-pressed={
                        spaceSelectable && targetMatchesSelection(selection, spaceSelection)
                      }
                      disabled={!spaceSelectable || spaceBlocked}
                      onClick={() => choose(spaceSelection, spaceBlocked)}
                    >
                      <Folder className="size-16 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{space.title}</span>
                      {space.disabledReason ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {space.disabledReason}
                        </span>
                      ) : null}
                    </button>
                    {space.memories.map((memory) => {
                      const memorySelection = {
                        targetWorkspaceId: space.workspaceId,
                        targetMemoryId: memory.memoryId,
                      };
                      const memoryBlocked = spaceBlocked || Boolean(memory.disabledReason);
                      const memorySelectable = targets.targetLevel === 'memory';
                      return (
                        <div key={memory.memoryId} className="space-y-1">
                          <button
                            type="button"
                            className="flex min-h-36 w-full items-center gap-10 rounded-md px-10 pl-[34px] text-left text-sm text-foreground hover:bg-accent disabled:cursor-default disabled:text-muted-foreground disabled:hover:bg-transparent"
                            aria-pressed={
                              memorySelectable && targetMatchesSelection(selection, memorySelection)
                            }
                            disabled={!memorySelectable || memoryBlocked}
                            onClick={() => choose(memorySelection, memoryBlocked)}
                          >
                            <FolderInput
                              className="size-16 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1 truncate">{memory.title}</span>
                            {memory.disabledReason ? (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {memory.disabledReason}
                              </span>
                            ) : null}
                          </button>
                          {memory.segments.map((segment) => {
                            const segmentSelection = {
                              targetWorkspaceId: space.workspaceId,
                              targetMemoryId: memory.memoryId,
                              targetSegmentId: segment.segmentId,
                            };
                            const segmentBlocked = memoryBlocked || Boolean(segment.disabledReason);
                            return (
                              <button
                                key={segment.segmentId}
                                type="button"
                                className="flex min-h-34 w-full items-center gap-10 rounded-md px-10 pl-[58px] text-left text-sm text-foreground hover:bg-accent disabled:cursor-default disabled:text-muted-foreground disabled:hover:bg-transparent"
                                aria-pressed={targetMatchesSelection(selection, segmentSelection)}
                                disabled={targets.targetLevel !== 'segment' || segmentBlocked}
                                onClick={() => choose(segmentSelection, segmentBlocked)}
                              >
                                <Layers3
                                  className="size-16 shrink-0 text-muted-foreground"
                                  aria-hidden
                                />
                                <span className="min-w-0 flex-1 truncate">{segment.title}</span>
                                {segment.disabledReason ? (
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    {segment.disabledReason}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : null}
          {targets && selectableCount === 0 ? (
            <div className="px-2 py-8 text-sm text-muted-foreground">没有可用目标</div>
          ) : null}
        </div>
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

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
          'reo-squircle flex min-h-32 w-full items-center gap-8 rounded-md pr-12 text-left text-ui-md font-medium leading-ui-md text-foreground',
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
        'reo-squircle flex min-h-32 w-full items-center gap-8 rounded-md pr-12 text-left text-ui-md leading-ui-md text-foreground',
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
    // 仅在弹层开合或 source 身份变化时重置展开与选择
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
            <div className="relative mt-20">
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

            <div className="edge-fade-y scrollbar-hover mt-12 max-h-[48vh] overflow-y-auto py-4">
              {rows.length > 0 ? (
                <div className="space-y-4">
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

import { AppWindow, Ellipsis, List, PanelRightClose, PanelRightOpen, Plus } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { MemoryActionsMenu } from './MemoryActionsMenu';
import { MemorySpaceActionsMenu } from './MemorySpaceActionsMenu';
import { WidgetActionsMenu } from './WidgetActionsMenu';
import { WORKSPACE_MEMORY_RAIL_ID } from './WorkspaceFrame';
import type { WorkspaceMemorySummary, WorkspaceWidgetProjection } from './workspaceApi';
import type { WorkspaceRailTab } from './workspaceRailTabs';

type WorkspaceTitlebarMemory = WorkspaceMemorySummary;
type WorkspaceTitlebarWidget = WorkspaceWidgetProjection;
type DraggedWorkspaceWidgetTab = {
  readonly widgetId: string;
};

const WIDGET_TAB_DRAG_MIME = 'application/x-reo-widget-tab';

type WorkspaceTitlebarProps = {
  readonly activeRailTab: WorkspaceRailTab;
  readonly currentMemory?: WorkspaceTitlebarMemory | null;
  readonly memoryRailOpen: boolean;
  readonly onCreateMemory: () => void;
  readonly onCreateWidget: () => void;
  readonly onDeleteMemory: (memory: WorkspaceTitlebarMemory) => void;
  readonly onDeleteWidget: (widget: WorkspaceTitlebarWidget) => void;
  readonly onRenameMemory: (memory: WorkspaceTitlebarMemory) => void;
  readonly onRenameWidget: (widget: WorkspaceTitlebarWidget) => void;
  readonly onRequestWidgetRefresh: (widget: WorkspaceTitlebarWidget) => void;
  readonly onRequestWidgetUpdate: (widget: WorkspaceTitlebarWidget) => void;
  readonly onResetMemoryCover: (memory: WorkspaceTitlebarMemory) => void;
  readonly onReorderWidgets: (widgetTabOrder: readonly string[]) => void;
  readonly onSelectRailTab: (tab: WorkspaceRailTab) => void;
  readonly onSwitchMemoryDefaultCover: (memory: WorkspaceTitlebarMemory) => void;
  readonly onRenameMemorySpace: () => void;
  readonly onRemoveMemorySpace: () => void;
  readonly onToggleMemoryRail: () => void;
  readonly title: string;
  readonly widgets: readonly WorkspaceTitlebarWidget[];
  readonly workspaceHandle: string;
  readonly workspaceId: string;
};

export function WorkspaceTitlebar({
  activeRailTab,
  currentMemory = null,
  memoryRailOpen,
  onCreateMemory,
  onCreateWidget,
  onDeleteMemory,
  onDeleteWidget,
  onRenameMemory,
  onRenameWidget,
  onRequestWidgetRefresh,
  onRequestWidgetUpdate,
  onResetMemoryCover,
  onReorderWidgets,
  onSelectRailTab,
  onSwitchMemoryDefaultCover,
  onRenameMemorySpace,
  onRemoveMemorySpace,
  onToggleMemoryRail,
  title,
  widgets,
  workspaceHandle,
  workspaceId,
}: WorkspaceTitlebarProps) {
  const ToggleIcon = memoryRailOpen ? PanelRightClose : PanelRightOpen;
  const toggleLabel = memoryRailOpen ? '折叠记忆列表' : '展开记忆列表';

  return (
    <div
      data-slot="workspace-titlebar"
      className="flex h-full w-full items-center justify-between gap-16 pl-28 pr-12 transition-[padding-left] duration-200 ease-out motion-reduce:transition-none group-data-[sidebar-state=expanded]/panel-titlebar:pl-12"
    >
      <Breadcrumb
        className="pointer-events-auto min-w-0 [-webkit-app-region:no-drag]"
        aria-label="当前位置"
      >
        <BreadcrumbList className="flex-nowrap gap-4">
          <BreadcrumbItem className="min-w-0">
            <MemorySpaceActionsMenu
              actionIdentity={{ workspaceId }}
              contentAlign="start"
              memorySpaceTitle={title}
              onRemove={onRemoveMemorySpace}
              onRename={onRenameMemorySpace}
              trigger={
                <button
                  type="button"
                  aria-label={`${title} 记忆空间操作`}
                  className="inline-flex max-w-[220px] items-center gap-3 rounded-sm px-4 py-4 text-body font-regular leading-body text-muted-foreground outline-none transition-colors duration-150 ease-out hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-secondary data-[state=open]:text-foreground"
                >
                  <span className="min-w-0 truncate">{title}</span>
                </button>
              }
              triggerLabel={`${title} 记忆空间操作`}
            />
          </BreadcrumbItem>
          {currentMemory ? (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="min-w-0">
                  <MemoryActionsMenu
                    actionIdentity={{
                      memoryId: currentMemory.memoryId,
                      workspaceHandle,
                      workspaceId,
                    }}
                    contentAlign="start"
                    cover={currentMemory.cover}
                    memoryTitle={currentMemory.title}
                    onDelete={() => onDeleteMemory(currentMemory)}
                    onRename={() => onRenameMemory(currentMemory)}
                    onResetCover={() => onResetMemoryCover(currentMemory)}
                    onSwitchDefaultCover={() => onSwitchMemoryDefaultCover(currentMemory)}
                    trigger={
                      <button
                        type="button"
                        aria-label={`${currentMemory.title} 记忆操作`}
                        className="inline-flex max-w-[260px] items-center gap-3 rounded-sm px-4 py-4 text-body font-medium leading-body text-foreground outline-none transition-colors duration-150 ease-out hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-secondary"
                      >
                        <span className="min-w-0 truncate">{currentMemory.title}</span>
                      </button>
                    }
                    triggerLabel={`${currentMemory.title} 记忆操作`}
                  />
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : null}
        </BreadcrumbList>
      </Breadcrumb>
      <div
        data-slot="workspace-titlebar-actions"
        className="pointer-events-auto flex items-center gap-8 [-webkit-app-region:no-drag]"
      >
        <WorkspaceCreateMenu onCreateMemory={onCreateMemory} onCreateWidget={onCreateWidget} />
        {memoryRailOpen ? (
          <WorkspaceRailTabStrip
            activeRailTab={activeRailTab}
            onDeleteWidget={onDeleteWidget}
            onRenameWidget={onRenameWidget}
            onRequestWidgetRefresh={onRequestWidgetRefresh}
            onRequestWidgetUpdate={onRequestWidgetUpdate}
            onReorderWidgets={onReorderWidgets}
            onSelectRailTab={onSelectRailTab}
            widgets={widgets}
            workspaceHandle={workspaceHandle}
            workspaceId={workspaceId}
          />
        ) : null}
        <Tooltip>
          <Button asChild variant="ghostIcon" size="icon">
            <TooltipTrigger
              type="button"
              aria-controls={WORKSPACE_MEMORY_RAIL_ID}
              aria-expanded={memoryRailOpen}
              aria-label={toggleLabel}
              className="rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={onToggleMemoryRail}
            >
              <ToggleIcon className="size-16" aria-hidden="true" />
            </TooltipTrigger>
          </Button>
          <TooltipContent side="bottom">{toggleLabel}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function WorkspaceCreateMenu({
  onCreateMemory,
  onCreateWidget,
}: {
  readonly onCreateMemory: () => void;
  readonly onCreateWidget: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghostIcon"
          size="icon"
          type="button"
          aria-label="新增"
          className="rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Plus aria-hidden="true" className="size-16" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="新增">
        <DropdownMenuItem onSelect={onCreateMemory}>
          <List className="size-16 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>新建记忆</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCreateWidget}>
          <AppWindow className="size-16 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>新增组件</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceRailTabStrip({
  activeRailTab,
  onDeleteWidget,
  onRenameWidget,
  onRequestWidgetRefresh,
  onRequestWidgetUpdate,
  onReorderWidgets,
  onSelectRailTab,
  widgets,
  workspaceHandle,
  workspaceId,
}: {
  readonly activeRailTab: WorkspaceRailTab;
  readonly onDeleteWidget: (widget: WorkspaceTitlebarWidget) => void;
  readonly onRenameWidget: (widget: WorkspaceTitlebarWidget) => void;
  readonly onRequestWidgetRefresh: (widget: WorkspaceTitlebarWidget) => void;
  readonly onRequestWidgetUpdate: (widget: WorkspaceTitlebarWidget) => void;
  readonly onReorderWidgets: (widgetTabOrder: readonly string[]) => void;
  readonly onSelectRailTab: (tab: WorkspaceRailTab) => void;
  readonly widgets: readonly WorkspaceTitlebarWidget[];
  readonly workspaceHandle: string;
  readonly workspaceId: string;
}) {
  const [visibleWidgetActionsId, setVisibleWidgetActionsId] = useState<string | null>(null);
  const [openWidgetActionsId, setOpenWidgetActionsId] = useState<string | null>(null);
  const [pendingWidgetOrder, setPendingWidgetOrder] = useState<readonly string[] | null>(null);
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const pendingWidgetOrderRef = useRef<readonly string[] | null>(null);
  const draggedWidgetIdRef = useRef<string | null>(null);
  const lastWidgetDragPlacementRef = useRef<string | null>(null);
  const orderedWidgets = useMemo(
    () => orderWorkspaceWidgets(widgets, pendingWidgetOrder ?? undefined),
    [pendingWidgetOrder, widgets]
  );

  useEffect(() => {
    const widgetIds = new Set(widgets.map((widget) => widget.widgetId));
    setVisibleWidgetActionsId((current) => (current && widgetIds.has(current) ? current : null));
    setOpenWidgetActionsId((current) => (current && widgetIds.has(current) ? current : null));
    setDraggedWidgetId((current) => (current && widgetIds.has(current) ? current : null));
    if (draggedWidgetIdRef.current && !widgetIds.has(draggedWidgetIdRef.current)) {
      draggedWidgetIdRef.current = null;
      lastWidgetDragPlacementRef.current = null;
    }
    setPendingWidgetOrder((current) => {
      if (!current) {
        pendingWidgetOrderRef.current = null;
        return null;
      }
      const nextOrder = normalizeWidgetOrderValues(current, widgets);
      pendingWidgetOrderRef.current = nextOrder;
      return sameStringOrder(nextOrder, current) ? current : nextOrder;
    });
  }, [widgets]);

  const moveWidget = (
    draggedWidgetId: string,
    targetWidgetId: string,
    targetRect: DOMRect,
    pointerClientX: number
  ) => {
    if (draggedWidgetId === targetWidgetId) {
      return;
    }
    const currentOrder = orderedWidgets.map((widget) => widget.widgetId);
    const from = currentOrder.indexOf(draggedWidgetId);
    const to = currentOrder.indexOf(targetWidgetId);
    if (from < 0 || to < 0) {
      return;
    }
    const targetMidpoint = targetRect.left + targetRect.width / 2;
    const placement = pointerClientX < targetMidpoint ? 'before' : 'after';
    const placementKey = `${draggedWidgetId}\0${targetWidgetId}\0${placement}`;
    if (lastWidgetDragPlacementRef.current === placementKey) {
      return;
    }
    const nextOrder = insertWidgetOrderValue(
      currentOrder,
      draggedWidgetId,
      targetWidgetId,
      placement
    );
    if (sameStringOrder(nextOrder, currentOrder)) {
      return;
    }
    lastWidgetDragPlacementRef.current = placementKey;

    setPendingWidgetOrder((currentPendingOrder) => {
      const currentWidgetOrder = orderWorkspaceWidgets(
        widgets,
        currentPendingOrder ?? undefined
      ).map((widget) => widget.widgetId);
      const nextWidgetOrder = insertWidgetOrderValue(
        currentWidgetOrder,
        draggedWidgetId,
        targetWidgetId,
        placement
      );
      if (sameStringOrder(nextWidgetOrder, currentWidgetOrder)) {
        return currentPendingOrder;
      }
      pendingWidgetOrderRef.current = nextWidgetOrder;
      return nextWidgetOrder;
    });
  };

  const readDraggedWidgetId = (event: DragEvent<HTMLElement>) => {
    if (draggedWidgetIdRef.current) {
      return draggedWidgetIdRef.current;
    }

    try {
      const encodedValue = event.dataTransfer.getData(WIDGET_TAB_DRAG_MIME);
      if (encodedValue) {
        const parsedValue = JSON.parse(encodedValue) as Partial<DraggedWorkspaceWidgetTab>;
        if (typeof parsedValue.widgetId === 'string') {
          return parsedValue.widgetId;
        }
      }
    } catch {
      return null;
    }

    const plainValue = event.dataTransfer.getData('text/plain');
    return plainValue || null;
  };

  const clearPendingWidgetOrder = () => {
    pendingWidgetOrderRef.current = null;
    setPendingWidgetOrder(null);
  };

  const commitWidgetOrder = () => {
    const nextOrder = pendingWidgetOrderRef.current;
    if (!nextOrder) {
      return;
    }
    const currentProjectionOrder = widgets.map((widget) => widget.widgetId);
    clearPendingWidgetOrder();
    if (!sameStringOrder(nextOrder, currentProjectionOrder)) {
      onReorderWidgets(nextOrder);
    }
  };

  const handleWidgetDragEnd = () => {
    commitWidgetOrder();
    draggedWidgetIdRef.current = null;
    lastWidgetDragPlacementRef.current = null;
    setDraggedWidgetId(null);
  };

  return (
    <div
      aria-label="右侧栏内容"
      className="edge-fade-x flex min-w-0 max-w-[min(42vw,360px)] items-center gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-slot="workspace-rail-tab-strip"
      role="tablist"
    >
      <WorkspaceRailTabItem
        active={activeRailTab.kind === 'memories'}
        dataSlot="workspace-memory-tab"
      >
        <WorkspaceRailTabButton
          active={activeRailTab.kind === 'memories'}
          ariaLabel="记忆列表"
          onClick={() => onSelectRailTab({ kind: 'memories' })}
        >
          <List className="size-[15px]" aria-hidden="true" />
        </WorkspaceRailTabButton>
      </WorkspaceRailTabItem>
      {orderedWidgets.map((widget) => {
        const active =
          activeRailTab.kind === 'widget' && activeRailTab.widgetId === widget.widgetId;
        const actionsVisible = visibleWidgetActionsId === widget.widgetId;
        const menuOpen = openWidgetActionsId === widget.widgetId;
        const actionsAccessible = actionsVisible || menuOpen;
        const dragging = draggedWidgetId === widget.widgetId;
        return (
          <WorkspaceRailTabItem
            className={cn(
              orderedWidgets.length > 1 && 'cursor-grab active:cursor-grabbing',
              dragging && 'scale-[1.02] opacity-40'
            )}
            active={active}
            dataSlot="workspace-widget-tab"
            draggable={orderedWidgets.length > 1}
            key={widget.widgetId}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setVisibleWidgetActionsId((current) =>
                  current === widget.widgetId ? null : current
                );
              }
            }}
            onDragOver={(event) => {
              if (orderedWidgets.length > 1) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                const draggedWidgetId = readDraggedWidgetId(event);
                if (draggedWidgetId) {
                  moveWidget(
                    draggedWidgetId,
                    widget.widgetId,
                    event.currentTarget.getBoundingClientRect(),
                    event.clientX
                  );
                }
              }
            }}
            onDragStart={(event) => {
              const draggedTab = { widgetId: widget.widgetId };
              draggedWidgetIdRef.current = widget.widgetId;
              lastWidgetDragPlacementRef.current = null;
              setDraggedWidgetId(widget.widgetId);
              event.dataTransfer.setData('text/plain', widget.widgetId);
              event.dataTransfer.setData(WIDGET_TAB_DRAG_MIME, JSON.stringify(draggedTab));
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={handleWidgetDragEnd}
            onDrop={(event) => {
              event.preventDefault();
            }}
            onFocusCapture={() => setVisibleWidgetActionsId(widget.widgetId)}
            onPointerEnter={() => setVisibleWidgetActionsId(widget.widgetId)}
            onPointerLeave={() => {
              setVisibleWidgetActionsId((current) =>
                current === widget.widgetId ? null : current
              );
            }}
          >
            <WorkspaceRailTabButton
              active={active}
              ariaLabel={`${widget.title} 组件`}
              onClick={() => onSelectRailTab({ kind: 'widget', widgetId: widget.widgetId })}
              tooltipLabel={widget.title}
            >
              <WorkspaceWidgetTabIcon widget={widget} />
            </WorkspaceRailTabButton>
            <WidgetActionsMenu
              actionIdentity={{
                workspaceHandle,
                workspaceId,
                widgetId: widget.widgetId,
              }}
              onDelete={() => onDeleteWidget(widget)}
              onRefresh={() => onRequestWidgetRefresh(widget)}
              onRename={() => onRenameWidget(widget)}
              onRequestAgentUpdate={() => onRequestWidgetUpdate(widget)}
              onOpenChange={(open) => {
                setOpenWidgetActionsId(open ? widget.widgetId : null);
              }}
              trigger={
                <button
                  type="button"
                  aria-label={`${widget.title} 更多操作`}
                  aria-hidden={actionsAccessible ? undefined : true}
                  data-slot="workspace-widget-tab-more-anchor"
                  draggable={false}
                  className={workspaceWidgetTabMoreClassName(actionsAccessible)}
                  tabIndex={actionsAccessible ? 0 : -1}
                  onClick={stopWorkspaceWidgetMoreEventPropagation}
                  onDragStart={stopWorkspaceWidgetMoreEventPropagation}
                  onMouseDown={stopWorkspaceWidgetMoreEventPropagation}
                  onPointerDown={stopWorkspaceWidgetMoreEventPropagation}
                >
                  <span className="inline-flex size-20 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-150 ease-out hover:bg-secondary hover:text-foreground">
                    <Ellipsis className="size-16" strokeWidth={2.5} aria-hidden="true" />
                  </span>
                </button>
              }
              widgetTitle={widget.title}
            />
          </WorkspaceRailTabItem>
        );
      })}
    </div>
  );
}

function orderWorkspaceWidgets(
  widgets: readonly WorkspaceTitlebarWidget[],
  order: readonly string[] | undefined
) {
  if (!order || order.length === 0) {
    return widgets;
  }

  const remainingWidgets = new Map(widgets.map((widget) => [widget.widgetId, widget]));
  const orderedWidgets: WorkspaceTitlebarWidget[] = [];

  for (const widgetId of order) {
    const widget = remainingWidgets.get(widgetId);
    if (!widget) {
      continue;
    }
    orderedWidgets.push(widget);
    remainingWidgets.delete(widgetId);
  }

  return [...orderedWidgets, ...remainingWidgets.values()];
}

function normalizeWidgetOrderValues(
  order: readonly string[],
  widgets: readonly WorkspaceTitlebarWidget[]
) {
  return orderWorkspaceWidgets(widgets, order).map((widget) => widget.widgetId);
}

function insertWidgetOrderValue(
  values: readonly string[],
  draggedValue: string,
  targetValue: string,
  placement: 'before' | 'after'
) {
  if (draggedValue === targetValue) {
    return values;
  }

  if (!values.includes(draggedValue) || !values.includes(targetValue)) {
    return values;
  }

  const remainingValues = values.filter((value) => value !== draggedValue);
  const targetIndex = remainingValues.indexOf(targetValue);
  if (targetIndex === -1) {
    return values;
  }

  const insertionIndex = placement === 'before' ? targetIndex : targetIndex + 1;
  const nextValues = [...remainingValues];
  nextValues.splice(insertionIndex, 0, draggedValue);
  return nextValues;
}

function sameStringOrder(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function WorkspaceRailTabItem({
  active,
  children,
  className,
  dataSlot,
  ...props
}: {
  readonly active: boolean;
  readonly children: ReactNode;
  readonly className?: string;
  readonly dataSlot: string;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className'>) {
  return (
    <div
      className={cn(
        'group/rail-tab flex h-[30px] shrink-0 items-center overflow-hidden rounded-sm text-muted-foreground transition-[background-color,color,box-shadow] duration-150 ease-out hover:bg-secondary hover:text-foreground focus-within:bg-secondary focus-within:text-foreground',
        active && 'bg-secondary text-foreground shadow-[0_1px_0_rgba(0,0,0,0.04)]',
        className
      )}
      data-slot={dataSlot}
      {...props}
    >
      {children}
    </div>
  );
}

function WorkspaceRailTabButton({
  active,
  ariaLabel,
  children,
  onClick,
  tooltipLabel = ariaLabel,
}: {
  readonly active: boolean;
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly tooltipLabel?: string;
}) {
  return (
    <Tooltip>
      <Button asChild variant="ghostIcon" size="icon">
        <TooltipTrigger
          aria-label={ariaLabel}
          aria-selected={active}
          className="size-[30px] rounded-sm bg-transparent text-inherit hover:bg-transparent hover:text-inherit focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={onClick}
          role="tab"
          type="button"
        >
          {children}
        </TooltipTrigger>
      </Button>
      <TooltipContent side="bottom">{tooltipLabel}</TooltipContent>
    </Tooltip>
  );
}

function workspaceWidgetTabMoreClassName(actionsAccessible: boolean) {
  const visibleClassName =
    'pointer-events-auto ml-[2px] max-w-20 scale-100 opacity-100 data-[state=open]:pointer-events-auto data-[state=open]:ml-[2px] data-[state=open]:max-w-20 data-[state=open]:scale-100 data-[state=open]:opacity-100';
  const hiddenClassName =
    'pointer-events-none ml-0 max-w-0 scale-75 opacity-0 group-hover/rail-tab:pointer-events-auto group-hover/rail-tab:ml-[2px] group-hover/rail-tab:max-w-20 group-hover/rail-tab:scale-100 group-hover/rail-tab:opacity-100 focus-visible:pointer-events-auto focus-visible:ml-[2px] focus-visible:max-w-20 focus-visible:scale-100 focus-visible:opacity-100 data-[state=open]:pointer-events-auto data-[state=open]:ml-[2px] data-[state=open]:max-w-20 data-[state=open]:scale-100 data-[state=open]:opacity-100';

  return [
    'inline-flex items-center justify-center overflow-hidden',
    'transition-[max-width,margin-left,opacity,transform] duration-150 ease-out motion-reduce:transition-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    actionsAccessible ? visibleClassName : hiddenClassName,
  ].join(' ');
}

function stopWorkspaceWidgetMoreEventPropagation(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

function WorkspaceWidgetTabIcon({ widget }: { readonly widget: WorkspaceTitlebarWidget }) {
  const customIconKey =
    widget.icon.source === 'custom-mask' ? `${widget.icon.url}:${widget.icon.version}` : '';
  const [customIconState, setCustomIconState] = useState<{
    readonly key: string;
    readonly status: 'pending' | 'ready' | 'failed';
  }>({ key: customIconKey, status: 'pending' });
  const customIconStatus =
    customIconState.key === customIconKey ? customIconState.status : 'pending';

  if (widget.icon.source === 'custom-mask' && customIconStatus !== 'failed') {
    return (
      <span
        aria-hidden="true"
        className="relative inline-flex size-16 items-center justify-center"
        data-slot="workspace-widget-tab-icon"
      >
        <WorkspaceWidgetFallbackIcon
          className={cn(
            'absolute inset-0 m-auto',
            customIconStatus === 'ready' ? 'opacity-0' : 'opacity-100'
          )}
        />
        <img
          alt=""
          aria-hidden="true"
          className={cn(
            'relative size-16 rounded-[3px] object-contain',
            customIconStatus === 'ready' ? 'opacity-100' : 'opacity-0'
          )}
          data-slot="workspace-widget-tab-icon-custom"
          draggable={false}
          key={customIconKey}
          role="img"
          src={widget.icon.url}
          onError={() => setCustomIconState({ key: customIconKey, status: 'failed' })}
          onLoad={() => setCustomIconState({ key: customIconKey, status: 'ready' })}
        />
      </span>
    );
  }

  return <WorkspaceWidgetFallbackIcon />;
}

function WorkspaceWidgetFallbackIcon({ className }: { readonly className?: string }) {
  return (
    <AppWindow
      aria-hidden="true"
      className={cn('size-16 shrink-0', className)}
      data-slot="workspace-widget-tab-icon-fallback"
      strokeWidth={2}
    />
  );
}

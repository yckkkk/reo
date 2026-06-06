import { createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WorkspaceTitlebar } from './WorkspaceTitlebar';
import type { WorkspaceMemorySummary, WorkspaceWidgetProjection } from './workspaceApi';
import { MEMORY_RAIL_TAB } from './workspaceRailTabs';

const currentMemory: WorkspaceMemorySummary = {
  audioByteLength: 0,
  audioDurationMs: 0,
  audioSegmentCount: 0,
  createdAt: '2026-05-23T10:00:00.000Z',
  hasAnyNote: true,
  hasAudioTranscript: false,
  memoryId: 'mem_1',
  noteSegmentCount: 1,
  artifactSegmentCount: 0,
  segmentCount: 1,
  supplementCount: 0,
  title: '碎片记录',
  updatedAt: '2026-05-23T10:00:00.000Z',
};

const workspaceWidget: WorkspaceWidgetProjection = {
  workspaceId: 'ws_1',
  widgetId: 'wdg_overview',
  type: 'widget',
  format: 'html',
  mount: 'workspace-rail',
  title: 'Workspace 总览',
  createdAt: '2026-06-05T12:00:00.000Z',
  updatedAt: '2026-06-05T12:00:00.000Z',
  icon: { source: 'default' },
  entryByteLength: 42,
  entryHash: 'a'.repeat(64),
  previewVersion: 'b'.repeat(64),
};

const customIconWidget: WorkspaceWidgetProjection = {
  ...workspaceWidget,
  widgetId: 'wdg_custom_icon',
  title: '自定义面板',
  icon: {
    source: 'custom-mask',
    url: 'reo-render://widget-ws_1-wdg_custom_icon/assets/icon.svg?v=hash',
    version: 'c'.repeat(64),
  },
};

const secondWidget: WorkspaceWidgetProjection = {
  ...workspaceWidget,
  widgetId: 'wdg_second',
  title: '第二个组件',
};

const thirdWidget: WorkspaceWidgetProjection = {
  ...workspaceWidget,
  widgetId: 'wdg_today',
  title: '今日空间总览',
};

function openCreateMenu(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
}

function createDragDataTransfer() {
  const data = new Map<string, string>();
  return {
    dropEffect: 'none',
    effectAllowed: 'all',
    getData: vi.fn((type: string) => data.get(type) ?? ''),
    setData: vi.fn((type: string, value: string) => {
      data.set(type, value);
    }),
  } as unknown as DataTransfer;
}

function mockTabRect(element: HTMLElement, left = 0, width = 100) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () =>
      ({
        bottom: 30,
        height: 30,
        left,
        right: left + width,
        top: 0,
        width,
        x: left,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  });
}

function fireWidgetTabDragOver(
  element: HTMLElement,
  input: {
    readonly clientX: number;
    readonly dataTransfer: DataTransfer;
  }
) {
  const event = createEvent.dragOver(element, { dataTransfer: input.dataTransfer });
  Object.defineProperty(event, 'clientX', {
    configurable: true,
    value: input.clientX,
  });
  fireEvent(element, event);
}

function renderWorkspaceTitlebar({
  memory,
  onCreateMemory = vi.fn(),
  onCreateWidget = vi.fn(),
  onReorderWidgets = vi.fn(),
  widgets = [],
}: {
  readonly memory: WorkspaceMemorySummary | null;
  readonly onCreateMemory?: () => void;
  readonly onCreateWidget?: () => void;
  readonly onReorderWidgets?: (widgetTabOrder: readonly string[]) => void;
  readonly widgets?: readonly WorkspaceWidgetProjection[];
}) {
  return render(
    <TooltipProvider>
      <WorkspaceTitlebar
        activeRailTab={MEMORY_RAIL_TAB}
        currentMemory={memory}
        memoryRailOpen
        onCreateMemory={onCreateMemory}
        onCreateWidget={onCreateWidget}
        onDeleteMemory={vi.fn()}
        onDeleteWidget={vi.fn()}
        onRenameMemory={vi.fn()}
        onRenameWidget={vi.fn()}
        onRequestWidgetRefresh={vi.fn()}
        onRequestWidgetUpdate={vi.fn()}
        onResetMemoryCover={vi.fn()}
        onReorderWidgets={onReorderWidgets}
        onSelectRailTab={vi.fn()}
        onSwitchMemoryDefaultCover={vi.fn()}
        onRenameMemorySpace={vi.fn()}
        onRemoveMemorySpace={vi.fn()}
        onToggleMemoryRail={vi.fn()}
        title="测试"
        widgets={widgets}
        workspaceHandle="workspace-handle-secret"
        workspaceId="ws_1"
      />
    </TooltipProvider>
  );
}

describe('WorkspaceTitlebar', () => {
  it('shows one global create menu for new Memory and component actions', () => {
    const onCreateMemory = vi.fn();
    const onCreateWidget = vi.fn();
    const { rerender } = renderWorkspaceTitlebar({
      memory: null,
      onCreateMemory,
      onCreateWidget,
    });

    const memorySpaceActions = document.querySelector('[data-slot="workspace-titlebar-actions"]');
    expect(memorySpaceActions).toBeInstanceOf(HTMLElement);
    const createButton = within(memorySpaceActions as HTMLElement).getByRole('button', {
      name: '新增',
    });
    expect(createButton).not.toHaveTextContent('新记忆');
    expect(createButton).not.toHaveTextContent('Widget');
    openCreateMenu(createButton);
    fireEvent.click(screen.getByRole('menuitem', { name: '新建记忆' }));
    expect(onCreateMemory).toHaveBeenCalledOnce();
    expect(onCreateWidget).not.toHaveBeenCalled();

    rerender(
      <TooltipProvider>
        <WorkspaceTitlebar
          activeRailTab={MEMORY_RAIL_TAB}
          currentMemory={currentMemory}
          memoryRailOpen
          onCreateMemory={onCreateMemory}
          onCreateWidget={onCreateWidget}
          onDeleteMemory={vi.fn()}
          onDeleteWidget={vi.fn()}
          onRenameMemory={vi.fn()}
          onRenameWidget={vi.fn()}
          onRequestWidgetRefresh={vi.fn()}
          onRequestWidgetUpdate={vi.fn()}
          onResetMemoryCover={vi.fn()}
          onReorderWidgets={vi.fn()}
          onSelectRailTab={vi.fn()}
          onSwitchMemoryDefaultCover={vi.fn()}
          onRenameMemorySpace={vi.fn()}
          onRemoveMemorySpace={vi.fn()}
          onToggleMemoryRail={vi.fn()}
          title="测试"
          widgets={[]}
          workspaceHandle="workspace-handle-secret"
          workspaceId="ws_1"
        />
      </TooltipProvider>
    );

    const currentMemoryActions = document.querySelector('[data-slot="workspace-titlebar-actions"]');
    expect(currentMemoryActions).toBeInstanceOf(HTMLElement);
    const nextCreateButton = within(currentMemoryActions as HTMLElement).getByRole('button', {
      name: '新增',
    });
    const railButton = within(currentMemoryActions as HTMLElement).getByRole('button', {
      name: '折叠记忆列表',
    });
    expect(nextCreateButton).not.toHaveTextContent('新记忆');
    expect(
      within(currentMemoryActions as HTMLElement).queryByText('新片段')
    ).not.toBeInTheDocument();
    expect(
      within(currentMemoryActions as HTMLElement).queryByRole('button', {
        name: '打开新片段菜单',
      })
    ).not.toBeInTheDocument();
    expect(currentMemoryActions).toContainElement(railButton);
    openCreateMenu(nextCreateButton);
    fireEvent.click(screen.getByRole('menuitem', { name: '新增组件' }));
    expect(onCreateMemory).toHaveBeenCalledOnce();
    expect(onCreateWidget).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '碎片记录 记忆操作' })).toBeInTheDocument();
  });

  it('reveals rail tabs only while the right rail is expanded', () => {
    const onCreateWidget = vi.fn();
    const onSelectRailTab = vi.fn();
    const { rerender } = render(
      <TooltipProvider>
        <WorkspaceTitlebar
          activeRailTab={MEMORY_RAIL_TAB}
          currentMemory={currentMemory}
          memoryRailOpen={false}
          onCreateMemory={vi.fn()}
          onCreateWidget={onCreateWidget}
          onDeleteMemory={vi.fn()}
          onDeleteWidget={vi.fn()}
          onRenameMemory={vi.fn()}
          onRenameWidget={vi.fn()}
          onRequestWidgetRefresh={vi.fn()}
          onRequestWidgetUpdate={vi.fn()}
          onResetMemoryCover={vi.fn()}
          onReorderWidgets={vi.fn()}
          onSelectRailTab={onSelectRailTab}
          onSwitchMemoryDefaultCover={vi.fn()}
          onRenameMemorySpace={vi.fn()}
          onRemoveMemorySpace={vi.fn()}
          onToggleMemoryRail={vi.fn()}
          title="测试"
          widgets={[workspaceWidget]}
          workspaceHandle="workspace-handle-secret"
          workspaceId="ws_1"
        />
      </TooltipProvider>
    );

    expect(screen.getByRole('button', { name: '新增' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新增组件' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="workspace-rail-tab-strip"]')).toBeNull();

    rerender(
      <TooltipProvider>
        <WorkspaceTitlebar
          activeRailTab={{ kind: 'widget', widgetId: workspaceWidget.widgetId }}
          currentMemory={currentMemory}
          memoryRailOpen
          onCreateMemory={vi.fn()}
          onCreateWidget={onCreateWidget}
          onDeleteMemory={vi.fn()}
          onDeleteWidget={vi.fn()}
          onRenameMemory={vi.fn()}
          onRenameWidget={vi.fn()}
          onRequestWidgetRefresh={vi.fn()}
          onRequestWidgetUpdate={vi.fn()}
          onResetMemoryCover={vi.fn()}
          onReorderWidgets={vi.fn()}
          onSelectRailTab={onSelectRailTab}
          onSwitchMemoryDefaultCover={vi.fn()}
          onRenameMemorySpace={vi.fn()}
          onRemoveMemorySpace={vi.fn()}
          onToggleMemoryRail={vi.fn()}
          title="测试"
          widgets={[workspaceWidget]}
          workspaceHandle="workspace-handle-secret"
          workspaceId="ws_1"
        />
      </TooltipProvider>
    );

    expect(document.querySelector('[data-slot="workspace-rail-tab-strip"]')).toBeInstanceOf(
      HTMLElement
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Workspace 总览 组件' }));
    expect(onSelectRailTab).toHaveBeenCalledWith({
      kind: 'widget',
      widgetId: 'wdg_overview',
    });
    expect(
      document
        .querySelector('[data-slot="workspace-rail-tab-strip"]')
        ?.querySelector('[aria-label="新增组件"]')
    ).toBeNull();
    openCreateMenu(screen.getByRole('button', { name: '新增' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '新增组件' }));
    expect(onCreateWidget).toHaveBeenCalledOnce();
  });

  it('keeps workspace rail tabs unfilled and nests widget actions inside the tab pill', () => {
    render(
      <TooltipProvider>
        <WorkspaceTitlebar
          activeRailTab={{ kind: 'widget', widgetId: workspaceWidget.widgetId }}
          currentMemory={currentMemory}
          memoryRailOpen
          onCreateMemory={vi.fn()}
          onCreateWidget={vi.fn()}
          onDeleteMemory={vi.fn()}
          onDeleteWidget={vi.fn()}
          onRenameMemory={vi.fn()}
          onRenameWidget={vi.fn()}
          onRequestWidgetRefresh={vi.fn()}
          onRequestWidgetUpdate={vi.fn()}
          onResetMemoryCover={vi.fn()}
          onReorderWidgets={vi.fn()}
          onSelectRailTab={vi.fn()}
          onSwitchMemoryDefaultCover={vi.fn()}
          onRenameMemorySpace={vi.fn()}
          onRemoveMemorySpace={vi.fn()}
          onToggleMemoryRail={vi.fn()}
          title="测试"
          widgets={[workspaceWidget]}
          workspaceHandle="workspace-handle-secret"
          workspaceId="ws_1"
        />
      </TooltipProvider>
    );

    const tabStrip = document.querySelector('[data-slot="workspace-rail-tab-strip"]');
    expect(tabStrip).toBeInstanceOf(HTMLElement);
    expect(tabStrip).not.toHaveClass('bg-secondary/45');
    expect(tabStrip).not.toHaveClass('px-4');
    expect(tabStrip).not.toHaveClass('py-[3px]');

    const memoryTab = document.querySelector('[data-slot="workspace-memory-tab"]');
    const widgetTab = document.querySelector('[data-slot="workspace-widget-tab"]');
    expect(memoryTab).toBeInstanceOf(HTMLElement);
    expect(widgetTab).toBeInstanceOf(HTMLElement);
    expect(memoryTab).toHaveClass('h-[30px]');
    expect(memoryTab).toHaveClass('transition-[background-color,color,box-shadow]');
    expect(widgetTab).toHaveClass('rounded-sm');
    expect(widgetTab).toHaveClass('h-[30px]');
    expect(widgetTab).toHaveClass('transition-[background-color,color,box-shadow]');
    expect(widgetTab).toHaveClass('bg-secondary');

    const memoryTabButton = within(memoryTab as HTMLElement).getByRole('tab', {
      name: '记忆列表',
    });
    expect(memoryTabButton).toHaveClass('bg-transparent');
    expect(memoryTabButton).toHaveClass('text-inherit');
    expect(memoryTabButton).toHaveClass('hover:bg-transparent');

    const tabButton = within(widgetTab as HTMLElement).getByRole('tab', {
      name: 'Workspace 总览 组件',
    });
    expect(tabButton).toHaveClass('bg-transparent');
    expect(tabButton).toHaveClass('text-inherit');
    expect(tabButton).toHaveClass('hover:bg-transparent');
    const moreButton = (widgetTab as HTMLElement).querySelector(
      '[data-slot="workspace-widget-tab-more-anchor"]'
    );
    expect(moreButton).toBeInstanceOf(HTMLButtonElement);
    expect(widgetTab).toContainElement(tabButton);
    expect(widgetTab).toContainElement(moreButton as HTMLElement);
    expect(moreButton).toHaveAttribute('aria-hidden', 'true');
    expect(moreButton).toHaveAttribute('tabindex', '-1');
    expect(moreButton).toHaveClass('max-w-0');
    expect(moreButton).toHaveClass('group-hover/rail-tab:max-w-20');
    expect(moreButton).toHaveClass('group-hover/rail-tab:ml-[2px]');
    expect(moreButton).not.toHaveClass('size-[30px]');
    expect(moreButton).not.toHaveClass('hover:bg-secondary');
  });

  it('groups Widget update prompts under Agent actions in the Widget tab menu', async () => {
    const user = userEvent.setup();
    const onRequestWidgetUpdate = vi.fn();
    render(
      <TooltipProvider>
        <WorkspaceTitlebar
          activeRailTab={{ kind: 'widget', widgetId: workspaceWidget.widgetId }}
          currentMemory={currentMemory}
          memoryRailOpen
          onCreateMemory={vi.fn()}
          onCreateWidget={vi.fn()}
          onDeleteMemory={vi.fn()}
          onDeleteWidget={vi.fn()}
          onRenameMemory={vi.fn()}
          onRenameWidget={vi.fn()}
          onRequestWidgetRefresh={vi.fn()}
          onRequestWidgetUpdate={onRequestWidgetUpdate}
          onResetMemoryCover={vi.fn()}
          onReorderWidgets={vi.fn()}
          onSelectRailTab={vi.fn()}
          onSwitchMemoryDefaultCover={vi.fn()}
          onRenameMemorySpace={vi.fn()}
          onRemoveMemorySpace={vi.fn()}
          onToggleMemoryRail={vi.fn()}
          title="测试"
          widgets={[workspaceWidget]}
          workspaceHandle="workspace-handle-secret"
          workspaceId="ws_1"
        />
      </TooltipProvider>
    );

    const widgetTab = document.querySelector('[data-slot="workspace-widget-tab"]');
    expect(widgetTab).toBeInstanceOf(HTMLElement);
    fireEvent.pointerEnter(widgetTab as HTMLElement);

    const moreButton = (widgetTab as HTMLElement).querySelector(
      '[data-slot="workspace-widget-tab-more-anchor"]'
    );
    expect(moreButton).toBeInstanceOf(HTMLButtonElement);
    await waitFor(() => expect(moreButton).not.toHaveAttribute('aria-hidden'));

    await user.click(moreButton as HTMLButtonElement);
    const menu = await screen.findByRole('menu', { name: 'Workspace 总览 更多操作' });
    expect(
      within(menu).queryByRole('menuitem', { name: '让 Agent 更新组件' })
    ).not.toBeInTheDocument();

    await user.click(within(menu).getByRole('menuitem', { name: 'Agent 操作' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '更新组件' }));

    expect(onRequestWidgetUpdate).toHaveBeenCalledWith(workspaceWidget);
  });

  it('shows the fallback icon while custom widget icons are loading', () => {
    const { rerender } = render(
      <TooltipProvider>
        <WorkspaceTitlebar
          activeRailTab={{ kind: 'widget', widgetId: workspaceWidget.widgetId }}
          currentMemory={currentMemory}
          memoryRailOpen
          onCreateMemory={vi.fn()}
          onCreateWidget={vi.fn()}
          onDeleteMemory={vi.fn()}
          onDeleteWidget={vi.fn()}
          onRenameMemory={vi.fn()}
          onRenameWidget={vi.fn()}
          onRequestWidgetRefresh={vi.fn()}
          onRequestWidgetUpdate={vi.fn()}
          onResetMemoryCover={vi.fn()}
          onReorderWidgets={vi.fn()}
          onSelectRailTab={vi.fn()}
          onSwitchMemoryDefaultCover={vi.fn()}
          onRenameMemorySpace={vi.fn()}
          onRemoveMemorySpace={vi.fn()}
          onToggleMemoryRail={vi.fn()}
          title="测试"
          widgets={[workspaceWidget]}
          workspaceHandle="workspace-handle-secret"
          workspaceId="ws_1"
        />
      </TooltipProvider>
    );

    expect(
      document.querySelector('[data-slot="workspace-widget-tab-icon-fallback"]')
    ).toBeInstanceOf(SVGElement);

    rerender(
      <TooltipProvider>
        <WorkspaceTitlebar
          activeRailTab={{ kind: 'widget', widgetId: customIconWidget.widgetId }}
          currentMemory={currentMemory}
          memoryRailOpen
          onCreateMemory={vi.fn()}
          onCreateWidget={vi.fn()}
          onDeleteMemory={vi.fn()}
          onDeleteWidget={vi.fn()}
          onRenameMemory={vi.fn()}
          onRenameWidget={vi.fn()}
          onRequestWidgetRefresh={vi.fn()}
          onRequestWidgetUpdate={vi.fn()}
          onResetMemoryCover={vi.fn()}
          onReorderWidgets={vi.fn()}
          onSelectRailTab={vi.fn()}
          onSwitchMemoryDefaultCover={vi.fn()}
          onRenameMemorySpace={vi.fn()}
          onRemoveMemorySpace={vi.fn()}
          onToggleMemoryRail={vi.fn()}
          title="测试"
          widgets={[customIconWidget]}
          workspaceHandle="workspace-handle-secret"
          workspaceId="ws_1"
        />
      </TooltipProvider>
    );

    const iconSlot = document.querySelector('[data-slot="workspace-widget-tab-icon"]');
    expect(iconSlot).toBeInstanceOf(HTMLElement);
    const fallbackIcon = (iconSlot as HTMLElement).querySelector(
      '[data-slot="workspace-widget-tab-icon-fallback"]'
    );
    expect(fallbackIcon).toBeInstanceOf(SVGElement);
    expect(fallbackIcon).toHaveClass('opacity-100');

    const customIcon = within(iconSlot as HTMLElement).getByRole('img', { hidden: true });
    expect(customIcon).toHaveAttribute(
      'src',
      customIconWidget.icon.source === 'custom-mask' ? customIconWidget.icon.url : ''
    );
    expect(customIcon).toHaveClass('opacity-0');

    fireEvent.load(customIcon);
    expect(customIcon).toHaveClass('opacity-100');
    expect(fallbackIcon).toHaveClass('opacity-0');

    fireEvent.error(customIcon);
    expect(
      document.querySelector('[data-slot="workspace-widget-tab-icon-fallback"]')
    ).toBeInstanceOf(SVGElement);
    expect(document.querySelector('[data-slot="workspace-widget-tab-icon-custom"]')).toBeNull();
  });

  it('reorders Widget tabs with the same before/after drag model as the content tab rail', async () => {
    const onReorderWidgets = vi.fn();
    renderWorkspaceTitlebar({
      memory: currentMemory,
      onReorderWidgets,
      widgets: [workspaceWidget, secondWidget, thirdWidget],
    });
    const tabStrip = document.querySelector('[data-slot="workspace-rail-tab-strip"]');
    expect(tabStrip).toBeInstanceOf(HTMLElement);
    const widgetTabNames = () =>
      within(tabStrip as HTMLElement)
        .getAllByRole('tab')
        .filter((tab) => tab.getAttribute('aria-label')?.endsWith(' 组件'))
        .map((tab) => tab.getAttribute('aria-label'));

    expect(widgetTabNames()).toEqual([
      'Workspace 总览 组件',
      '第二个组件 组件',
      '今日空间总览 组件',
    ]);

    const overviewItem = within(tabStrip as HTMLElement)
      .getByRole('tab', { name: 'Workspace 总览 组件' })
      .closest('[data-slot="workspace-widget-tab"]') as HTMLElement;
    const todayItem = within(tabStrip as HTMLElement)
      .getByRole('tab', { name: '今日空间总览 组件' })
      .closest('[data-slot="workspace-widget-tab"]') as HTMLElement;
    mockTabRect(overviewItem);
    const dataTransfer = createDragDataTransfer();

    fireEvent.dragStart(todayItem, { dataTransfer });
    fireWidgetTabDragOver(overviewItem, { clientX: -10, dataTransfer });
    fireEvent.drop(overviewItem, { dataTransfer });

    await waitFor(() =>
      expect(widgetTabNames()).toEqual([
        '今日空间总览 组件',
        'Workspace 总览 组件',
        '第二个组件 组件',
      ])
    );
    expect(onReorderWidgets).not.toHaveBeenCalled();

    fireEvent.dragEnd(todayItem, { dataTransfer });
    expect(onReorderWidgets).toHaveBeenCalledWith(['wdg_today', 'wdg_overview', 'wdg_second']);
  });

  it('commits one Widget reorder for one drag gesture even if drag end fires again', async () => {
    const onReorderWidgets = vi.fn();
    renderWorkspaceTitlebar({
      memory: currentMemory,
      onReorderWidgets,
      widgets: [workspaceWidget, secondWidget, thirdWidget],
    });
    const tabStrip = document.querySelector('[data-slot="workspace-rail-tab-strip"]');
    expect(tabStrip).toBeInstanceOf(HTMLElement);
    const overviewItem = within(tabStrip as HTMLElement)
      .getByRole('tab', { name: 'Workspace 总览 组件' })
      .closest('[data-slot="workspace-widget-tab"]') as HTMLElement;
    const todayItem = within(tabStrip as HTMLElement)
      .getByRole('tab', { name: '今日空间总览 组件' })
      .closest('[data-slot="workspace-widget-tab"]') as HTMLElement;
    mockTabRect(overviewItem);
    const dataTransfer = createDragDataTransfer();

    fireEvent.dragStart(todayItem, { dataTransfer });
    fireWidgetTabDragOver(overviewItem, { clientX: -10, dataTransfer });
    await waitFor(() =>
      expect(
        within(tabStrip as HTMLElement)
          .getAllByRole('tab')
          .filter((tab) => tab.getAttribute('aria-label')?.endsWith(' 组件'))
          .map((tab) => tab.getAttribute('aria-label'))
      ).toEqual(['今日空间总览 组件', 'Workspace 总览 组件', '第二个组件 组件'])
    );

    fireEvent.dragEnd(todayItem, { dataTransfer });
    fireEvent.dragEnd(todayItem, { dataTransfer });

    expect(onReorderWidgets).toHaveBeenCalledTimes(1);
    expect(onReorderWidgets).toHaveBeenCalledWith(['wdg_today', 'wdg_overview', 'wdg_second']);
  });
});

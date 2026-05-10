import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createReoQueryClient } from '../queryClient';
import { LoadedWorkspaceFrame } from './LoadedWorkspaceFrame';
import type { WorkspaceSession } from './workspaceApi';
import { seedWorkspaceSnapshot, workspaceSnapshotQueryKey } from './workspaceQueries';

function workspaceSession(snapshot: Partial<WorkspaceSession['snapshot']> = {}): WorkspaceSession {
  return {
    workspaceHandle: 'workspace-handle-secret',
    workspaceId: 'ws_1',
    snapshot: {
      workspaceId: 'ws_1',
      title: 'Daily memory',
      description: 'Private notes',
      memories: [],
      ...snapshot,
    },
  };
}

const birthdayMemory = {
  memoryId: 'mem_birthday',
  title: 'My seventh birthday',
  createdAt: '2026-05-06T13:08:00.000',
  updatedAt: '2026-05-06T13:10:00.000',
  segmentCount: 2,
  durationMs: 125_000,
  audioByteLength: 2048,
  hasTranscript: true,
  attachmentCount: 0,
};

const morningMemory = {
  memoryId: 'mem_morning',
  title: 'Morning note',
  createdAt: '2026-04-11T09:00:00.000',
  updatedAt: '2026-04-11T09:02:00.000',
  segmentCount: 1,
  durationMs: 30_000,
  audioByteLength: 512,
  hasTranscript: false,
  attachmentCount: 1,
};

const recitalMemory = {
  memoryId: 'mem_recital',
  title: 'School recital',
  createdAt: '2026-05-01T09:00:00.000',
  updatedAt: '2026-05-01T09:10:00.000',
  segmentCount: 1,
  durationMs: 60_000,
  audioByteLength: 1024,
  hasTranscript: false,
  attachmentCount: 0,
};

function renderLoadedWorkspaceFrame({
  currentMemory = null,
  memoryRailOpen,
  onRenameMemory = vi.fn(),
  onSelectMemory = vi.fn(),
  onStartRecording = vi.fn(),
  session = workspaceSession(),
}: {
  readonly currentMemory?: WorkspaceSession['snapshot']['memories'][number] | null;
  readonly memoryRailOpen?: boolean;
  readonly onRenameMemory?: (memory: WorkspaceSession['snapshot']['memories'][number]) => void;
  readonly onSelectMemory?: (memoryId: string) => void;
  readonly onStartRecording?: () => void;
  readonly session?: WorkspaceSession;
} = {}) {
  const queryClient = createReoQueryClient();
  seedWorkspaceSnapshot(queryClient, session);
  const frameProps =
    memoryRailOpen === undefined
      ? {}
      : {
          memoryRailOpen,
        };
  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <LoadedWorkspaceFrame
        currentMemory={currentMemory}
        workspaceSession={session}
        onRenameMemory={onRenameMemory}
        onSelectMemory={onSelectMemory}
        onStartRecording={onStartRecording}
        {...frameProps}
      />
    </QueryClientProvider>
  );

  return { queryClient, ...renderResult };
}

describe('LoadedWorkspaceFrame', () => {
  it('renders the loaded workspace frame as a workspace stage with one real expression entry', async () => {
    const user = userEvent.setup();
    const onStartRecording = vi.fn();

    renderLoadedWorkspaceFrame({ onStartRecording });

    expect(screen.queryByRole('region', { name: '记忆空间栏' })).not.toBeInTheDocument();
    expect(screen.queryByText('Daily memory')).not.toBeInTheDocument();
    const stage = screen.getByRole('region', { name: '记忆空间舞台' });
    expect(within(stage).getByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();
    expect(within(stage).getByRole('heading', { name: '今天想记录些什么？' })).toHaveClass(
      'font-memory-serif'
    );
    expect(stage.querySelector('svg')).not.toBeInTheDocument();
    expect(within(stage).queryByText('片段时间线')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '全部记忆' })).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: '搜索记忆' })).not.toBeInTheDocument();
    expect(screen.queryByText('workspace-handle-secret')).not.toBeInTheDocument();

    const dock = screen.getByRole('region', { name: '表达入口' });
    expect(dock).toHaveClass('pointer-events-none');
    expect(dock.closest('[data-slot="workspace-expression-fab-layer"]')).toHaveClass(
      'bottom-32',
      'right-[var(--workspace-memory-rail-stage-inset)]',
      'xl:right-[var(--workspace-memory-rail-stage-inset-wide)]'
    );
    expect(document.querySelector('[data-slot="workspace-frame"]')).toHaveStyle({
      '--workspace-memory-rail-stage-inset': 'calc(var(--workspace-memory-rail-width) + 20px)',
      '--workspace-memory-rail-stage-inset-wide': 'calc(var(--workspace-memory-rail-width) + 40px)',
      '--workspace-memory-rail-width': '340px',
    });
    const dialTrigger = within(dock).getByRole('button', { name: '打开表达入口' });
    expect(dialTrigger).toHaveClass(
      '!bg-signal-blue',
      '!rounded-full',
      '!size-[var(--reo-speed-dial-diameter)]'
    );
    expect(within(dock).queryByRole('menuitem', { name: '录音' })).not.toBeInTheDocument();
    expect(dock.querySelector('[role="menu"]')).toHaveAttribute('aria-hidden', 'true');
    expect(within(dock).queryByRole('menuitem', { name: '上传图片' })).not.toBeInTheDocument();

    await user.click(dialTrigger);
    const recordingAction = within(dock).getByRole('menuitem', { name: '录音' });
    expect(recordingAction).toHaveClass('rounded-full', 'size-[var(--reo-speed-dial-action-size)]');
    expect(within(dock).getByRole('menu', { name: '表达方式' })).toBeInTheDocument();
    expect(within(dock).queryByText('笔记')).not.toBeInTheDocument();
    expect(within(dock).queryByText('拍照')).not.toBeInTheDocument();
    expect(within(dock).queryByText('视频')).not.toBeInTheDocument();
    expect(within(dock).queryByText('上传')).not.toBeInTheDocument();
    expect(
      dock.querySelectorAll('[data-slot="floating-action-button-speed-dial-action-unavailable"]')
    ).toHaveLength(4);
    expect(within(dock).getByRole('menuitem', { name: '笔记暂不可用' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(within(dock).getByRole('menuitem', { name: '拍照暂不可用' })).toHaveClass(
      'cursor-default',
      'focus-visible:ring-2',
      'p-disabled'
    );
    expect(within(dock).queryByRole('menuitem', { name: '上传图片' })).not.toBeInTheDocument();

    await user.click(recordingAction);
    expect(onStartRecording).toHaveBeenCalledOnce();
  });

  it('renders right-side Memory containers without turning the stage into an segment timeline', () => {
    renderLoadedWorkspaceFrame({
      session: workspaceSession({
        memories: [morningMemory, recitalMemory, birthdayMemory],
      }),
    });

    const rail = screen.getByRole('navigation', { name: '记忆列表' });
    const railShell = rail.closest('[data-slot="workspace-memory-rail-shell"]');
    expect(railShell).toHaveAttribute('aria-hidden', 'false');
    expect(railShell).toHaveClass('absolute', 'right-0', 'w-[var(--workspace-memory-rail-width)]');
    expect(railShell).toHaveClass('translate-x-0', 'opacity-100');
    expect(rail).toHaveAttribute('id', 'workspace-memory-rail');
    expect(rail).toHaveClass('bg-card-white');
    expect(rail).not.toHaveClass('bg-eggshell/70');
    expect(rail).not.toHaveClass('xl:border-l');
    expect(within(rail).queryByRole('heading', { name: '当前记忆' })).not.toBeInTheDocument();
    expect(within(rail).queryByText('3 条记忆')).not.toBeInTheDocument();
    expect(
      within(rail)
        .getAllByRole('button', { name: /选择记忆/ })
        .map((button) => button.getAttribute('aria-label'))
    ).toEqual(['选择记忆 My seventh birthday', '选择记忆 School recital', '选择记忆 Morning note']);
    expect(within(rail).getByText('05/06 13:10 · 2 个片段')).toBeInTheDocument();
    expect(within(rail).getByText('05/01 09:10 · 1 个片段')).toBeInTheDocument();
    expect(within(rail).getByText('04/11 09:02 · 1 个片段')).toBeInTheDocument();
    expect(within(rail).queryByText(/更新/)).not.toBeInTheDocument();
    expect(within(rail).queryByText('转写')).not.toBeInTheDocument();
    expect(within(rail).queryByText('反思')).not.toBeInTheDocument();
    expect(within(rail).queryByText('时长')).not.toBeInTheDocument();
    expect(screen.queryByText('片段时间线')).not.toBeInTheDocument();
  });

  it('selects an existing Memory through the right rail without requiring a detail route', async () => {
    const user = userEvent.setup();
    const onSelectMemory = vi.fn();

    renderLoadedWorkspaceFrame({
      onSelectMemory,
      session: workspaceSession({ memories: [birthdayMemory] }),
    });

    await user.click(screen.getByRole('button', { name: '选择记忆 My seventh birthday' }));

    expect(onSelectMemory).toHaveBeenCalledWith('mem_birthday');
  });

  it('renders the selected Memory as the current quiet stage context', () => {
    renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session: workspaceSession({ memories: [birthdayMemory] }),
    });

    const stage = screen.getByRole('region', { name: '记忆空间舞台' });
    expect(within(stage).getByRole('heading', { name: 'My seventh birthday' })).toBeInTheDocument();
    expect(within(stage).getByText('2 个片段 · 继续在这条记忆里记录。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '选择记忆 My seventh birthday' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('opens the Memory rename action from a compact card menu', async () => {
    const user = userEvent.setup();
    const onRenameMemory = vi.fn();

    renderLoadedWorkspaceFrame({
      onRenameMemory,
      session: workspaceSession({ memories: [birthdayMemory] }),
    });

    await user.click(screen.getByRole('button', { name: 'My seventh birthday 更多操作' }));
    expect(screen.getByRole('menu', { name: 'My seventh birthday 更多操作' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: '重命名记忆' }));

    expect(onRenameMemory).toHaveBeenCalledWith(birthdayMemory);
  });

  it('can hide the right-side Memory rail without turning the workspace stage into a timeline', () => {
    renderLoadedWorkspaceFrame({
      memoryRailOpen: false,
      session: workspaceSession({
        memories: [birthdayMemory],
      }),
    });

    expect(screen.queryByRole('navigation', { name: '记忆列表' })).not.toBeInTheDocument();
    const railShell = document.querySelector('[data-slot="workspace-memory-rail-shell"]');
    expect(railShell).toHaveAttribute('aria-hidden', 'true');
    expect(railShell).toHaveAttribute('inert');
    expect(railShell).toHaveClass('absolute', 'right-0', 'w-[var(--workspace-memory-rail-width)]');
    expect(railShell).toHaveClass('translate-x-full', 'opacity-0', 'pointer-events-none');
    expect(document.querySelector('[data-slot="workspace-expression-fab-layer"]')).toHaveClass(
      'right-24',
      'sm:right-40',
      'xl:right-40'
    );
    expect(screen.getByRole('region', { name: '记忆空间舞台' })).toBeInTheDocument();
    expect(screen.queryByText('片段时间线')).not.toBeInTheDocument();
  });

  it('renders the Memory rail from the TanStack Query snapshot cache', async () => {
    const session = workspaceSession({
      memories: [morningMemory],
    });
    const { queryClient } = renderLoadedWorkspaceFrame({ session });

    queryClient.setQueryData(workspaceSnapshotQueryKey(session), {
      ...session.snapshot,
      memories: [birthdayMemory],
    });

    expect(
      await screen.findByRole('button', { name: '选择记忆 My seventh birthday' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '选择记忆 Morning note' })).not.toBeInTheDocument();
  });
});

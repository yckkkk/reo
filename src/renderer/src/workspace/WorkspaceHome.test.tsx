import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceHome } from './WorkspaceHome';
import type { WorkspaceSession } from './workspaceApi';

function workspaceSession(snapshot: Partial<WorkspaceSession['snapshot']> = {}): WorkspaceSession {
  return {
    workspaceHandle: 'workspace-handle-secret',
    workspaceId: 'ws_1',
    snapshot: {
      workspaceId: 'ws_1',
      title: 'Daily memory',
      description: 'Private notes',
      memories: [],
      recordings: [],
      ...snapshot,
    },
  };
}

const birthdayMemory = {
  memoryId: 'mem_birthday',
  title: 'My seventh birthday',
  createdAt: '2026-05-06T13:08:00.000Z',
  updatedAt: '2026-05-06T13:10:00.000Z',
  recordingCount: 2,
  durationMs: 125_000,
  audioByteLength: 2048,
  hasTranscript: true,
  hasReflections: false,
};

const morningMemory = {
  memoryId: 'mem_morning',
  title: 'Morning note',
  createdAt: '2026-04-11T09:00:00.000Z',
  updatedAt: '2026-04-11T09:02:00.000Z',
  recordingCount: 1,
  durationMs: 30_000,
  audioByteLength: 512,
  hasTranscript: false,
  hasReflections: true,
};

const recitalMemory = {
  memoryId: 'mem_recital',
  title: 'School recital',
  createdAt: '2026-05-01T09:00:00.000Z',
  updatedAt: '2026-05-01T09:10:00.000Z',
  recordingCount: 1,
  durationMs: 60_000,
  audioByteLength: 1024,
  hasTranscript: false,
  hasReflections: false,
};

describe('WorkspaceHome', () => {
  it('uses Chinese interface copy for the workspace home surface', () => {
    render(
      <WorkspaceHome
        workspaceSession={workspaceSession()}
        onOpenMemory={vi.fn()}
        onStartRecording={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: '全部记忆' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: '搜索记忆' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '记录记忆' })).toBeInTheDocument();
    expect(screen.getByText('还没有记忆。')).toBeInTheDocument();
    expect(screen.queryByText('All memories')).not.toBeInTheDocument();
  });

  it('filters the loaded workspace snapshot locally by title, date, month, and status', async () => {
    const user = userEvent.setup();

    render(
      <WorkspaceHome
        workspaceSession={workspaceSession({ memories: [birthdayMemory, morningMemory] })}
        onOpenMemory={vi.fn()}
        onStartRecording={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: '全部记忆' })).toBeInTheDocument();
    const search = screen.getByRole('searchbox', { name: '搜索记忆' });

    await user.type(search, 'birthday');
    expect(screen.getByText('My seventh birthday')).toBeInTheDocument();
    expect(screen.queryByText('Morning note')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, '2026年4月');
    expect(screen.getByText('Morning note')).toBeInTheDocument();
    expect(screen.queryByText('My seventh birthday')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, '2026年5月6日');
    expect(screen.getByText('My seventh birthday')).toBeInTheDocument();
    expect(screen.queryByText('Morning note')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, '反思');
    expect(screen.getByText('Morning note')).toBeInTheDocument();
    expect(screen.queryByText('My seventh birthday')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'not in this workspace');
    expect(screen.getByText('没有匹配的记忆。')).toBeInTheDocument();
    expect(screen.getByText('清空搜索即可返回此工作区。')).toBeInTheDocument();
    expect(screen.queryByText(/global search/i)).not.toBeInTheDocument();
  });

  it('groups memories by descending month and renders memory card metadata', () => {
    render(
      <WorkspaceHome
        workspaceSession={workspaceSession({
          memories: [morningMemory, recitalMemory, birthdayMemory],
        })}
        onOpenMemory={vi.fn()}
        onStartRecording={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: '2026年5月' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2026年4月' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    ).toEqual(['已保存的记忆', '2026年5月', '2026年4月']);
    expect(
      within(screen.getByRole('region', { name: '2026年5月' }))
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent)
    ).toEqual(['My seventh birthday', 'School recital']);
    expect(screen.getByText('2 段录音')).toBeInTheDocument();
    expect(screen.getByText('2 分 5 秒')).toBeInTheDocument();
    expect(screen.getByText('转写')).toBeInTheDocument();
    expect(screen.getByText('反思')).toBeInTheDocument();
    expect(screen.queryByText(/photos|videos|films|files|global search/i)).not.toBeInTheDocument();
  });

  it('opens a saved memory from its memory card', async () => {
    const user = userEvent.setup();
    const onOpenMemory = vi.fn();

    render(
      <WorkspaceHome
        workspaceSession={workspaceSession({ memories: [birthdayMemory] })}
        onStartRecording={vi.fn()}
        onOpenMemory={onOpenMemory}
      />
    );

    await user.click(screen.getByRole('button', { name: '打开 My seventh birthday' }));

    expect(onOpenMemory).toHaveBeenCalledWith('mem_birthday');
  });

  it('keeps an empty workspace scoped to saved recordings', async () => {
    const user = userEvent.setup();
    const onStartRecording = vi.fn();

    render(
      <WorkspaceHome
        workspaceSession={workspaceSession()}
        onOpenMemory={vi.fn()}
        onStartRecording={onStartRecording}
      />
    );

    expect(screen.getByRole('heading', { name: '全部记忆' })).toBeInTheDocument();
    expect(screen.getByText('还没有记忆。')).toBeInTheDocument();
    expect(screen.getByText('保存后的记忆会显示在这里。')).toBeInTheDocument();
    expect(screen.queryByText('workspace-handle-secret')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '记录记忆' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: '记录记忆' }));
    expect(onStartRecording).toHaveBeenCalledTimes(1);
  });
});

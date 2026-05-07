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
  it('filters the loaded workspace snapshot locally by title, date, month, and status', async () => {
    const user = userEvent.setup();

    render(
      <WorkspaceHome
        workspaceSession={workspaceSession({ memories: [birthdayMemory, morningMemory] })}
        onStartRecording={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'All memories' })).toBeInTheDocument();
    const search = screen.getByRole('searchbox', { name: 'Search memories' });

    await user.type(search, 'birthday');
    expect(screen.getByText('My seventh birthday')).toBeInTheDocument();
    expect(screen.queryByText('Morning note')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'April 2026');
    expect(screen.getByText('Morning note')).toBeInTheDocument();
    expect(screen.queryByText('My seventh birthday')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'May 6, 2026');
    expect(screen.getByText('My seventh birthday')).toBeInTheDocument();
    expect(screen.queryByText('Morning note')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'Reflections');
    expect(screen.getByText('Morning note')).toBeInTheDocument();
    expect(screen.queryByText('My seventh birthday')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'not in this workspace');
    expect(screen.getByText('No matching memories.')).toBeInTheDocument();
    expect(screen.getByText('Clear search to return to this workspace.')).toBeInTheDocument();
    expect(screen.queryByText(/global search/i)).not.toBeInTheDocument();
  });

  it('groups memories by descending month and renders memory card metadata', () => {
    render(
      <WorkspaceHome
        workspaceSession={workspaceSession({
          memories: [morningMemory, recitalMemory, birthdayMemory],
        })}
        onStartRecording={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'May 2026' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'April 2026' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    ).toEqual(['Saved memories', 'May 2026', 'April 2026']);
    expect(
      within(screen.getByRole('region', { name: 'May 2026' }))
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent)
    ).toEqual(['My seventh birthday', 'School recital']);
    expect(screen.getByText('2 recordings')).toBeInTheDocument();
    expect(screen.getByText('2 min 5 sec')).toBeInTheDocument();
    expect(screen.getByText('Transcript')).toBeInTheDocument();
    expect(screen.getByText('Reflections')).toBeInTheDocument();
    expect(screen.queryByText(/photos|videos|films|files|global search/i)).not.toBeInTheDocument();
  });

  it('keeps an empty workspace scoped to saved recordings', async () => {
    const user = userEvent.setup();
    const onStartRecording = vi.fn();

    render(
      <WorkspaceHome workspaceSession={workspaceSession()} onStartRecording={onStartRecording} />
    );

    expect(screen.getByRole('heading', { name: 'All memories' })).toBeInTheDocument();
    expect(screen.getByText('No memories yet.')).toBeInTheDocument();
    expect(
      screen.getByText('Recorded memories appear here after they are saved.')
    ).toBeInTheDocument();
    expect(screen.queryByText('workspace-handle-secret')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Record memory' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Record memory' }));
    expect(onStartRecording).toHaveBeenCalledTimes(1);
  });
});

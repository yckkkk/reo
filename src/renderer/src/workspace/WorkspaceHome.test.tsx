import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceHome } from './WorkspaceHome';
import type { WorkspaceSession } from './workspaceApi';

const workspaceSession: WorkspaceSession = {
  workspaceHandle: 'workspace-handle-secret',
  workspaceId: 'ws_1',
  snapshot: {
    workspaceId: 'ws_1',
    title: 'Daily memory',
    description: 'Private notes',
    recordings: [],
  },
};

describe('WorkspaceHome', () => {
  it('shows the workspace title, one record action, Memory Content, and empty state', async () => {
    const user = userEvent.setup();
    const onStartRecording = vi.fn();

    render(
      <WorkspaceHome workspaceSession={workspaceSession} onStartRecording={onStartRecording} />
    );

    expect(screen.getByRole('heading', { name: 'Daily memory' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Memory Content' })).toBeInTheDocument();
    expect(screen.getByText('No recordings yet.')).toBeInTheDocument();
    expect(screen.getByText('Private notes')).toBeInTheDocument();
    expect(screen.queryByText('workspace-handle-secret')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Record memory' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Record memory' }));
    expect(onStartRecording).toHaveBeenCalledTimes(1);
  });
});

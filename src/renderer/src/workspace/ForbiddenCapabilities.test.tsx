import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../app-shell/AppShell';
import { WorkspaceHome } from './WorkspaceHome';
import type { WorkspaceSession } from './workspaceApi';

const workspaceSession: WorkspaceSession = {
  workspaceHandle: 'workspace-handle-secret',
  workspaceId: 'ws_1',
  snapshot: {
    workspaceId: 'ws_1',
    title: 'Daily memory',
    description: '',
    memories: [],
    recordings: [],
  },
};

describe('forbidden first-slice capabilities', () => {
  it('does not show future photo, video, file, or film capabilities', () => {
    render(
      <AppShell onNewMemory={() => {}}>
        <WorkspaceHome workspaceSession={workspaceSession} onStartRecording={() => {}} />
      </AppShell>
    );

    expect(screen.queryByText(/photo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/video/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/file/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/film/i)).not.toBeInTheDocument();
  });
});

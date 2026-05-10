import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../app-shell/AppShell';
import { ReoQueryProvider } from '../queryClient';
import { LoadedWorkspaceFrame } from './LoadedWorkspaceFrame';
import type { WorkspaceSession } from './workspaceApi';

const forbiddenRuntimeCapability =
  /photo|video|films?|files?|file upload|\bAI\b|AI generation|\bauth\b|authentication|sign in|sign up|global search/i;

const workspaceSession: WorkspaceSession = {
  workspaceHandle: 'workspace-handle-secret',
  workspaceId: 'ws_1',
  snapshot: {
    workspaceId: 'ws_1',
    title: 'Daily memory',
    description: '',
    memories: [],
  },
};

describe('forbidden first-slice capabilities', () => {
  it('does not show future media, AI, auth, or global search capabilities', () => {
    render(
      <ReoQueryProvider>
        <AppShell themeMode="light" onHome={() => {}} onLibrary={() => {}} onToggleTheme={() => {}}>
          <LoadedWorkspaceFrame
            workspaceSession={workspaceSession}
            onRenameMemory={() => {}}
            onSelectMemory={() => {}}
            onStartRecording={() => {}}
          />
        </AppShell>
      </ReoQueryProvider>
    );

    expect(screen.queryByText(forbiddenRuntimeCapability)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: forbiddenRuntimeCapability,
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', {
        name: forbiddenRuntimeCapability,
      })
    ).not.toBeInTheDocument();
  });
});

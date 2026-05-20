import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRail } from './MemoryRail';
import type { WorkspaceSession } from './workspaceApi';

type WorkspaceMemory = WorkspaceSession['snapshot']['memories'][number];

function memory(overrides: Partial<WorkspaceMemory>): WorkspaceMemory {
  return {
    audioByteLength: 0,
    createdAt: '2026-05-06T13:00:00.000Z',
    audioDurationMs: 0,
    hasAudioTranscript: false,
    memoryId: 'mem_default',
    segmentCount: 0,
    noteSegmentCount: 0,
    audioSegmentCount: 0,
    hasAnyNote: false,
    supplementCount: 0,
    title: 'Default memory',
    updatedAt: '2026-05-06T13:00:00.000Z',
    ...overrides,
  };
}

describe('MemoryRail', () => {
  it('renders memories in upstream snapshot order without resorting in render', () => {
    render(
      <MemoryRail
        memories={[
          memory({
            memoryId: 'mem_older',
            title: 'Older first from snapshot',
            updatedAt: '2026-05-06T13:00:00.000Z',
          }),
          memory({
            memoryId: 'mem_newer',
            title: 'Newer second from snapshot',
            updatedAt: '2026-05-06T14:00:00.000Z',
          }),
        ]}
        onDeleteMemory={vi.fn()}
        onRenameMemory={vi.fn()}
        onSelectMemory={vi.fn()}
        workspaceHandle="workspace-handle-secret"
        workspaceId="ws_1"
      />
    );

    expect(
      screen
        .getAllByRole('button', { name: /^选择记忆/ })
        .map((button) => button.querySelector('span')?.textContent)
    ).toEqual(['Older first from snapshot', 'Newer second from snapshot']);
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EntityMoveDialog } from './EntityMoveDialog';
import type { EntityMoveTargets } from './workspaceApi';

const segmentMoveTargets: EntityMoveTargets = {
  source: {
    type: 'segment',
    workspaceId: 'ws_source',
    memoryId: 'mem_source',
    segmentId: 'seg_source',
    title: '源片段',
    breadcrumb: ['当前空间', '当前记忆'],
  },
  targetLevel: 'memory',
  spaces: [
    {
      workspaceId: 'ws_source',
      title: '当前空间',
      disabledReason: null,
      memories: [
        {
          memoryId: 'mem_source',
          title: '当前记忆',
          disabledReason: '当前位置',
          segments: [],
        },
      ],
    },
    {
      workspaceId: 'ws_target',
      title: '草稿',
      disabledReason: null,
      memories: [
        {
          memoryId: 'mem_target',
          title: '收件箱',
          disabledReason: null,
          segments: [],
        },
      ],
    },
  ],
};

describe('EntityMoveDialog', () => {
  it('confirms a same-level memory target from the directory list', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <EntityMoveDialog
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
        open
        targets={segmentMoveTargets}
      />
    );

    expect(screen.getByRole('heading', { name: '移动片段' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /当前记忆/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '收件箱' }));
    await user.click(screen.getByRole('button', { name: '移动' }));

    expect(onConfirm).toHaveBeenCalledWith({
      targetWorkspaceId: 'ws_target',
      targetMemoryId: 'mem_target',
    });
  });
});

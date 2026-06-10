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
        { memoryId: 'mem_source', title: '当前记忆', disabledReason: '当前位置', segments: [] },
      ],
    },
    {
      workspaceId: 'ws_target',
      title: '草稿',
      disabledReason: null,
      memories: [{ memoryId: 'mem_target', title: '收件箱', disabledReason: null, segments: [] }],
    },
  ],
};

const memoryMoveTargets: EntityMoveTargets = {
  source: {
    type: 'memory',
    workspaceId: 'ws_source',
    memoryId: 'mem_source',
    title: '源记忆',
    breadcrumb: ['当前空间'],
  },
  targetLevel: 'workspace',
  spaces: [
    { workspaceId: 'ws_source', title: '当前空间', disabledReason: '当前位置', memories: [] },
    { workspaceId: 'ws_target', title: '归档空间', disabledReason: null, memories: [] },
  ],
};

describe('EntityMoveDialog', () => {
  it('shows source context and disables the current location', () => {
    render(
      <EntityMoveDialog
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open
        targets={segmentMoveTargets}
      />
    );
    expect(screen.getByRole('heading', { name: '移动片段' })).toBeInTheDocument();
    expect(screen.getByText(/正在移动「源片段」/)).toBeInTheDocument();
    // 源空间默认展开，当前记忆可见且禁用
    expect(screen.getByRole('button', { name: /当前记忆/ })).toBeDisabled();
  });

  it('expands a collapsed target space, selects a memory, and confirms', async () => {
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

    // 目标空间默认折叠：收件箱尚不可见
    expect(screen.queryByRole('button', { name: '收件箱' })).toBeNull();

    await user.click(screen.getByRole('button', { name: /草稿/ }));
    await user.click(screen.getByRole('button', { name: '收件箱' }));
    await user.click(screen.getByRole('button', { name: '移动' }));

    expect(onConfirm).toHaveBeenCalledWith({
      targetWorkspaceId: 'ws_target',
      targetMemoryId: 'mem_target',
    });
  });

  it('filters the tree with the search box', async () => {
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

    await user.type(screen.getByRole('textbox', { name: '搜索移动目标' }), '收件箱');

    // 命中路径强制展开，当前记忆被过滤掉
    expect(screen.queryByRole('button', { name: /当前记忆/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: '收件箱' }));
    await user.click(screen.getByRole('button', { name: '移动' }));
    expect(onConfirm).toHaveBeenCalledWith({
      targetWorkspaceId: 'ws_target',
      targetMemoryId: 'mem_target',
    });
  });

  it('selects a space directly when moving a memory', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <EntityMoveDialog
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
        open
        targets={memoryMoveTargets}
      />
    );

    expect(screen.getByRole('heading', { name: '移动记忆' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /当前空间/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '归档空间' }));
    await user.click(screen.getByRole('button', { name: '移动' }));
    expect(onConfirm).toHaveBeenCalledWith({ targetWorkspaceId: 'ws_target' });
  });
});

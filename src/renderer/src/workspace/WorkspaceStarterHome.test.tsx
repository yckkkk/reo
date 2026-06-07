import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  WorkspaceStarterHome,
  type WorkspaceStarterHomeRecentExpression,
} from './WorkspaceStarterHome';

const recentExpression: WorkspaceStarterHomeRecentExpression = {
  id: 'recent-seg-1',
  preview: '整理今日产品判断。',
  time: '今天 09:24',
  title: '产品判断笔记',
  type: 'note',
};

describe('WorkspaceStarterHome', () => {
  it('renders loading and empty recent expression states without static fixture rows', () => {
    const { rerender } = render(<WorkspaceStarterHome recentExpressionsStatus="loading" />);

    expect(screen.getByText('正在加载近期表达')).toBeInTheDocument();
    expect(screen.queryByText('清晨的灵感碎片')).not.toBeInTheDocument();

    rerender(<WorkspaceStarterHome recentExpressions={[]} recentExpressionsStatus="ready" />);

    expect(screen.getByText('暂无近期表达')).toBeInTheDocument();
    expect(screen.queryByText('清晨的灵感碎片')).not.toBeInTheDocument();
  });

  it('renders populated recent expressions and reports row selection', async () => {
    const user = userEvent.setup();
    const onOpenRecentExpression = vi.fn();
    render(
      <WorkspaceStarterHome
        recentExpressions={[recentExpression]}
        recentExpressionsStatus="ready"
        onOpenRecentExpression={onOpenRecentExpression}
      />
    );

    expect(screen.getByText('产品判断笔记')).toBeInTheDocument();
    expect(screen.getByText('整理今日产品判断。')).toBeInTheDocument();
    expect(screen.queryByText('清晨的灵感碎片')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开近期表达 产品判断笔记' }));

    expect(onOpenRecentExpression).toHaveBeenCalledWith(recentExpression);
  });

  it('renders Home actions without an outer card wrapped around each icon tile', () => {
    render(<WorkspaceStarterHome recentExpressionsStatus="ready" />);

    for (const label of ['写下来', '录下来', '造出来', '拍下来']) {
      const action = screen.getByRole('button', { name: label });
      expect(action).not.toHaveClass('bg-card');
      expect(action.querySelectorAll('[data-slot^="home-action-icon-slot-"]')).toHaveLength(1);
    }
  });

  it('renders partial recent expression failures without exposing raw paths', () => {
    render(
      <WorkspaceStarterHome
        recentExpressions={[recentExpression]}
        recentExpressionsSkippedCount={1}
        recentExpressionsStatus="ready"
      />
    );

    expect(screen.getByText('部分记忆空间暂不可读')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('/Users/');
  });
});

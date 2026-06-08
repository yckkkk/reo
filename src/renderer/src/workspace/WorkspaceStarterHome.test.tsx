import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  WorkspaceStarterHome,
  greetingForHour,
  type WorkspaceStarterHomeRecentExpression,
} from './WorkspaceStarterHome';

const recentExpression: WorkspaceStarterHomeRecentExpression = {
  id: 'recent-seg-1',
  preview: '整理今日产品判断。',
  time: '今天 09:24',
  title: '产品判断笔记',
  type: 'note',
};

describe('greetingForHour', () => {
  it('maps each hour to its time-of-day greeting at the bucket boundaries', () => {
    expect(greetingForHour(0)).toBe('晚上好');
    expect(greetingForHour(4)).toBe('晚上好');
    expect(greetingForHour(5)).toBe('早上好');
    expect(greetingForHour(11)).toBe('早上好');
    expect(greetingForHour(12)).toBe('下午好');
    expect(greetingForHour(17)).toBe('下午好');
    expect(greetingForHour(18)).toBe('晚上好');
    expect(greetingForHour(23)).toBe('晚上好');
  });
});

describe('WorkspaceStarterHome', () => {
  it('renders the time-based greeting and welcome heading above the action tiles', () => {
    render(<WorkspaceStarterHome recentExpressionsStatus="ready" />);

    expect(screen.getByText('想到的，都留下来')).toBeInTheDocument();
    expect(
      screen.getByText((text) => ['早上好', '下午好', '晚上好'].includes(text))
    ).toBeInTheDocument();
  });

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

  it('keeps recent expression hover surface inset from row content', () => {
    render(
      <WorkspaceStarterHome
        recentExpressions={[recentExpression]}
        recentExpressionsStatus="ready"
      />
    );

    const row = screen.getByRole('button', { name: '打开近期表达 产品判断笔记' });

    expect(row).toHaveClass('px-16');
    expect(row).not.toHaveClass('pl-0', 'pr-0');
    expect(row).toHaveClass('py-8');
    expect(row).not.toHaveClass('py-10');
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

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EditorExpandShell } from './EditorExpandShell';

type RenderOverrides = Partial<Parameters<typeof EditorExpandShell>[0]>;

function renderShell(overrides: RenderOverrides = {}) {
  const props = {
    ariaLabelledBy: 'tab-1',
    expanded: false,
    onExpandedChange: vi.fn(),
    onReturn: vi.fn(),
    panelId: 'panel-1',
    pending: false,
    renderAsPanel: true,
    title: '正文',
    ...overrides,
  };
  render(
    <EditorExpandShell {...props}>
      <div data-testid="editor-body">正文内容</div>
    </EditorExpandShell>
  );
  return props;
}

describe('EditorExpandShell', () => {
  it('collapsed: 显示 Grip，点击请求展开，不显示全窗控件', async () => {
    const user = userEvent.setup();
    const props = renderShell({ expanded: false });

    expect(screen.getByTestId('editor-body')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '返回' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '缩小编辑器' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '展开编辑器' }));
    expect(props.onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('expanded: 显示全窗、返回与缩小，不显示常驻取消/保存', async () => {
    const user = userEvent.setup();
    const props = renderShell({ expanded: true });

    expect(screen.getByRole('dialog', { name: '正文' })).toBeInTheDocument();
    expect(screen.getByTestId('editor-body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '缩小编辑器' }));
    expect(props.onExpandedChange).toHaveBeenCalledWith(false);
    expect(props.onReturn).not.toHaveBeenCalled();
  });

  it('expanded: 左上角返回和右下角缩小是不同职责', async () => {
    const user = userEvent.setup();
    const props = renderShell({ expanded: true });

    await user.click(screen.getByRole('button', { name: '返回' }));
    expect(props.onReturn).toHaveBeenCalledOnce();
    expect(props.onExpandedChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '缩小编辑器' }));
    expect(props.onExpandedChange).toHaveBeenCalledWith(false);
    expect(props.onReturn).toHaveBeenCalledOnce();
  });

  it('expanded: 右下角缩小不触发返回确认', async () => {
    const user = userEvent.setup();
    const props = renderShell({ expanded: true });

    await user.click(screen.getByRole('button', { name: '缩小编辑器' }));

    expect(props.onExpandedChange).toHaveBeenCalledWith(false);
    expect(props.onReturn).not.toHaveBeenCalled();
  });

  it('expanded + pending: 禁用返回和缩小', () => {
    renderShell({ expanded: true, pending: true });

    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '缩小编辑器' })).toBeDisabled();
  });
});

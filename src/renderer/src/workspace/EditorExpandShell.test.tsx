import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EditorExpandShell } from './EditorExpandShell';

type RenderOverrides = Partial<Parameters<typeof EditorExpandShell>[0]>;

function renderShell(overrides: RenderOverrides = {}) {
  const props = {
    ariaLabelledBy: 'tab-1',
    cancelLabel: '取消',
    dirty: false,
    expanded: false,
    onCancel: vi.fn(),
    onExpandedChange: vi.fn(),
    onSave: vi.fn(),
    panelId: 'panel-1',
    pending: false,
    renderAsPanel: true,
    saveDisabled: false,
    saveLabel: '保存',
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
    expect(screen.queryByRole('button', { name: '退出全屏' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '展开为全屏' }));
    expect(props.onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('expanded(未改动): 显示全窗与 Minimize，点击请求收起，不显示取消/保存', async () => {
    const user = userEvent.setup();
    const props = renderShell({ expanded: true, dirty: false });

    expect(screen.getByRole('dialog', { name: '正文' })).toBeInTheDocument();
    expect(screen.getByTestId('editor-body')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '退出全屏' }));
    expect(props.onExpandedChange).toHaveBeenCalledWith(false);
  });

  it('expanded(已改动): 显示取消/保存并连到 handler', async () => {
    const user = userEvent.setup();
    const props = renderShell({ expanded: true, dirty: true });

    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(props.onCancel).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(props.onSave).toHaveBeenCalledOnce();
  });

  it('expanded + pending: 即使 dirty 也隐藏取消/保存，仍显示 Minimize', () => {
    renderShell({ expanded: true, dirty: true, pending: true });

    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出全屏' })).toBeInTheDocument();
  });
});

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
    onReturn: vi.fn(),
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
    expect(screen.queryByRole('button', { name: '返回' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '缩小编辑器' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '展开编辑器' }));
    expect(props.onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('expanded(未改动): 显示全窗、返回与缩小，不显示取消/保存', async () => {
    const user = userEvent.setup();
    const props = renderShell({ expanded: true, dirty: false });

    expect(screen.getByRole('dialog', { name: '正文' })).toBeInTheDocument();
    expect(screen.getByTestId('editor-body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '缩小编辑器' }));
    expect(props.onExpandedChange).toHaveBeenCalledWith(false);
    expect(props.onReturn).not.toHaveBeenCalled();
  });

  it('expanded(已改动): 显示取消/保存并连到 handler', async () => {
    const user = userEvent.setup();
    const props = renderShell({ expanded: true, dirty: true });

    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(props.onCancel).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(props.onSave).toHaveBeenCalledOnce();
  });

  it('expanded: 左上角返回和右下角缩小是不同职责', async () => {
    const user = userEvent.setup();
    const props = renderShell({ expanded: true, dirty: true });

    await user.click(screen.getByRole('button', { name: '返回' }));
    expect(props.onReturn).toHaveBeenCalledOnce();
    expect(props.onExpandedChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '缩小编辑器' }));
    expect(props.onExpandedChange).toHaveBeenCalledWith(false);
    expect(props.onReturn).toHaveBeenCalledOnce();
  });

  it('expanded: 右下角缩小在 dirty 时也不触发保存或取消', async () => {
    const user = userEvent.setup();
    const props = renderShell({ expanded: true, dirty: true });

    await user.click(screen.getByRole('button', { name: '缩小编辑器' }));

    expect(props.onExpandedChange).toHaveBeenCalledWith(false);
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onCancel).not.toHaveBeenCalled();
    expect(props.onReturn).not.toHaveBeenCalled();
  });

  it('expanded + pending: 即使 dirty 也隐藏取消/保存，禁用返回和缩小', () => {
    renderShell({ expanded: true, dirty: true, pending: true });

    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '缩小编辑器' })).toBeDisabled();
  });
});

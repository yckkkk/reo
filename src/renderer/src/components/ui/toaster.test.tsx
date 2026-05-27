import { describe, expect, it, vi, beforeEach } from 'vitest';

const { toastFn, toastMock } = vi.hoisted(() => {
  const fn = vi.fn(() => 'neutral-id');
  const mock = Object.assign(fn, {
    success: vi.fn(() => 'success-id'),
    error: vi.fn(() => 'error-id'),
    warning: vi.fn(() => 'warning-id'),
    info: vi.fn(() => 'info-id'),
    dismiss: vi.fn(),
  });
  return { toastFn: fn, toastMock: mock };
});

vi.mock('sonner', () => ({
  toast: toastMock,
  Toaster: () => null,
}));

import { showReoToast } from './toaster';

beforeEach(() => {
  toastFn.mockClear();
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  toastMock.warning.mockClear();
  toastMock.info.mockClear();
  toastMock.dismiss.mockClear();
});

describe('showReoToast — status types', () => {
  it('delegates success without an options object when no description', () => {
    showReoToast({ type: 'success', title: '已新建记忆' });
    expect(toastMock.success).toHaveBeenCalledWith('已新建记忆');
  });

  it('passes description through to the matching sonner level', () => {
    showReoToast({
      type: 'error',
      title: '无法移除记忆空间',
      description: '请检查文件权限后重试。',
    });
    expect(toastMock.error).toHaveBeenCalledWith('无法移除记忆空间', {
      description: '请检查文件权限后重试。',
    });
  });

  it('routes warning and info to their sonner levels', () => {
    showReoToast({ type: 'warning', title: '录音时长较长' });
    showReoToast({ type: 'info', title: '转写进行中' });
    expect(toastMock.warning).toHaveBeenCalledWith('录音时长较长');
    expect(toastMock.info).toHaveBeenCalledWith('转写进行中');
  });

  it('defaults to a neutral toast with no icon level', () => {
    showReoToast({ title: '已停止录音' });
    expect(toastFn).toHaveBeenCalledWith('已停止录音');
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});

describe('showReoToast — undo recovery', () => {
  it('builds the reo-undo-toast treatment and wires the recovery action', () => {
    const onUndo = vi.fn();
    const onAutoClose = vi.fn();
    showReoToast({
      title: '已删除记忆',
      description: '可在数秒内恢复。',
      durationMs: 3200,
      undo: { onUndo, onAutoClose },
    });

    expect(toastFn).toHaveBeenCalledTimes(1);
    const [title, options] = toastFn.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(title).toBe('已删除记忆');
    expect(options).toMatchObject({
      className: 'reo-undo-toast',
      closeButton: false,
      dismissible: false,
      duration: 3200,
      description: '可在数秒内恢复。',
      onAutoClose,
    });
    expect((options['style'] as Record<string, string>)['--reo-toast-duration']).toBe('3200ms');

    const action = options['action'] as { onClick: () => void };
    action.onClick();
    expect(toastMock.dismiss).toHaveBeenCalledWith('neutral-id');
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});

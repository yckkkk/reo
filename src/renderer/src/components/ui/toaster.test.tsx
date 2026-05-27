import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { toastFn, toastMock, toasterMock } = vi.hoisted(() => {
  const fn = vi.fn(() => 'neutral-id');
  const mock = Object.assign(fn, {
    success: vi.fn(() => 'success-id'),
    error: vi.fn(() => 'error-id'),
    warning: vi.fn(() => 'warning-id'),
    info: vi.fn(() => 'info-id'),
    dismiss: vi.fn(),
  });
  const toaster = vi.fn(() => null);
  return { toastFn: fn, toastMock: mock, toasterMock: toaster };
});

vi.mock('sonner', () => ({
  toast: toastMock,
  Toaster: toasterMock,
}));

import { ReoToaster, showReoToast } from './toaster';

beforeEach(() => {
  toastFn.mockClear();
  toasterMock.mockClear();
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
  it('renders the recovery action text before the undo icon', () => {
    showReoToast({
      title: '已删除记忆',
      undo: { onUndo: vi.fn() },
    });

    const [, options] = toastFn.mock.calls[0] as unknown as [string, Record<string, unknown>];
    const action = options['action'] as { label: ReactNode };
    const { container } = render(action.label);
    const actionRoot = container.firstElementChild;

    expect(actionRoot?.children[0]).toHaveTextContent('恢复');
    expect(actionRoot?.children[1]?.tagName.toLowerCase()).toBe('svg');
    expect(actionRoot?.children[1]).toHaveClass('h-16', 'w-16');
  });

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
      closeButton: true,
      dismissible: true,
      duration: 3200,
      description: '可在数秒内恢复。',
      onAutoClose,
      onDismiss: onAutoClose,
    });
    expect((options['style'] as Record<string, string>)['--reo-toast-duration']).toBe('3200ms');

    const action = options['action'] as { onClick: () => void };
    action.onClick();
    expect(toastMock.dismiss).toHaveBeenCalledWith('neutral-id');
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onUndo.mock.invocationCallOrder[0]).toBeLessThan(
      toastMock.dismiss.mock.invocationCallOrder[0] ?? 0
    );
  });
});

describe('showReoToast — reo-doctor recovery', () => {
  it('builds a reo-doctor toast with copy text before the 16px copy icon', () => {
    const onCopyPrompt = vi.fn();

    showReoToast({
      type: 'reo-doctor',
      id: 'reo-needs-review:ws_1',
      title: '2个文件需要检查',
      description: '复制提示词给您的Agent',
      onCopyPrompt,
    });

    expect(toastFn).toHaveBeenCalledTimes(1);
    const [title, options] = toastFn.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(title).toBe('2个文件需要检查');
    expect(options).toMatchObject({
      id: 'reo-needs-review:ws_1',
      className: 'reo-doctor-toast',
      closeButton: true,
      dismissible: true,
      duration: Infinity,
      description: '复制提示词给您的Agent',
    });

    const action = options['action'] as { label: ReactNode; onClick: () => void };
    const { container } = render(action.label);
    const actionRoot = container.firstElementChild;

    expect(actionRoot?.children[0]).toHaveTextContent('复制');
    expect(actionRoot?.children[1]?.tagName.toLowerCase()).toBe('svg');
    expect(actionRoot?.children[1]).toHaveClass('h-16', 'w-16');

    action.onClick();
    expect(onCopyPrompt).toHaveBeenCalledTimes(1);
  });

  it('renders copied feedback with confirmation text before a 16px check icon', () => {
    showReoToast({
      type: 'reo-doctor',
      id: 'reo-needs-review:ws_1',
      title: '1个文件需要检查',
      description: '复制提示词给您的Agent',
      onCopyPrompt: vi.fn(),
      copyState: 'copied',
    });

    const [, options] = toastFn.mock.calls[0] as unknown as [string, Record<string, unknown>];
    const action = options['action'] as { label: ReactNode };
    const { container } = render(action.label);
    const actionRoot = container.firstElementChild;

    expect(actionRoot?.children[0]).toHaveTextContent('已复制');
    expect(actionRoot?.children[1]?.tagName.toLowerCase()).toBe('svg');
    expect(actionRoot?.children[1]).toHaveClass('h-16', 'w-16', 'lucide-check');
  });
});

describe('ReoToaster', () => {
  it('uses one top-right close button treatment for every toast surface', () => {
    render(<ReoToaster themeMode="light" />);

    const props = (toasterMock.mock.calls as unknown as Array<[unknown]>)[0]?.[0] as
      | {
          toastOptions?: {
            classNames?: {
              actionButton?: string;
              closeButton?: string;
              content?: string;
              toast?: string;
            };
          };
        }
      | undefined;
    const classNames = props?.toastOptions?.classNames;

    expect(classNames?.toast).toContain('relative');
    expect(classNames?.content).toContain('pr-32');
    expect(classNames?.actionButton).toContain('mr-32');
    expect(classNames?.closeButton).toContain('reo-toast-close');
    expect(classNames?.closeButton).not.toContain('reo-toast-action');
    expect(classNames?.closeButton).toContain('absolute');
    expect(classNames?.closeButton).toContain('right-16');
    expect(classNames?.closeButton).toContain('top-16');
    expect(classNames?.closeButton).toContain('bg-transparent');
    expect(classNames?.closeButton).toContain('hover:bg-transparent');
    expect(classNames?.closeButton).toContain('active:bg-transparent');
    expect(classNames?.closeButton).toContain('focus-visible:bg-transparent');
    expect(classNames?.closeButton).toContain('[&_svg]:h-16');
    expect(classNames?.closeButton).toContain('[&_svg]:w-16');
  });
});

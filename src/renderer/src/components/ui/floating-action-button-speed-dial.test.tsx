import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Camera, Mic, PencilLine, Upload, Video } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import {
  FLOATING_ACTION_BUTTON_SPEED_DIAL_GEOMETRY,
  FloatingActionButtonSpeedDial,
  type FloatingActionButtonSpeedDialAction,
} from './floating-action-button-speed-dial';

const actions: readonly FloatingActionButtonSpeedDialAction[] = [
  { id: 'upload', label: '上传', icon: Upload, disabled: true, disabledLabel: '上传暂不可用' },
  { id: 'video', label: '视频', icon: Video, disabled: true, disabledLabel: '视频暂不可用' },
  { id: 'photo', label: '拍照', icon: Camera, disabled: true, disabledLabel: '拍照暂不可用' },
  { id: 'note', label: '笔记', icon: PencilLine, disabled: true, disabledLabel: '笔记暂不可用' },
  { id: 'recording', label: '录音', icon: Mic, onSelect: vi.fn() },
];

function readPixelOffset(value: string | null, axis: 'left' | 'bottom'): number {
  const pattern = new RegExp(`${axis}: calc\\((-?[0-9.e+-]+)px`);
  const match = value?.match(pattern);

  if (!match?.[1]) {
    throw new Error(`Missing ${axis} pixel offset in style: ${value ?? ''}`);
  }

  return Number(match[1]);
}

describe('FloatingActionButtonSpeedDial', () => {
  it('opens a Reo CTA speed dial and names the upload action cleanly', async () => {
    const user = userEvent.setup();

    render(
      <FloatingActionButtonSpeedDial
        actions={actions}
        closeLabel="关闭表达入口"
        id="workspace-floating-action-button-speed-dial"
        menuLabel="表达方式"
        openLabel="打开表达入口"
      />
    );

    const trigger = screen.getByRole('button', { name: '打开表达入口' });
    expect(document.querySelector('[data-slot="floating-action-button-speed-dial"]')).toHaveClass(
      'pointer-events-none',
      'h-[var(--reo-speed-dial-shell-height)]',
      'max-w-[var(--reo-speed-dial-shell-width)]'
    );
    expect(document.querySelector('[data-slot="floating-action-button-speed-dial"]')).toHaveStyle({
      '--reo-speed-dial-action-size': `${FLOATING_ACTION_BUTTON_SPEED_DIAL_GEOMETRY.actionSize}px`,
      '--reo-speed-dial-diameter': `${FLOATING_ACTION_BUTTON_SPEED_DIAL_GEOMETRY.diameter}px`,
      '--reo-speed-dial-shell-height': `${FLOATING_ACTION_BUTTON_SPEED_DIAL_GEOMETRY.shellHeight}px`,
      '--reo-speed-dial-shell-width': `${FLOATING_ACTION_BUTTON_SPEED_DIAL_GEOMETRY.shellWidth}px`,
    });
    expect(trigger).toHaveClass(
      '!bg-signal-blue',
      '!rounded-full',
      '!size-[var(--reo-speed-dial-diameter)]'
    );
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute(
      'aria-controls',
      'workspace-floating-action-button-speed-dial-menu'
    );
    expect(screen.queryByRole('menuitem', { name: '录音' })).not.toBeInTheDocument();

    await user.click(trigger);

    expect(screen.getByRole('button', { name: '关闭表达入口' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('button', { name: '关闭表达入口' })).toHaveClass(
      '!size-[var(--reo-speed-dial-diameter)]'
    );
    expect(screen.getByRole('menu', { name: '表达方式' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '录音' })).toHaveClass(
      'size-[var(--reo-speed-dial-action-size)]',
      'hover:bg-obsidian',
      'hover:text-on-accent'
    );
    expect(screen.getByRole('menuitem', { name: '录音' }).tagName).toBe('A');
    expect(screen.getByRole('menuitem', { name: '录音' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('menuitem', { name: '录音' })).not.toHaveAttribute('href', '#');
    expect(screen.getByRole('menu', { name: '表达方式' })).toHaveClass('!transition-opacity');
    expect(document.querySelector('[data-pc-section="menuitem"]')).toHaveClass(
      '!transition-[transform,opacity]'
    );
    expect(document.querySelector('a[href="#"]')).not.toBeInTheDocument();
    expect(screen.queryByText('笔记')).not.toBeInTheDocument();
    expect(screen.queryByText('拍照')).not.toBeInTheDocument();
    expect(screen.queryByText('视频')).not.toBeInTheDocument();
    expect(screen.queryByText('上传')).not.toBeInTheDocument();
    expect(
      document.querySelectorAll(
        '[data-slot="floating-action-button-speed-dial-action-unavailable"]'
      )
    ).toHaveLength(4);
    expect(screen.getByRole('menuitem', { name: '笔记暂不可用' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByRole('menuitem', { name: '上传暂不可用' })).toHaveClass(
      'cursor-default',
      'size-[var(--reo-speed-dial-action-size)]',
      'focus-visible:ring-2',
      'p-disabled'
    );
    expect(screen.queryByRole('menuitem', { name: '上传图片' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-pc-section="menuitem"]')).toHaveAttribute(
      'style',
      expect.stringContaining(`${FLOATING_ACTION_BUTTON_SPEED_DIAL_GEOMETRY.radius}px`)
    );
    expect(
      document.querySelectorAll(
        '[data-slot="floating-action-button-speed-dial-action-unavailable"] svg'
      )
    ).toHaveLength(4);

    const actionMenuItems = screen.getAllByRole('menuitem');
    expect(actionMenuItems).toHaveLength(5);
    expect(
      Array.from(document.querySelectorAll('[data-pc-section="menuitem"]')).every(
        (menuItem) => menuItem.getAttribute('role') === 'none'
      )
    ).toBe(true);
  });

  it('keeps the semi-circle geometry centered in measured pixels', async () => {
    const user = userEvent.setup();

    render(
      <FloatingActionButtonSpeedDial
        actions={actions}
        closeLabel="关闭表达入口"
        id="workspace-floating-action-button-speed-dial"
        menuLabel="表达方式"
        openLabel="打开表达入口"
      />
    );

    await user.click(screen.getByRole('button', { name: '打开表达入口' }));

    const menuItems = Array.from(document.querySelectorAll('[data-pc-section="menuitem"]'));
    const offsets = menuItems.map((item) => ({
      label: item.querySelector('[role="menuitem"]')?.getAttribute('aria-label'),
      x: readPixelOffset(item.getAttribute('style'), 'left'),
      y: readPixelOffset(item.getAttribute('style'), 'bottom'),
    }));

    expect(offsets).toHaveLength(5);
    const radius = FLOATING_ACTION_BUTTON_SPEED_DIAL_GEOMETRY.radius;
    const diagonal = Math.sqrt((radius * radius) / 2);
    const [upload, video, photo, note, recording] = offsets;
    if (!upload || !video || !photo || !note || !recording) {
      throw new Error('SpeedDial should render five positioned actions.');
    }

    expect(upload).toEqual({ label: '上传暂不可用', x: radius, y: 0 });
    expect(Math.abs(video.x - diagonal)).toBeLessThan(0.1);
    expect(Math.abs(video.y - diagonal)).toBeLessThan(0.1);
    expect(video.label).toBe('视频暂不可用');
    expect(Math.abs(photo.x)).toBeLessThan(0.1);
    expect(photo.y).toBe(radius);
    expect(photo.label).toBe('拍照暂不可用');
    expect(Math.abs(note.x + video.x)).toBeLessThan(0.1);
    expect(Math.abs(note.y - video.y)).toBeLessThan(0.1);
    expect(note.label).toBe('笔记暂不可用');
    expect(recording.x).toBe(-radius);
    expect(Math.abs(recording.y)).toBeLessThan(0.1);
    expect(recording.label).toBe('录音');
  });

  it('keeps hidden action controls out of the tab order while closed', async () => {
    const user = userEvent.setup();

    render(
      <FloatingActionButtonSpeedDial
        actions={actions}
        closeLabel="关闭表达入口"
        id="workspace-floating-action-button-speed-dial"
        menuLabel="表达方式"
        openLabel="打开表达入口"
      />
    );

    const trigger = screen.getByRole('button', { name: '打开表达入口' });

    expect(
      Array.from(
        document.querySelectorAll('[data-slot="floating-action-button-speed-dial-action-active"]')
      ).every((action) => action.getAttribute('tabindex') === '-1')
    ).toBe(true);

    await user.click(trigger);
    expect(screen.getByRole('menuitem', { name: '录音' })).toHaveAttribute('tabindex', '0');
    await user.click(screen.getByRole('menuitem', { name: '录音' }));

    expect(
      Array.from(
        document.querySelectorAll('[data-slot="floating-action-button-speed-dial-action-active"]')
      ).every((action) => action.getAttribute('tabindex') === '-1')
    ).toBe(true);
  });

  it('selects an action and closes the dial', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <FloatingActionButtonSpeedDial
        actions={[{ id: 'recording', label: '录音', icon: Mic, onSelect }]}
        closeLabel="关闭表达入口"
        menuLabel="表达方式"
        openLabel="打开表达入口"
      />
    );

    await user.click(screen.getByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '打开表达入口' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByRole('menuitem', { name: '录音' })).not.toBeInTheDocument();
  });

  it('supports keyboard activation for the executable action', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <FloatingActionButtonSpeedDial
        actions={[{ id: 'recording', label: '录音', icon: Mic, onSelect }]}
        closeLabel="关闭表达入口"
        menuLabel="表达方式"
        openLabel="打开表达入口"
      />
    );

    await user.click(screen.getByRole('button', { name: '打开表达入口' }));
    screen.getByRole('menuitem', { name: '录音' }).focus();
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '打开表达入口' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('keeps unavailable action buttons inert and supports Escape close', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <FloatingActionButtonSpeedDial
        actions={[
          { id: 'recording', label: '录音', icon: Mic, onSelect },
          {
            id: 'note',
            label: '笔记',
            icon: PencilLine,
            disabled: true,
            disabledLabel: '笔记暂不可用',
          },
        ]}
        closeLabel="关闭表达入口"
        menuLabel="表达方式"
        openLabel="打开表达入口"
      />
    );

    const trigger = screen.getByRole('button', { name: '打开表达入口' });

    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: '笔记暂不可用' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '关闭表达入口' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    await user.keyboard('{Escape}');

    const closedTrigger = screen.getByRole('button', { name: '打开表达入口' });
    expect(closedTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(closedTrigger).toHaveFocus();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '@/components/ui/toaster';
import {
  expectNoRenderedRawPath,
  installWorkspaceBridgeForEntityActionTests,
  openEntityActionMenu,
} from './entityActionMenuTestHelpers';
import { SegmentActionsMenu } from './SegmentActionsMenu';

vi.mock('@/components/ui/toaster', () => {
  const toast = Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  });

  const showReoToast = (input: {
    readonly type?: string;
    readonly title: string;
    readonly description?: string;
  }) => {
    const fn =
      input.type === 'success' ? toast.success : input.type === 'error' ? toast.error : toast;
    return input.description === undefined
      ? fn(input.title)
      : fn(input.title, { description: input.description });
  };

  return { toast, showReoToast, ReoToaster: () => null };
});

const reoWorkspace = {
  copySegmentAbsolutePath: vi.fn(),
  copySegmentRelativePath: vi.fn(),
  openSegmentDocument: vi.fn(),
  revealSegmentInFinder: vi.fn(),
};

const segmentActionPayload = {
  memoryId: 'mem-1',
  segmentId: 'seg-1',
  workspaceHandle: 'handle-1',
  workspaceId: 'wsp-1',
};

function renderMenu(
  props: {
    onDelete?: () => void;
    onRename?: () => void;
    onRequestTranscriptionBackfill?: () => void;
    transcriptExists?: boolean;
    transcriptionBackfillDisabledReason?: string | null;
  } = {}
) {
  render(
    <SegmentActionsMenu
      actionIdentity={segmentActionPayload}
      onDelete={props.onDelete ?? vi.fn()}
      onRequestTranscriptionBackfill={props.onRequestTranscriptionBackfill}
      onRename={props.onRename ?? vi.fn()}
      segmentTitle="My Segment"
      transcriptExists={props.transcriptExists ?? false}
      transcriptionBackfillDisabledReason={props.transcriptionBackfillDisabledReason ?? null}
    />
  );
}

describe('SegmentActionsMenu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installWorkspaceBridgeForEntityActionTests(reoWorkspace);
    reoWorkspace.copySegmentAbsolutePath.mockResolvedValue({ ok: true });
    reoWorkspace.copySegmentRelativePath.mockResolvedValue({ ok: true });
    reoWorkspace.openSegmentDocument.mockResolvedValue({ ok: true });
    reoWorkspace.revealSegmentInFinder.mockResolvedValue({ ok: true });
  });

  it('supports a custom controlled trigger without changing menu actions', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onOpenChange = vi.fn();
    const onRename = vi.fn();
    const { rerender } = render(
      <SegmentActionsMenu
        actionIdentity={segmentActionPayload}
        contentAlign="start"
        onDelete={onDelete}
        onOpenChange={onOpenChange}
        onRename={onRename}
        open={false}
        segmentTitle="My Segment"
        trigger={
          <button type="button" aria-label="My Segment card actions" className="custom-trigger">
            <span>More</span>
          </button>
        }
        triggerLabel="My Segment card actions"
      />
    );

    const trigger = screen.getByRole('button', { name: 'My Segment card actions' });
    expect(trigger).toHaveClass('custom-trigger');
    expect(trigger).toHaveTextContent('More');
    expect(trigger.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('button', { name: 'My Segment 更多操作' })).not.toBeInTheDocument();

    await user.click(trigger);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    rerender(
      <SegmentActionsMenu
        actionIdentity={segmentActionPayload}
        contentAlign="start"
        onDelete={onDelete}
        onOpenChange={onOpenChange}
        onRename={onRename}
        open
        segmentTitle="My Segment"
        trigger={
          <button type="button" aria-label="My Segment card actions" className="custom-trigger">
            <span>More</span>
          </button>
        }
        triggerLabel="My Segment card actions"
      />
    );

    expect(
      await screen.findByRole('menu', { name: 'My Segment card actions' })
    ).toBeInTheDocument();
  });

  it('opens the segment document without showing a success toast', async () => {
    renderMenu();

    const { user } = await openEntityActionMenu('My Segment 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '用默认应用打开' }));

    expect(reoWorkspace.openSegmentDocument).toHaveBeenCalledWith(segmentActionPayload);
    await waitFor(() => expect(toast.success).not.toHaveBeenCalled());
  });

  it('shows an error toast when reveal in Finder fails', async () => {
    reoWorkspace.revealSegmentInFinder.mockResolvedValueOnce({
      error: { code: 'ERR_WORKSPACE_SEGMENT_NOT_FOUND', message: '片段不存在' },
      ok: false,
    });
    renderMenu();

    const { user } = await openEntityActionMenu('My Segment 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '在访达中显示' }));

    expect(reoWorkspace.revealSegmentInFinder).toHaveBeenCalledWith(segmentActionPayload);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('找不到这个片段。'));
  });

  it('copies the relative path with a success toast', async () => {
    renderMenu();

    const { user } = await openEntityActionMenu('My Segment 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '复制相对路径' }));

    expect(reoWorkspace.copySegmentRelativePath).toHaveBeenCalledWith(segmentActionPayload);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('已复制路径'));
    expectNoRenderedRawPath();
  });

  it('copies the absolute path with a success toast without rendering the raw path', async () => {
    renderMenu();

    const { user } = await openEntityActionMenu('My Segment 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '复制绝对路径' }));

    expect(reoWorkspace.copySegmentAbsolutePath).toHaveBeenCalledWith(segmentActionPayload);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('已复制路径'));
    expectNoRenderedRawPath();
  });

  it('invokes rename and delete callbacks', async () => {
    const onDelete = vi.fn();
    const onRename = vi.fn();
    renderMenu({ onDelete, onRename });

    const { user } = await openEntityActionMenu('My Segment 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '重命名' }));
    expect(onRename).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'My Segment 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('shows the generate transcript action when the segment has no transcript', async () => {
    const onRequestTranscriptionBackfill = vi.fn();
    renderMenu({ onRequestTranscriptionBackfill, transcriptExists: false });

    const { user } = await openEntityActionMenu('My Segment 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '生成转录' }));

    expect(onRequestTranscriptionBackfill).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menuitem', { name: '重新生成转录' })).not.toBeInTheDocument();
  });

  it('shows the regenerate transcript action when the segment already has a transcript', async () => {
    const onRequestTranscriptionBackfill = vi.fn();
    renderMenu({ onRequestTranscriptionBackfill, transcriptExists: true });

    const { user } = await openEntityActionMenu('My Segment 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '重新生成转录' }));

    expect(onRequestTranscriptionBackfill).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menuitem', { name: '生成转录' })).not.toBeInTheDocument();
  });

  it('disables the transcript action with tooltip copy when backfill is unavailable', async () => {
    renderMenu({
      onRequestTranscriptionBackfill: vi.fn(),
      transcriptExists: false,
      transcriptionBackfillDisabledReason: '先在设置里启用并填写 X-Api-Key',
    });

    const { user } = await openEntityActionMenu('My Segment 更多操作');
    const item = screen.getByRole('menuitem', { name: '生成转录' });

    expect(item).toHaveAttribute('aria-disabled', 'true');
    await user.hover(item);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('先在设置里启用并填写 X-Api-Key');
    await user.click(item);
    expect(reoWorkspace.copySegmentAbsolutePath).not.toHaveBeenCalled();
  });
});

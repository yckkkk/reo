import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installWorkspaceBridgeForEntityActionTests,
  openEntityActionMenu,
} from './entityActionMenuTestHelpers';
import { SegmentContentActionsMenu } from './SegmentContentActionsMenu';
import type { VoiceSpeechSynthesisSpeaker } from '../voiceSpeechSynthesisSpeakers';

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
    contentKind?: 'body' | 'transcript';
    clearDisabled?: boolean;
    onClear?: () => void;
    onRequestSpeechSynthesis?: (speaker: VoiceSpeechSynthesisSpeaker) => void;
    onRequestTranscriptionBackfill?: () => void;
    onRename?: () => void;
    speechSynthesisDisabledReason?: string | null;
    transcriptExists?: boolean;
    transcriptionBackfillDisabledReason?: string | null;
  } = {}
) {
  render(
    <SegmentContentActionsMenu
      actionIdentity={segmentActionPayload}
      {...(props.clearDisabled === undefined ? {} : { clearDisabled: props.clearDisabled })}
      contentKind={props.contentKind ?? 'transcript'}
      menuLabel="转录 更多操作"
      onClear={props.onClear ?? vi.fn()}
      onRequestSpeechSynthesis={props.onRequestSpeechSynthesis}
      onRequestTranscriptionBackfill={props.onRequestTranscriptionBackfill}
      onRename={props.onRename ?? vi.fn()}
      speechSynthesisDisabledReason={props.speechSynthesisDisabledReason ?? null}
      transcriptExists={props.transcriptExists ?? false}
      transcriptionBackfillDisabledReason={props.transcriptionBackfillDisabledReason ?? null}
    />
  );
}

describe('SegmentContentActionsMenu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installWorkspaceBridgeForEntityActionTests(reoWorkspace);
    reoWorkspace.copySegmentAbsolutePath.mockResolvedValue({ ok: true });
    reoWorkspace.copySegmentRelativePath.mockResolvedValue({ ok: true });
    reoWorkspace.openSegmentDocument.mockResolvedValue({ ok: true });
    reoWorkspace.revealSegmentInFinder.mockResolvedValue({ ok: true });
  });

  it('shows path, transcript generation, rename, and clear actions for a primary transcript tab', async () => {
    const onClear = vi.fn();
    const onRename = vi.fn();
    const onRequestTranscriptionBackfill = vi.fn();
    renderMenu({ onClear, onRename, onRequestTranscriptionBackfill });

    const { user } = await openEntityActionMenu('转录 更多操作');
    screen.getByRole('menu', { name: '转录 更多操作' });

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      '用默认应用打开',
      '在访达中显示',
      '复制相对路径',
      '复制绝对路径',
      '生成转录',
      '重命名',
      '清空转录',
    ]);
    expect(screen.queryByRole('menuitem', { name: '编辑转录' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '重新生成转录' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '删除' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: '生成转录' }));
    expect(onRequestTranscriptionBackfill).toHaveBeenCalledOnce();

    await openEntityActionMenu('转录 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '重命名' }));
    expect(onRename).toHaveBeenCalledOnce();

    await openEntityActionMenu('转录 更多操作');
    await user.click(screen.getByRole('menuitem', { name: '清空转录' }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('uses body copy for a primary body tab', async () => {
    renderMenu({ contentKind: 'body' });

    await openEntityActionMenu('转录 更多操作');

    expect(screen.getByRole('menuitem', { name: '清空正文' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '编辑正文' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '编辑转录' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '清空转录' })).not.toBeInTheDocument();
  });

  it('requests primary body speech synthesis from the speaker submenu', async () => {
    const onRequestSpeechSynthesis = vi.fn();
    renderMenu({ contentKind: 'body', onRequestSpeechSynthesis });

    const { user } = await openEntityActionMenu('转录 更多操作');
    const item = screen.getByRole('menuitem', { name: '生成/重新生成语音' });
    await user.click(item);
    fireEvent.click(await screen.findByRole('menuitem', { name: '少年梓辛' }));

    expect(onRequestSpeechSynthesis).toHaveBeenCalledWith('zh_male_shaonianzixin_uranus_bigtts');
    expect(screen.queryByRole('menuitem', { name: '重新生成语音' })).not.toBeInTheDocument();
  });

  it('disables clear while the primary content has not loaded', async () => {
    const onClear = vi.fn();
    const onRename = vi.fn();
    renderMenu({ clearDisabled: true, onClear, onRename });

    const { user } = await openEntityActionMenu('转录 更多操作');

    const clearItem = screen.getByRole('menuitem', { name: '清空转录' });
    expect(screen.queryByRole('menuitem', { name: '编辑转录' })).not.toBeInTheDocument();
    expect(clearItem).toHaveAttribute('data-disabled');
    expect(clearItem).toHaveClass('text-destructive');

    await user.click(clearItem);
    expect(onClear).not.toHaveBeenCalled();

    await user.click(screen.getByRole('menuitem', { name: '重命名' }));
    expect(onRename).toHaveBeenCalledOnce();
  });
});

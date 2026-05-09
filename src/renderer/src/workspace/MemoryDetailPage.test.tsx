import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReoQueryProvider } from '@/queryClient';
import { MemoryDetailPage } from './MemoryDetailPage';

describe('MemoryDetailPage', () => {
  const reoWorkspace = {
    getMemoryDetail: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(window, 'reoWorkspace', {
      configurable: true,
      value: reoWorkspace,
    });
  });

  it('renders memory detail from file-backed memory detail data', async () => {
    reoWorkspace.getMemoryDetail.mockResolvedValue({
      ok: true,
      value: {
        memoryId: 'mem_birthday',
        title: 'My seventh birthday',
        createdAt: '2026-04-12T09:00:00.000Z',
        updatedAt: '2026-04-12T09:10:00.000Z',
        assetIds: ['rec_1', 'rec_2'],
        assetCount: 2,
        recordingsTruncated: false,
        hasTranscript: true,
        hasReflections: false,
        recordings: [
          {
            recordingId: 'rec_1',
            title: 'Birthday_summary_01',
            durationMs: 135_000,
            audioByteLength: 4096,
          },
          {
            recordingId: 'rec_2',
            title: 'Birthday_summary_02',
            durationMs: 45_000,
            audioByteLength: 1024,
          },
        ],
      },
    });

    render(
      <ReoQueryProvider>
        <MemoryDetailPage
          memoryId="mem_birthday"
          workspaceHandle="workspace-handle-secret"
          workspaceId="ws_1"
          onBack={vi.fn()}
          onRecordMemory={vi.fn()}
        />
      </ReoQueryProvider>
    );

    expect(await screen.findByRole('heading', { name: 'My seventh birthday' })).toBeInTheDocument();
    expect(screen.getByText('2026年4月12日')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '继续记录' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '语音录音' })).toBeInTheDocument();
    expect(screen.getByText('Birthday_summary_01')).toBeInTheDocument();
    expect(screen.getByText('2 分 15 秒')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '转写' })).toBeInTheDocument();
    expect(screen.getByText('已保存转写。')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '反思' })).toBeInTheDocument();
    expect(screen.getByText('还没有保存反思。')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '记忆内容' })).toBeInTheDocument();
    expect(reoWorkspace.getMemoryDetail).toHaveBeenCalledWith({
      workspaceHandle: 'workspace-handle-secret',
      memoryId: 'mem_birthday',
    });
  });

  it('keeps future More actions out of the clickable runtime surface', async () => {
    reoWorkspace.getMemoryDetail.mockResolvedValue({
      ok: true,
      value: {
        memoryId: 'mem_birthday',
        title: 'My seventh birthday',
        createdAt: '2026-04-12T09:00:00.000Z',
        updatedAt: '2026-04-12T09:10:00.000Z',
        assetIds: [],
        assetCount: 0,
        recordingsTruncated: false,
        hasTranscript: false,
        hasReflections: false,
        recordings: [],
      },
    });

    render(
      <ReoQueryProvider>
        <MemoryDetailPage
          memoryId="mem_birthday"
          workspaceHandle="workspace-handle-secret"
          workspaceId="ws_1"
          onBack={vi.fn()}
          onRecordMemory={vi.fn()}
        />
      </ReoQueryProvider>
    );

    expect(await screen.findByRole('heading', { name: 'My seventh birthday' })).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: /rename|delete|show in folder|export/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more|delete memory/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/films|photo|video|file|AI/i)).not.toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  WorkspaceMemoryEntityActionRequest,
  WorkspaceMemorySpaceEntityActionRequest,
  WorkspaceSegmentEntityActionRequest,
  WorkspaceSegmentSupplementEntityActionRequest,
} from '../../../workspace-contract/workspace-contract';
import {
  bindMemoryEntityActions,
  bindMemorySpaceEntityActions,
  bindSegmentEntityActions,
  bindSegmentSupplementEntityActions,
} from './entityActionBindings';
import {
  copyMemoryAbsolutePath,
  copyMemoryRelativePath,
  copyMemorySpaceAbsolutePath,
  copySegmentAbsolutePath,
  copySegmentRelativePath,
  copySegmentSupplementAbsolutePath,
  copySegmentSupplementRelativePath,
  openMemoryDocument,
  openMemorySpaceAgentsFile,
  openSegmentDocument,
  openSegmentSupplementDocument,
  revealMemoryInFinder,
  revealMemorySpaceInFinder,
  revealSegmentInFinder,
  revealSegmentSupplementInFinder,
} from './workspaceApi';

vi.mock('./workspaceApi', () => ({
  copyMemoryAbsolutePath: vi.fn(),
  copyMemoryRelativePath: vi.fn(),
  copyMemorySpaceAbsolutePath: vi.fn(),
  copySegmentAbsolutePath: vi.fn(),
  copySegmentRelativePath: vi.fn(),
  copySegmentSupplementAbsolutePath: vi.fn(),
  copySegmentSupplementRelativePath: vi.fn(),
  openMemoryDocument: vi.fn(),
  openMemorySpaceAgentsFile: vi.fn(),
  openSegmentDocument: vi.fn(),
  openSegmentSupplementDocument: vi.fn(),
  revealMemoryInFinder: vi.fn(),
  revealMemorySpaceInFinder: vi.fn(),
  revealSegmentInFinder: vi.fn(),
  revealSegmentSupplementInFinder: vi.fn(),
}));

const okResponse = Promise.resolve({ ok: true as const });

describe('entityActionBindings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('maps Memory Space actions to workspace API wrappers', () => {
    const payload = {
      workspaceId: 'wsp-1',
    } satisfies WorkspaceMemorySpaceEntityActionRequest;
    vi.mocked(openMemorySpaceAgentsFile).mockReturnValue(okResponse);
    vi.mocked(revealMemorySpaceInFinder).mockReturnValue(okResponse);
    vi.mocked(copyMemorySpaceAbsolutePath).mockReturnValue(okResponse);

    const actions = bindMemorySpaceEntityActions(payload);

    expect(actions.onOpenDefault()).toBe(okResponse);
    expect(actions.onRevealInFinder()).toBe(okResponse);
    expect(actions.onCopyAbsolutePath()).toBe(okResponse);
    expect(actions.onCopyRelativePath).toBeUndefined();
    expect(openMemorySpaceAgentsFile).toHaveBeenCalledWith(payload);
    expect(revealMemorySpaceInFinder).toHaveBeenCalledWith(payload);
    expect(copyMemorySpaceAbsolutePath).toHaveBeenCalledWith(payload);
  });

  it('maps Memory actions to workspace API wrappers', () => {
    const payload = {
      memoryId: 'mem-1',
      workspaceHandle: 'handle-1',
      workspaceId: 'wsp-1',
    } satisfies WorkspaceMemoryEntityActionRequest;
    vi.mocked(openMemoryDocument).mockReturnValue(okResponse);
    vi.mocked(revealMemoryInFinder).mockReturnValue(okResponse);
    vi.mocked(copyMemoryRelativePath).mockReturnValue(okResponse);
    vi.mocked(copyMemoryAbsolutePath).mockReturnValue(okResponse);

    const actions = bindMemoryEntityActions(payload);

    expect(actions.onOpenDefault()).toBe(okResponse);
    expect(actions.onRevealInFinder()).toBe(okResponse);
    expect(actions.onCopyRelativePath?.()).toBe(okResponse);
    expect(actions.onCopyAbsolutePath()).toBe(okResponse);
    expect(openMemoryDocument).toHaveBeenCalledWith(payload);
    expect(revealMemoryInFinder).toHaveBeenCalledWith(payload);
    expect(copyMemoryRelativePath).toHaveBeenCalledWith(payload);
    expect(copyMemoryAbsolutePath).toHaveBeenCalledWith(payload);
  });

  it('maps Segment actions to workspace API wrappers', () => {
    const payload = {
      memoryId: 'mem-1',
      segmentId: 'seg-1',
      workspaceHandle: 'handle-1',
      workspaceId: 'wsp-1',
    } satisfies WorkspaceSegmentEntityActionRequest;
    vi.mocked(openSegmentDocument).mockReturnValue(okResponse);
    vi.mocked(revealSegmentInFinder).mockReturnValue(okResponse);
    vi.mocked(copySegmentRelativePath).mockReturnValue(okResponse);
    vi.mocked(copySegmentAbsolutePath).mockReturnValue(okResponse);

    const actions = bindSegmentEntityActions(payload);

    expect(actions.onOpenDefault()).toBe(okResponse);
    expect(actions.onRevealInFinder()).toBe(okResponse);
    expect(actions.onCopyRelativePath?.()).toBe(okResponse);
    expect(actions.onCopyAbsolutePath()).toBe(okResponse);
    expect(openSegmentDocument).toHaveBeenCalledWith(payload);
    expect(revealSegmentInFinder).toHaveBeenCalledWith(payload);
    expect(copySegmentRelativePath).toHaveBeenCalledWith(payload);
    expect(copySegmentAbsolutePath).toHaveBeenCalledWith(payload);
  });

  it('maps SegmentSupplement actions to workspace API wrappers', () => {
    const payload = {
      memoryId: 'mem-1',
      segmentId: 'seg-1',
      supplementId: 'sup-1',
      workspaceHandle: 'handle-1',
      workspaceId: 'wsp-1',
    } satisfies WorkspaceSegmentSupplementEntityActionRequest;
    vi.mocked(openSegmentSupplementDocument).mockReturnValue(okResponse);
    vi.mocked(revealSegmentSupplementInFinder).mockReturnValue(okResponse);
    vi.mocked(copySegmentSupplementRelativePath).mockReturnValue(okResponse);
    vi.mocked(copySegmentSupplementAbsolutePath).mockReturnValue(okResponse);

    const actions = bindSegmentSupplementEntityActions(payload);

    expect(actions.onOpenDefault()).toBe(okResponse);
    expect(actions.onRevealInFinder()).toBe(okResponse);
    expect(actions.onCopyRelativePath?.()).toBe(okResponse);
    expect(actions.onCopyAbsolutePath()).toBe(okResponse);
    expect(openSegmentSupplementDocument).toHaveBeenCalledWith(payload);
    expect(revealSegmentSupplementInFinder).toHaveBeenCalledWith(payload);
    expect(copySegmentSupplementRelativePath).toHaveBeenCalledWith(payload);
    expect(copySegmentSupplementAbsolutePath).toHaveBeenCalledWith(payload);
  });
});

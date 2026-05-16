import type {
  WorkspaceMemoryEntityActionRequest,
  WorkspaceMemorySpaceEntityActionRequest,
  WorkspaceSegmentEntityActionRequest,
  WorkspaceSegmentSupplementEntityActionRequest,
} from '../../../workspace-contract/workspace-contract';
import type { EntityActionMenuProps } from './entityActionMenu';
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

type EntityActionBindings = Pick<
  EntityActionMenuProps,
  'onCopyAbsolutePath' | 'onCopyRelativePath' | 'onOpenDefault' | 'onRevealInFinder'
>;

export function bindMemorySpaceEntityActions(
  actionIdentity: WorkspaceMemorySpaceEntityActionRequest
): EntityActionBindings {
  return {
    onCopyAbsolutePath: () => copyMemorySpaceAbsolutePath(actionIdentity),
    onOpenDefault: () => openMemorySpaceAgentsFile(actionIdentity),
    onRevealInFinder: () => revealMemorySpaceInFinder(actionIdentity),
  };
}

export function bindMemoryEntityActions(
  actionIdentity: WorkspaceMemoryEntityActionRequest
): EntityActionBindings {
  return {
    onCopyAbsolutePath: () => copyMemoryAbsolutePath(actionIdentity),
    onCopyRelativePath: () => copyMemoryRelativePath(actionIdentity),
    onOpenDefault: () => openMemoryDocument(actionIdentity),
    onRevealInFinder: () => revealMemoryInFinder(actionIdentity),
  };
}

export function bindSegmentEntityActions(
  actionIdentity: WorkspaceSegmentEntityActionRequest
): EntityActionBindings {
  return {
    onCopyAbsolutePath: () => copySegmentAbsolutePath(actionIdentity),
    onCopyRelativePath: () => copySegmentRelativePath(actionIdentity),
    onOpenDefault: () => openSegmentDocument(actionIdentity),
    onRevealInFinder: () => revealSegmentInFinder(actionIdentity),
  };
}

export function bindSegmentSupplementEntityActions(
  actionIdentity: WorkspaceSegmentSupplementEntityActionRequest
): EntityActionBindings {
  return {
    onCopyAbsolutePath: () => copySegmentSupplementAbsolutePath(actionIdentity),
    onCopyRelativePath: () => copySegmentSupplementRelativePath(actionIdentity),
    onOpenDefault: () => openSegmentSupplementDocument(actionIdentity),
    onRevealInFinder: () => revealSegmentSupplementInFinder(actionIdentity),
  };
}

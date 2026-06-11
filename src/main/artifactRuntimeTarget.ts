import {
  resolveFinalizedArtifactSegmentDirectoryFromManifest,
  resolveFinalizedArtifactSegmentSupplementDirectoryFromManifest,
} from './memoryFiles.js';
import { resolveHomeComponentDirectoryFromFileTruth } from './homeComponents.js';
import { resolveWorkspaceWidgetDirectoryFromFileTruth } from './workspaceWidgets.js';

export type ArtifactRuntimeTarget =
  | {
      readonly targetType: 'segment';
      readonly workspaceId: string;
      readonly memoryId: string;
      readonly segmentId: string;
    }
  | {
      readonly targetType: 'supplement';
      readonly workspaceId: string;
      readonly memoryId: string;
      readonly segmentId: string;
      readonly supplementId: string;
    }
  | {
      readonly targetType: 'widget';
      readonly workspaceId: string;
      readonly widgetId: string;
    }
  | {
      readonly targetType: 'home-component';
      readonly componentId: string;
    };

export async function resolveArtifactRuntimeTargetDirectory({
  rootPath,
  target,
}: {
  readonly rootPath: string;
  readonly target: ArtifactRuntimeTarget;
}): Promise<string> {
  if (target.targetType === 'segment') {
    const resolved = await resolveFinalizedArtifactSegmentDirectoryFromManifest({
      rootPath,
      workspaceId: target.workspaceId,
      segmentId: target.segmentId,
    });
    if (resolved.memoryId !== target.memoryId) {
      throw new Error('Artifact segment runtime target does not match memory');
    }
    return resolved.segmentDirectory;
  }

  if (target.targetType === 'widget') {
    return resolveWorkspaceWidgetDirectoryFromFileTruth({
      rootPath,
      workspaceId: target.workspaceId,
      widgetId: target.widgetId,
    });
  }

  if (target.targetType === 'home-component') {
    return resolveHomeComponentDirectoryFromFileTruth({
      appDataRootPath: rootPath,
      componentId: target.componentId,
    });
  }

  const resolved = await resolveFinalizedArtifactSegmentSupplementDirectoryFromManifest({
    rootPath,
    workspaceId: target.workspaceId,
    segmentId: target.segmentId,
    supplementId: target.supplementId,
  });
  if (resolved.memoryId !== target.memoryId || resolved.segmentId !== target.segmentId) {
    throw new Error('Artifact supplement runtime target does not match parent');
  }
  return resolved.supplementDirectory;
}

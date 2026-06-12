import {
  resolveFinalizedArtifactSegmentDirectoryFromManifest,
  resolveFinalizedArtifactSegmentSupplementDirectoryFromManifest,
} from './memoryFiles.js';
import { resolveHomeComponentDirectoryFromFileTruth } from './homeComponents.js';
import { resolveWorkspaceWidgetDirectoryFromFileTruth } from './workspaceWidgets.js';
import type { ArtifactRequestTarget } from './artifactUrl.js';

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

type ArtifactRuntimeDirectoryTarget =
  | {
      readonly targetType: 'segment';
      readonly workspaceId: string;
      readonly segmentId: string;
    }
  | {
      readonly targetType: 'supplement';
      readonly workspaceId: string;
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

type ArtifactRuntimeProtocolTarget = Exclude<ArtifactRequestTarget, { readonly kind: 'vendor' }>;
type ArtifactRuntimeWorkspaceProtocolTarget = Exclude<
  ArtifactRuntimeProtocolTarget,
  { readonly kind: 'home-component' }
>;
type ArtifactRuntimeHomeComponentProtocolTarget = Extract<
  ArtifactRuntimeProtocolTarget,
  { readonly kind: 'home-component' }
>;

type ResolveArtifactRuntimeProtocolTargetDirectoryOptions =
  | {
      readonly rootPath: string;
      readonly target: ArtifactRuntimeWorkspaceProtocolTarget;
    }
  | {
      readonly appDataRootPath: string;
      readonly target: ArtifactRuntimeHomeComponentProtocolTarget;
    };

type ArtifactRuntimeTargetDirectoryResolution =
  | {
      readonly targetType: 'segment';
      readonly directory: string;
      readonly memoryId: string;
      readonly segmentId: string;
    }
  | {
      readonly targetType: 'supplement';
      readonly directory: string;
      readonly memoryId: string;
      readonly segmentId: string;
      readonly supplementId: string;
    }
  | {
      readonly targetType: 'widget';
      readonly directory: string;
    }
  | {
      readonly targetType: 'home-component';
      readonly directory: string;
    };

async function resolveArtifactRuntimeTargetDirectoryWithManifestOwner({
  rootPath,
  target,
}: {
  readonly rootPath: string;
  readonly target: ArtifactRuntimeDirectoryTarget;
}): Promise<ArtifactRuntimeTargetDirectoryResolution> {
  if (target.targetType === 'segment') {
    const resolved = await resolveFinalizedArtifactSegmentDirectoryFromManifest({
      rootPath,
      workspaceId: target.workspaceId,
      segmentId: target.segmentId,
    });
    return {
      targetType: 'segment',
      directory: resolved.segmentDirectory,
      memoryId: resolved.memoryId,
      segmentId: target.segmentId,
    };
  }

  if (target.targetType === 'widget') {
    return {
      targetType: 'widget',
      directory: await resolveWorkspaceWidgetDirectoryFromFileTruth({
        rootPath,
        workspaceId: target.workspaceId,
        widgetId: target.widgetId,
      }),
    };
  }

  if (target.targetType === 'home-component') {
    return {
      targetType: 'home-component',
      directory: await resolveHomeComponentDirectoryFromFileTruth({
        appDataRootPath: rootPath,
        componentId: target.componentId,
      }),
    };
  }

  const resolved = await resolveFinalizedArtifactSegmentSupplementDirectoryFromManifest({
    rootPath,
    workspaceId: target.workspaceId,
    segmentId: target.segmentId,
    supplementId: target.supplementId,
  });
  return {
    targetType: 'supplement',
    directory: resolved.supplementDirectory,
    memoryId: resolved.memoryId,
    segmentId: resolved.segmentId,
    supplementId: target.supplementId,
  };
}

function artifactRuntimeDirectoryTargetFromProtocolTarget(
  target: ArtifactRuntimeProtocolTarget
): ArtifactRuntimeDirectoryTarget {
  if (target.kind === 'home-component') {
    return { targetType: 'home-component', componentId: target.componentId };
  }
  if (target.kind === 'widget') {
    return {
      targetType: 'widget',
      workspaceId: target.workspaceId,
      widgetId: target.widgetId,
    };
  }
  if (target.kind === 'segment') {
    return {
      targetType: 'segment',
      workspaceId: target.workspaceId,
      segmentId: target.segmentId,
    };
  }
  return {
    targetType: 'supplement',
    workspaceId: target.workspaceId,
    segmentId: target.segmentId,
    supplementId: target.supplementId,
  };
}

export async function resolveArtifactRuntimeTargetDirectory({
  rootPath,
  target,
}: {
  readonly rootPath: string;
  readonly target: ArtifactRuntimeTarget;
}): Promise<string> {
  const resolved = await resolveArtifactRuntimeTargetDirectoryWithManifestOwner({
    rootPath,
    target,
  });
  if (target.targetType === 'segment') {
    if (resolved.targetType !== 'segment') {
      throw new Error('Artifact segment runtime target could not be resolved');
    }
    if (resolved.memoryId !== target.memoryId) {
      throw new Error('Artifact segment runtime target does not match memory');
    }
    return resolved.directory;
  }

  if (target.targetType === 'supplement') {
    if (resolved.targetType !== 'supplement') {
      throw new Error('Artifact supplement runtime target could not be resolved');
    }
    if (resolved.memoryId !== target.memoryId || resolved.segmentId !== target.segmentId) {
      throw new Error('Artifact supplement runtime target does not match parent');
    }
    return resolved.directory;
  }

  return resolved.directory;
}

export async function resolveArtifactRuntimeProtocolTargetDirectory(
  options: ResolveArtifactRuntimeProtocolTargetDirectoryOptions
): Promise<string> {
  const rootPath = 'appDataRootPath' in options ? options.appDataRootPath : options.rootPath;
  const resolved = await resolveArtifactRuntimeTargetDirectoryWithManifestOwner({
    rootPath,
    target: artifactRuntimeDirectoryTargetFromProtocolTarget(options.target),
  });
  return resolved.directory;
}

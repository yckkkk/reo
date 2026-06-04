import { useEffect, type RefObject } from 'react';
import type { WorkspaceMemoryDetail, WorkspaceSession } from './workspaceApi';

export type ArtifactRuntimeBridgeTarget =
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
    };

type RuntimeApi = Partial<
  Pick<
    Window['reoWorkspace'],
    | 'clearArtifactRuntimeSecret'
    | 'copyArtifactAgentPrompt'
    | 'getArtifactRuntimeSecret'
    | 'listArtifactRuntimeSecretSlots'
    | 'readArtifactRuntimeState'
    | 'setArtifactRuntimeSecret'
    | 'updateSegmentSupplementTitle'
    | 'updateSegmentTitle'
    | 'writeArtifactRuntimeState'
  >
>;

export type ArtifactRuntimeBridgeOptions = {
  readonly api: RuntimeApi;
  readonly iframeRef: RefObject<HTMLIFrameElement | null>;
  readonly memory: WorkspaceMemoryDetail;
  readonly onProductMutation: () => void;
  readonly onRequestFullscreen: () => void;
  readonly src: string;
  readonly target: ArtifactRuntimeBridgeTarget;
  readonly workspaceSession: WorkspaceSession;
};

type RuntimeRequest = {
  readonly source: 'reo-runtime';
  readonly type: 'request';
  readonly requestId: string;
  readonly method: string;
  readonly payload?: unknown;
};

type WorkspaceEnvelope =
  | {
      readonly ok: true;
      readonly value?: unknown;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly message: string;
      };
    };

class ArtifactRuntimeBridgeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRuntimeRequest(value: unknown): value is RuntimeRequest {
  return (
    isRecord(value) &&
    value['source'] === 'reo-runtime' &&
    value['type'] === 'request' &&
    typeof value['requestId'] === 'string' &&
    value['requestId'].length > 0 &&
    typeof value['method'] === 'string' &&
    value['method'].length > 0
  );
}

function isWorkspaceEnvelope(value: unknown): value is WorkspaceEnvelope {
  return isRecord(value) && typeof value['ok'] === 'boolean';
}

function requiredString(payload: unknown, key: string): string {
  if (!isRecord(payload) || typeof payload[key] !== 'string' || payload[key].length === 0) {
    throw new ArtifactRuntimeBridgeError('ERR_REO_RUNTIME_INVALID_REQUEST', `${key} is required`);
  }
  return payload[key];
}

function optionalString(payload: unknown, key: string): string | undefined {
  if (!isRecord(payload) || payload[key] === undefined) {
    return undefined;
  }
  if (typeof payload[key] !== 'string') {
    throw new ArtifactRuntimeBridgeError(
      'ERR_REO_RUNTIME_INVALID_REQUEST',
      `${key} must be a string`
    );
  }
  return payload[key];
}

function requireRecord(payload: unknown, key: string): Record<string, unknown> {
  const value = isRecord(payload) ? payload[key] : undefined;
  if (!isRecord(value)) {
    throw new ArtifactRuntimeBridgeError(
      'ERR_REO_RUNTIME_INVALID_REQUEST',
      `${key} must be an object`
    );
  }
  return value;
}

function runtimeTargetPayload({
  requestId,
  target,
  workspaceHandle,
}: {
  readonly requestId: string;
  readonly target: ArtifactRuntimeBridgeTarget;
  readonly workspaceHandle: string;
}) {
  const base = {
    workspaceHandle,
    workspaceId: target.workspaceId,
    targetType: target.targetType,
    memoryId: target.memoryId,
    segmentId: target.segmentId,
    requestId,
  };
  return target.targetType === 'supplement' ? { ...base, supplementId: target.supplementId } : base;
}

function currentObject({
  memory,
  target,
}: {
  readonly memory: WorkspaceMemoryDetail;
  readonly target: ArtifactRuntimeBridgeTarget;
}) {
  const segment = memory.segments.find((candidate) => candidate.segmentId === target.segmentId);
  if (!segment) {
    return null;
  }
  if (target.targetType === 'segment') {
    return segment;
  }
  return (
    segment.supplements.find((candidate) => candidate.supplementId === target.supplementId) ?? null
  );
}

function currentContext({
  memory,
  target,
  workspaceSession,
}: {
  readonly memory: WorkspaceMemoryDetail;
  readonly target: ArtifactRuntimeBridgeTarget;
  readonly workspaceSession: WorkspaceSession;
}) {
  return {
    workspace: {
      workspaceId: workspaceSession.workspaceId,
      title: workspaceSession.snapshot.title,
      description: workspaceSession.snapshot.description,
    },
    memory:
      workspaceSession.snapshot.memories.find(
        (candidate) => candidate.memoryId === target.memoryId
      ) ?? null,
    target,
    currentObject: currentObject({ memory, target }),
  };
}

function missingApi(method: string): never {
  throw new ArtifactRuntimeBridgeError(
    'ERR_REO_RUNTIME_API_UNAVAILABLE',
    `${method} is unavailable`
  );
}

function bridgeErrorFromUnknown(error: unknown) {
  if (error instanceof ArtifactRuntimeBridgeError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 'ERR_REO_RUNTIME_BRIDGE_FAILED',
    message: 'Reo runtime bridge request failed',
  };
}

async function unwrapResult(result: unknown): Promise<unknown> {
  if (!isWorkspaceEnvelope(result)) {
    return result;
  }
  if (result.ok) {
    return result.value;
  }
  throw new ArtifactRuntimeBridgeError(result.error.code, result.error.message);
}

async function unwrapMutationResult(
  result: unknown,
  onProductMutation: () => void
): Promise<unknown> {
  const value = await unwrapResult(result);
  onProductMutation();
  return value;
}

async function handleRuntimeRequest(
  request: RuntimeRequest,
  {
    api,
    memory,
    onProductMutation,
    onRequestFullscreen,
    target,
    workspaceSession,
  }: ArtifactRuntimeBridgeOptions
): Promise<unknown> {
  const baseTarget = runtimeTargetPayload({
    requestId: request.requestId,
    target,
    workspaceHandle: workspaceSession.workspaceHandle,
  });

  if (request.method === 'state.read') {
    return unwrapResult(
      await (api.readArtifactRuntimeState?.(
        baseTarget as Parameters<Window['reoWorkspace']['readArtifactRuntimeState']>[0]
      ) ?? missingApi(request.method))
    );
  }

  if (request.method === 'state.write') {
    const payload = request.payload;
    return unwrapResult(
      await (api.writeArtifactRuntimeState?.({
        ...baseTarget,
        baselineVersion: requiredString(payload, 'baselineVersion'),
        state: requireRecord(payload, 'state'),
      } as Parameters<Window['reoWorkspace']['writeArtifactRuntimeState']>[0]) ??
        missingApi(request.method))
    );
  }

  if (request.method === 'workspace.read') {
    return currentContext({ memory, target, workspaceSession });
  }

  if (request.method === 'content.readMemoryDetail') {
    return memory;
  }

  if (request.method === 'content.readCurrentObject') {
    const object = currentObject({ memory, target });
    if (!object) {
      throw new ArtifactRuntimeBridgeError(
        'ERR_REO_RUNTIME_OBJECT_NOT_FOUND',
        'Current runtime object was not found'
      );
    }
    return object;
  }

  if (request.method === 'secrets.list') {
    return unwrapResult(
      await (api.listArtifactRuntimeSecretSlots?.(
        baseTarget as Parameters<Window['reoWorkspace']['listArtifactRuntimeSecretSlots']>[0]
      ) ?? missingApi(request.method))
    );
  }

  if (request.method === 'secrets.get') {
    return unwrapResult(
      await (api.getArtifactRuntimeSecret?.({
        ...baseTarget,
        slotId: requiredString(request.payload, 'slotId'),
      } as Parameters<Window['reoWorkspace']['getArtifactRuntimeSecret']>[0]) ??
        missingApi(request.method))
    );
  }

  if (request.method === 'secrets.set') {
    return unwrapResult(
      await (api.setArtifactRuntimeSecret?.({
        ...baseTarget,
        slotId: requiredString(request.payload, 'slotId'),
        value: requiredString(request.payload, 'value'),
      } as Parameters<Window['reoWorkspace']['setArtifactRuntimeSecret']>[0]) ??
        missingApi(request.method))
    );
  }

  if (request.method === 'secrets.clear') {
    return unwrapResult(
      await (api.clearArtifactRuntimeSecret?.({
        ...baseTarget,
        slotId: requiredString(request.payload, 'slotId'),
      } as Parameters<Window['reoWorkspace']['clearArtifactRuntimeSecret']>[0]) ??
        missingApi(request.method))
    );
  }

  if (request.method === 'mutations.updateTitle') {
    const title = requiredString(request.payload, 'title');
    if (target.targetType === 'supplement') {
      return unwrapMutationResult(
        await (api.updateSegmentSupplementTitle?.({
          workspaceHandle: workspaceSession.workspaceHandle,
          workspaceId: target.workspaceId,
          memoryId: target.memoryId,
          segmentId: target.segmentId,
          supplementId: target.supplementId,
          title,
        } as Parameters<Window['reoWorkspace']['updateSegmentSupplementTitle']>[0]) ??
          missingApi(request.method)),
        onProductMutation
      );
    }
    return unwrapMutationResult(
      await (api.updateSegmentTitle?.({
        workspaceHandle: workspaceSession.workspaceHandle,
        workspaceId: target.workspaceId,
        memoryId: target.memoryId,
        segmentId: target.segmentId,
        title,
      } as Parameters<Window['reoWorkspace']['updateSegmentTitle']>[0]) ??
        missingApi(request.method)),
      onProductMutation
    );
  }

  if (request.method === 'mutations.saveNoteBody') {
    throw new ArtifactRuntimeBridgeError(
      'ERR_REO_RUNTIME_INVALID_REQUEST',
      'Note body writes are not available to artifact runtime works'
    );
  }

  if (request.method === 'ui.requestFullscreen') {
    onRequestFullscreen();
    return { expanded: true };
  }

  if (request.method === 'agent.copyPrompt') {
    const requestedAction = optionalString(request.payload, 'action');
    const action =
      requestedAction === 'create-supplement' && target.targetType === 'segment'
        ? 'create-supplement'
        : target.targetType === 'supplement'
          ? 'update-supplement'
          : 'update-segment';
    return unwrapResult(
      await (api.copyArtifactAgentPrompt?.({
        workspaceHandle: workspaceSession.workspaceHandle,
        workspaceId: target.workspaceId,
        action,
        memoryId: target.memoryId,
        segmentId: target.segmentId,
        ...(action === 'update-supplement' && target.targetType === 'supplement'
          ? { supplementId: target.supplementId }
          : {}),
      } as Parameters<Window['reoWorkspace']['copyArtifactAgentPrompt']>[0]) ??
        missingApi(request.method))
    );
  }

  throw new ArtifactRuntimeBridgeError(
    'ERR_REO_RUNTIME_UNKNOWN_METHOD',
    `${request.method} is not supported`
  );
}

export function createArtifactRuntimeMessageHandler(options: ArtifactRuntimeBridgeOptions) {
  const expectedOrigin = new URL(options.src).origin;
  return (event: MessageEvent<unknown>): void => {
    if (event.origin !== expectedOrigin) {
      return;
    }
    const runtimeWindow = options.iframeRef.current?.contentWindow ?? null;
    if (!runtimeWindow || event.source !== runtimeWindow) {
      return;
    }
    if (!isRuntimeRequest(event.data)) {
      return;
    }

    const source = runtimeWindow;
    const request = event.data;
    void handleRuntimeRequest(request, options)
      .then((value) => {
        source.postMessage(
          {
            source: 'reo-host',
            type: 'response',
            requestId: request.requestId,
            ok: true,
            value,
          },
          expectedOrigin
        );
      })
      .catch((error: unknown) => {
        source.postMessage(
          {
            source: 'reo-host',
            type: 'response',
            requestId: request.requestId,
            ok: false,
            error: bridgeErrorFromUnknown(error),
          },
          expectedOrigin
        );
      });
  };
}

export function useArtifactRuntimeBridge(options: ArtifactRuntimeBridgeOptions): void {
  useEffect(() => {
    const handler = createArtifactRuntimeMessageHandler(options);
    window.addEventListener('message', handler);
    return () => {
      window.removeEventListener('message', handler);
    };
  }, [options]);
}

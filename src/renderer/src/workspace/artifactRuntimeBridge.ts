import { useEffect, useRef, type RefObject } from 'react';
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
    | 'copyArtifactAgentPrompt'
    | 'readArtifactRuntimeState'
    | 'updateSegmentSupplementTitle'
    | 'updateSegmentTitle'
    | 'writeArtifactRuntimeState'
  >
>;

export type ArtifactRuntimeBridgeOptions = {
  readonly api: RuntimeApi;
  readonly enabled?: boolean;
  readonly iframeRef: RefObject<HTMLIFrameElement | null>;
  readonly memory: WorkspaceMemoryDetail;
  readonly onProductMutation: () => void;
  readonly onRequestFullscreen: () => void;
  readonly src: string;
  readonly target: ArtifactRuntimeBridgeTarget;
  readonly workspaceSession: WorkspaceSession;
};

type LatestBridgeOptions = Omit<ArtifactRuntimeBridgeOptions, 'enabled' | 'iframeRef' | 'src'>;

type ArtifactRuntimeMessageHandlerLiveOptions = {
  readonly iframeRef: RefObject<HTMLIFrameElement | null>;
  readonly src: string;
  readonly getLatestOptions: () => LatestBridgeOptions;
};

type RuntimeRequest = {
  readonly source: 'reo-runtime';
  readonly type: 'request';
  readonly requestId: string;
  readonly method: string;
  readonly payload?: unknown;
};

type ArtifactRuntimeMessageHandler = ((event: MessageEvent<unknown>) => void) & {
  dispose: () => void;
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

const HOST_MAX_PENDING_REQUESTS = 64;
const HOST_REQUEST_TIMEOUT_MS = 30_000;

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
  }: LatestBridgeOptions
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

export function createArtifactRuntimeMessageHandler(
  options: ArtifactRuntimeMessageHandlerLiveOptions
) {
  const expectedOrigin = new URL(options.src).origin;
  const pending = new Map<string, number>();
  const getLatestOptions = options.getLatestOptions;

  const postRuntimeResponse = (
    source: WindowProxy,
    requestId: string,
    response:
      | {
          readonly ok: true;
          readonly value: unknown;
        }
      | {
          readonly ok: false;
          readonly error: {
            readonly code: string;
            readonly message: string;
          };
        }
  ) => {
    source.postMessage(
      {
        source: 'reo-host',
        type: 'response',
        requestId,
        ...response,
      },
      expectedOrigin
    );
  };

  const finishPendingRequest = (
    source: WindowProxy,
    requestId: string,
    response:
      | {
          readonly ok: true;
          readonly value: unknown;
        }
      | {
          readonly ok: false;
          readonly error: {
            readonly code: string;
            readonly message: string;
          };
        }
  ) => {
    const timeoutId = pending.get(requestId);
    if (timeoutId === undefined) {
      return;
    }
    window.clearTimeout(timeoutId);
    pending.delete(requestId);
    postRuntimeResponse(source, requestId, response);
  };

  const handler = ((event: MessageEvent<unknown>): void => {
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
    if (pending.has(request.requestId)) {
      postRuntimeResponse(source, request.requestId, {
        ok: false,
        error: {
          code: 'ERR_REO_RUNTIME_DUPLICATE_REQUEST',
          message: 'Reo runtime request is already pending',
        },
      });
      return;
    }
    if (pending.size >= HOST_MAX_PENDING_REQUESTS) {
      postRuntimeResponse(source, request.requestId, {
        ok: false,
        error: {
          code: 'ERR_REO_RUNTIME_BUSY',
          message: 'Too many Reo runtime requests',
        },
      });
      return;
    }
    const timeoutId = window.setTimeout(() => {
      if (!pending.delete(request.requestId)) {
        return;
      }
      postRuntimeResponse(source, request.requestId, {
        ok: false,
        error: {
          code: 'ERR_REO_RUNTIME_TIMEOUT',
          message: 'Reo runtime request timed out',
        },
      });
    }, HOST_REQUEST_TIMEOUT_MS);
    pending.set(request.requestId, timeoutId);

    void handleRuntimeRequest(request, getLatestOptions())
      .then((value) => {
        finishPendingRequest(source, request.requestId, { ok: true, value });
      })
      .catch((error: unknown) => {
        finishPendingRequest(source, request.requestId, {
          ok: false,
          error: bridgeErrorFromUnknown(error),
        });
      });
  }) as ArtifactRuntimeMessageHandler;
  handler.dispose = () => {
    for (const timeoutId of pending.values()) {
      window.clearTimeout(timeoutId);
    }
    pending.clear();
  };
  return handler;
}

export function useArtifactRuntimeBridge(options: ArtifactRuntimeBridgeOptions): void {
  const latestOptionsRef = useRef<LatestBridgeOptions>({
    api: options.api,
    memory: options.memory,
    onProductMutation: options.onProductMutation,
    onRequestFullscreen: options.onRequestFullscreen,
    target: options.target,
    workspaceSession: options.workspaceSession,
  });

  latestOptionsRef.current = {
    api: options.api,
    memory: options.memory,
    onProductMutation: options.onProductMutation,
    onRequestFullscreen: options.onRequestFullscreen,
    target: options.target,
    workspaceSession: options.workspaceSession,
  };

  useEffect(() => {
    if (options.enabled === false) {
      return;
    }
    const handler = createArtifactRuntimeMessageHandler({
      iframeRef: options.iframeRef,
      src: options.src,
      getLatestOptions: () => latestOptionsRef.current,
    });
    window.addEventListener('message', handler);
    return () => {
      window.removeEventListener('message', handler);
      handler.dispose();
    };
  }, [options.enabled, options.iframeRef, options.src]);
}

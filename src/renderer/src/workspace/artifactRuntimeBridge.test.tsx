import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { artifactSegmentRuntimeUrl } from '../../../workspace-contract/artifact-runtime-url';
import type { WorkspaceMemoryDetail, WorkspaceSession } from './workspaceApi';
import {
  createArtifactRuntimeMessageHandler,
  useArtifactRuntimeBridge,
  type ArtifactRuntimeBridgeOptions,
  type ArtifactRuntimeBridgeTarget,
} from './artifactRuntimeBridge';

function session(): WorkspaceSession {
  return {
    workspaceHandle: 'wh_bridge',
    workspaceId: 'ws_bridge',
    snapshot: {
      workspaceId: 'ws_bridge',
      title: 'Bridge workspace',
      description: 'Bridge test',
      memories: [
        {
          memoryId: 'mem_bridge',
          title: 'Bridge memory',
          createdAt: '2026-06-04T09:00:00.000Z',
          updatedAt: '2026-06-04T09:00:00.000Z',
          segmentCount: 1,
          noteSegmentCount: 0,
          artifactSegmentCount: 1,
          audioSegmentCount: 0,
          audioDurationMs: 0,
          audioByteLength: 0,
          hasAudioTranscript: false,
          hasAnyNote: false,
          supplementCount: 0,
        },
      ],
    },
  };
}

function memoryDetail(): WorkspaceMemoryDetail {
  return {
    workspaceId: 'ws_bridge',
    memoryId: 'mem_bridge',
    title: 'Bridge memory',
    createdAt: '2026-06-04T09:00:00.000Z',
    updatedAt: '2026-06-04T09:00:00.000Z',
    segmentCount: 1,
    noteSegmentCount: 0,
    artifactSegmentCount: 1,
    audioSegmentCount: 0,
    audioDurationMs: 0,
    audioByteLength: 0,
    hasAudioTranscript: false,
    hasAnyNote: false,
    supplementCount: 0,
    segments: [
      {
        workspaceId: 'ws_bridge',
        memoryId: 'mem_bridge',
        segmentId: 'seg_bridge',
        type: 'artifact',
        format: 'html',
        title: 'Bridge work',
        createdAt: '2026-06-04T09:00:00.000Z',
        updatedAt: '2026-06-04T09:00:00.000Z',
        entryByteLength: 42,
        entryHash: 'e'.repeat(64),
        previewVersion: 'v1',
        supplementCount: 0,
        supplements: [],
      },
    ],
  };
}

function messageEvent({
  data,
  origin,
  source,
}: {
  readonly data: unknown;
  readonly origin: string;
  readonly source: WindowProxy;
}) {
  return { data, origin, source } as MessageEvent;
}

function bridgeHandlerOptions({
  api,
  iframeRef,
  memory,
  onProductMutation,
  onRequestFullscreen,
  src,
  target,
  workspaceSession,
}: ArtifactRuntimeBridgeOptions) {
  return {
    iframeRef,
    src,
    getLatestOptions: () => ({
      api,
      memory,
      onProductMutation,
      onRequestFullscreen,
      target,
      workspaceSession,
    }),
  };
}

async function flushBridge() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('artifact runtime bridge', () => {
  it('keeps an in-flight iframe request alive across ordinary React rerenders', async () => {
    const src = artifactSegmentRuntimeUrl({
      workspaceId: 'ws_bridge',
      segmentId: 'seg_bridge',
      previewVersion: 'v1',
    });
    const origin = new URL(src).origin;
    const runtimeWindow = { postMessage: vi.fn() } as unknown as WindowProxy;
    let resolveStateRead:
      | ((result: Awaited<ReturnType<Window['reoWorkspace']['readArtifactRuntimeState']>>) => void)
      | undefined;
    const readArtifactRuntimeState = vi.fn<Window['reoWorkspace']['readArtifactRuntimeState']>(
      () =>
        new Promise((resolve) => {
          resolveStateRead = resolve;
        })
    );
    const target: ArtifactRuntimeBridgeTarget = {
      targetType: 'segment',
      workspaceId: 'ws_bridge',
      memoryId: 'mem_bridge',
      segmentId: 'seg_bridge',
    };
    const iframeRef = {
      current: { contentWindow: runtimeWindow } as HTMLIFrameElement,
    };

    function BridgeHarness({ tick }: { readonly tick: number }) {
      useArtifactRuntimeBridge({
        api: {
          readArtifactRuntimeState,
        },
        iframeRef,
        memory: memoryDetail(),
        onProductMutation: vi.fn(),
        onRequestFullscreen: vi.fn(),
        src,
        target,
        workspaceSession: session(),
      });
      return <div data-tick={tick} />;
    }

    const rendered = render(<BridgeHarness tick={1} />);
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: 'reo-runtime',
          type: 'request',
          requestId: 'req-rerender',
          method: 'state.read',
        },
        origin,
        source: runtimeWindow,
      })
    );
    await flushBridge();
    expect(readArtifactRuntimeState).toHaveBeenCalledTimes(1);

    rendered.rerender(<BridgeHarness tick={2} />);
    resolveStateRead?.({
      ok: true,
      value: {
        requestId: 'req-rerender',
        source: 'file',
        state: { schemaVersion: 1, stores: { ui: { count: 1 } } },
        version: 'a'.repeat(64),
      },
    });
    await flushBridge();

    expect(runtimeWindow.postMessage).toHaveBeenCalledWith(
      {
        source: 'reo-host',
        type: 'response',
        requestId: 'req-rerender',
        ok: true,
        value: {
          requestId: 'req-rerender',
          source: 'file',
          state: { schemaVersion: 1, stores: { ui: { count: 1 } } },
          version: 'a'.repeat(64),
        },
      },
      origin
    );
  });

  it('accepts only the expected artifact origin and iframe source', async () => {
    const src = artifactSegmentRuntimeUrl({
      workspaceId: 'ws_bridge',
      segmentId: 'seg_bridge',
      previewVersion: 'v1',
    });
    const expectedOrigin = new URL(src).origin;
    const runtimeWindow = { postMessage: vi.fn() } as unknown as WindowProxy;
    const otherWindow = { postMessage: vi.fn() } as unknown as WindowProxy;
    const readArtifactRuntimeState = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        requestId: 'req-1',
        source: 'file',
        state: { schemaVersion: 1, stores: { ui: { count: 1 } } },
        version: 'a'.repeat(64),
      },
    });

    const handler = createArtifactRuntimeMessageHandler(
      bridgeHandlerOptions({
        api: {
          readArtifactRuntimeState,
        },
        iframeRef: {
          current: { contentWindow: runtimeWindow } as HTMLIFrameElement,
        },
        memory: memoryDetail(),
        onProductMutation: vi.fn(),
        onRequestFullscreen: vi.fn(),
        src,
        target: {
          targetType: 'segment',
          workspaceId: 'ws_bridge',
          memoryId: 'mem_bridge',
          segmentId: 'seg_bridge',
        },
        workspaceSession: session(),
      })
    );

    handler(
      messageEvent({
        data: {
          source: 'reo-runtime',
          type: 'request',
          requestId: 'req-1',
          method: 'state.read',
        },
        origin: 'https://example.test',
        source: runtimeWindow,
      })
    );
    handler(
      messageEvent({
        data: {
          source: 'reo-runtime',
          type: 'request',
          requestId: 'req-1',
          method: 'state.read',
        },
        origin: expectedOrigin,
        source: otherWindow,
      })
    );
    await flushBridge();
    expect(readArtifactRuntimeState).not.toHaveBeenCalled();
    expect(runtimeWindow.postMessage).not.toHaveBeenCalled();

    handler(
      messageEvent({
        data: {
          source: 'reo-runtime',
          type: 'request',
          requestId: 'req-1',
          method: 'state.read',
        },
        origin: expectedOrigin,
        source: runtimeWindow,
      })
    );
    await flushBridge();

    expect(readArtifactRuntimeState).toHaveBeenCalledWith({
      workspaceHandle: 'wh_bridge',
      workspaceId: 'ws_bridge',
      targetType: 'segment',
      memoryId: 'mem_bridge',
      segmentId: 'seg_bridge',
      requestId: 'req-1',
    });
    expect(runtimeWindow.postMessage).toHaveBeenCalledWith(
      {
        source: 'reo-host',
        type: 'response',
        requestId: 'req-1',
        ok: true,
        value: {
          requestId: 'req-1',
          source: 'file',
          state: { schemaVersion: 1, stores: { ui: { count: 1 } } },
          version: 'a'.repeat(64),
        },
      },
      expectedOrigin
    );
  });

  it('routes content, state, agent, ui and typed mutation calls', async () => {
    const src = artifactSegmentRuntimeUrl({
      workspaceId: 'ws_bridge',
      segmentId: 'seg_bridge',
      previewVersion: 'v1',
    });
    const origin = new URL(src).origin;
    const runtimeWindow = { postMessage: vi.fn() } as unknown as WindowProxy;
    const updateSegmentTitle = vi.fn().mockResolvedValue({
      ok: true,
      value: { memory: memoryDetail(), segment: memoryDetail().segments[0] },
    });
    const copyArtifactAgentPrompt = vi.fn().mockResolvedValue({ ok: true });
    const writeArtifactRuntimeState = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        requestId: 'req-state',
        status: 'saved',
        state: { schemaVersion: 1, stores: { ui: { count: 2 } } },
        version: 'b'.repeat(64),
      },
    });
    const writeSegmentContent = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        bodyByteLength: 16,
        bodyMarkdown: 'Updated note',
        baselineContentHash: 'c'.repeat(64),
      },
    });
    const onProductMutation = vi.fn();
    const onRequestFullscreen = vi.fn();

    const handler = createArtifactRuntimeMessageHandler(
      bridgeHandlerOptions({
        api: {
          copyArtifactAgentPrompt,
          updateSegmentTitle,
          writeArtifactRuntimeState,
        },
        iframeRef: {
          current: { contentWindow: runtimeWindow } as HTMLIFrameElement,
        },
        memory: memoryDetail(),
        onProductMutation,
        onRequestFullscreen,
        src,
        target: {
          targetType: 'segment',
          workspaceId: 'ws_bridge',
          memoryId: 'mem_bridge',
          segmentId: 'seg_bridge',
        },
        workspaceSession: session(),
      })
    );

    for (const request of [
      {
        requestId: 'req-workspace',
        method: 'workspace.read',
      },
      {
        requestId: 'req-content',
        method: 'content.readCurrentObject',
      },
      {
        requestId: 'req-memory-detail',
        method: 'content.readMemoryDetail',
      },
      {
        requestId: 'req-state',
        method: 'state.write',
        payload: {
          baselineVersion: 'a'.repeat(64),
          state: { schemaVersion: 1, stores: { ui: { count: 2 } } },
        },
      },
      {
        requestId: 'req-secret',
        method: 'secrets.list',
      },
      {
        requestId: 'req-title',
        method: 'mutations.updateTitle',
        payload: { title: 'Updated work' },
      },
      {
        requestId: 'req-agent',
        method: 'agent.copyPrompt',
        payload: {
          action: 'create-supplement',
          intent: '把这个作品补成今天能继续用的打卡表',
          state: { checkedDays: ['周一'] },
          suggestedFiles: ['entry.html', 'state.json'],
        },
      },
      {
        requestId: 'req-ui',
        method: 'ui.requestFullscreen',
      },
    ]) {
      handler(
        messageEvent({
          data: {
            source: 'reo-runtime',
            type: 'request',
            ...request,
          },
          origin,
          source: runtimeWindow,
        })
      );
    }
    await flushBridge();

    expect(writeArtifactRuntimeState).toHaveBeenCalledWith({
      workspaceHandle: 'wh_bridge',
      workspaceId: 'ws_bridge',
      targetType: 'segment',
      memoryId: 'mem_bridge',
      segmentId: 'seg_bridge',
      requestId: 'req-state',
      baselineVersion: 'a'.repeat(64),
      state: { schemaVersion: 1, stores: { ui: { count: 2 } } },
    });
    expect(updateSegmentTitle).toHaveBeenCalledWith({
      workspaceHandle: 'wh_bridge',
      workspaceId: 'ws_bridge',
      memoryId: 'mem_bridge',
      segmentId: 'seg_bridge',
      title: 'Updated work',
    });
    expect(copyArtifactAgentPrompt).toHaveBeenCalledWith({
      workspaceHandle: 'wh_bridge',
      workspaceId: 'ws_bridge',
      action: 'create-supplement',
      memoryId: 'mem_bridge',
      segmentId: 'seg_bridge',
    });
    expect(writeSegmentContent).not.toHaveBeenCalled();
    expect(onProductMutation).toHaveBeenCalledTimes(1);
    expect(onRequestFullscreen).toHaveBeenCalledTimes(1);

    const responses = (runtimeWindow.postMessage as ReturnType<typeof vi.fn>).mock.calls.map(
      ([payload]) => payload
    );
    expect(responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requestId: 'req-workspace',
          ok: true,
          value: expect.objectContaining({
            workspace: expect.objectContaining({ workspaceId: 'ws_bridge' }),
            target: expect.objectContaining({ segmentId: 'seg_bridge' }),
          }),
        }),
        expect.objectContaining({
          requestId: 'req-content',
          ok: true,
          value: expect.objectContaining({
            type: 'artifact',
            segmentId: 'seg_bridge',
          }),
        }),
        expect.objectContaining({
          requestId: 'req-memory-detail',
          ok: true,
          value: expect.objectContaining({
            memoryId: 'mem_bridge',
            segments: expect.arrayContaining([
              expect.objectContaining({ segmentId: 'seg_bridge' }),
            ]),
          }),
        }),
        expect.objectContaining({
          requestId: 'req-secret',
          ok: false,
          error: expect.objectContaining({
            code: 'ERR_REO_RUNTIME_UNKNOWN_METHOD',
          }),
        }),
        expect.objectContaining({
          requestId: 'req-ui',
          ok: true,
          value: { expanded: true },
        }),
      ])
    );
  });

  it('bounds raw iframe requests at the host bridge', async () => {
    const src = artifactSegmentRuntimeUrl({
      workspaceId: 'ws_bridge',
      segmentId: 'seg_bridge',
      previewVersion: 'v1',
    });
    const origin = new URL(src).origin;
    const runtimeWindow = { postMessage: vi.fn() } as unknown as WindowProxy;
    const readArtifactRuntimeState = vi.fn<Window['reoWorkspace']['readArtifactRuntimeState']>(
      () =>
        new Promise(() => {
          // Keep host requests pending to exercise the host-side cap.
        })
    );

    const handler = createArtifactRuntimeMessageHandler(
      bridgeHandlerOptions({
        api: {
          readArtifactRuntimeState,
        },
        iframeRef: {
          current: { contentWindow: runtimeWindow } as HTMLIFrameElement,
        },
        memory: memoryDetail(),
        onProductMutation: vi.fn(),
        onRequestFullscreen: vi.fn(),
        src,
        target: {
          targetType: 'segment',
          workspaceId: 'ws_bridge',
          memoryId: 'mem_bridge',
          segmentId: 'seg_bridge',
        },
        workspaceSession: session(),
      })
    );

    for (let index = 0; index < 65; index += 1) {
      handler(
        messageEvent({
          data: {
            source: 'reo-runtime',
            type: 'request',
            requestId: `req-${index}`,
            method: 'state.read',
          },
          origin,
          source: runtimeWindow,
        })
      );
    }

    await flushBridge();

    expect(readArtifactRuntimeState).toHaveBeenCalledTimes(64);
    expect(runtimeWindow.postMessage).toHaveBeenCalledWith(
      {
        source: 'reo-host',
        type: 'response',
        requestId: 'req-64',
        ok: false,
        error: {
          code: 'ERR_REO_RUNTIME_BUSY',
          message: 'Too many Reo runtime requests',
        },
      },
      origin
    );
    (handler as { dispose?: () => void }).dispose?.();
  });

  it('ignores runtime-supplied agent prompt payloads before calling preload', async () => {
    const src = artifactSegmentRuntimeUrl({
      workspaceId: 'ws_bridge',
      segmentId: 'seg_bridge',
      previewVersion: 'v1',
    });
    const origin = new URL(src).origin;
    const runtimeWindow = { postMessage: vi.fn() } as unknown as WindowProxy;
    const copyArtifactAgentPrompt = vi.fn().mockResolvedValue({ ok: true });

    const handler = createArtifactRuntimeMessageHandler(
      bridgeHandlerOptions({
        api: {
          copyArtifactAgentPrompt,
        },
        iframeRef: {
          current: { contentWindow: runtimeWindow } as HTMLIFrameElement,
        },
        memory: memoryDetail(),
        onProductMutation: vi.fn(),
        onRequestFullscreen: vi.fn(),
        src,
        target: {
          targetType: 'segment',
          workspaceId: 'ws_bridge',
          memoryId: 'mem_bridge',
          segmentId: 'seg_bridge',
        },
        workspaceSession: session(),
      })
    );

    handler(
      messageEvent({
        data: {
          source: 'reo-runtime',
          type: 'request',
          requestId: 'req-agent-oversized',
          method: 'agent.copyPrompt',
          payload: {
            state: { body: 'x'.repeat(20_000) },
          },
        },
        origin,
        source: runtimeWindow,
      })
    );
    await flushBridge();

    expect(copyArtifactAgentPrompt).toHaveBeenCalledWith({
      workspaceHandle: 'wh_bridge',
      workspaceId: 'ws_bridge',
      action: 'update-segment',
      memoryId: 'mem_bridge',
      segmentId: 'seg_bridge',
    });
    expect(runtimeWindow.postMessage).toHaveBeenCalledWith(
      {
        source: 'reo-host',
        type: 'response',
        requestId: 'req-agent-oversized',
        ok: true,
        value: undefined,
      },
      origin
    );
  });
});

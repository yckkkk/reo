import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  artifactSegmentRuntimeUrl,
  homeComponentRuntimeUrl,
  workspaceWidgetRuntimeUrl,
} from '../../../workspace-contract/artifact-runtime-url';
import type {
  WorkspaceHomeComponent,
  WorkspaceMemoryDetail,
  WorkspaceMemorySpace,
  WorkspaceRecentExpressionItem,
  WorkspaceSession,
} from './workspaceApi';
import {
  createArtifactRuntimeMessageHandler,
  useArtifactRuntimeBridge,
  type ArtifactRuntimeBridgeOptions,
  type ArtifactRuntimeObjectSelectionTarget,
  type ArtifactRuntimeBridgeTarget,
  type ReadMemoryDetailForRuntime,
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
        {
          memoryId: 'mem_other',
          title: 'Other memory',
          createdAt: '2026-06-04T10:00:00.000Z',
          updatedAt: '2026-06-04T10:05:00.000Z',
          segmentCount: 3,
          noteSegmentCount: 1,
          artifactSegmentCount: 1,
          audioSegmentCount: 1,
          audioDurationMs: 30_000,
          audioByteLength: 2048,
          hasAudioTranscript: true,
          hasAnyNote: true,
          supplementCount: 2,
        },
      ],
      widgets: [
        {
          workspaceId: 'ws_bridge',
          widgetId: 'wdg_bridge',
          type: 'widget',
          format: 'html',
          mount: 'workspace-rail',
          title: 'Bridge widget',
          createdAt: '2026-06-05T09:00:00.000Z',
          updatedAt: '2026-06-05T09:00:00.000Z',
          icon: { source: 'default' },
          entryByteLength: 128,
          entryHash: 'f'.repeat(64),
          previewVersion: 'widget-v1',
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

function otherMemoryDetail(): WorkspaceMemoryDetail {
  return {
    workspaceId: 'ws_bridge',
    memoryId: 'mem_other',
    title: 'Other memory',
    createdAt: '2026-06-04T10:00:00.000Z',
    updatedAt: '2026-06-04T10:05:00.000Z',
    segmentCount: 3,
    noteSegmentCount: 1,
    artifactSegmentCount: 1,
    audioSegmentCount: 1,
    audioDurationMs: 30_000,
    audioByteLength: 2048,
    hasAudioTranscript: true,
    hasAnyNote: true,
    supplementCount: 2,
    segments: [
      {
        workspaceId: 'ws_bridge',
        memoryId: 'mem_other',
        segmentId: 'seg_other',
        type: 'note',
        title: 'Other note',
        createdAt: '2026-06-04T10:00:00.000Z',
        updatedAt: '2026-06-04T10:05:00.000Z',
        bodyByteLength: 128,
        speechSynthesis: {
          status: 'missing',
          audioByteLength: null,
          contentHash: null,
          format: null,
          lastSynthesisAttempt: 'never',
          mimeType: null,
          model: null,
          reason: null,
          resourceId: null,
          sampleRate: null,
          speaker: null,
          updatedAt: null,
        },
        supplementCount: 0,
        supplements: [],
      },
    ],
  };
}

function homeComponent(): WorkspaceHomeComponent {
  return {
    componentId: 'hcmp_daily',
    type: 'home-component',
    format: 'html',
    mount: 'home',
    title: 'Daily home',
    createdAt: '2026-06-10T09:00:00.000Z',
    updatedAt: '2026-06-10T09:01:00.000Z',
    icon: { source: 'default' },
    entryByteLength: 128,
    entryHash: 'c'.repeat(64),
    previewVersion: 'd'.repeat(64),
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

type BridgeHandlerTestOptions = Omit<ArtifactRuntimeBridgeOptions, 'readMemoryDetail'> & {
  readonly readMemoryDetail?: ReadMemoryDetailForRuntime;
  readonly onSelectHomeMemory?: ArtifactRuntimeBridgeOptions['onSelectHomeMemory'] | undefined;
  readonly onSelectHomeObject?: ArtifactRuntimeBridgeOptions['onSelectHomeObject'] | undefined;
  readonly onSelectObject?: ((target: ArtifactRuntimeObjectSelectionTarget) => boolean) | undefined;
};

function bridgeHandlerOptions({
  api,
  iframeRef,
  memory,
  onProductMutation,
  onSelectObject,
  onSelectMemory,
  readMemoryDetail = async () => {
    throw new Error('readMemoryDetail test default unavailable');
  },
  onRequestFullscreen,
  src,
  target,
  homeComponent,
  homeMemorySpaces,
  homeRecentExpressions,
  onSelectHomeMemory,
  onSelectHomeObject,
  workspaceSession,
}: BridgeHandlerTestOptions) {
  return {
    iframeRef,
    src,
    getLatestOptions: () => ({
      api,
      homeComponent,
      homeMemorySpaces,
      homeRecentExpressions,
      memory,
      onProductMutation,
      onSelectHomeMemory,
      onSelectHomeObject,
      onSelectObject,
      onSelectMemory,
      readMemoryDetail,
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
        readMemoryDetail: vi.fn(async () => otherMemoryDetail()),
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
          source: 'reo-render',
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

  it('lets the hook route runtime cross-memory detail reads through the provided read model', async () => {
    const src = artifactSegmentRuntimeUrl({
      workspaceId: 'ws_bridge',
      segmentId: 'seg_bridge',
      previewVersion: 'v1',
    });
    const origin = new URL(src).origin;
    const runtimeWindow = { postMessage: vi.fn() } as unknown as WindowProxy;
    const readMemoryDetail = vi.fn().mockResolvedValue(otherMemoryDetail());
    const target: ArtifactRuntimeBridgeTarget = {
      targetType: 'segment',
      workspaceId: 'ws_bridge',
      memoryId: 'mem_bridge',
      segmentId: 'seg_bridge',
    };
    const iframeRef = {
      current: { contentWindow: runtimeWindow } as HTMLIFrameElement,
    };

    function BridgeHarness() {
      useArtifactRuntimeBridge({
        api: {},
        iframeRef,
        memory: memoryDetail(),
        onProductMutation: vi.fn(),
        readMemoryDetail,
        onRequestFullscreen: vi.fn(),
        src,
        target,
        workspaceSession: session(),
      });
      return <div />;
    }

    render(<BridgeHarness />);
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: 'reo-render',
          type: 'request',
          requestId: 'req-other-memory',
          method: 'content.readMemoryDetail',
          payload: { memoryId: 'mem_other' },
        },
        origin,
        source: runtimeWindow,
      })
    );
    await flushBridge();

    expect(readMemoryDetail).toHaveBeenCalledWith({ memoryId: 'mem_other' });
    expect(runtimeWindow.postMessage).toHaveBeenCalledWith(
      {
        source: 'reo-host',
        type: 'response',
        requestId: 'req-other-memory',
        ok: true,
        value: otherMemoryDetail(),
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
          source: 'reo-render',
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
          source: 'reo-render',
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
          source: 'reo-render',
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
            source: 'reo-render',
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
            workspace: expect.objectContaining({
              workspaceId: 'ws_bridge',
              memories: expect.arrayContaining([
                expect.objectContaining({ memoryId: 'mem_bridge', segmentCount: 1 }),
                expect.objectContaining({ memoryId: 'mem_other', segmentCount: 3 }),
              ]),
            }),
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

  it('routes runtime media playback reads through the existing expression playback read', async () => {
    const src = artifactSegmentRuntimeUrl({
      workspaceId: 'ws_bridge',
      segmentId: 'seg_bridge',
      previewVersion: 'v1',
    });
    const origin = new URL(src).origin;
    const runtimeWindow = { postMessage: vi.fn() } as unknown as WindowProxy;
    const readExpressionPlaybackAudio = vi.fn<
      Window['reoWorkspace']['readExpressionPlaybackAudio']
    >(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: payload.workspaceId,
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        ...(payload.supplementId ? { supplementId: payload.supplementId } : {}),
        kind: payload.kind,
        audio: new Uint8Array([1, 2, 3]),
        mimeType: payload.kind === 'note-speech' ? 'audio/mpeg' : 'audio/webm',
      },
    }));

    const handler = createArtifactRuntimeMessageHandler(
      bridgeHandlerOptions({
        api: {
          readExpressionPlaybackAudio,
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

    for (const request of [
      {
        requestId: 'req-media-audio-segment',
        method: 'media.readPlaybackAudio',
        payload: { memoryId: 'mem_bridge', segmentId: 'seg_audio', kind: 'audio' },
      },
      {
        requestId: 'req-media-audio-supplement',
        method: 'media.readPlaybackAudio',
        payload: {
          memoryId: 'mem_bridge',
          segmentId: 'seg_audio',
          supplementId: 'sup_audio',
          kind: 'audio',
        },
      },
      {
        requestId: 'req-media-speech-segment',
        method: 'media.readPlaybackAudio',
        payload: { memoryId: 'mem_bridge', segmentId: 'seg_note', kind: 'note-speech' },
      },
      {
        requestId: 'req-media-speech-supplement',
        method: 'media.readPlaybackAudio',
        payload: {
          memoryId: 'mem_bridge',
          segmentId: 'seg_note',
          supplementId: 'sup_note',
          kind: 'note-speech',
        },
      },
      {
        requestId: 'req-media-invalid-kind',
        method: 'media.readPlaybackAudio',
        payload: { memoryId: 'mem_bridge', segmentId: 'seg_note', kind: 'artifact' },
      },
    ]) {
      handler(
        messageEvent({
          data: {
            source: 'reo-render',
            type: 'request',
            ...request,
          },
          origin,
          source: runtimeWindow,
        })
      );
    }
    await flushBridge();

    expect(readExpressionPlaybackAudio).toHaveBeenCalledTimes(4);
    expect(readExpressionPlaybackAudio).toHaveBeenNthCalledWith(1, {
      requestId: 'req-media-audio-segment',
      workspaceId: 'ws_bridge',
      memoryId: 'mem_bridge',
      segmentId: 'seg_audio',
      kind: 'audio',
    });
    expect(readExpressionPlaybackAudio).toHaveBeenNthCalledWith(2, {
      requestId: 'req-media-audio-supplement',
      workspaceId: 'ws_bridge',
      memoryId: 'mem_bridge',
      segmentId: 'seg_audio',
      supplementId: 'sup_audio',
      kind: 'audio',
    });
    expect(readExpressionPlaybackAudio).toHaveBeenNthCalledWith(3, {
      requestId: 'req-media-speech-segment',
      workspaceId: 'ws_bridge',
      memoryId: 'mem_bridge',
      segmentId: 'seg_note',
      kind: 'note-speech',
    });
    expect(readExpressionPlaybackAudio).toHaveBeenNthCalledWith(4, {
      requestId: 'req-media-speech-supplement',
      workspaceId: 'ws_bridge',
      memoryId: 'mem_bridge',
      segmentId: 'seg_note',
      supplementId: 'sup_note',
      kind: 'note-speech',
    });

    const responses = (runtimeWindow.postMessage as ReturnType<typeof vi.fn>).mock.calls.map(
      ([payload]) => payload
    );
    expect(responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requestId: 'req-media-audio-segment',
          ok: true,
          value: { audio: new Uint8Array([1, 2, 3]), mimeType: 'audio/webm' },
        }),
        expect.objectContaining({
          requestId: 'req-media-speech-supplement',
          ok: true,
          value: { audio: new Uint8Array([1, 2, 3]), mimeType: 'audio/mpeg' },
        }),
        expect.objectContaining({
          requestId: 'req-media-invalid-kind',
          ok: false,
          error: expect.objectContaining({ code: 'ERR_REO_RUNTIME_INVALID_REQUEST' }),
        }),
      ])
    );
  });

  it('routes workspace widget bridge calls without changing the active rail tab', async () => {
    const src = workspaceWidgetRuntimeUrl({
      workspaceId: 'ws_bridge',
      widgetId: 'wdg_bridge',
      previewVersion: 'widget-v1',
    });
    const origin = new URL(src).origin;
    const runtimeWindow = { postMessage: vi.fn() } as unknown as WindowProxy;
    const copyWidgetAgentPrompt = vi.fn().mockResolvedValue({ ok: true });
    const updateWidgetTitle = vi.fn().mockResolvedValue({
      ok: true,
      value: { widget: session().snapshot.widgets?.[0], widgets: session().snapshot.widgets },
    });
    const readArtifactRuntimeState = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        requestId: 'req-widget-state',
        source: 'file',
        state: { schemaVersion: 1, stores: { ui: { selected: 'mem_bridge' } } },
        version: 'd'.repeat(64),
      },
    });
    const onProductMutation = vi.fn();
    const onSelectMemory = vi.fn(() => true);

    const handler = createArtifactRuntimeMessageHandler(
      bridgeHandlerOptions({
        api: {
          copyWidgetAgentPrompt,
          readArtifactRuntimeState,
          updateWidgetTitle,
        },
        iframeRef: {
          current: { contentWindow: runtimeWindow } as HTMLIFrameElement,
        },
        memory: memoryDetail(),
        onProductMutation,
        onRequestFullscreen: vi.fn(),
        onSelectMemory,
        src,
        target: {
          targetType: 'widget',
          workspaceId: 'ws_bridge',
          widgetId: 'wdg_bridge',
        },
        workspaceSession: session(),
      })
    );

    for (const request of [
      { requestId: 'req-widget-state', method: 'state.read' },
      { requestId: 'req-widget-workspace', method: 'workspace.read' },
      { requestId: 'req-widget-current', method: 'content.readCurrentObject' },
      {
        requestId: 'req-widget-title',
        method: 'mutations.updateTitle',
        payload: { title: 'Updated widget' },
      },
      { requestId: 'req-widget-agent', method: 'agent.copyPrompt' },
      {
        requestId: 'req-widget-select-memory',
        method: 'ui.selectMemory',
        payload: { memoryId: 'mem_other' },
      },
    ]) {
      handler(
        messageEvent({
          data: {
            source: 'reo-render',
            type: 'request',
            ...request,
          },
          origin,
          source: runtimeWindow,
        })
      );
    }
    await flushBridge();

    expect(readArtifactRuntimeState).toHaveBeenCalledWith({
      workspaceHandle: 'wh_bridge',
      workspaceId: 'ws_bridge',
      targetType: 'widget',
      widgetId: 'wdg_bridge',
      requestId: 'req-widget-state',
    });
    expect(updateWidgetTitle).toHaveBeenCalledWith({
      workspaceHandle: 'wh_bridge',
      workspaceId: 'ws_bridge',
      widgetId: 'wdg_bridge',
      title: 'Updated widget',
    });
    expect(copyWidgetAgentPrompt).toHaveBeenCalledWith({
      workspaceHandle: 'wh_bridge',
      workspaceId: 'ws_bridge',
      widgetId: 'wdg_bridge',
      action: 'update-widget',
    });
    expect(onProductMutation).toHaveBeenCalledWith({
      widget: session().snapshot.widgets?.[0],
      widgets: session().snapshot.widgets,
    });
    expect(onSelectMemory).toHaveBeenCalledWith('mem_other');

    const responses = (runtimeWindow.postMessage as ReturnType<typeof vi.fn>).mock.calls.map(
      ([payload]) => payload
    );
    expect(responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requestId: 'req-widget-workspace',
          ok: true,
          value: expect.objectContaining({
            target: expect.objectContaining({ targetType: 'widget', widgetId: 'wdg_bridge' }),
            currentObject: expect.objectContaining({ widgetId: 'wdg_bridge' }),
            currentMemory: expect.objectContaining({ memoryId: 'mem_bridge' }),
            memory: null,
          }),
        }),
        expect.objectContaining({
          requestId: 'req-widget-current',
          ok: true,
          value: expect.objectContaining({ widgetId: 'wdg_bridge' }),
        }),
        expect.objectContaining({
          requestId: 'req-widget-select-memory',
          ok: true,
          value: { selected: true },
        }),
      ])
    );
  });

  it('routes app-level home component bridge calls with home context', async () => {
    const component = homeComponent();
    if (!('previewVersion' in component)) {
      throw new Error('Expected ready home component.');
    }
    const src = homeComponentRuntimeUrl({
      componentId: component.componentId,
      previewVersion: component.previewVersion,
    });
    const origin = new URL(src).origin;
    const runtimeWindow = { postMessage: vi.fn() } as unknown as WindowProxy;
    const readArtifactRuntimeState = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        requestId: 'req-home-state',
        source: 'file',
        state: { schemaVersion: 1, stores: { ui: { collapsed: false } } },
        version: 'e'.repeat(64),
      },
    });
    const writeArtifactRuntimeState = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        requestId: 'req-home-write',
        state: { schemaVersion: 1 },
        version: 'f'.repeat(64),
      },
    });
    const updatedComponent = { ...component, title: 'Daily home updated' };
    const updateHomeComponentTitle = vi.fn().mockResolvedValue({
      ok: true,
      value: { component: updatedComponent, components: [updatedComponent] },
    });
    const copyHomeComponentAgentPrompt = vi.fn().mockResolvedValue({ ok: true });
    const onProductMutation = vi.fn();
    const homeMemorySpaces: readonly WorkspaceMemorySpace[] = [
      {
        workspaceId: 'ws_bridge',
        title: 'Bridge workspace',
        description: 'Bridge test',
        addedAt: '2026-06-04T09:00:00.000Z',
        lastOpenedAt: '2026-06-04T09:00:00.000Z',
      },
    ];
    const homeRecentExpressions: readonly WorkspaceRecentExpressionItem[] = [
      {
        id: 'recent_bridge',
        objectType: 'segment',
        workspaceId: 'ws_bridge',
        workspaceTitle: 'Bridge workspace',
        memoryId: 'mem_bridge',
        memoryTitle: 'Bridge memory',
        segmentId: 'seg_bridge',
        contentKind: 'note',
        title: 'Recent bridge',
        preview: 'Recent preview',
        createdAt: '2026-06-04T09:00:00.000Z',
        updatedAt: '2026-06-04T09:01:00.000Z',
      },
    ];

    const handler = createArtifactRuntimeMessageHandler(
      bridgeHandlerOptions({
        api: {
          copyHomeComponentAgentPrompt,
          readArtifactRuntimeState,
          updateHomeComponentTitle,
          writeArtifactRuntimeState,
        },
        iframeRef: {
          current: { contentWindow: runtimeWindow } as HTMLIFrameElement,
        },
        homeComponent: component,
        homeMemorySpaces,
        homeRecentExpressions,
        memory: null,
        onProductMutation,
        onRequestFullscreen: vi.fn(),
        src,
        target: {
          targetType: 'home-component',
          componentId: component.componentId,
        },
        workspaceSession: session(),
      })
    );

    for (const request of [
      { requestId: 'req-home-state', method: 'state.read' },
      {
        requestId: 'req-home-write',
        method: 'state.write',
        payload: { baselineVersion: 'e'.repeat(64), state: { schemaVersion: 1 } },
      },
      { requestId: 'req-home-workspace', method: 'workspace.read' },
      { requestId: 'req-home-current', method: 'content.readCurrentObject' },
      {
        requestId: 'req-home-title',
        method: 'mutations.updateTitle',
        payload: { title: 'Daily home updated' },
      },
      { requestId: 'req-home-agent', method: 'agent.copyPrompt' },
    ]) {
      handler(
        messageEvent({
          data: {
            source: 'reo-render',
            type: 'request',
            ...request,
          },
          origin,
          source: runtimeWindow,
        })
      );
    }
    await flushBridge();

    expect(readArtifactRuntimeState).toHaveBeenCalledWith({
      targetType: 'home-component',
      componentId: component.componentId,
      requestId: 'req-home-state',
    });
    expect(writeArtifactRuntimeState).toHaveBeenCalledWith({
      targetType: 'home-component',
      componentId: component.componentId,
      requestId: 'req-home-write',
      baselineVersion: 'e'.repeat(64),
      state: { schemaVersion: 1 },
    });
    expect(updateHomeComponentTitle).toHaveBeenCalledWith({
      componentId: component.componentId,
      title: 'Daily home updated',
    });
    expect(copyHomeComponentAgentPrompt).toHaveBeenCalledWith({
      action: 'update-home-component',
      componentId: component.componentId,
    });
    expect(onProductMutation).toHaveBeenCalledWith({
      component: updatedComponent,
      components: [updatedComponent],
    });

    const responses = (runtimeWindow.postMessage as ReturnType<typeof vi.fn>).mock.calls.map(
      ([payload]) => payload
    );
    expect(responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requestId: 'req-home-workspace',
          ok: true,
          value: expect.objectContaining({
            workspace: expect.objectContaining({ workspaceId: 'ws_bridge' }),
            memorySpaces: homeMemorySpaces,
            recentExpressions: homeRecentExpressions,
            memory: null,
            currentMemory: null,
            target: expect.objectContaining({
              targetType: 'home-component',
              componentId: component.componentId,
            }),
            currentObject: expect.objectContaining({ componentId: component.componentId }),
          }),
        }),
        expect.objectContaining({
          requestId: 'req-home-current',
          ok: true,
          value: expect.objectContaining({ componentId: component.componentId }),
        }),
      ])
    );
  });

  it('allows home components to read and select workspace memory targets', async () => {
    const component = homeComponent();
    if (!('previewVersion' in component)) {
      throw new Error('Expected ready home component.');
    }
    const src = homeComponentRuntimeUrl({
      componentId: component.componentId,
      previewVersion: component.previewVersion,
    });
    const origin = new URL(src).origin;
    const runtimeWindow = { postMessage: vi.fn() } as unknown as WindowProxy;
    const readMemoryDetail = vi.fn().mockResolvedValue(otherMemoryDetail());
    const onSelectHomeMemory = vi.fn(async () => true);
    const onSelectHomeObject = vi.fn(async () => true);
    const handler = createArtifactRuntimeMessageHandler(
      bridgeHandlerOptions({
        api: {},
        iframeRef: {
          current: { contentWindow: runtimeWindow } as HTMLIFrameElement,
        },
        homeComponent: component,
        memory: null,
        onProductMutation: vi.fn(),
        onRequestFullscreen: vi.fn(),
        onSelectHomeMemory,
        onSelectHomeObject,
        readMemoryDetail,
        src,
        target: {
          targetType: 'home-component',
          componentId: component.componentId,
        },
      })
    );

    for (const request of [
      {
        requestId: 'req-home-read-memory',
        method: 'content.readMemoryDetail',
        payload: { workspaceId: 'ws_bridge', memoryId: 'mem_other' },
      },
      {
        requestId: 'req-home-select-memory',
        method: 'ui.selectMemory',
        payload: { workspaceId: 'ws_bridge', memoryId: 'mem_other' },
      },
      {
        requestId: 'req-home-select-object',
        method: 'ui.selectObject',
        payload: { workspaceId: 'ws_bridge', memoryId: 'mem_other', segmentId: 'seg_other' },
      },
    ]) {
      handler(
        messageEvent({
          data: {
            source: 'reo-render',
            type: 'request',
            ...request,
          },
          origin,
          source: runtimeWindow,
        })
      );
    }
    await flushBridge();

    expect(readMemoryDetail).toHaveBeenCalledWith({
      workspaceId: 'ws_bridge',
      memoryId: 'mem_other',
    });
    expect(readMemoryDetail).toHaveBeenLastCalledWith({
      workspaceId: 'ws_bridge',
      memoryId: 'mem_other',
    });
    expect(onSelectHomeMemory).toHaveBeenCalledWith({
      workspaceId: 'ws_bridge',
      memoryId: 'mem_other',
    });
    expect(onSelectHomeObject).toHaveBeenCalledWith({
      workspaceId: 'ws_bridge',
      memoryId: 'mem_other',
      segmentId: 'seg_other',
    });

    const responses = (runtimeWindow.postMessage as ReturnType<typeof vi.fn>).mock.calls.map(
      ([payload]) => payload
    );
    expect(responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requestId: 'req-home-read-memory',
          ok: true,
          value: expect.objectContaining({ memoryId: 'mem_other' }),
        }),
        expect.objectContaining({
          requestId: 'req-home-select-memory',
          ok: true,
          value: { selected: true },
        }),
        expect.objectContaining({
          requestId: 'req-home-select-object',
          ok: true,
          value: { selected: true },
        }),
      ])
    );
  });

  it('reports blocked workspace widget memory selection without changing host state', async () => {
    const src = workspaceWidgetRuntimeUrl({
      workspaceId: 'ws_bridge',
      widgetId: 'wdg_bridge',
      previewVersion: 'widget-v1',
    });
    const origin = new URL(src).origin;
    const runtimeWindow = { postMessage: vi.fn() } as unknown as WindowProxy;
    const onSelectMemory = vi.fn(() => false);
    const handler = createArtifactRuntimeMessageHandler(
      bridgeHandlerOptions({
        api: {},
        iframeRef: {
          current: { contentWindow: runtimeWindow } as HTMLIFrameElement,
        },
        memory: null,
        onProductMutation: vi.fn(),
        onRequestFullscreen: vi.fn(),
        onSelectMemory,
        src,
        target: {
          targetType: 'widget',
          workspaceId: 'ws_bridge',
          widgetId: 'wdg_bridge',
        },
        workspaceSession: session(),
      })
    );

    handler(
      messageEvent({
        data: {
          source: 'reo-render',
          type: 'request',
          requestId: 'req-widget-select-blocked',
          method: 'ui.selectMemory',
          payload: { memoryId: 'mem_other' },
        },
        origin,
        source: runtimeWindow,
      })
    );
    await flushBridge();

    expect(onSelectMemory).toHaveBeenCalledWith('mem_other');
    expect((runtimeWindow.postMessage as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        requestId: 'req-widget-select-blocked',
        ok: true,
        value: { selected: false },
      })
    );
  });

  it('lets workspace widgets select an existing SegmentSupplement object', async () => {
    const src = workspaceWidgetRuntimeUrl({
      workspaceId: 'ws_bridge',
      widgetId: 'wdg_bridge',
      previewVersion: 'widget-v1',
    });
    const origin = new URL(src).origin;
    const runtimeWindow = { postMessage: vi.fn() } as unknown as WindowProxy;
    const onSelectObject = vi.fn(() => true);
    const detailWithSupplement: WorkspaceMemoryDetail = {
      ...otherMemoryDetail(),
      segments: [
        {
          workspaceId: 'ws_bridge',
          memoryId: 'mem_other',
          segmentId: 'seg_other',
          type: 'note',
          title: 'Other note',
          createdAt: '2026-06-04T10:00:00.000Z',
          updatedAt: '2026-06-04T10:05:00.000Z',
          bodyByteLength: 128,
          speechSynthesis: {
            status: 'missing',
            audioByteLength: null,
            contentHash: null,
            format: null,
            lastSynthesisAttempt: 'never',
            mimeType: null,
            model: null,
            reason: null,
            resourceId: null,
            sampleRate: null,
            speaker: null,
            updatedAt: null,
          },
          supplementCount: 1,
          supplements: [
            {
              workspaceId: 'ws_bridge',
              memoryId: 'mem_other',
              segmentId: 'seg_other',
              supplementId: 'sup_other_note',
              type: 'note',
              title: 'Other supplement',
              createdAt: '2026-06-04T10:06:00.000Z',
              updatedAt: '2026-06-04T10:06:00.000Z',
              bodyByteLength: 32,
            },
          ],
        },
      ],
    };
    const readMemoryDetail = vi.fn().mockResolvedValue(detailWithSupplement);
    const handler = createArtifactRuntimeMessageHandler(
      bridgeHandlerOptions({
        api: {},
        iframeRef: {
          current: { contentWindow: runtimeWindow } as HTMLIFrameElement,
        },
        memory: memoryDetail(),
        onProductMutation: vi.fn(),
        onRequestFullscreen: vi.fn(),
        onSelectObject,
        readMemoryDetail,
        src,
        target: {
          targetType: 'widget',
          workspaceId: 'ws_bridge',
          widgetId: 'wdg_bridge',
        },
        workspaceSession: session(),
      })
    );

    handler(
      messageEvent({
        data: {
          source: 'reo-render',
          type: 'request',
          requestId: 'req-widget-select-object',
          method: 'ui.selectObject',
          payload: {
            memoryId: 'mem_other',
            segmentId: 'seg_other',
            supplementId: 'sup_other_note',
          },
        },
        origin,
        source: runtimeWindow,
      })
    );
    await flushBridge();

    expect(readMemoryDetail).toHaveBeenCalledWith({ memoryId: 'mem_other' });
    expect(onSelectObject).toHaveBeenCalledWith({
      memoryId: 'mem_other',
      segmentId: 'seg_other',
      supplementId: 'sup_other_note',
    });
    expect((runtimeWindow.postMessage as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        requestId: 'req-widget-select-object',
        ok: true,
        value: { selected: true },
      })
    );
  });

  it('rejects workspace widget object selection when the target is not navigable', async () => {
    const src = workspaceWidgetRuntimeUrl({
      workspaceId: 'ws_bridge',
      widgetId: 'wdg_bridge',
      previewVersion: 'widget-v1',
    });
    const origin = new URL(src).origin;
    const runtimeWindow = { postMessage: vi.fn() } as unknown as WindowProxy;
    const onSelectObject = vi.fn(() => true);
    const readMemoryDetail = vi.fn().mockResolvedValue(otherMemoryDetail());
    const handler = createArtifactRuntimeMessageHandler(
      bridgeHandlerOptions({
        api: {},
        iframeRef: {
          current: { contentWindow: runtimeWindow } as HTMLIFrameElement,
        },
        memory: memoryDetail(),
        onProductMutation: vi.fn(),
        onRequestFullscreen: vi.fn(),
        onSelectObject,
        readMemoryDetail,
        src,
        target: {
          targetType: 'widget',
          workspaceId: 'ws_bridge',
          widgetId: 'wdg_bridge',
        },
        workspaceSession: session(),
      })
    );

    handler(
      messageEvent({
        data: {
          source: 'reo-render',
          type: 'request',
          requestId: 'req-widget-select-missing-object',
          method: 'ui.selectObject',
          payload: {
            memoryId: 'mem_other',
            segmentId: 'seg_other',
            supplementId: 'sup_missing',
          },
        },
        origin,
        source: runtimeWindow,
      })
    );
    await flushBridge();

    expect(onSelectObject).not.toHaveBeenCalled();
    expect((runtimeWindow.postMessage as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        requestId: 'req-widget-select-missing-object',
        ok: false,
        error: expect.objectContaining({
          code: 'ERR_REO_RUNTIME_OBJECT_NOT_FOUND',
        }),
      })
    );
  });

  it('lets runtime read any memory detail from the current workspace through the existing read model', async () => {
    const src = artifactSegmentRuntimeUrl({
      workspaceId: 'ws_bridge',
      segmentId: 'seg_bridge',
      previewVersion: 'v1',
    });
    const origin = new URL(src).origin;
    const runtimeWindow = { postMessage: vi.fn() } as unknown as WindowProxy;
    const readMemoryDetail = vi.fn().mockResolvedValue(otherMemoryDetail());

    const handler = createArtifactRuntimeMessageHandler(
      bridgeHandlerOptions({
        api: {},
        iframeRef: {
          current: { contentWindow: runtimeWindow } as HTMLIFrameElement,
        },
        memory: memoryDetail(),
        onProductMutation: vi.fn(),
        readMemoryDetail,
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
          source: 'reo-render',
          type: 'request',
          requestId: 'req-current-memory',
          method: 'content.readMemoryDetail',
        },
        origin,
        source: runtimeWindow,
      })
    );
    handler(
      messageEvent({
        data: {
          source: 'reo-render',
          type: 'request',
          requestId: 'req-other-memory',
          method: 'content.readMemoryDetail',
          payload: { memoryId: 'mem_other' },
        },
        origin,
        source: runtimeWindow,
      })
    );
    await flushBridge();

    expect(readMemoryDetail).toHaveBeenCalledTimes(1);
    expect(readMemoryDetail).toHaveBeenCalledWith({
      memoryId: 'mem_other',
    });
    expect(runtimeWindow.postMessage).toHaveBeenCalledWith(
      {
        source: 'reo-host',
        type: 'response',
        requestId: 'req-current-memory',
        ok: true,
        value: memoryDetail(),
      },
      origin
    );
    expect(runtimeWindow.postMessage).toHaveBeenCalledWith(
      {
        source: 'reo-host',
        type: 'response',
        requestId: 'req-other-memory',
        ok: true,
        value: otherMemoryDetail(),
      },
      origin
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
            source: 'reo-render',
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
          source: 'reo-render',
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

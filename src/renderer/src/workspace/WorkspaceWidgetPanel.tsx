import { useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppWindow, RefreshCw } from 'lucide-react';
import { workspaceWidgetRuntimeUrl } from '../../../workspace-contract/artifact-runtime-url';
import { Button } from '@/components/ui/button';
import {
  copyWidgetAgentPrompt,
  readArtifactRuntimeState,
  readExpressionPlaybackAudio,
  updateWidgetTitle,
  writeArtifactRuntimeState,
  type WorkspaceSession,
  type WorkspaceMemorySummary,
  type WorkspaceWidgetProjection,
} from './workspaceApi';
import { runtimeMemoryDetailQueryOptions } from './workspaceQueries';
import {
  useArtifactRuntimeBridge,
  type ArtifactRuntimeObjectSelectionTarget,
  type ReadMemoryDetailForRuntime,
} from './artifactRuntimeBridge';

type WorkspaceWidgetPanelProps = {
  readonly currentMemory?: WorkspaceMemorySummary | null;
  readonly id?: string;
  readonly onProductMutation: (value: unknown) => void;
  readonly onRequestAgentUpdate: (widget: WorkspaceWidgetProjection) => void;
  readonly onSelectMemory: (memoryId: string) => boolean;
  readonly onSelectObject: (target: ArtifactRuntimeObjectSelectionTarget) => boolean;
  readonly refreshVersion?: number;
  readonly widget: WorkspaceWidgetProjection;
  readonly workspaceSession: WorkspaceSession;
};

function WorkspaceWidgetFaultPanel({
  onRequestAgentUpdate,
  widget,
}: {
  readonly onRequestAgentUpdate: () => void;
  readonly widget: WorkspaceWidgetProjection;
}) {
  const fault = widget.runtimeFault;

  return (
    <div className="flex h-full min-h-0 flex-col justify-center gap-12 px-16 py-20">
      <div>
        <p className="text-ui-md font-semibold leading-ui-md text-foreground">组件无法加载</p>
        <p className="mt-6 text-ui-sm leading-ui-sm text-muted-foreground">
          {fault?.diagnostic ?? '这个组件的运行文件需要检查。'}
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="compact"
        className="w-fit gap-6"
        onClick={onRequestAgentUpdate}
      >
        <AppWindow className="size-[14px]" aria-hidden="true" />让 Agent 更新组件
      </Button>
    </div>
  );
}

export function WorkspaceWidgetPanel({
  currentMemory = null,
  id,
  onProductMutation,
  onRequestAgentUpdate,
  onSelectMemory,
  onSelectObject,
  refreshVersion = 0,
  widget,
  workspaceSession,
}: WorkspaceWidgetPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const queryClient = useQueryClient();
  const src = widget.runtimeFault
    ? null
    : workspaceWidgetRuntimeUrl({
        previewVersion: widget.previewVersion,
        widgetId: widget.widgetId,
        workspaceId: widget.workspaceId,
      });
  const bridgeApi = useMemo(
    () => ({
      copyWidgetAgentPrompt,
      readArtifactRuntimeState,
      readExpressionPlaybackAudio,
      updateWidgetTitle,
      writeArtifactRuntimeState,
    }),
    []
  );
  const readMemoryDetail = useMemo<ReadMemoryDetailForRuntime>(
    () =>
      async ({ memoryId }) => {
        const response = await queryClient.fetchQuery(
          runtimeMemoryDetailQueryOptions(workspaceSession, memoryId)
        );
        return response.detail;
      },
    [queryClient, workspaceSession]
  );

  useArtifactRuntimeBridge({
    api: bridgeApi,
    enabled: src !== null && !widget.runtimeFault,
    iframeRef,
    memory: currentMemory,
    onProductMutation,
    onRequestFullscreen: () => undefined,
    onSelectObject,
    onSelectMemory,
    readMemoryDetail,
    src: src ?? '',
    target: {
      targetType: 'widget',
      widgetId: widget.widgetId,
      workspaceId: widget.workspaceId,
    },
    workspaceSession,
  });

  if (widget.runtimeFault || src === null) {
    return (
      <section
        aria-label={`${widget.title} 组件`}
        className="flex h-full min-h-0 w-full flex-col bg-background"
        data-slot="workspace-widget-panel"
        id={id}
      >
        <WorkspaceWidgetFaultPanel
          widget={widget}
          onRequestAgentUpdate={() => onRequestAgentUpdate(widget)}
        />
      </section>
    );
  }

  return (
    <section
      aria-label={`${widget.title} 组件`}
      className="flex h-full min-h-0 w-full flex-col bg-background"
      data-slot="workspace-widget-panel"
      id={id}
    >
      <iframe
        key={`${src}:${refreshVersion}`}
        title={`组件：${widget.title}`}
        sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
        src={src}
        className="h-full w-full border-0 bg-background"
        data-slot="workspace-widget-preview-frame"
        ref={iframeRef}
        referrerPolicy="no-referrer"
      />
    </section>
  );
}

export function WorkspaceWidgetLoadingPanel() {
  return (
    <section
      aria-label="Widget"
      className="flex h-full min-h-0 w-full items-center justify-center bg-background px-16 py-20 text-ui-sm leading-ui-sm text-muted-foreground"
      data-slot="workspace-widget-panel"
    >
      <RefreshCw className="mr-8 size-[14px] animate-spin" aria-hidden="true" />
      正在加载 Widget
    </section>
  );
}

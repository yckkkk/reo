import { AppWindow, FileText, MoreHorizontal, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { homeComponentRuntimeUrl } from '../../../workspace-contract/artifact-runtime-url';
import { HOME_RECENT_EXPRESSIONS_COMPONENT_ID } from '../../../workspace-contract/workspace-contract';
import { MediaPlaybackControl } from '@/components/ui/media-playback-control';
import {
  useMediaPlaybackController,
  type MediaPlaybackPlayState,
} from '@/components/ui/useMediaPlaybackController';
import { cn } from '@/lib/utils';
import { recentExpressionGlyphToneStyle } from './covers/recentExpressionGlyphTone';
import { useRecentExpressionGlyphToneForImageSource } from './covers/useRecentExpressionGlyphToneForImageSource';
import { homeActionIconSource } from './homeActionIcons/homeActionIcons';
import {
  copyHomeComponentAgentPrompt,
  copyHomeComponentAbsolutePath,
  openHomeComponentDocument,
  readArtifactRuntimeState,
  readExpressionPlaybackAudio,
  revealHomeComponentInFinder,
  updateHomeComponentTitle,
  writeArtifactRuntimeState,
  type WorkspaceHomeComponent,
  type WorkspaceMemorySpace,
  type WorkspaceRecentExpressionItem,
  type WorkspaceSession,
} from './workspaceApi';
import {
  useArtifactRuntimeBridge,
  type ArtifactRuntimeMemorySelectionTarget,
  type ArtifactRuntimeObjectSelectionTarget,
  type ReadMemoryDetailForRuntime,
} from './artifactRuntimeBridge';
import { EntityActionMenu, type EntityActionMenuExtraAction } from './entityActionMenu';
import { workspaceErrorDisplayMessage } from './workspaceErrorMessages';

type HomeAction = {
  readonly description: string;
  readonly disabled?: boolean;
  readonly iconSrc: { readonly light: string; readonly dark: string };
  readonly id: 'write' | 'record' | 'create' | 'capture';
  readonly label: string;
  readonly onSelect?: (() => void) | undefined;
};

type RecentExpressionType = 'artifact' | 'audio' | 'note';

export type WorkspaceStarterHomeRecentExpression = {
  readonly coverImageSrc: string;
  readonly id: string;
  readonly playback?: {
    readonly kind: 'audio' | 'note-speech';
    readonly ref: {
      readonly workspaceId: string;
      readonly memoryId: string;
      readonly segmentId: string;
      readonly supplementId?: string;
    };
  };
  readonly preview: string;
  readonly time: string;
  readonly title: string;
  readonly type: RecentExpressionType;
};

const AUDIO_BADGE_LEVELS = [32, 58, 84, 48, 70, 42, 92];

type WorkspaceStarterHomeProps = {
  readonly activeHomeComponentId?: string | undefined;
  readonly homeComponents?: readonly WorkspaceHomeComponent[] | undefined;
  readonly homeMemorySpaces?: readonly WorkspaceMemorySpace[] | undefined;
  readonly homeRecentExpressionItems?: readonly WorkspaceRecentExpressionItem[] | undefined;
  readonly onOpenRecentExpression?:
    | ((expression: WorkspaceStarterHomeRecentExpression) => void)
    | undefined;
  readonly onCreateHomeComponent?: (() => void) | undefined;
  readonly onDeleteHomeComponent?: ((component: WorkspaceHomeComponent) => void) | undefined;
  readonly onHomeComponentTabChange?: ((componentId: string) => void) | undefined;
  readonly onHomeComponentRuntimeMutation?: ((value: unknown) => void) | undefined;
  readonly onHomeComponentSelectMemory?:
    | ((target: ArtifactRuntimeMemorySelectionTarget) => boolean | Promise<boolean>)
    | undefined;
  readonly onHomeComponentSelectObject?:
    | ((target: ArtifactRuntimeObjectSelectionTarget) => boolean | Promise<boolean>)
    | undefined;
  readonly onRequestHomeComponentAgentUpdate?:
    | ((component: WorkspaceHomeComponent) => void)
    | undefined;
  readonly onRenameHomeComponent?: ((component: WorkspaceHomeComponent) => void) | undefined;
  readonly readHomeComponentMemoryDetail?: ReadMemoryDetailForRuntime | undefined;
  readonly onStartArtifact?: (() => void) | undefined;
  readonly onStartCapture?: (() => void) | undefined;
  readonly onStartNote?: (() => void) | undefined;
  readonly onStartRecording?: (() => void) | undefined;
  readonly recentExpressions?: readonly WorkspaceStarterHomeRecentExpression[] | undefined;
  readonly recentExpressionsSkippedCount?: number | undefined;
  readonly recentExpressionsStatus?: 'error' | 'loading' | 'ready' | undefined;
  readonly workspaceSession?: WorkspaceSession | null | undefined;
};

function expressionTypeLabel(type: RecentExpressionType) {
  switch (type) {
    case 'artifact':
      return '作品';
    case 'audio':
      return '录音';
    case 'note':
      return '笔记';
  }
}

function expressionTypeTone(type: RecentExpressionType) {
  switch (type) {
    case 'artifact':
      return {
        badgeClassName: 'bg-brand-magenta',
        iconClassName: 'text-brand-magenta',
      };
    case 'audio':
      return {
        badgeClassName: 'bg-brand-ember',
        iconClassName: 'text-brand-ember',
      };
    case 'note':
      return {
        badgeClassName: 'bg-primary',
        iconClassName: 'text-primary',
      };
  }
}

function createRecentExpressionPlaybackRequestId(expressionId: string) {
  return `recent-expression-playback:${expressionId}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function playbackResponseMatchesRequest({
  expression,
  requestId,
  response,
}: {
  readonly expression: WorkspaceStarterHomeRecentExpression;
  readonly requestId: string;
  readonly response: Extract<
    Awaited<ReturnType<typeof readExpressionPlaybackAudio>>,
    { readonly ok: true }
  >['value'];
}) {
  const playback = expression.playback;
  if (!playback) {
    return false;
  }

  return (
    response.requestId === requestId &&
    response.workspaceId === playback.ref.workspaceId &&
    response.memoryId === playback.ref.memoryId &&
    response.segmentId === playback.ref.segmentId &&
    response.kind === playback.kind &&
    response.supplementId === playback.ref.supplementId
  );
}

export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) {
    return '早上好';
  }
  if (hour >= 12 && hour < 18) {
    return '下午好';
  }
  return '晚上好';
}

function actionTileClass(disabled: boolean) {
  return cn(
    'flex min-w-0 flex-col items-center text-center outline-none transition-transform duration-200 ease-out focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    disabled
      ? 'cursor-default'
      : 'group cursor-pointer will-change-transform hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0'
  );
}

function HomeActionTile({ action }: { readonly action: HomeAction }) {
  const disabled = action.disabled === true || action.onSelect === undefined;

  return (
    <button
      type="button"
      aria-label={action.label}
      disabled={disabled}
      className={actionTileClass(disabled)}
      onClick={action.onSelect}
    >
      <span
        className="reo-squircle relative block aspect-square w-full max-w-[152px] overflow-hidden rounded-[64px] bg-secondary"
        data-slot={`home-action-icon-slot-${action.id}`}
      >
        <img
          src={action.iconSrc.light}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover dark:hidden"
        />
        <img
          src={action.iconSrc.dark}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute inset-0 hidden h-full w-full object-cover dark:block"
        />
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-0 bg-foreground/0',
            disabled
              ? 'bg-background/30'
              : 'transition-colors duration-200 ease-out group-hover:bg-foreground/[0.05]'
          )}
          data-slot={`home-action-state-overlay-${action.id}`}
        />
      </span>
      <span
        className={cn(
          'mt-12 block min-w-0 text-body font-bold leading-body',
          disabled ? 'text-muted-foreground' : 'text-foreground'
        )}
      >
        {action.label}
      </span>
      <span className="mt-4 block max-w-[188px] text-ui-xs font-medium leading-ui-xs text-muted-foreground">
        {action.description}
      </span>
    </button>
  );
}

function RecentExpressionTypeIcon({
  expression,
  hovered,
  onTogglePlayback,
  playState,
}: {
  readonly expression: WorkspaceStarterHomeRecentExpression;
  readonly hovered: boolean;
  readonly onTogglePlayback: () => void;
  readonly playState: MediaPlaybackPlayState;
}) {
  const tone = expressionTypeTone(expression.type);
  const playable = expression.playback !== undefined;
  const glyphTone = useRecentExpressionGlyphToneForImageSource(expression.coverImageSrc);
  const playbackVisible = playable && (hovered || playState === 'playing');

  return (
    <span
      aria-label={expressionTypeLabel(expression.type)}
      className={cn(
        'reo-squircle relative isolate grid size-[34px] shrink-0 place-items-center overflow-hidden rounded-full',
        tone.badgeClassName
      )}
      data-expression-id={expression.id}
      data-slot="home-recent-expression-icon"
      style={recentExpressionGlyphToneStyle(glyphTone)}
    >
      <img
        alt=""
        aria-hidden="true"
        className="absolute inset-0 z-0 size-full object-cover"
        data-slot="home-recent-expression-cover"
        decoding="async"
        draggable={false}
        loading="lazy"
        src={expression.coverImageSrc}
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 z-[1] bg-background/0 transition-colors duration-150 ease-out',
          playable && (hovered || playState === 'playing') ? 'bg-background/30' : ''
        )}
        data-slot="home-recent-expression-scrim"
      />
      <span
        className={cn(
          'relative z-[2] grid size-full place-items-center text-[rgb(var(--recent-expression-glyph-r)_var(--recent-expression-glyph-g)_var(--recent-expression-glyph-b)/0.92)] drop-shadow-sm transition-opacity duration-150 ease-out',
          playbackVisible ? 'opacity-0' : 'opacity-100'
        )}
        data-slot="home-recent-expression-glyph"
      >
        {expression.type === 'audio' ? (
          <span
            aria-hidden="true"
            className="inline-flex h-[22px] w-[24px] items-center justify-center gap-[2px]"
            data-slot="home-recent-expression-waveform"
          >
            {AUDIO_BADGE_LEVELS.map((level, index) => (
              <span
                key={index}
                className="block w-[3px] rounded-full bg-current"
                style={{ height: `${Math.round(22 * (level / 100))}px` }}
              />
            ))}
          </span>
        ) : expression.type === 'artifact' ? (
          <AppWindow aria-hidden="true" className="size-[17px]" strokeWidth={1.9} />
        ) : (
          <FileText aria-hidden="true" className="size-[17px]" strokeWidth={1.9} />
        )}
      </span>
      <MediaPlaybackControl
        className="z-[3]"
        hovered={hovered}
        label={expression.title}
        playable={playable}
        playState={playState}
        onToggle={onTogglePlayback}
      />
    </span>
  );
}

function RecentExpressionTypeIconLayer({
  expression,
  onTogglePlayback,
  playState,
}: {
  readonly expression: WorkspaceStarterHomeRecentExpression;
  readonly onTogglePlayback: () => void;
  readonly playState: MediaPlaybackPlayState;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <span
      className="absolute left-16 top-1/2 z-[2] block -translate-y-1/2"
      onPointerEnter={() => {
        setHovered(true);
      }}
      onPointerLeave={() => {
        setHovered(false);
      }}
    >
      <RecentExpressionTypeIcon
        expression={expression}
        hovered={hovered}
        playState={playState}
        onTogglePlayback={onTogglePlayback}
      />
    </span>
  );
}

function RecentExpressionOpenButtonContent({
  expression,
}: {
  readonly expression: WorkspaceStarterHomeRecentExpression;
}) {
  return (
    <>
      <span aria-hidden="true" className="size-[34px]" />
      <span className="grid min-w-0 gap-2">
        <span className="min-w-0 truncate text-body font-bold leading-body text-foreground">
          {expression.title}
        </span>
        <span className="min-w-0 truncate text-ui-sm font-medium leading-ui-sm text-muted-foreground">
          {expression.preview}
        </span>
      </span>
      <span className="min-w-0 whitespace-nowrap text-ui-xs font-medium leading-ui-xs text-muted-foreground">
        {expression.time}
      </span>
    </>
  );
}

function RecentExpressionRow({
  expression,
  onOpenRecentExpression,
  onTogglePlayback,
  playState,
}: {
  readonly expression: WorkspaceStarterHomeRecentExpression;
  readonly onOpenRecentExpression?:
    | ((expression: WorkspaceStarterHomeRecentExpression) => void)
    | undefined;
  readonly onTogglePlayback: (expression: WorkspaceStarterHomeRecentExpression) => void;
  readonly playState: MediaPlaybackPlayState;
}) {
  return (
    <li className="relative min-w-0">
      <div className="group/recent-row relative min-w-0">
        <button
          type="button"
          aria-label={`打开近期表达 ${expression.title}`}
          className="grid min-h-[58px] w-full min-w-0 grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-[14px] rounded-lg px-16 py-8 text-left outline-none transition-colors duration-150 ease-out hover:bg-secondary/35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background group-hover/recent-row:bg-secondary/35"
          onClick={() => onOpenRecentExpression?.(expression)}
        >
          <RecentExpressionOpenButtonContent expression={expression} />
        </button>
        <RecentExpressionTypeIconLayer
          expression={expression}
          playState={playState}
          onTogglePlayback={() => {
            onTogglePlayback(expression);
          }}
        />
      </div>
    </li>
  );
}

function useHomeRecentExpressionPlayback(
  recentExpressions: readonly WorkspaceStarterHomeRecentExpression[]
) {
  const expressionsById = useMemo(
    () => new Map(recentExpressions.map((expression) => [expression.id, expression])),
    [recentExpressions]
  );
  const expressionsByIdRef = useRef(expressionsById);
  expressionsByIdRef.current = expressionsById;

  const loadSource = useCallback(async (expressionId: string) => {
    const expression = expressionsByIdRef.current.get(expressionId);
    if (!expression?.playback) {
      throw new Error('Recent expression playback is unavailable.');
    }

    const requestId = createRecentExpressionPlaybackRequestId(expression.id);
    const response = await readExpressionPlaybackAudio({
      ...expression.playback.ref,
      kind: expression.playback.kind,
      requestId,
    });

    if (!response.ok) {
      throw new Error(workspaceErrorDisplayMessage(response.error, '近期表达音频加载失败。'));
    }
    if (!playbackResponseMatchesRequest({ expression, requestId, response: response.value })) {
      throw new Error('Stale recent expression playback response');
    }

    return {
      audio: response.value.audio,
      mimeType: response.value.mimeType,
    };
  }, []);

  const playback = useMediaPlaybackController({ loadSource });
  const { activeId, stop } = playback;

  useEffect(() => {
    if (activeId !== null && !expressionsById.has(activeId)) {
      stop();
    }
  }, [activeId, expressionsById, stop]);

  return playback;
}

const HOME_COMPONENT_TAB_PREFIX = 'home-component-tab';
const HOME_COMPONENT_PANEL_PREFIX = 'home-component-panel';

function homeComponentTabDomId(componentId: string) {
  return `${HOME_COMPONENT_TAB_PREFIX}-${componentId}`;
}

function homeComponentPanelDomId(componentId: string) {
  return `${HOME_COMPONENT_PANEL_PREFIX}-${componentId}`;
}

function HomeComponentTabIcon({ component }: { readonly component: WorkspaceHomeComponent }) {
  const customIconKey =
    component.icon.source === 'custom-mask'
      ? `${component.icon.url}:${component.icon.version}`
      : '';
  const [customIconState, setCustomIconState] = useState<{
    readonly key: string;
    readonly status: 'pending' | 'ready' | 'failed';
  }>({ key: customIconKey, status: 'pending' });
  const customIconStatus =
    customIconState.key === customIconKey ? customIconState.status : 'pending';

  if (component.icon.source === 'custom-mask' && customIconStatus !== 'failed') {
    return (
      <span
        aria-hidden="true"
        className="relative inline-flex size-[15px] items-center justify-center"
        data-slot="home-component-tab-icon-custom-shell"
      >
        <AppWindow
          aria-hidden="true"
          className={cn(
            'absolute inset-0 m-auto size-[15px]',
            customIconStatus === 'ready' ? 'opacity-0' : 'opacity-100'
          )}
          strokeWidth={2}
        />
        <img
          alt=""
          aria-hidden="true"
          className={cn(
            'relative size-[15px] rounded-[3px] object-contain',
            customIconStatus === 'ready' ? 'opacity-100' : 'opacity-0'
          )}
          data-slot="home-component-tab-icon-custom"
          draggable={false}
          key={customIconKey}
          role="img"
          src={component.icon.url}
          onError={() => setCustomIconState({ key: customIconKey, status: 'failed' })}
          onLoad={() => setCustomIconState({ key: customIconKey, status: 'ready' })}
        />
      </span>
    );
  }

  return <AppWindow aria-hidden="true" className="size-[15px]" strokeWidth={2} />;
}

function HomeComponentActionsMenu({
  actionsAccessible,
  component,
  onDelete,
  onOpenChange,
  onRefresh,
  onRename,
  onRequestAgentUpdate,
}: {
  readonly actionsAccessible: boolean;
  readonly component: WorkspaceHomeComponent;
  readonly onDelete?: ((component: WorkspaceHomeComponent) => void) | undefined;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
  readonly onRefresh: (component: WorkspaceHomeComponent) => void;
  readonly onRename?: ((component: WorkspaceHomeComponent) => void) | undefined;
  readonly onRequestAgentUpdate?: ((component: WorkspaceHomeComponent) => void) | undefined;
}) {
  const actionIdentity = { componentId: component.componentId };
  const extraActions: EntityActionMenuExtraAction[] = [
    {
      icon: RefreshCw,
      label: '刷新页面',
      onSelect: () => onRefresh(component),
    },
  ];
  if (onRequestAgentUpdate) {
    extraActions.push({
      icon: AppWindow,
      items: [{ label: '更新组件', onSelect: () => onRequestAgentUpdate(component) }],
      kind: 'submenu',
      label: 'Agent 操作',
    });
  }

  return (
    <EntityActionMenu
      canDelete={Boolean(onDelete)}
      canRename={Boolean(onRename)}
      contentAlign="start"
      extraActions={extraActions}
      menuLabel={`${component.title} 更多操作`}
      onCopyAbsolutePath={() => copyHomeComponentAbsolutePath(actionIdentity)}
      onDelete={() => {
        onDelete?.(component);
      }}
      onOpenChange={onOpenChange}
      onOpenDefault={() => openHomeComponentDocument(actionIdentity)}
      onRename={() => {
        onRename?.(component);
      }}
      onRevealInFinder={() => revealHomeComponentInFinder(actionIdentity)}
      trigger={
        <button
          type="button"
          aria-label={`${component.title} 更多操作`}
          aria-hidden={actionsAccessible ? undefined : true}
          className={homeComponentTabMoreClassName(actionsAccessible)}
          data-slot="home-component-tab-menu-trigger"
          tabIndex={actionsAccessible ? 0 : -1}
        >
          <MoreHorizontal aria-hidden="true" className="size-[15px]" strokeWidth={2.2} />
        </button>
      }
    />
  );
}

function homeComponentTabMoreClassName(actionsAccessible: boolean) {
  const visibleClassName =
    'pointer-events-auto ml-[6px] max-w-[28px] scale-100 opacity-100 data-[state=open]:pointer-events-auto data-[state=open]:ml-[6px] data-[state=open]:max-w-[28px] data-[state=open]:scale-100 data-[state=open]:opacity-100';
  const hiddenClassName =
    'pointer-events-none ml-0 max-w-0 scale-75 opacity-0 group-hover/home-component-tab:pointer-events-auto group-hover/home-component-tab:ml-[6px] group-hover/home-component-tab:max-w-[28px] group-hover/home-component-tab:scale-100 group-hover/home-component-tab:opacity-100 focus-visible:pointer-events-auto focus-visible:ml-[6px] focus-visible:max-w-[28px] focus-visible:scale-100 focus-visible:opacity-100 data-[state=open]:pointer-events-auto data-[state=open]:ml-[6px] data-[state=open]:max-w-[28px] data-[state=open]:scale-100 data-[state=open]:opacity-100';

  return cn(
    'grid size-[28px] shrink-0 place-items-center overflow-hidden rounded-full text-muted-foreground outline-none transition-[max-width,margin-left,opacity,transform,background-color,color,box-shadow] duration-150 ease-out hover:bg-background/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-background/80 data-[state=open]:text-foreground motion-reduce:transition-none',
    actionsAccessible ? visibleClassName : hiddenClassName
  );
}

function HomeComponentTabButton({
  active,
  actions,
  children,
  icon,
  onFocusCapture,
  onPointerEnter,
  onPointerLeave,
  onSelect,
  panelId,
  tabId,
}: {
  readonly active: boolean;
  readonly actions?: ReactNode | undefined;
  readonly children: string;
  readonly icon: ReactNode;
  readonly onFocusCapture?: (() => void) | undefined;
  readonly onPointerEnter?: (() => void) | undefined;
  readonly onPointerLeave?: (() => void) | undefined;
  readonly onSelect: () => void;
  readonly panelId: string;
  readonly tabId: string;
}) {
  const shellClassName = cn(
    'inline-flex h-[38px] max-w-[220px] shrink-0 items-center rounded-full text-[13.5px] font-medium leading-none outline-none transition-colors duration-150 ease-out',
    active
      ? 'bg-secondary text-foreground'
      : 'text-muted-foreground hover:bg-secondary/45 hover:text-foreground'
  );
  const content = (
    <>
      <span
        className="grid size-[16px] shrink-0 place-items-center"
        data-slot="home-component-tab-icon"
      >
        {icon}
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </>
  );

  if (actions) {
    return (
      <div
        className={cn(shellClassName, 'group/home-component-tab pl-[16px] pr-[5px]')}
        onFocusCapture={onFocusCapture}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <button
          type="button"
          role="tab"
          id={tabId}
          aria-controls={panelId}
          aria-selected={active}
          className="inline-flex min-w-0 flex-1 items-center gap-[8px] rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          data-slot="home-component-tab"
          onClick={onSelect}
        >
          {content}
        </button>
        {actions}
      </div>
    );
  }

  return (
    <button
      type="button"
      role="tab"
      id={tabId}
      aria-controls={panelId}
      aria-selected={active}
      className={cn(
        shellClassName,
        'gap-[8px] px-[16px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      )}
      data-slot="home-component-tab"
      onClick={onSelect}
    >
      {content}
    </button>
  );
}

function HomeComponentContentRegion({
  children,
  panelId,
  tabId,
}: {
  readonly children: ReactNode;
  readonly panelId: string;
  readonly tabId: string;
}) {
  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      className="mt-[12px] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      data-slot="home-component-content-region"
    >
      {children}
    </div>
  );
}

function HomeRecentExpressionsContent({
  handleTogglePlayback,
  onOpenRecentExpression,
  playback,
  recentExpressions,
  recentExpressionsSkippedCount,
  recentExpressionsStatus,
}: {
  readonly handleTogglePlayback: (expression: WorkspaceStarterHomeRecentExpression) => void;
  readonly onOpenRecentExpression?:
    | ((expression: WorkspaceStarterHomeRecentExpression) => void)
    | undefined;
  readonly playback: ReturnType<typeof useHomeRecentExpressionPlayback>;
  readonly recentExpressions: readonly WorkspaceStarterHomeRecentExpression[];
  readonly recentExpressionsSkippedCount: number;
  readonly recentExpressionsStatus: 'error' | 'loading' | 'ready';
}) {
  return (
    <>
      {recentExpressionsSkippedCount > 0 ? (
        <p className="mb-[10px] shrink-0 text-ui-sm font-medium leading-ui-sm text-muted-foreground">
          部分记忆空间暂不可读
        </p>
      ) : null}
      {recentExpressionsStatus === 'loading' ? (
        <p
          className="min-h-56 shrink-0 rounded-lg py-16 text-ui-sm font-medium leading-ui-sm text-muted-foreground"
          data-slot="home-recent-expression-empty"
        >
          正在加载近期表达
        </p>
      ) : recentExpressions.length === 0 ? (
        <p
          className="min-h-56 shrink-0 rounded-lg py-16 text-ui-sm font-medium leading-ui-sm text-muted-foreground"
          data-slot="home-recent-expression-empty"
        >
          {recentExpressionsStatus === 'error' ? '近期表达加载失败' : '暂无近期表达'}
        </p>
      ) : (
        <ol
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-8 overflow-y-auto"
          data-slot="home-recent-expression-list"
        >
          {recentExpressions.map((expression) => (
            <RecentExpressionRow
              key={expression.id}
              expression={expression}
              onOpenRecentExpression={onOpenRecentExpression}
              onTogglePlayback={handleTogglePlayback}
              playState={playback.activeId === expression.id ? playback.playState : 'idle'}
            />
          ))}
        </ol>
      )}
    </>
  );
}

function HomeComponentRuntimePanel({
  component,
  homeMemorySpaces,
  homeRecentExpressions,
  onProductMutation,
  onRequestAgentUpdate,
  onSelectMemory,
  onSelectObject,
  readMemoryDetail,
  refreshVersion,
  workspaceSession,
}: {
  readonly component: WorkspaceHomeComponent;
  readonly homeMemorySpaces?: readonly WorkspaceMemorySpace[] | undefined;
  readonly homeRecentExpressions?: readonly WorkspaceRecentExpressionItem[] | undefined;
  readonly onProductMutation?: ((value: unknown) => void) | undefined;
  readonly onRequestAgentUpdate?: ((component: WorkspaceHomeComponent) => void) | undefined;
  readonly onSelectMemory?:
    | ((target: ArtifactRuntimeMemorySelectionTarget) => boolean | Promise<boolean>)
    | undefined;
  readonly onSelectObject?:
    | ((target: ArtifactRuntimeObjectSelectionTarget) => boolean | Promise<boolean>)
    | undefined;
  readonly readMemoryDetail?: ReadMemoryDetailForRuntime | undefined;
  readonly refreshVersion: number;
  readonly workspaceSession?: WorkspaceSession | null | undefined;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const fault = component.runtimeFault;
  const baseSrc =
    fault || !('previewVersion' in component)
      ? null
      : homeComponentRuntimeUrl({
          componentId: component.componentId,
          previewVersion: component.previewVersion,
        });
  const src =
    baseSrc && refreshVersion > 0
      ? `${baseSrc}&refresh=${encodeURIComponent(String(refreshVersion))}`
      : baseSrc;
  const bridgeApi = useMemo(
    () => ({
      copyHomeComponentAgentPrompt,
      readArtifactRuntimeState,
      readExpressionPlaybackAudio,
      updateHomeComponentTitle,
      writeArtifactRuntimeState,
    }),
    []
  );

  useArtifactRuntimeBridge({
    api: bridgeApi,
    enabled: src !== null,
    iframeRef,
    homeComponent: component,
    homeMemorySpaces,
    homeRecentExpressions,
    memory: null,
    onProductMutation: onProductMutation ?? (() => undefined),
    onRequestFullscreen: () => undefined,
    onSelectHomeMemory: onSelectMemory,
    onSelectHomeObject: onSelectObject,
    readMemoryDetail,
    src: src ?? '',
    target: {
      targetType: 'home-component',
      componentId: component.componentId,
    },
    workspaceSession: workspaceSession ?? undefined,
  });

  if (src === null) {
    return (
      <div className="flex min-h-[180px] min-w-0 flex-col items-start justify-center rounded-lg border border-dashed border-border/70 px-20 py-18">
        <p className="text-body font-bold leading-body text-foreground">组件无法加载</p>
        <p className="mt-8 max-w-[520px] text-ui-sm font-medium leading-ui-sm text-muted-foreground">
          {fault?.reason === 'missing-entry'
            ? '组件缺少 entry.html。'
            : fault?.reason === 'oversized-entry'
              ? '组件入口文件过大。'
              : '组件文件暂不可用。'}
        </p>
        {onRequestAgentUpdate ? (
          <button
            type="button"
            className="mt-16 inline-flex h-36 items-center rounded-lg bg-primary px-14 text-ui-sm font-bold leading-ui-sm text-primary-foreground outline-none transition-colors duration-150 ease-out hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={() => onRequestAgentUpdate(component)}
          >
            让 Agent 更新组件
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <iframe
      title={`组件：${component.title}`}
      src={src}
      className="min-h-0 min-w-0 flex-1 rounded-lg border border-border/60 bg-background"
      sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
      ref={iframeRef}
      referrerPolicy="no-referrer"
    />
  );
}

export function WorkspaceStarterHome({
  activeHomeComponentId,
  homeComponents = [],
  homeMemorySpaces = [],
  homeRecentExpressionItems = [],
  onOpenRecentExpression,
  onHomeComponentSelectMemory,
  onHomeComponentSelectObject,
  onCreateHomeComponent,
  onDeleteHomeComponent,
  onHomeComponentRuntimeMutation,
  onHomeComponentTabChange,
  onRequestHomeComponentAgentUpdate,
  onRenameHomeComponent,
  readHomeComponentMemoryDetail,
  onStartArtifact,
  onStartCapture,
  onStartNote,
  onStartRecording,
  recentExpressions = [],
  recentExpressionsSkippedCount = 0,
  recentExpressionsStatus = 'ready',
  workspaceSession,
}: WorkspaceStarterHomeProps) {
  const actions: readonly HomeAction[] = [
    {
      description: '记录你的想法与文字',
      iconSrc: homeActionIconSource('write'),
      id: 'write',
      label: '写下来',
      onSelect: onStartNote,
    },
    {
      description: '录制语音与声音片段',
      iconSrc: homeActionIconSource('record'),
      id: 'record',
      label: '录下来',
      onSelect: onStartRecording,
    },
    {
      description: '创建作品与内容片段',
      iconSrc: homeActionIconSource('create'),
      id: 'create',
      label: '造出来',
      onSelect: onStartArtifact,
    },
    {
      description: '敬请期待',
      disabled: true,
      iconSrc: homeActionIconSource('capture'),
      id: 'capture',
      label: '拍下来',
      onSelect: onStartCapture,
    },
  ];

  const greeting = greetingForHour(new Date().getHours());
  const playback = useHomeRecentExpressionPlayback(recentExpressions);
  const [homeComponentRefreshVersions, setHomeComponentRefreshVersions] = useState<
    Readonly<Record<string, number>>
  >({});
  const [visibleHomeComponentActionsId, setVisibleHomeComponentActionsId] = useState<string | null>(
    null
  );
  const [openHomeComponentActionsId, setOpenHomeComponentActionsId] = useState<string | null>(null);
  const activeCustomHomeComponent =
    activeHomeComponentId && activeHomeComponentId !== HOME_RECENT_EXPRESSIONS_COMPONENT_ID
      ? (homeComponents.find((component) => component.componentId === activeHomeComponentId) ??
        null)
      : null;
  const activeHomeComponentTitle = activeCustomHomeComponent?.title ?? '近期表达';
  const handleTogglePlayback = useCallback(
    (expression: WorkspaceStarterHomeRecentExpression) => {
      if (!expression.playback) {
        return;
      }
      void playback.toggle(expression.id);
    },
    [playback]
  );
  const refreshHomeComponent = useCallback((component: WorkspaceHomeComponent) => {
    setHomeComponentRefreshVersions((current) => ({
      ...current,
      [component.componentId]: (current[component.componentId] ?? 0) + 1,
    }));
  }, []);

  return (
    <section
      aria-label="首页"
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1120px] flex-col px-24 pb-24 pt-12 sm:px-32 lg:px-40">
        <header className="min-w-0 shrink-0 px-4">
          <p className="text-body font-medium leading-body text-muted-foreground">{greeting}</p>
          <h1 className="mt-8 min-w-0 text-heading font-bold leading-heading text-foreground">
            想到的，都留下来
          </h1>
        </header>

        <section
          aria-label="表达入口"
          className="mt-56 grid shrink-0 grid-cols-2 gap-x-22 gap-y-28 md:grid-cols-4"
        >
          {actions.map((action) => (
            <HomeActionTile key={action.id} action={action} />
          ))}
        </section>

        <section aria-label="主页组件" className="mt-40 flex min-h-0 min-w-0 flex-1 flex-col px-4">
          <div
            aria-label="主页组件"
            className="inline-flex max-w-full shrink-0 self-start items-center gap-[8px]"
            data-slot="home-component-tab-rail"
          >
            <div
              role="tablist"
              aria-label="主页组件"
              className="edge-fade-x flex min-w-0 max-w-full items-center gap-[4px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              data-slot="home-component-tab-scroller"
            >
              <HomeComponentTabButton
                active={activeCustomHomeComponent === null}
                icon={<FileText aria-hidden="true" className="size-[15px]" strokeWidth={2} />}
                onSelect={() => {
                  onHomeComponentTabChange?.(HOME_RECENT_EXPRESSIONS_COMPONENT_ID);
                }}
                panelId={homeComponentPanelDomId(HOME_RECENT_EXPRESSIONS_COMPONENT_ID)}
                tabId={homeComponentTabDomId(HOME_RECENT_EXPRESSIONS_COMPONENT_ID)}
              >
                近期表达
              </HomeComponentTabButton>
              {homeComponents.map((component) => {
                const actionsAccessible =
                  visibleHomeComponentActionsId === component.componentId ||
                  openHomeComponentActionsId === component.componentId;
                return (
                  <HomeComponentTabButton
                    key={component.componentId}
                    actions={
                      <HomeComponentActionsMenu
                        actionsAccessible={actionsAccessible}
                        component={component}
                        onDelete={onDeleteHomeComponent}
                        onOpenChange={(open) => {
                          setOpenHomeComponentActionsId(open ? component.componentId : null);
                          if (open) {
                            setVisibleHomeComponentActionsId(component.componentId);
                          }
                        }}
                        onRefresh={refreshHomeComponent}
                        onRename={onRenameHomeComponent}
                        onRequestAgentUpdate={onRequestHomeComponentAgentUpdate}
                      />
                    }
                    active={activeCustomHomeComponent?.componentId === component.componentId}
                    icon={<HomeComponentTabIcon component={component} />}
                    onFocusCapture={() => setVisibleHomeComponentActionsId(component.componentId)}
                    onPointerEnter={() => setVisibleHomeComponentActionsId(component.componentId)}
                    onPointerLeave={() => {
                      setVisibleHomeComponentActionsId((current) =>
                        current === component.componentId ? null : current
                      );
                    }}
                    onSelect={() => {
                      onHomeComponentTabChange?.(component.componentId);
                    }}
                    panelId={homeComponentPanelDomId(component.componentId)}
                    tabId={homeComponentTabDomId(component.componentId)}
                  >
                    {component.title}
                  </HomeComponentTabButton>
                );
              })}
            </div>
            <button
              type="button"
              aria-label="新增组件"
              className="grid size-[38px] shrink-0 place-items-center rounded-full text-muted-foreground outline-none transition-colors duration-150 ease-out hover:bg-secondary/45 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              data-slot="home-component-add-button"
              onClick={onCreateHomeComponent}
            >
              <Plus aria-hidden="true" className="size-[16px]" strokeWidth={2.1} />
            </button>
          </div>
          <h2
            className="mt-[16px] min-w-0 shrink-0 text-heading-sm font-bold leading-heading-sm text-foreground"
            data-slot="home-component-heading"
          >
            {activeHomeComponentTitle}
          </h2>
          {activeCustomHomeComponent ? (
            <HomeComponentContentRegion
              panelId={homeComponentPanelDomId(activeCustomHomeComponent.componentId)}
              tabId={homeComponentTabDomId(activeCustomHomeComponent.componentId)}
            >
              <HomeComponentRuntimePanel
                component={activeCustomHomeComponent}
                homeMemorySpaces={homeMemorySpaces}
                homeRecentExpressions={homeRecentExpressionItems}
                onProductMutation={onHomeComponentRuntimeMutation}
                onRequestAgentUpdate={onRequestHomeComponentAgentUpdate}
                onSelectMemory={onHomeComponentSelectMemory}
                onSelectObject={onHomeComponentSelectObject}
                readMemoryDetail={readHomeComponentMemoryDetail}
                refreshVersion={
                  homeComponentRefreshVersions[activeCustomHomeComponent.componentId] ?? 0
                }
                workspaceSession={workspaceSession}
              />
            </HomeComponentContentRegion>
          ) : (
            <HomeComponentContentRegion
              panelId={homeComponentPanelDomId(HOME_RECENT_EXPRESSIONS_COMPONENT_ID)}
              tabId={homeComponentTabDomId(HOME_RECENT_EXPRESSIONS_COMPONENT_ID)}
            >
              <HomeRecentExpressionsContent
                handleTogglePlayback={handleTogglePlayback}
                onOpenRecentExpression={onOpenRecentExpression}
                playback={playback}
                recentExpressions={recentExpressions}
                recentExpressionsSkippedCount={recentExpressionsSkippedCount}
                recentExpressionsStatus={recentExpressionsStatus}
              />
            </HomeComponentContentRegion>
          )}
        </section>
      </div>
    </section>
  );
}

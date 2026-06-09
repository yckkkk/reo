import { AppWindow, FileText } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MediaPlaybackControl } from '@/components/ui/media-playback-control';
import {
  useMediaPlaybackController,
  type MediaPlaybackPlayState,
} from '@/components/ui/useMediaPlaybackController';
import { cn } from '@/lib/utils';
import { recentExpressionGlyphToneStyle } from './covers/recentExpressionGlyphTone';
import { useRecentExpressionGlyphToneForImageSource } from './covers/useRecentExpressionGlyphToneForImageSource';
import { homeActionIconSource } from './homeActionIcons/homeActionIcons';
import { readExpressionPlaybackAudio } from './workspaceApi';
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
  readonly onOpenRecentExpression?:
    | ((expression: WorkspaceStarterHomeRecentExpression) => void)
    | undefined;
  readonly onStartArtifact?: (() => void) | undefined;
  readonly onStartCapture?: (() => void) | undefined;
  readonly onStartNote?: (() => void) | undefined;
  readonly onStartRecording?: (() => void) | undefined;
  readonly recentExpressions?: readonly WorkspaceStarterHomeRecentExpression[] | undefined;
  readonly recentExpressionsSkippedCount?: number | undefined;
  readonly recentExpressionsStatus?: 'error' | 'loading' | 'ready' | undefined;
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

export function WorkspaceStarterHome({
  onOpenRecentExpression,
  onStartArtifact,
  onStartCapture,
  onStartNote,
  onStartRecording,
  recentExpressions = [],
  recentExpressionsSkippedCount = 0,
  recentExpressionsStatus = 'ready',
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
  const handleTogglePlayback = useCallback(
    (expression: WorkspaceStarterHomeRecentExpression) => {
      if (!expression.playback) {
        return;
      }
      void playback.toggle(expression.id);
    },
    [playback]
  );

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

        <section
          aria-labelledby="home-recent-expressions-heading"
          className="mt-40 flex min-h-0 min-w-0 flex-1 flex-col px-4"
        >
          <h2
            id="home-recent-expressions-heading"
            className="min-w-0 shrink-0 text-heading-sm font-bold leading-heading-sm text-foreground"
          >
            近期表达
          </h2>
          {recentExpressionsSkippedCount > 0 ? (
            <p className="mt-12 shrink-0 text-ui-sm font-medium leading-ui-sm text-muted-foreground">
              部分记忆空间暂不可读
            </p>
          ) : null}
          {recentExpressionsStatus === 'loading' ? (
            <p className="mt-20 min-h-56 shrink-0 rounded-lg py-16 text-ui-sm font-medium leading-ui-sm text-muted-foreground">
              正在加载近期表达
            </p>
          ) : recentExpressions.length === 0 ? (
            <p className="mt-20 min-h-56 shrink-0 rounded-lg py-16 text-ui-sm font-medium leading-ui-sm text-muted-foreground">
              {recentExpressionsStatus === 'error' ? '近期表达加载失败' : '暂无近期表达'}
            </p>
          ) : (
            <ol className="mt-20 flex min-h-0 min-w-0 flex-1 flex-col gap-8 overflow-y-auto">
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
        </section>
      </div>
    </section>
  );
}

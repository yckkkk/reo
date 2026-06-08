import { AppWindow, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { homeActionIconSource } from './homeActionIcons/homeActionIcons';

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
  readonly id: string;
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
    'group flex min-w-0 flex-col items-center text-center outline-none transition-transform duration-200 ease-out focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
    disabled
      ? 'cursor-default opacity-[0.58] hover:translate-y-0 hover:bg-transparent'
      : 'cursor-pointer'
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
        className="reo-squircle relative block aspect-square w-full max-w-[152px] overflow-hidden rounded-[34px] bg-secondary"
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
          className="absolute inset-0 bg-foreground/0 transition-colors duration-200 ease-out group-hover:bg-foreground/[0.05]"
        />
      </span>
      <span className="mt-12 block min-w-0 text-body font-bold leading-body text-foreground">
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
}: {
  readonly expression: WorkspaceStarterHomeRecentExpression;
}) {
  const tone = expressionTypeTone(expression.type);

  return (
    <span
      aria-label={expressionTypeLabel(expression.type)}
      className={cn(
        'reo-squircle grid size-[34px] shrink-0 place-items-center rounded-full text-primary-foreground',
        tone.badgeClassName
      )}
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
  );
}

function RecentExpressionRow({
  expression,
  onOpenRecentExpression,
}: {
  readonly expression: WorkspaceStarterHomeRecentExpression;
  readonly onOpenRecentExpression?:
    | ((expression: WorkspaceStarterHomeRecentExpression) => void)
    | undefined;
}) {
  return (
    <li className="relative min-w-0">
      <button
        type="button"
        aria-label={`打开近期表达 ${expression.title}`}
        className="grid min-h-[58px] w-full min-w-0 grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-[14px] rounded-lg px-16 py-8 text-left outline-none transition-colors duration-150 ease-out hover:bg-secondary/35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={() => onOpenRecentExpression?.(expression)}
      >
        <RecentExpressionTypeIcon expression={expression} />
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
      </button>
    </li>
  );
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
                />
              ))}
            </ol>
          )}
        </section>
      </div>
    </section>
  );
}

import type { ReactNode } from 'react';
import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type MarkdownContentSurfaceProps = {
  readonly ariaLabelledBy?: string;
  readonly attachmentContext?:
    | {
        readonly kind: 'segment';
        readonly workspaceId: string;
        readonly segmentId: string;
      }
    | {
        readonly kind: 'segment-supplement';
        readonly workspaceId: string;
        readonly segmentId: string;
        readonly supplementId: string;
      };
  readonly bodyMarkdown?: string | undefined;
  readonly className?: string;
  readonly dataSlot?: string;
  readonly editLabel?: string;
  readonly emptyCopy?: string;
  readonly errorCopy?: string;
  readonly footer?: ReactNode;
  readonly id?: string;
  readonly loadingCopy?: string;
  readonly loading: boolean;
  readonly onEdit?: () => void;
  readonly role?: 'tabpanel';
  readonly showTitle?: boolean;
  readonly title: string;
};

type MarkdownImageToken = {
  readonly alt: string;
  readonly src: string;
};

function parseAttachmentImageSource(
  src: string,
  attachmentContext: MarkdownContentSurfaceProps['attachmentContext']
) {
  if (!attachmentContext || !src.startsWith('attachments/')) {
    return src;
  }
  const filename = src.slice('attachments/'.length);
  if (
    filename.length === 0 ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('..')
  ) {
    return src;
  }
  if (attachmentContext.kind === 'segment') {
    return `reo-attachment://${attachmentContext.workspaceId}/segments/${attachmentContext.segmentId}/${filename}`;
  }
  return `reo-attachment://${attachmentContext.workspaceId}/segments/${attachmentContext.segmentId}/supplements/${attachmentContext.supplementId}/${filename}`;
}

function renderMarkdownLine(
  line: string,
  attachmentContext: MarkdownContentSurfaceProps['attachmentContext'],
  lineIndex: number
) {
  const nodes: ReactNode[] = [];
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = imagePattern.exec(line)) !== null) {
    const raw = match[0];
    const alt = match[1] ?? '';
    const src = match[2] ?? '';
    if (match.index > cursor) {
      nodes.push(line.slice(cursor, match.index));
    }
    const image: MarkdownImageToken = {
      alt,
      src: parseAttachmentImageSource(src, attachmentContext),
    };
    nodes.push(
      <img
        key={`${lineIndex}:${match.index}:image`}
        alt={image.alt}
        src={image.src}
        className="my-8 max-h-[360px] max-w-full rounded-sm object-contain"
      />
    );
    cursor = match.index + raw.length;
  }

  if (cursor < line.length) {
    nodes.push(line.slice(cursor));
  }

  return nodes.length > 0 ? nodes : '\u00A0';
}

function MarkdownBody({
  attachmentContext,
  content,
  className,
}: {
  readonly attachmentContext: MarkdownContentSurfaceProps['attachmentContext'];
  readonly className: string;
  readonly content: string;
}) {
  const lines = content.split('\n');
  return (
    <div className={className}>
      {lines.map((line, index) => (
        <div key={index} className="min-h-[1.65em]">
          {renderMarkdownLine(line, attachmentContext, index)}
        </div>
      ))}
    </div>
  );
}

export function MarkdownContentSurface({
  ariaLabelledBy,
  attachmentContext,
  bodyMarkdown,
  className,
  dataSlot = 'markdown-content-surface',
  editLabel,
  emptyCopy = '这条笔记还没有正文。',
  errorCopy = '笔记内容加载失败，请重试。',
  footer,
  id,
  loadingCopy = '正在载入笔记内容。',
  loading,
  onEdit,
  role,
  showTitle = true,
  title,
}: MarkdownContentSurfaceProps) {
  const content = bodyMarkdown ?? '';
  const hasTitle = showTitle;
  const contentSpacingClassName = hasTitle ? 'mt-12' : 'mt-0';

  return (
    <section
      aria-label={title}
      aria-labelledby={ariaLabelledBy}
      data-component="markdown-content-surface"
      data-slot={dataSlot}
      id={id}
      role={role}
      className={[
        'reo-content-tab-panel-motion edge-fade-y scrollbar-hover relative min-h-0 flex-1 overflow-y-auto pr-8 pb-6',
        className ?? '',
      ].join(' ')}
    >
      {hasTitle ? (
        <div className="flex min-w-0 items-center justify-between gap-12">
          <h2 className="truncate text-body font-bold leading-body text-foreground">{title}</h2>
        </div>
      ) : null}
      {onEdit && editLabel ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghostIcon"
                size="icon"
                type="button"
                aria-label={editLabel}
                className="absolute right-0 top-0 z-[1] text-muted-foreground hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground"
                onClick={onEdit}
              >
                <Maximize2 aria-hidden="true" className="size-16" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">展开编辑</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
      {loading ? (
        <p
          role="status"
          className={[contentSpacingClassName, 'text-body leading-body text-muted-foreground'].join(
            ' '
          )}
        >
          {loadingCopy}
        </p>
      ) : bodyMarkdown === undefined ? (
        <p
          role="status"
          className={[contentSpacingClassName, 'text-body leading-body text-muted-foreground'].join(
            ' '
          )}
        >
          {errorCopy}
        </p>
      ) : content.trim().length === 0 ? (
        <p
          className={[contentSpacingClassName, 'text-body leading-body text-muted-foreground'].join(
            ' '
          )}
        >
          {emptyCopy}
        </p>
      ) : (
        <MarkdownBody
          attachmentContext={attachmentContext}
          content={content}
          className={[
            contentSpacingClassName,
            'whitespace-pre-wrap break-words font-sans text-body leading-body text-foreground',
          ].join(' ')}
        />
      )}
      {footer ? <div className="mt-12">{footer}</div> : null}
    </section>
  );
}

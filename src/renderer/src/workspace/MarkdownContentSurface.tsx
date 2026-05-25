import { useMemo, useRef, type MouseEvent, type ReactNode } from 'react';
import {
  createMarkdownAttachmentContext,
  markdownAttachmentContextKey,
  resolveMarkdownImageSource,
  type MarkdownAttachmentContext,
} from './markdownAttachmentSource';

type MarkdownContentSurfaceProps = {
  readonly ariaLabelledBy?: string;
  readonly attachmentContext?: MarkdownAttachmentContext;
  readonly bodyMarkdown?: string | undefined;
  readonly className?: string;
  readonly dataSlot?: string;
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
  readonly src: string | null;
};

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
      nodes.push(...renderMarkdownInlineText(line.slice(cursor, match.index), `${lineIndex}:text`));
    }
    const image: MarkdownImageToken = {
      alt,
      src: resolveMarkdownImageSource(src, attachmentContext),
    };
    nodes.push(
      <img
        key={`${lineIndex}:${match.index}:image`}
        alt={image.alt}
        data-reo-image-source={image.src ? undefined : 'unsupported'}
        src={image.src ?? undefined}
        className="my-8 max-h-[360px] max-w-full rounded-sm object-contain"
      />
    );
    cursor = match.index + raw.length;
  }

  if (cursor < line.length) {
    nodes.push(...renderMarkdownInlineText(line.slice(cursor), `${lineIndex}:tail`));
  }

  return nodes.length > 0 ? nodes : '\u00A0';
}

function renderMarkdownInlineText(text: string, keyPrefix: string) {
  const nodes: ReactNode[] = [];
  const inlinePattern = /(\*\*|__)(.+?)\1|(\*|_)([^*_]+?)\3/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = inlinePattern.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }
    const strongText = match[2];
    const emphasisText = match[4];
    nodes.push(
      strongText !== undefined ? (
        <strong key={`${keyPrefix}:${match.index}:strong`} className="font-bold">
          {strongText}
        </strong>
      ) : (
        <em key={`${keyPrefix}:${match.index}:emphasis`} className="italic">
          {emphasisText}
        </em>
      )
    );
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function readMarkdownHeading(line: string) {
  const match = /^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/.exec(line);
  if (!match) {
    return null;
  }
  return {
    level: Math.min(match[1]?.length ?? 1, 6),
    text: match[2] ?? '',
  };
}

function readMarkdownListItem(line: string, kind: 'ordered' | 'unordered') {
  const pattern = kind === 'ordered' ? /^(\s*)(\d+[.)])\s+(.+)$/ : /^(\s*)([-*+])\s+(.+)$/;
  const match = pattern.exec(line);
  if (!match) {
    return null;
  }
  const leadingWhitespace = match[1] ?? '';
  return {
    depth: Math.min(Math.floor(leadingWhitespace.replace(/\t/g, '    ').length / 2), 3),
    marker: match[2] ?? '',
    text: match[3] ?? '',
  };
}

function readMarkdownQuote(line: string) {
  const match = /^\s{0,3}(>+)\s?(.*)$/.exec(line);
  if (!match) {
    return null;
  }
  return {
    depth: Math.min(match[1]?.length ?? 1, 3),
    text: match[2] ?? '',
  };
}

function isMarkdownHorizontalRule(line: string) {
  return /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
}

function isMarkdownControlMarker(line: string) {
  return /^\s*\[toc\]\s*$/i.test(line);
}

function headingTagForLevel(level: number) {
  if (level === 1) {
    return 'h1';
  }
  if (level === 2) {
    return 'h2';
  }
  if (level === 3) {
    return 'h3';
  }
  if (level === 4) {
    return 'h4';
  }
  if (level === 5) {
    return 'h5';
  }
  return 'h6';
}

function headingClassForLevel(level: number) {
  if (level === 1) {
    return 'mt-16 first:mt-0 text-heading-sm font-bold leading-heading-sm text-foreground';
  }
  if (level === 2) {
    return 'mt-14 first:mt-0 text-subheading font-bold leading-subheading text-foreground';
  }
  return 'mt-12 first:mt-0 text-body font-bold leading-body text-foreground';
}

type MarkdownFenceStart = {
  readonly marker: string;
  readonly language: string;
};

function readMarkdownFenceStart(line: string): MarkdownFenceStart | null {
  const match = /^\s{0,3}(`{3,}|~{3,})\s*([^\s{]*)?.*$/.exec(line);
  if (!match) {
    return null;
  }
  return {
    marker: match[1] ?? '',
    language: match[2] ?? '',
  };
}

function isMarkdownFenceEnd(line: string, fence: MarkdownFenceStart) {
  const escapedMarkerChar = fence.marker.startsWith('`') ? '`' : '~';
  const pattern = new RegExp(`^\\s{0,3}${escapedMarkerChar}{${fence.marker.length},}\\s*$`);
  return pattern.test(line);
}

function listDepthClassName(depth: number) {
  if (depth === 1) {
    return 'ml-[18px]';
  }
  if (depth === 2) {
    return 'ml-[36px]';
  }
  if (depth >= 3) {
    return 'ml-[54px]';
  }
  return '';
}

function quoteDepthClassName(depth: number) {
  if (depth === 2) {
    return 'ml-[18px]';
  }
  if (depth >= 3) {
    return 'ml-[36px]';
  }
  return '';
}

function isYamlFrontmatterLine(line: string) {
  const trimmed = line.trim();
  return (
    trimmed.length === 0 || /^[A-Za-z][A-Za-z0-9_-]*:\s*/.test(trimmed) || /^-\s+/.test(trimmed)
  );
}

function readDisplayMarkdownContent(content: string) {
  const lines = content.split('\n');
  if (lines.length < 2) {
    return content;
  }

  if (lines[0]?.trim() !== '---') {
    return content;
  }

  const startIndex = 1;
  const firstContentLine = lines[startIndex]?.trim() ?? '';
  if (!/^[A-Za-z][A-Za-z0-9_-]*:\s*/.test(firstContentLine)) {
    return content;
  }

  const endIndex = lines.findIndex((line, index) => index > startIndex && line.trim() === '---');
  if (endIndex < 0) {
    return content;
  }

  const frontmatterLines = lines.slice(startIndex, endIndex);
  const hasDocumentMetadataKey = frontmatterLines.some((line) =>
    /^(title|author|date|tags|description):\s*/.test(line.trim())
  );
  if (!hasDocumentMetadataKey || frontmatterLines.some((line) => !isYamlFrontmatterLine(line))) {
    return content;
  }

  return lines
    .slice(endIndex + 1)
    .join('\n')
    .replace(/^\n+/, '');
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
  const blocks: ReactNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (isMarkdownControlMarker(line)) {
      continue;
    }

    const codeFence = readMarkdownFenceStart(line);
    if (codeFence !== null) {
      const codeLines: string[] = [];
      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1] ?? '';
        index += 1;
        if (isMarkdownFenceEnd(nextLine, codeFence)) {
          break;
        }
        codeLines.push(nextLine);
      }
      const codeText = codeLines.join('\n');
      blocks.push(
        <div key={index} className="my-10 overflow-hidden rounded-md bg-secondary text-foreground">
          {codeFence.language.length > 0 ? (
            <div className="flex h-28 items-center justify-end px-12 text-ui-sm font-bold leading-ui-sm text-muted-foreground">
              {codeFence.language}
            </div>
          ) : null}
          <pre className="scrollbar-hover overflow-x-auto px-12 py-10 font-mono text-ui-sm leading-ui-sm text-foreground">
            <code className="selectable-text whitespace-pre-wrap break-words">
              {codeText.length > 0 ? codeText : '\u00A0'}
            </code>
          </pre>
        </div>
      );
      continue;
    }

    const heading = readMarkdownHeading(line);
    if (heading) {
      const HeadingTag = headingTagForLevel(heading.level);
      blocks.push(
        <HeadingTag key={index} className={headingClassForLevel(heading.level)}>
          {renderMarkdownLine(heading.text, attachmentContext, index)}
        </HeadingTag>
      );
      continue;
    }

    if (isMarkdownHorizontalRule(line)) {
      blocks.push(
        <div key={index} className="py-[10px]" aria-hidden="true">
          <hr className="border-0 border-t border-border" />
        </div>
      );
      continue;
    }

    const quote = readMarkdownQuote(line);
    if (quote) {
      blocks.push(
        <blockquote
          key={index}
          data-quote-depth={quote.depth}
          className={[
            'my-[6px] min-h-[1.65em] border-l-2 border-border pl-12 text-muted-foreground',
            quoteDepthClassName(quote.depth),
          ].join(' ')}
        >
          {renderMarkdownLine(quote.text, attachmentContext, index)}
        </blockquote>
      );
      continue;
    }

    const unorderedItem = readMarkdownListItem(line, 'unordered');
    if (unorderedItem) {
      const items = [{ index, depth: unorderedItem.depth, text: unorderedItem.text }];
      while (index + 1 < lines.length) {
        const nextItem = readMarkdownListItem(lines[index + 1] ?? '', 'unordered');
        if (!nextItem) {
          break;
        }
        index += 1;
        items.push({ index, depth: nextItem.depth, text: nextItem.text });
      }
      blocks.push(
        <ul key={items[0]?.index ?? index} className="my-[6px] list-disc space-y-[2px] pl-[22px]">
          {items.map((item) => (
            <li
              key={item.index}
              data-list-depth={item.depth}
              className={['min-h-[1.65em]', listDepthClassName(item.depth)].join(' ')}
            >
              {renderMarkdownLine(item.text, attachmentContext, item.index)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    const orderedItem = readMarkdownListItem(line, 'ordered');
    if (orderedItem) {
      const items = [{ index, depth: orderedItem.depth, text: orderedItem.text }];
      while (index + 1 < lines.length) {
        const nextItem = readMarkdownListItem(lines[index + 1] ?? '', 'ordered');
        if (!nextItem) {
          break;
        }
        index += 1;
        items.push({ index, depth: nextItem.depth, text: nextItem.text });
      }
      blocks.push(
        <ol
          key={items[0]?.index ?? index}
          className="my-[6px] list-decimal space-y-[2px] pl-[24px]"
        >
          {items.map((item) => (
            <li
              key={item.index}
              data-list-depth={item.depth}
              className={['min-h-[1.65em]', listDepthClassName(item.depth)].join(' ')}
            >
              {renderMarkdownLine(item.text, attachmentContext, item.index)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (line.trim().length === 0) {
      blocks.push(
        <div key={index} className="min-h-[1.65em]" aria-hidden="true">
          {'\u00A0'}
        </div>
      );
      continue;
    }

    blocks.push(
      <p key={index} className="min-h-[1.65em]">
        {renderMarkdownLine(line, attachmentContext, index)}
      </p>
    );
  }

  return <div className={className}>{blocks}</div>;
}

export function MarkdownContentSurface({
  ariaLabelledBy,
  attachmentContext,
  bodyMarkdown,
  className,
  dataSlot = 'markdown-content-surface',
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
  const displayContent = useMemo(() => readDisplayMarkdownContent(content), [content]);
  const displayContentHasBody = useMemo(() => /\S/.test(displayContent), [displayContent]);
  const hasTitle = showTitle;
  const contentSpacingClassName = hasTitle ? 'mt-12' : 'mt-0';
  const editable = Boolean(onEdit) && !loading && bodyMarkdown !== undefined;
  const skipNextEditClickRef = useRef(false);
  const attachmentContextKey = markdownAttachmentContextKey(attachmentContext);
  const renderAttachmentContext = useMemo(
    () => createMarkdownAttachmentContext(attachmentContext),
    [attachmentContextKey]
  );
  const renderedMarkdownBody = useMemo(() => {
    return !displayContentHasBody ? null : (
      <MarkdownBody
        attachmentContext={renderAttachmentContext}
        content={displayContent}
        className={[
          contentSpacingClassName,
          'whitespace-pre-wrap break-words font-sans text-body leading-body text-foreground',
        ].join(' ')}
      />
    );
  }, [contentSpacingClassName, displayContent, displayContentHasBody, renderAttachmentContext]);

  function handleSurfaceMouseDown() {
    skipNextEditClickRef.current = Boolean(window.getSelection()?.toString());
  }

  function handleSurfaceClick(event: MouseEvent<HTMLElement>) {
    if (!editable || event.defaultPrevented || event.button !== 0) {
      return;
    }
    if (skipNextEditClickRef.current || window.getSelection()?.toString()) {
      skipNextEditClickRef.current = false;
      return;
    }
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('button,a,input,textarea,select,[role="button"],[data-no-edit-on-click]')
    ) {
      return;
    }
    onEdit?.();
  }

  return (
    <section
      aria-label={title}
      aria-labelledby={ariaLabelledBy}
      data-component="markdown-content-surface"
      data-slot={dataSlot}
      id={id}
      onClick={handleSurfaceClick}
      onMouseDown={handleSurfaceMouseDown}
      role={role}
      className={[
        'reo-content-tab-panel-motion edge-fade-y scrollbar-hover relative min-h-0 flex-1 overflow-y-auto pr-8 pb-6',
        editable ? 'cursor-text' : '',
        className ?? '',
      ].join(' ')}
    >
      {hasTitle ? (
        <div className="flex min-w-0 items-center justify-between gap-12">
          <h2 className="truncate text-body font-bold leading-body text-foreground">{title}</h2>
        </div>
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
      ) : !displayContentHasBody ? (
        <p
          className={[contentSpacingClassName, 'text-body leading-body text-muted-foreground'].join(
            ' '
          )}
        >
          {emptyCopy}
        </p>
      ) : (
        renderedMarkdownBody
      )}
      {footer ? <div className="mt-12">{footer}</div> : null}
    </section>
  );
}

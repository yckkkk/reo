import { Bold, Image, Italic, List, ListOrdered, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { LightweightMarkdownFormatAction } from './noteEditorModel';

const NOTE_MARKDOWN_FORMAT_CONTROLS = [
  { action: 'bold', icon: Bold, label: '粗体' },
  { action: 'emphasis', icon: Italic, label: '强调' },
  { action: 'image', icon: Image, label: '图片' },
  { action: 'bullet-list', icon: List, label: '项目列表' },
  { action: 'numbered-list', icon: ListOrdered, label: '编号列表' },
] satisfies readonly {
  readonly action: LightweightMarkdownFormatAction;
  readonly icon: LucideIcon;
  readonly label: string;
}[];

export function LightweightMarkdownToolbar({
  className,
  disabled = false,
  onAction,
}: {
  readonly className?: string;
  readonly disabled?: boolean;
  readonly onAction: (action: LightweightMarkdownFormatAction) => void;
}) {
  return (
    <TooltipProvider>
      <div aria-label="Markdown 格式工具栏" className={className} role="toolbar">
        {NOTE_MARKDOWN_FORMAT_CONTROLS.map((control) => {
          const Icon = control.icon;
          return (
            <Tooltip key={control.action}>
              <Button
                asChild
                className="!bg-transparent text-muted-foreground !transition-none hover:!bg-transparent hover:text-foreground active:!bg-transparent focus-visible:!bg-transparent disabled:!bg-transparent disabled:text-muted-foreground disabled:opacity-100"
                disabled={disabled}
                size="icon"
                variant="ghostIcon"
              >
                <TooltipTrigger
                  aria-label={control.label}
                  onClick={() => onAction(control.action)}
                  onMouseDown={(event) => event.preventDefault()}
                  type="button"
                >
                  <Icon aria-hidden="true" className="size-16" />
                </TooltipTrigger>
              </Button>
              <TooltipContent side="bottom">{control.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

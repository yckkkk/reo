import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type CarouselArrowButtonProps = {
  readonly ariaLabel: string;
  readonly direction: 'left' | 'right';
  readonly onClick: () => void;
};

export function CarouselArrowButton({ ariaLabel, direction, onClick }: CarouselArrowButtonProps) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;

  return (
    <TooltipProvider>
      <Tooltip>
        <Button
          asChild
          size="iconMedium"
          variant="secondary"
          className="!size-40 rounded-full border border-secondary bg-background text-foreground transition-colors duration-150 ease-out hover:border-secondary hover:bg-secondary hover:text-foreground"
        >
          <TooltipTrigger type="button" aria-label={ariaLabel} onClick={onClick}>
            <Icon aria-hidden="true" className="size-[17px]" />
          </TooltipTrigger>
        </Button>
        <TooltipContent side="bottom">{ariaLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

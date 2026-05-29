import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

describe('Tooltip primitive', () => {
  it('uses the Reo/Tiptap floating pill typography without an arrow', () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>设置</TooltipTrigger>
          <TooltipContent>跟随系统</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    const tooltip = document.querySelector('[data-slot="tooltip-content"]');
    if (!(tooltip instanceof HTMLElement)) {
      throw new Error('Tooltip content was not rendered');
    }
    expect(tooltip).toHaveClass(
      'reo-float-motion',
      'reo-squircle',
      'rounded-sm',
      'px-8',
      'py-[6px]',
      'text-ui-sm',
      'font-medium',
      'leading-[1.2]',
      'text-center',
      'shadow-float'
    );
    expect(document.querySelector('[data-slot="tooltip-arrow"]')).not.toBeInTheDocument();
  });
});

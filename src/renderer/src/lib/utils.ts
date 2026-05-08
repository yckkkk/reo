import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      leading: [
        'caption',
        'ui-xs',
        'ui-sm',
        'ui-md',
        'body',
        'body-lg',
        'subheading',
        'heading-sm',
        'heading',
        'heading-lg',
        'display',
      ],
      text: [
        'caption',
        'ui-xs',
        'ui-sm',
        'ui-md',
        'body',
        'body-lg',
        'subheading',
        'heading-sm',
        'heading',
        'heading-lg',
        'display',
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

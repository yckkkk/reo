import * as React from 'react';
import { cn } from '@/lib/utils';

function Breadcrumb({ ...props }: React.ComponentProps<'nav'>) {
  return <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />;
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-3 break-words text-ui-md leading-ui-md text-gravel',
        className
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn('inline-flex min-w-0 items-center gap-3', className)}
      {...props}
    />
  );
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-current="page"
      data-slot="breadcrumb-page"
      className={cn('min-w-0 font-medium text-obsidian', className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      aria-hidden="true"
      data-slot="breadcrumb-separator"
      role="presentation"
      className={cn('flex shrink-0 items-center text-slate', className)}
      {...props}
    >
      {children ?? <span className="size-4 rounded-full bg-current" />}
    </li>
  );
}

export { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator };

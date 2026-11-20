import React from 'react';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  title: React.ReactNode;
  /** One plain sentence on what the page is for. */
  description?: React.ReactNode;
  /** Short facts about the data on the page (e.g. "Last 30 days"), shown as quiet text. */
  meta?: React.ReactNode;
  /** Buttons and controls aligned to the right of the title. */
  actions?: React.ReactNode;
  /** Content inside the header card under a hairline: tabs, search, filters. */
  children?: React.ReactNode;
  /** Render without the card surface, for pages whose body is the card. */
  bare?: boolean;
  className?: string;
}

/**
 * The one page title pattern: title, plain description, actions on the right.
 * No icon tile, no status badge beside the title: a page states what it is and
 * lets its content carry the detail.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, meta, actions, children, bare, className }) => (
  <div
    className={cn(
      // Phones: an iOS large title on the page background, without the card.
      !bare && 'md:bg-white md:dark:bg-white/[0.03] md:border border-slate-900/[0.08] dark:border-white/[0.08] md:rounded-lg px-1 pt-1 pb-2 md:p-6',
      className
    )}
  >
    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[30px] leading-9 tracking-tight font-semibold md:text-2xl md:leading-8 md:tracking-normal md:font-medium text-slate-900 dark:text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">{description}</p>}
        {meta && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
    {children && <div className="mt-5 pt-5 border-t border-slate-900/[0.08] dark:border-white/[0.08]">{children}</div>}
  </div>
);

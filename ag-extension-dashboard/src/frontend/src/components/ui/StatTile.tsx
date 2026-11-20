import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface StatTileProps {
  label: string;
  icon?: LucideIcon | React.ElementType;
  /** The figure as shown. null means nothing was measured: the tile says so instead of printing 0. */
  value: React.ReactNode | null;
  /** What the figure counts, or how it changed; one short line. */
  note?: React.ReactNode;
  emptyText?: string;
  className?: string;
}

/**
 * One headline figure. Every tile looks the same: a neutral icon beside the
 * label, the figure in tabular numerals, an optional note. Colour is left to
 * the note (for a rise or fall), never to the tile.
 */
export const StatTile: React.FC<StatTileProps> = ({ label, icon: Icon, value, note, emptyText = 'No data yet', className }) => (
  <div role="group" aria-label={label} className={cn('bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-5', className)}>
    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
      {Icon && <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />}
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
    </div>
    {value === null ? (
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>
    ) : (
      <p className="mt-3 text-3xl leading-none font-medium tabular-nums text-slate-900 dark:text-white">{value}</p>
    )}
    {note && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{note}</p>}
  </div>
);

import React from 'react';
import { BarChart3, Table2 } from 'lucide-react';

export interface LegendItem {
  label: string;
  color: string;
}

/** Series names with their colours, in slot order. */
export const ChartLegend: React.FC<{ items: LegendItem[] }> = ({ items }) => (
  <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
    {items.map(item => (
      <li key={item.label} className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-theme-text-secondary">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} aria-hidden="true" />
        {item.label}
      </li>
    ))}
  </ul>
);

/** Shown in place of a chart with nothing to draw, at the chart's height so nothing jumps. */
export const ChartEmpty: React.FC<{ title: string; hint?: string; height: number }> = ({ title, hint, height }) => (
  <div className="flex flex-col items-center justify-center gap-1 px-6 text-center" style={{ minHeight: height }}>
    <BarChart3 className="mb-1 h-[18px] w-[18px] text-slate-400 dark:text-theme-text-muted" strokeWidth={1.5} aria-hidden="true" />
    <p className="text-sm font-medium text-slate-700 dark:text-theme-text-secondary">{title}</p>
    {hint && <p className="max-w-sm text-xs text-slate-600 dark:text-theme-text-muted">{hint}</p>}
  </div>
);

interface ViewToggleProps {
  showTable: boolean;
  onToggle: () => void;
  tableLabel: string;
  chartLabel: string;
}

/** Switches a chart between its picture and its table. */
export const ChartViewToggle: React.FC<ViewToggleProps> = ({ showTable, onToggle, tableLabel, chartLabel }) => {
  const Icon = showTable ? BarChart3 : Table2;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={showTable}
      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-slate-600 dark:text-theme-text-secondary hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
      {showTable ? chartLabel : tableLabel}
    </button>
  );
};

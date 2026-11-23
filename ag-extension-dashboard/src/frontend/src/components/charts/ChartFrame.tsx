import React, { useId, useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { ChartTable, type ChartColumn } from './ChartTable';
import { ChartEmpty, ChartLegend, ChartViewToggle, type LegendItem } from './ChartParts';

export const CHART_CARD =
  'rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-5';

export interface ChartFrameProps<Row> {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** Badges beside the title, such as "estimated". */
  aside?: React.ReactNode;
  /** Series names and colours; needed whenever a chart has two or more series. */
  legend?: LegendItem[];
  /** The numbers behind the chart. Adds a table view and a table for screen readers. */
  table?: { rows: Row[]; columns: ChartColumn<Row>[] };
  /** Shown in place of the chart when `isEmpty`. */
  empty: { title: string; hint?: string };
  isEmpty: boolean;
  /** Plot height in px, axis labels included. Leave out for lists that size themselves. */
  height?: number;
  /** No card of its own, for a chart inside a larger card. */
  bare?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Every chart's frame: title and description, legend, a switch to the table of numbers, and an
 * empty state at the chart's height. The drawn chart is hidden from screen readers, which read
 * the table instead.
 */
export function ChartFrame<Row>({
  title,
  description,
  icon,
  aside,
  legend,
  table,
  empty,
  isEmpty,
  height,
  bare = false,
  footer,
  children,
}: ChartFrameProps<Row>): React.ReactElement {
  const { t } = useLanguage();
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();
  const tableShown = Boolean(table) && showTable;

  return (
    <section aria-labelledby={titleId} className={bare ? 'space-y-4' : `${CHART_CARD} space-y-4`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 id={titleId} className="flex items-center gap-2 text-base font-medium text-slate-900 dark:text-white">
            {icon}
            {title}
          </h3>
          {description && <p className="text-xs text-slate-600 dark:text-theme-text-muted">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {aside}
          {legend && legend.length > 1 && !isEmpty && !tableShown && <ChartLegend items={legend} />}
          {table && !isEmpty && (
            <ChartViewToggle
              showTable={showTable}
              onToggle={() => setShowTable(shown => !shown)}
              tableLabel={t('chart_view_table', { defaultValue: 'Table' })}
              chartLabel={t('chart_view_chart', { defaultValue: 'Chart' })}
            />
          )}
        </div>
      </header>

      {isEmpty ? (
        <ChartEmpty title={empty.title} hint={empty.hint} height={Math.min(height ?? 160, 200)} />
      ) : tableShown && table ? (
        <ChartTable caption={title} rows={table.rows} columns={table.columns} />
      ) : (
        <>
          <div style={height ? { height } : undefined} aria-hidden={table ? true : undefined}>
            {children}
          </div>
          {table && <ChartTable caption={title} rows={table.rows} columns={table.columns} srOnly />}
        </>
      )}
      {footer}
    </section>
  );
}

import React from 'react';
import { formatNumber } from './chartFormat';

export interface ChartColumn<Row> {
  key: string;
  label: string;
  /** Right-aligned with tabular figures. */
  numeric?: boolean;
  /** Text for a cell; defaults to the row's value at `key`. */
  format?: (row: Row) => string;
}

interface ChartTableProps<Row> {
  caption: string;
  rows: Row[];
  columns: ChartColumn<Row>[];
  /** For screen readers only, beside a drawn chart. */
  srOnly?: boolean;
}

function cellText<Row>(row: Row, column: ChartColumn<Row>): string {
  if (column.format) return column.format(row);
  const value = (row as Record<string, unknown>)[column.key];
  if (typeof value === 'number') return formatNumber(value);
  return value === undefined || value === null ? '' : String(value);
}

/** The numbers behind a chart as a table: the chart's table view, and what screen readers get. */
export function ChartTable<Row>({
  caption,
  rows,
  columns,
  srOnly = false,
}: ChartTableProps<Row>): React.ReactElement {
  const table = (
    <table className={srOnly ? 'sr-only' : 'w-full text-sm'}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-slate-900/[0.08] dark:border-white/[0.08]">
          {columns.map(column => (
            <th
              key={column.key}
              scope="col"
              className={`py-2 pe-4 text-xs font-medium text-slate-600 dark:text-theme-text-muted ${column.numeric ? 'text-end' : 'text-start'}`}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={index}
            className="border-b border-slate-900/[0.05] dark:border-white/[0.05] last:border-0"
          >
            {columns.map(column => (
              <td
                key={column.key}
                className={`py-2 pe-4 ${column.numeric ? 'text-end tabular-nums text-slate-900 dark:text-theme-text-primary' : 'text-slate-700 dark:text-theme-text-secondary'}`}
              >
                {cellText(row, column)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
  if (srOnly) return table;
  // A wide table scrolls sideways; the region takes focus so the keyboard can scroll it too.
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
      {table}
    </div>
  );
}

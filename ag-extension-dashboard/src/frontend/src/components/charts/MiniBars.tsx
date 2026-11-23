import React from 'react';
import { seriesColor } from './chartConfig';
import { formatDay } from './chartFormat';

export interface MiniBarPoint {
  /** An ISO date. */
  date: string;
  value: number;
}

interface MiniBarsProps {
  points: MiniBarPoint[];
  /** The top of the scale, so bars compare against a known maximum rather than each other. */
  max: number;
  format: (value: number) => string;
  /** What the values are, for screen readers: "Vegetation index by day". */
  label: string;
  heightClass?: string;
}

/**
 * A run of small daily bars under a headline number, one colour, with the first and last day
 * of the bars actually drawn. Each bar names its day and value on hover; screen readers get
 * the same list.
 */
export const MiniBars: React.FC<MiniBarsProps> = ({ points, max, format, label, heightClass = 'h-14' }) => {
  if (points.length === 0) return null;
  const top = Math.max(max, ...points.map(point => point.value)) || 1;
  return (
    <figure className="mb-2">
      <div className={`flex items-end gap-0.5 ${heightClass}`} aria-hidden="true">
        {points.map(point => (
          <div
            key={point.date}
            title={`${formatDay(point.date)}: ${format(point.value)}`}
            className="flex-1 rounded-t-sm"
            style={{ height: `${point.value > 0 ? Math.max((point.value / top) * 100, 2) : 0}%`, background: seriesColor(0) }}
          />
        ))}
      </div>
      <figcaption className="mt-1 flex justify-between text-xs tabular-nums text-slate-600 dark:text-theme-text-muted">
        <span>{formatDay(points[0].date)}</span>
        <span>{formatDay(points[points.length - 1].date)}</span>
      </figcaption>
      <ul className="sr-only" aria-label={label}>
        {points.map(point => (
          <li key={point.date}>{`${formatDay(point.date)}: ${format(point.value)}`}</li>
        ))}
      </ul>
    </figure>
  );
};

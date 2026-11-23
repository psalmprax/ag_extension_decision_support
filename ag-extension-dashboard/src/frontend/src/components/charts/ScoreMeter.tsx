import React from 'react';
import { seriesColor } from './chartConfig';

interface ScoreMeterProps {
  /** Missing values draw an empty track, never a made-up fill. */
  value: number | null | undefined;
  max: number;
  heightClass?: string;
}

/** A single value against a fixed maximum (a score out of 100, a rating out of 5). The number is shown beside it. */
export const ScoreMeter: React.FC<ScoreMeterProps> = ({ value, max, heightClass = 'h-1.5' }) => {
  const known = typeof value === 'number' && Number.isFinite(value) && max > 0;
  const share = known ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={`w-full ${heightClass} overflow-hidden rounded-full bg-slate-900/[0.06] dark:bg-white/[0.08]`} aria-hidden="true">
      {known && <div className="h-full rounded-full" style={{ width: `${share}%`, background: seriesColor(0) }} />}
    </div>
  );
};

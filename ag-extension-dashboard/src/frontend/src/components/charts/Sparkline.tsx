import React from 'react';
import { seriesColor } from './chartConfig';

interface SparklineProps {
  values: number[];
  height?: number;
  color?: string;
}

/**
 * A small trend line under a stat tile: shape only, no axes. Draws nothing for fewer than two
 * points, so a trend is never implied from a single value.
 */
export const Sparkline: React.FC<SparklineProps> = ({ values, height = 28, color = seriesColor(0) }) => {
  const points = values.filter(Number.isFinite);
  if (points.length < 2) return null;
  const width = 100;
  const min = Math.min(...points);
  const span = Math.max(...points) - min || 1;
  const inset = 2;
  const coords = points.map((value, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = inset + (1 - (value - min) / span) * (height - inset * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} aria-hidden="true">
      <polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

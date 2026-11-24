import React from 'react';
import type { BoundaryPoint } from '@ag-extension/shared/api';
import { OUTLINE_SIZE, outlinePath } from './boundaryModel';

/** A small drawing of a field's mapped shape. */
export const BoundaryOutline: React.FC<{ points: BoundaryPoint[]; label: string; className?: string }> = ({ points, label, className = 'w-12 h-12' }) => (
  <svg viewBox={`0 0 ${OUTLINE_SIZE} ${OUTLINE_SIZE}`} className={`${className} shrink-0 text-emerald-700 dark:text-emerald-300`} role="img" aria-label={label}>
    <path d={outlinePath(points)} fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>
);

import { CH_COLORS } from '@/lib/colors';

/**
 * Shared Recharts configuration — one palette and one set of axis/grid/cursor
 * styles for every chart in the dashboard. The palette is a fixed semantic set
 * (so a "green" series stays green regardless of active theme), while the axis,
 * grid, and tooltip colors resolve through CSS variables and flip with
 * light/dark mode.
 */

export const CHART_PALETTE = [
  CH_COLORS.blue,
  CH_COLORS.green,
  CH_COLORS.purple,
  CH_COLORS.cyber,
  CH_COLORS.warning,
  CH_COLORS.error,
] as const;

/** Muted, theme-aware axis tick style. */
export const chartTick = {
  fontSize: 10,
  fontWeight: 600,
  fill: 'var(--color-on-surface-variant)',
} as const;

/** Subtle grid lines consistent with the rest of the UI. */
export const chartGrid = {
  stroke: 'var(--color-outline)',
  strokeOpacity: 0.15,
  strokeDasharray: '3 3',
  vertical: false,
} as const;

/** Tooltip cursor highlight. */
export const chartCursor = {
  fill: 'var(--color-outline)',
  fillOpacity: 0.1,
} as const;

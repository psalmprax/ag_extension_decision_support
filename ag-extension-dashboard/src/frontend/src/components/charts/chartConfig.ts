/**
 * Shared chart settings: series colours, axis ticks, grid, hover cursors and mark sizes,
 * so every chart reads the same way. Colours resolve through CSS variables emitted by the
 * theme (`--color-series-*`, `--color-text-muted`), so light and dark mode each get their
 * own validated steps rather than one colour forced onto both surfaces.
 */

/** Series slots the palette validates; anything past this folds into "Other". */
export const SERIES_COUNT = 6;

export const OTHER_SERIES_COLOR = 'var(--color-series-other)';

/** The colour for a series slot (0-based). Slots past the palette get the "Other" grey. */
export function seriesColor(slot: number): string {
  return slot >= 0 && slot < SERIES_COUNT ? `var(--color-series-${slot + 1})` : OTHER_SERIES_COLOR;
}

/** Status colours, only for values that mean good, warning or bad; always shown with a label. */
export const STATUS_COLOR = {
  good: 'var(--color-status-success)',
  warning: 'var(--color-status-warning)',
  bad: 'var(--color-status-error)',
  neutral: OTHER_SERIES_COLOR,
} as const;

/** Axis tick labels: muted text at a readable size, regular weight. */
export const chartTick = {
  fontSize: 11,
  fill: 'var(--color-text-muted)',
} as const;

/** Solid hairline grid, horizontal only, one shade off the surface. */
export const chartGrid = {
  stroke: 'var(--color-text-muted)',
  strokeOpacity: 0.14,
  vertical: false,
} as const;

/** Hover band behind a bar: a faint wash, never a block that hides the mark. */
export const barCursor = { fill: 'var(--color-text-muted)', fillOpacity: 0.08 } as const;

/** Hover line on a line chart. */
export const lineCursor = { stroke: 'var(--color-text-muted)', strokeOpacity: 0.35, strokeWidth: 1 } as const;

export const chartMargin = { top: 8, right: 12, bottom: 0, left: 0 } as const;

/** Rounded data end, square at the baseline. */
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];
export const MAX_BAR_SIZE = 48;
export const LINE_WIDTH = 2;
/** Room for the y-axis labels; compact numbers keep them short. */
export const Y_AXIS_WIDTH = 44;

/**
 * Keeps the first `max - 1` rows and adds the rest up as one "Other" row, so a chart never
 * needs a colour past the palette. Rows are expected largest first.
 */
export function foldToOther<Row extends { label: string; value: number }>(
  rows: Row[],
  otherLabel: string,
  max = SERIES_COUNT
): Array<{ label: string; value: number }> {
  if (rows.length <= max) return rows.map(({ label, value }) => ({ label, value }));
  const kept = rows.slice(0, max - 1).map(({ label, value }) => ({ label, value }));
  const rest = rows.slice(max - 1).reduce((sum, row) => sum + row.value, 0);
  return [...kept, { label: otherLabel, value: rest }];
}

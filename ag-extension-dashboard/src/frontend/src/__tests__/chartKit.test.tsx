import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { RankedBars } from '@/components/charts/RankedBars';
import { Sparkline } from '@/components/charts/Sparkline';
import { foldToOther, seriesColor } from '@/components/charts/chartConfig';
import { formatCompact, formatMoney, percentChange } from '@/components/charts/chartFormat';
import { getDarkThemeCSS, getThemeCSS } from '@/theme';

const cssValue = (css: string, name: string) => css.match(new RegExp(`${name}: ([^;]+);`))?.[1];

describe('chart colours', () => {
  it('gives each of the six slots its own colour and folds the rest into "Other"', () => {
    expect(seriesColor(0)).toBe('var(--color-series-1)');
    expect(seriesColor(5)).toBe('var(--color-series-6)');
    expect(seriesColor(6)).toBe('var(--color-series-other)');
    const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((label, i) => ({ label, value: 10 - i }));
    const folded = foldToOther(rows, 'Other');
    expect(folded).toHaveLength(6);
    expect(folded[5]).toEqual({ label: 'Other', value: 5 + 4 + 3 });
  });

  it('emits separate validated steps for light and dark mode, field green first', () => {
    expect(cssValue(getThemeCSS('forest'), '--color-series-1')).toBe('#1f8053');
    expect(cssValue(getDarkThemeCSS('forest'), '--color-series-1')).toBe('#4e9e73');
    expect(cssValue(getDarkThemeCSS('oceanic'), '--color-series-2')).toBe('#3987e5');
  });
});

describe('chart numbers', () => {
  it('keeps one decimal on compact axis labels instead of rounding 3,500 to 4K', () => {
    expect(formatCompact(3500)).toBe('3.5K');
    expect(formatCompact(14000)).toBe('14K');
  });

  it('formats money with its currency and works out change only when it can', () => {
    expect(formatMoney(12500, 'KES')).toMatch(/12,500/);
    expect(formatMoney(12500, 'KES')).toMatch(/KES|Ksh/);
    expect(percentChange(4, 5)).toBe(25);
    expect(percentChange(0, 5)).toBeNull();
  });
});

describe('ChartTooltip', () => {
  const entry = (name: string, value: number) => ({ name, value, color: 'red', payload: { formatted: 'KES 12,500' } });

  it('never guesses a unit from the series name', () => {
    render(<ChartTooltip active payload={[entry('Chats', 12)]} label="Mon" />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.queryByText(/\d ha\b/)).not.toBeInTheDocument();
  });

  it('uses the chart’s formatter, with the hovered row, on an opaque panel in both modes', () => {
    const { container } = render(
      <ChartTooltip active payload={[entry('Price', 12500)]} valueFormatter={(_value, _name, row) => String(row?.formatted)} />
    );
    expect(screen.getByText('KES 12,500')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('bg-white', 'dark:bg-theme-bg-tertiary');
  });
});

describe('ChartFrame', () => {
  const table = {
    rows: [{ day: 'Mon', visits: 3 }],
    columns: [
      { key: 'day', label: 'Day' },
      { key: 'visits', label: 'Visits', numeric: true },
    ],
  };

  it('shows an empty state instead of a blank chart', () => {
    render(
      <ChartFrame title="Activity" isEmpty empty={{ title: 'No activity yet', hint: 'Visits are counted daily.' }} table={table} height={300}>
        <div data-testid="plot" />
      </ChartFrame>
    );
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
    expect(screen.queryByTestId('plot')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Table' })).not.toBeInTheDocument();
  });

  it('switches to a table of the numbers, and keeps one for screen readers while the chart shows', () => {
    render(
      <ChartFrame title="Activity" isEmpty={false} empty={{ title: 'None' }} table={table} height={300}>
        <div data-testid="plot" />
      </ChartFrame>
    );
    expect(screen.getByTestId('plot').parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('table', { hidden: true })).toHaveClass('sr-only');
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    expect(screen.queryByTestId('plot')).not.toBeInTheDocument();
    const shown = screen.getByRole('table');
    expect(within(shown).getByText('Visits')).toBeInTheDocument();
    expect(within(shown).getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chart' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a legend only when there are two or more series', () => {
    const { rerender } = render(
      <ChartFrame title="One" isEmpty={false} empty={{ title: 'None' }} legend={[{ label: 'Visits', color: 'red' }]}>
        <div />
      </ChartFrame>
    );
    expect(screen.queryByText('Visits')).not.toBeInTheDocument();
    rerender(
      <ChartFrame title="Two" isEmpty={false} empty={{ title: 'None' }} legend={[{ label: 'Visits', color: 'red' }, { label: 'Chats', color: 'blue' }]}>
        <div />
      </ChartFrame>
    );
    expect(screen.getByText('Visits')).toBeInTheDocument();
    expect(screen.getByText('Chats')).toBeInTheDocument();
  });
});

describe('RankedBars', () => {
  it('lists rows largest first with every value printed', () => {
    const rows = [{ label: 'Beans', value: 2 }, { label: 'Maize', value: 5, detail: '62%' }];
    render(<RankedBars label="Crops" rows={rows} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Maize');
    expect(items[0]).toHaveTextContent('5');
    expect(items[0]).toHaveTextContent('62%');
    expect(items[1]).toHaveTextContent('Beans');
    expect(rows.map(row => row.label)).toEqual(['Beans', 'Maize']);
  });

  it('keeps a fixed order when asked, and draws no bar for zero', () => {
    const { container } = render(
      <RankedBars label="States" sort={false} rows={[{ label: 'Queued', value: 0 }, { label: 'Done', value: 4 }]} />
    );
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Queued');
    const fills = container.querySelectorAll('[aria-hidden="true"] > div');
    expect((fills[0] as HTMLElement).style.width).toBe('0%');
    expect((fills[1] as HTMLElement).style.width).toBe('100%');
  });
});

describe('Sparkline', () => {
  it('draws nothing from a single value, so no trend is implied', () => {
    const { container } = render(<Sparkline values={[4]} />);
    expect(container.querySelector('svg')).toBeNull();
  });
});

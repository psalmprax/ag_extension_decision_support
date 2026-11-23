import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FarmerYieldChart } from '@/components/FarmerYieldChart';
import { DistributionPanels } from '@/components/dashboard/DistributionPanels';
import { AgentActivityPanels } from '@/pages/agents/AgentActivityPanels';
import { KnowledgeStats } from '@/components/KnowledgeBase/KnowledgeStats';
import { FarmerYieldList } from '@/components/farmer/FarmerYieldList';
import { cleanPoints } from '@/components/KnowledgeBase/answerChartData';
import { eventTrends } from '@/pages/telemetry/eventTrends';
import { fillActivityDays } from '@/pages/analytics/activityDays';
import { formatTrend, priceCurrency } from '@/components/market/marketPriceModel';
import type { Farmer } from '@/types/dashboard';
import type { TelemetryEvent } from '@/api/telemetryService';
import { resolveEffectiveFarmers } from '@/hooks/useAppQueries';

const farmer = (yieldHistory?: Array<{ month: string; yield: number }>) => ({ id: 'f1', yieldHistory }) as unknown as Farmer;
const t = (key: string, fallback?: string) => fallback ?? key;

describe('farmer yield chart', () => {
  it('works the change out from the farmer’s own harvests instead of a fixed "+12%"', () => {
    render(<FarmerYieldChart farmer={farmer([{ month: 'Jan', yield: 4 }, { month: 'Jun', yield: 5 }])} radiusClass="" />);
    expect(screen.getByText('+25% since Jan')).toBeInTheDocument();
    expect(screen.queryByText(/\+12%/)).not.toBeInTheDocument();
  });

  it('shows no change with a single harvest, and an empty state with none', () => {
    const { rerender } = render(<FarmerYieldChart farmer={farmer([{ month: 'Jan', yield: 4 }])} radiusClass="" />);
    expect(screen.queryByText(/since/)).not.toBeInTheDocument();
    rerender(<FarmerYieldChart farmer={farmer([])} radiusClass="" />);
    expect(screen.getByText('No harvests recorded yet')).toBeInTheDocument();
  });
});

describe('farmer records for the farmer panel', () => {
  it('keeps the vital score and harvests the server sends', () => {
    const [mapped] = resolveEffectiveFarmers(
      [{ id: 'f1', firstName: 'David', lastName: 'Mwangi', vitalScore: 72, yieldHistory: [{ month: 'Jan', yield: 3.8 }] } as never],
      [],
      false
    );
    expect(mapped.vitalScore).toBe(72);
    expect(mapped.yieldHistory).toEqual([{ month: 'Jan', yield: 3.8 }]);
  });
});

describe('dashboard crops grown', () => {
  it('shows the number of farmers per crop and their share', () => {
    render(
      <DistributionPanels
        t={t}
        cardClass=""
        dashboardData={{ crops: [{ name: 'maize', count: 16, percentage: 62 }], geography: [{ region: 'Rift Valley', farmers: 26 }] } as never}
      />
    );
    const maize = screen.getByText('Maize').closest('li')!;
    expect(maize).toHaveTextContent('16 farmers');
    expect(maize).toHaveTextContent('62%');
    expect(screen.getByText('Rift Valley').closest('li')).toHaveTextContent('26 farmers');
  });
});

describe('assistant task panels', () => {
  it('counts the handoffs listed instead of claiming "0 errors"', () => {
    render(
      <AgentActivityPanels
        queueStatus={{ queued: 1, active: 0, completed: 3, failed: 2 }}
        handoffs={[{ from: 'triage', to: 'agronomist', taskId: 't1', reason: 'pest', timestamp: '2026-11-20T10:00:00Z' }]}
      />
    );
    expect(screen.queryByText(/0 errors/)).not.toBeInTheDocument();
    expect(screen.getByText('1 handoffs')).toBeInTheDocument();
    expect(screen.getByText('6 tasks')).toBeInTheDocument();
    expect(screen.getByText('Failed').closest('li')).toHaveTextContent('2');
  });

  it('says there are no tasks rather than drawing an empty ring', () => {
    render(<AgentActivityPanels queueStatus={{ queued: 0, active: 0, completed: 0, failed: 0 }} handoffs={[]} />);
    expect(screen.getByText('No tasks yet')).toBeInTheDocument();
  });
});

describe('knowledge stats', () => {
  it('reads the crop and topic names the server sends, and no made-up hit rate', () => {
    render(
      <KnowledgeStats
        data={{
          crops: [{ crop: 'maize', count: '7' }],
          categories: [{ category: 'pest_control', count: 3 }],
          totalQueries: 20,
          cachedQueries: 4,
          totalArticles: 10,
          embeddedArticles: 9,
        }}
      />
    );
    expect(screen.getByText('Maize').closest('li')).toHaveTextContent('7');
    expect(screen.getByText('Pest control').closest('li')).toHaveTextContent('3');
    expect(screen.getByText('9 of 10')).toBeInTheDocument();
    expect(screen.queryByText(/hit rate/i)).not.toBeInTheDocument();
  });
});

describe('farmer yields list', () => {
  it('labels yields by month, not "PHASE_1"', () => {
    render(<FarmerYieldList records={[{ month: 'Jan', yield: 3.4 }]} />);
    expect(screen.getByText('Jan').closest('li')).toHaveTextContent('3.4 t/ha');
    expect(screen.queryByText(/PHASE/)).not.toBeInTheDocument();
  });
});

describe('chart data helpers', () => {
  it('drops AI chart points without a label or a number', () => {
    expect(cleanPoints([{ label: 'Maize', value: '4' }, { label: '', value: 2 }, { label: 'Beans', value: 'x' }, null])).toEqual([
      { label: 'Maize', value: 4 },
    ]);
    expect(cleanPoints('not a list')).toEqual([]);
  });

  it('builds telemetry trends from real events only', () => {
    const at = (minute: number, status = 'success', durationMs = 100): TelemetryEvent => ({
      id: String(minute),
      eventType: 'request',
      status,
      durationMs,
      timestamp: new Date(Date.UTC(2026, 10, 20, 10, minute)).toISOString(),
    });
    expect(eventTrends([at(0)])).toEqual({ requests: [], responseMs: [], errorPercent: [], costUsd: [] });
    // Two equal time slices: minute 0 in the first, minutes 5 and 10 in the second.
    const trends = eventTrends([at(0), at(5, 'error', 300), at(10)], 2);
    expect(trends.requests).toEqual([1, 2]);
    expect(trends.errorPercent).toEqual([0, 50]);
    expect(trends.responseMs).toEqual([100, 200]);
  });

  it('fills quiet days with zeros so the activity line does not skip them', () => {
    const days = fillActivityDays([{ date: '2026-11-20T00:00:00.000Z', visits: '2', queries: 1 }], 3, new Date(Date.UTC(2026, 10, 21)));
    expect(days).toEqual([
      { date: '2026-11-19', visits: 0, queries: 0 },
      { date: '2026-11-20', visits: 2, queries: 1 },
      { date: '2026-11-21', visits: 0, queries: 0 },
    ]);
  });

  it('shows no rise for an unchanged price and finds the currency', () => {
    expect(formatTrend(0)).toBe('0.0%');
    expect(formatTrend(3.24)).toBe('+3.2%');
    expect(priceCurrency('KES 12,500')).toBe('KES');
    expect(priceCurrency('$1,234')).toBeNull();
  });
});

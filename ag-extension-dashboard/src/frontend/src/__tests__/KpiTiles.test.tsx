import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiTiles } from '@/pages/analytics/KpiTiles';
import { SupportEfficiencyCard } from '@/components/dashboard/SupportEfficiencyCard';
import { useAppStore } from '@/store/useAppStore';

const t = (key: string, fallback?: string) => fallback ?? key;

describe('KpiTiles', () => {
  it('says "No data yet" instead of 0 when nothing was measured', () => {
    render(
      <KpiTiles
        t={t}
        metrics={{
          resolutionRate: null,
          avgResponseTime: null,
          satisfactionScore: null,
          followUpRate: null,
          firstContactResolution: null,
          samples: { conversations: 0, replied: 0, ratings: 0, completedVisits: 0 },
        }}
      />,
    );
    expect(screen.getAllByText('No data yet')).toHaveLength(5);
    expect(screen.queryByText(/^0/)).not.toBeInTheDocument();
  });

  it('shows units and the sample each figure rests on', () => {
    render(
      <KpiTiles
        t={t}
        metrics={{
          resolutionRate: 70,
          avgResponseTime: 2.3,
          satisfactionScore: 4.3,
          followUpRate: 25,
          firstContactResolution: 40,
          samples: { conversations: 10, replied: 4, ratings: 1, completedVisits: 12 },
        }}
      />,
    );
    expect(screen.getByText('2.3 min')).toBeInTheDocument();
    expect(screen.getByText('4.3 / 5')).toBeInTheDocument();
    expect(screen.getByText('Farmer rating, 1–5 · 1 rating')).toBeInTheDocument();
    expect(screen.getByText('Completed visits needing a follow-up · 12 visits')).toBeInTheDocument();
  });
});

describe('SupportEfficiencyCard', () => {
  it('does not draw 0% for metrics that were never measured', () => {
    render(
      <SupportEfficiencyCard
        t={(key, fallback) => fallback ?? key}
        cardClass=""
        performanceData={{ metrics: { resolutionRate: null, satisfactionScore: null } }}
      />,
    );
    expect(screen.getAllByText('No data yet')).toHaveLength(2);
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('shows satisfaction on its 1–5 scale', () => {
    render(
      <SupportEfficiencyCard
        t={key => key}
        cardClass=""
        performanceData={{ metrics: { resolutionRate: 82, satisfactionScore: 4.6 } }}
      />,
    );
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('4.6 / 5')).toBeInTheDocument();
  });

  afterEach(() => useAppStore.setState({ user: null } as never));

  it('tells a free-plan user the figures are Pro analytics instead of loading forever', () => {
    useAppStore.setState({ user: { id: 'o1', role: 'extension_officer', planName: 'Free', isFree: true } } as never);
    render(<SupportEfficiencyCard t={key => key} cardClass="" performanceData={undefined} />);
    expect(screen.getByText('dash_support_efficiency_pro_only')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeNull();
  });
});

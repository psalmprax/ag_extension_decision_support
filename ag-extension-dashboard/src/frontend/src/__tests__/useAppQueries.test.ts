import { describe, it, expect } from 'vitest';
import {
  buildCropDistribution,
  buildDemoDashboardData,
  buildDemoPerformanceData,
  buildRegionBreakdown,
  resolveEffectiveFarmers,
} from '@/hooks/useAppQueries';
import { DEMO_FARMERS } from '@/data/demoFarmers';
import type { Farmer } from '@/store/useAppStore';

type FarmerWithYield = Farmer & { yield?: number };

function sum(numbers: number[]): number {
  return numbers.reduce((total, n) => total + n, 0);
}

describe('useAppQueries demo metrics', () => {
  it('falls back to DEMO_FARMERS when demo mode has no live or store farmers', () => {
    const result = resolveEffectiveFarmers([], [], true);

    expect(result).toBe(DEMO_FARMERS);
    expect(result).toHaveLength(12);
  });

  it('derives dashboard overview totals from DEMO_FARMERS', () => {
    const dashboard = buildDemoDashboardData(DEMO_FARMERS);

    const expectedHectares = sum(DEMO_FARMERS.map(f => f.farmSize));
    const expectedAvgYield = sum(DEMO_FARMERS.map(f => f.yield)) / DEMO_FARMERS.length;

    expect(dashboard.overview.totalFarmers).toBe(DEMO_FARMERS.length);
    expect(dashboard.overview.totalHectares).toBeCloseTo(expectedHectares, 2);
    expect(dashboard.overview.avgYield).toBeCloseTo(expectedAvgYield, 1);
  });

  it('locks the known demo numbers so real and demo accounts stay aligned', () => {
    const dashboard = buildDemoDashboardData(DEMO_FARMERS);

    expect(dashboard.overview.totalFarmers).toBe(12);
    expect(dashboard.overview.totalHectares).toBeCloseTo(44.1, 2);
    expect(dashboard.overview.avgYield).toBeCloseTo(6.7, 1);
  });

  it('derives crop distribution from the farmers dataset', () => {
    const crops = buildCropDistribution(DEMO_FARMERS);

    const expectedMaize = DEMO_FARMERS.filter(f => f.crops.includes('Maize')).length;
    const expectedCoffee = DEMO_FARMERS.filter(f => f.crops.includes('Coffee')).length;
    const expectedTea = DEMO_FARMERS.filter(f => f.crops.includes('Tea')).length;

    const countFor = (name: string) => crops.find(c => c.name === name)?.count ?? 0;

    expect(countFor('Maize')).toBe(expectedMaize);
    expect(countFor('Coffee')).toBe(expectedCoffee);
    expect(countFor('Tea')).toBe(expectedTea);
    // Every crop mention across all farmers is counted.
    expect(sum(crops.map(c => c.count))).toBe(sum(DEMO_FARMERS.map(f => f.crops.length)));
  });

  it('derives region breakdown from the farmers dataset', () => {
    const geography = buildRegionBreakdown(DEMO_FARMERS);

    const distinctRegions = new Set(DEMO_FARMERS.map(f => f.region)).size;
    expect(geography).toHaveLength(distinctRegions);
    expect(sum(geography.map(g => g.farmers))).toBe(DEMO_FARMERS.length);
  });

  it('derives performance data from the farmer count', () => {
    const performance = buildDemoPerformanceData(DEMO_FARMERS);

    // resolutionRate = (total - 1) / total, one decimal place
    const expectedResolution = Math.round(((DEMO_FARMERS.length - 1) / DEMO_FARMERS.length) * 1000) / 10;

    expect(performance.metrics.resolutionRate).toBe(expectedResolution);
    expect(performance.timeline).toHaveLength(6);
    expect(performance.timeline.every(t => t.farmers === DEMO_FARMERS.length)).toBe(true);
  });

  it('is driven by input, not hardcoded to the demo dataset', () => {
    const synthetic: FarmerWithYield[] = [
      { id: 'a', firstName: 'A', lastName: 'A', region: 'North', crops: ['Maize', 'Beans'], farmSize: 2, yield: 4 },
      { id: 'b', firstName: 'B', lastName: 'B', region: 'North', crops: ['Maize'], farmSize: 3, yield: 8 },
    ];

    const dashboard = buildDemoDashboardData(synthetic);

    expect(dashboard.overview.totalFarmers).toBe(2);
    expect(dashboard.overview.totalHectares).toBe(5);
    expect(dashboard.overview.avgYield).toBe(6);
    expect(dashboard.geography).toEqual([{ region: 'North', farmers: 2 }]);
    expect(dashboard.crops.find(c => c.name === 'Maize')?.count).toBe(2);
  });
});

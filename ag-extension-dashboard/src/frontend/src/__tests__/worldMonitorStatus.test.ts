import { describe, it, expect } from 'vitest';
import { liveLayersSummary, pestSwarmLabel } from '@/pages/worldMonitorStatus';

describe('WorldMonitor pest swarm labels', () => {
  it('never shows a missing data source as zero clusters', () => {
    expect(pestSwarmLabel({ status: 'no_data_source', clusters: [] })).toBe('No data source');
    expect(pestSwarmLabel({ status: 'unavailable', clusters: [] })).toBe('Unavailable');
  });

  it('shows real counts for a live source, including zero', () => {
    expect(pestSwarmLabel({ status: 'live', clusters: [] })).toBe('0 clusters');
    expect(pestSwarmLabel({ status: 'live', clusters: [{}] })).toBe('1 cluster');
    expect(pestSwarmLabel({ status: 'live', clusters: [{}, {}] })).toBe('2 clusters');
  });

  it('treats a status-less response (older backend) as live, and no data as not loaded', () => {
    expect(pestSwarmLabel({ clusters: [{}, {}, {}] })).toBe('3 clusters');
    expect(pestSwarmLabel(undefined)).toBe('—');
  });

  it('only counts pest swarm as a live layer when it is live', () => {
    expect(liveLayersSummary('live')).toMatch(/^4 live layers/);
    expect(liveLayersSummary(undefined)).toMatch(/^4 live layers/);
    expect(liveLayersSummary('no_data_source')).toMatch(/^3 live layers.*pest swarm is not connected/);
    expect(liveLayersSummary('unavailable')).toMatch(/^3 live layers/);
  });
});

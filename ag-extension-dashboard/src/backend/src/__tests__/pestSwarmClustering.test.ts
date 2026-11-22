import { clusterPestSightings, type PestSightingReport } from '../services/pestSwarmRadarService';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('Pest sighting clustering', () => {
    it('clusters spatial sightings into active epidemic swarms', () => {
      const sightings: PestSightingReport[] = [
        {
          id: 's1',
          pestType: 'desert_locust',
          lat: 0.5,
          lng: 36.0,
          county: 'Baringo',
          severity: 'dense_plague',
          reportedAt: '2026-09-01T00:00:00Z',
          reporterRole: 'extension_officer',
        },
        {
          id: 's2',
          pestType: 'desert_locust',
          lat: 0.52,
          lng: 36.05,
          county: 'Baringo',
          severity: 'moderate_swarm',
          reportedAt: '2026-09-01T00:05:00Z',
          reporterRole: 'farmer',
        },
      ];

      const clusters = clusterPestSightings(sightings, 30.0);
      expect(clusters.length).toBe(1);
      expect(clusters[0].severityLevel).toBe('critical');
      expect(clusters[0].sightingCount).toBe(2);
    });
});

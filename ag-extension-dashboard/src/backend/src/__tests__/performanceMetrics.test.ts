import { formatPerformanceMetrics } from '@/services/analytics/performanceMetrics';

const rows = (row: Record<string, unknown>) => [row];

describe('support KPIs', () => {
    it('reports no value (not 0) when there is nothing to measure', () => {
        const metrics = formatPerformanceMetrics([
            rows({ avg_minutes: null, replied: '0' }),
            rows({ total: '0', resolved: '0' }),
            rows({ avg: null, rated: '0' }),
            rows({ completed: '0', follow_ups: '0' }),
            rows({ total: '0', first_contact: '0' }),
        ]);
        expect(metrics).toEqual({
            avgResponseTime: null,
            resolutionRate: null,
            satisfactionScore: null,
            followUpRate: null,
            firstContactResolution: null,
            samples: { conversations: 0, replied: 0, ratings: 0, completedVisits: 0 },
        });
    });

    it('computes each rate against its own denominator', () => {
        const metrics = formatPerformanceMetrics([
            rows({ avg_minutes: '2.34', replied: '4' }),
            rows({ total: '10', resolved: '7' }),
            rows({ avg: '4.25', rated: '3' }),
            // 3 follow-ups across 12 completed visits; the old formula divided by days (3/30 → 10%).
            rows({ completed: '12', follow_ups: '3' }),
            // First-contact resolution is its own count, not the overall resolution rate.
            rows({ total: '10', first_contact: '4' }),
        ]);
        expect(metrics).toMatchObject({
            avgResponseTime: 2.3,
            resolutionRate: 70,
            satisfactionScore: 4.3,
            followUpRate: 25,
            firstContactResolution: 40,
            samples: { conversations: 10, replied: 4, ratings: 3, completedVisits: 12 },
        });
    });
});

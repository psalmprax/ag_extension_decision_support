import express from 'express';
import request from 'supertest';
import telemetryRouter from '@/routes/pillars/telemetry';
import * as weatherHazardDaemonService from '@/services/weatherHazardDaemonService';

jest.mock('@/middleware/usageMiddleware', () => ({
    checkUsageLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const app = express();
app.use(express.json());
app.use(telemetryRouter);

describe('Forecast threshold endpoint validation', () => {
    const day = {
        date: '2026-11-08', minTempC: 1, maxTempC: 15,
        precipitationMm: 0, relativeHumidityPct: 60, windSpeedKmh: 5,
    };

    it('evaluates valid caller-supplied forecasts with provenance', async () => {
        const result = await request(app).post('/hazard/evaluate').send({ forecast: [day] }).expect(200);
        expect(result.body.data.hazards[0].hazardType).toBe('frost');
        expect(JSON.stringify(result.body.data.provenance)).toContain('caller-supplied forecast');
    });

    it.each([
        [], [{ ...day, relativeHumidityPct: 101 }], [{ ...day, precipitationMm: -1 }],
        [{ ...day, windSpeedKmh: -1 }], [{ ...day, minTempC: 20 }], [{ ...day, date: '' }],
        Array.from({ length: 15 }, () => day),
    ])('rejects invalid forecasts', async (...forecast) => {
        await request(app).post('/hazard/evaluate').send({ forecast }).expect(400);
    });
});

describe('Proactive hazard scan recipient validation', () => {
    const day = {
        date: '2026-11-08', minTempC: 1, maxTempC: 15,
        precipitationMm: 0, relativeHumidityPct: 60, windSpeedKmh: 5,
    };
    const scan = jest.spyOn(weatherHazardDaemonService, 'runProactiveHazardScan');

    beforeEach(() => {
        jest.clearAllMocks();
        scan.mockResolvedValue({} as Awaited<ReturnType<typeof weatherHazardDaemonService.runProactiveHazardScan>>);
    });

    it('preserves explicit farmer IDs through the HTTP route', async () => {
        const farmerIds = ['00000000-0000-4000-8000-000000000001'];
        await request(app).post('/hazard/scan')
            .send({ county: 'Nakuru', forecast: [day], farmerIds }).expect(200);
        expect(scan).toHaveBeenCalledWith({ county: 'Nakuru', forecast: [day], farmerIds });
    });

    it('preserves an empty farmer selection through the HTTP route', async () => {
        await request(app).post('/hazard/scan')
            .send({ county: 'Nakuru', forecast: [day], farmerIds: [] }).expect(200);
        expect(scan).toHaveBeenCalledWith({ county: 'Nakuru', forecast: [day], farmerIds: [] });
    });
});

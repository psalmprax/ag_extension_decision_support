import express from 'express';
import request from 'supertest';
import {
    outbreakService,
    K_ANONYMITY_MIN,
    ALERT_THRESHOLD,
    applyDifferentialPrivacyPerturbation,
    projectAtmosphericDispersalCone,
} from '../services/outbreakService';
import { query } from '../services/databaseService';
import outbreakRouter from '../routes/outbreaks';

jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => ({ query: jest.fn() })),
    query: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), crit: jest.fn() },
}));

jest.mock('../middleware/authorize', () => ({
    authorize: () => (req: express.Request & { user?: unknown }, _res: express.Response, next: express.NextFunction) => {
        req.user = { userId: 'officer-1', role: 'extension_officer', email: 'officer@example.com' };
        next();
    },
}));

const mockQuery = query as jest.Mock;

const app = express();
app.use(express.json());
app.use('/api/outbreaks', outbreakRouter);

describe('outbreakService', () => {
    beforeEach(() => mockQuery.mockReset());

    it('records diagnosis events with district and source', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
        await outbreakService.recordDiagnosisEvent({
            farmerId: 'f-1', district: 'Lilongwe', crop: 'maize', diseaseLabel: 'fall_armyworm', confidence: 0.92,
        });
        const call = mockQuery.mock.calls[0];
        expect(String(call[0])).toMatch(/INSERT INTO diagnosis_events/);
        expect(call[1]).toEqual(['f-1', 'Lilongwe', 'maize', 'fall_armyworm', 0.92, 'extension_tool']);
    });

    it('enforces the k-anonymity floor in SQL and never surfaces smaller clusters', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                { district: 'Lilongwe', crop: 'maize', disease_label: 'fall_armyworm', case_count: '9', distinct_farmers: '5', first_seen: new Date(), last_seen: new Date(), centroid_lat: null, centroid_lng: null },
            ],
            rowCount: 1,
        });
        const clusters = await outbreakService.getClusters({ days: 14 });
        const sql = mockQuery.mock.calls[0][0] as string;
        expect(sql).toMatch(/HAVING COUNT\(DISTINCT de\.farmer_id\) >= \$2/);
        expect(mockQuery.mock.calls[0][1]).toContain(K_ANONYMITY_MIN);
        expect(clusters[0].caseCount).toBe(9);
        expect(clusters[0].distinctFarmers).toBe(5);
        expect(clusters[0].centroid).toBeNull();
    });

    it('applies differential privacy perturbation to cluster centroids (IR-004)', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    district: 'Lilongwe',
                    crop: 'maize',
                    disease_label: 'fall_armyworm',
                    case_count: '9',
                    distinct_farmers: '5',
                    first_seen: new Date(),
                    last_seen: new Date(),
                    centroid_lat: '-13.900000',
                    centroid_lng: '33.700000',
                },
            ],
            rowCount: 1,
        });
        const clusters = await outbreakService.getClusters({ days: 14, enableDifferentialPrivacy: true });
        expect(clusters).toHaveLength(1);
        expect(clusters[0].differentialPrivacyApplied).toBe(true);
        expect(clusters[0].centroid).not.toBeNull();
        // Perturbed coordinates should be numerically valid and close to original
        expect(Math.abs(clusters[0].centroid!.lat - (-13.9))).toBeLessThan(0.01);
        expect(Math.abs(clusters[0].centroid!.lng - 33.7)).toBeLessThan(0.01);
    });

    it('flags clusters at or above the alert threshold', async () => {
        const cluster = { district: 'Lilongwe', crop: 'maize', diseaseLabel: 'fall_armyworm', caseCount: ALERT_THRESHOLD, distinctFarmers: 5, firstSeen: new Date(), lastSeen: new Date(), centroid: { lat: -13.9, lng: 33.7 } };
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        jest.spyOn(outbreakService, 'getClusters').mockResolvedValueOnce([
            cluster,
            { ...cluster, caseCount: ALERT_THRESHOLD - 1, district: 'Salima' },
        ]);
        const alerted = await outbreakService.getAlertedDistricts();
        expect(alerted).toHaveLength(1);
        expect(alerted[0].district).toBe('Lilongwe');
    });

    it('falls back to same-region adjacency when the curated table is empty', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockQuery.mockResolvedValueOnce({ rows: [{ district: 'Salima' }, { district: 'Dedza' }], rowCount: 2 });

        const adjacent = await outbreakService.getAdjacentDistricts('Lilongwe');
        expect(adjacent).toEqual(['Salima', 'Dedza']);
        expect(String(mockQuery.mock.calls[1][0])).toMatch(/f1\.region = f2\.region/);
    });

    it('uses the curated adjacency table when populated', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ adjacent_district: 'Mchinji' }], rowCount: 1 });
        const adjacent = await outbreakService.getAdjacentDistricts('Lilongwe');
        expect(adjacent).toEqual(['Mchinji']);
        expect(mockQuery.mock.calls.length).toBe(1);
    });

    it('emails officers in affected and adjacent districts during rollup', async () => {
        const cluster = { district: 'Lilongwe', crop: 'maize', diseaseLabel: 'fall_armyworm', caseCount: 12, distinctFarmers: 7, firstSeen: new Date(), lastSeen: new Date(), centroid: { lat: -13.9, lng: 33.7 } };
        jest.spyOn(outbreakService, 'getAlertedDistricts').mockResolvedValueOnce([cluster]);
        jest.spyOn(outbreakService, 'getOfficersToWarn').mockResolvedValueOnce(['a@e.com', 'b@e.com']);

        const emails: string[] = [];
        const sent = await outbreakService.rollupAndNotify(async (to) => { emails.push(to); });
        expect(sent).toBe(2);
        expect(emails).toEqual(['a@e.com', 'b@e.com']);
    });
});

describe('applyDifferentialPrivacyPerturbation (IR-004)', () => {
    const origin = { lat: -13.900000, lng: 33.700000 };

    it('bounds perturbation displacement to maxPerturbationMeters', () => {
        // Run multiple trials with various seeds
        for (let seed = 1; seed <= 20; seed++) {
            const perturbed = applyDifferentialPrivacyPerturbation(origin, 3, {
                epsilon: 1.0,
                maxPerturbationMeters: 150,
                seed,
            });

            // Convert degree offset back to approximate Euclidean distance
            const dLatMeters = (perturbed.lat - origin.lat) * 111139.0;
            const cosLat = Math.cos((origin.lat * Math.PI) / 180);
            const dLngMeters = (perturbed.lng - origin.lng) * (111139.0 * cosLat);
            const distMeters = Math.sqrt(dLatMeters * dLatMeters + dLngMeters * dLngMeters);

            expect(distMeters).toBeLessThanOrEqual(150.01);
        }
    });

    it('is reproducible when seed is specified', () => {
        const res1 = applyDifferentialPrivacyPerturbation(origin, 5, { seed: 42 });
        const res2 = applyDifferentialPrivacyPerturbation(origin, 5, { seed: 42 });
        expect(res1).toEqual(res2);
    });

    it('tighter sensitivity for larger sample sizes', () => {
        // With sampleSize=100 sensitivity is 60/10=6 vs sampleSize=1 sensitivity 60
        const pSmall = applyDifferentialPrivacyPerturbation(origin, 1, { seed: 100, maxPerturbationMeters: 500 });
        const pLarge = applyDifferentialPrivacyPerturbation(origin, 100, { seed: 100, maxPerturbationMeters: 500 });

        const dSmall = Math.hypot(pSmall.lat - origin.lat, pSmall.lng - origin.lng);
        const dLarge = Math.hypot(pLarge.lat - origin.lat, pLarge.lng - origin.lng);

        expect(dLarge).toBeLessThan(dSmall);
    });
});

describe('projectAtmosphericDispersalCone (CE-002)', () => {
    const baseInput = {
        centroid: { lat: -13.9, lng: 33.7 },
        windSpeedKmH: 25,
        windBearingDeg: 90, // Eastward
        relativeHumidity: 85,
        temperatureC: 22,
        crop: 'maize',
        diseaseLabel: 'fall_armyworm',
    };

    it('calculates downwind trajectory, target centroid, and polygon footprint', () => {
        const projection = projectAtmosphericDispersalCone(baseInput);

        expect(projection.origin).toEqual(baseInput.centroid);
        expect(projection.dispersionDistanceKm).toBeGreaterThanOrEqual(5);
        expect(projection.dispersionDistanceKm).toBeLessThanOrEqual(150);
        expect(projection.targetCentroid.lng).toBeGreaterThan(baseInput.centroid.lng); // Eastward drift
        expect(projection.coneFootprint.length).toBeGreaterThanOrEqual(8);
        expect(projection.modelProvenance.model).toContain('AlphaAg-Atmospheric-Dispersal');
    });

    it('narrows aperture under high wind speeds and widens under calm winds', () => {
        const calm = projectAtmosphericDispersalCone({ ...baseInput, windSpeedKmH: 5 });
        const gale = projectAtmosphericDispersalCone({ ...baseInput, windSpeedKmH: 60 });

        expect(calm.apertureDegrees).toBeGreaterThan(gale.apertureDegrees);
        expect(gale.apertureDegrees).toBeGreaterThanOrEqual(15);
        expect(calm.apertureDegrees).toBeLessThanOrEqual(45);
    });

    it('computes high viability score and CRITICAL risk under optimal spore conditions', () => {
        const result = projectAtmosphericDispersalCone({
            ...baseInput,
            windSpeedKmH: 40,
            relativeHumidity: 90,
            temperatureC: 24, // Optimal 18-28C
        });

        expect(result.viabilityScore).toBe(1.0);
        expect(result.riskLevel).toBe('CRITICAL');
    });

    it('reduces viability and risk under dry or extreme cold conditions', () => {
        const result = projectAtmosphericDispersalCone({
            ...baseInput,
            windSpeedKmH: 10,
            relativeHumidity: 30, // Dry (<50%)
            temperatureC: 8,  // Cold (<14C)
        });

        expect(result.viabilityScore).toBeLessThan(0.2);
        expect(result.riskLevel).toBe('LOW');
    });
});

describe('Outbreak API Routes', () => {
    it('GET /api/outbreaks returns k-anonymized cluster list with alert flags', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    district: 'Lilongwe',
                    crop: 'maize',
                    disease_label: 'fall_armyworm',
                    case_count: '8',
                    distinct_farmers: '4',
                    first_seen: new Date(),
                    last_seen: new Date(),
                    centroid_lat: '-13.9',
                    centroid_lng: '33.7',
                },
            ],
            rowCount: 1,
        });

        const res = await request(app).get('/api/outbreaks');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].alert).toBe(true);
        expect(res.body.data[0].differentialPrivacyApplied).toBe(true);
    });

    it('POST /api/outbreaks/dispersal-projection validates input parameters', async () => {
        const resInvalidCentroid = await request(app)
            .post('/api/outbreaks/dispersal-projection')
            .send({ windSpeedKmH: 20 });
        expect(resInvalidCentroid.status).toBe(400);
        expect(resInvalidCentroid.body.error).toContain('centroid');

        const resInvalidWind = await request(app)
            .post('/api/outbreaks/dispersal-projection')
            .send({
                centroid: { lat: -13.9, lng: 33.7 },
                windSpeedKmH: -10,
                windBearingDeg: 90,
                relativeHumidity: 70,
                temperatureC: 22,
            });
        expect(resInvalidWind.status).toBe(400);
        expect(resInvalidWind.body.error).toContain('windSpeedKmH');

        const resInvalidHumidity = await request(app)
            .post('/api/outbreaks/dispersal-projection')
            .send({
                centroid: { lat: -13.9, lng: 33.7 },
                windSpeedKmH: 15,
                windBearingDeg: 90,
                relativeHumidity: 120, // Invalid > 100
                temperatureC: 22,
            });
        expect(resInvalidHumidity.status).toBe(400);
        expect(resInvalidHumidity.body.error).toContain('relativeHumidity');
    });

    it('POST /api/outbreaks/dispersal-projection returns valid projection on clean input', async () => {
        const res = await request(app)
            .post('/api/outbreaks/dispersal-projection')
            .send({
                centroid: { lat: -13.9, lng: 33.7 },
                windSpeedKmH: 25,
                windBearingDeg: 180, // Southward
                relativeHumidity: 80,
                temperatureC: 25,
                crop: 'maize',
                diseaseLabel: 'fall_armyworm',
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.origin).toEqual({ lat: -13.9, lng: 33.7 });
        expect(res.body.data.targetCentroid.lat).toBeLessThan(-13.9); // Southward
        expect(res.body.data.riskLevel).toBeDefined();
        expect(res.body.data.coneFootprint.length).toBeGreaterThan(0);
    });
});

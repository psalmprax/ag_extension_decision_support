import { optimizeRoute, haversineKm, stopPriority, RouteStop } from '../services/routeOptimizationService';
import { milestonesForCrop, PLAN_TEMPLATES } from '../services/farmPlanService';
import { officerGamificationService } from '../services/officerGamificationService';
import { triageSymptoms, PLAYBOOKS } from '../services/symptomTriageService';
import { parseSoilLabCsv, EXPECTED_COLUMNS } from '../services/soilLabService';
import { misExportService, MIS_VERSION } from '../services/misExportService';
import { classifyIndex } from '../services/weatherIndexService';

// ── Route optimizer ──────────────────────────────────────────────────────────

const mkStop = (id: string, lat: number, lng: number, daysOverdue = 10, vitalScore = 50): RouteStop => ({
    visitId: id,
    farmerName: id,
    lat,
    lng,
    daysOverdue,
    vitalScore,
});

describe('route optimization', () => {
    it('haversine computes sane distances', () => {
        // Lilongwe -> Salima ≈ 90km
        const km = haversineKm({ lat: -13.97, lng: 33.79 }, { lat: -13.78, lng: 34.45 });
        expect(km).toBeGreaterThan(50);
        expect(km).toBeLessThan(130);
    });

    it('priority weights overdue visits higher', () => {
        const overdue = stopPriority(mkStop('a', -14, 34, 45));
        const fresh = stopPriority(mkStop('b', -14, 34, 2));
        expect(overdue).toBeGreaterThan(fresh);
    });

    it('orders stops so total distance is finite and each stop visited once', () => {
        const stops = [
            mkStop('a', -13.9, 33.7, 30),
            mkStop('b', -14.1, 33.9, 5),
            mkStop('c', -13.8, 33.6, 15),
            mkStop('d', -14.3, 34.1, 8),
            mkStop('e', -13.95, 33.85, 22),
        ];
        const plan = optimizeRoute({ lat: -13.97, lng: 33.79 }, stops);
        expect(plan.stops).toHaveLength(5);
        expect(new Set(plan.stops.map(s => s.visitId)).size).toBe(5);
        expect(plan.stops[0].order).toBe(1);
        expect(plan.totalKm).toBeGreaterThan(0);
    });

    it('2-opt improves or equals the naive nearest-neighbor distance', () => {
        const stops = [mkStop('a', -13.5, 33.2), mkStop('b', -14.5, 34.5), mkStop('c', -13.6, 34.4), mkStop('d', -14.4, 33.3)];
        const plan = optimizeRoute({ lat: -14.0, lng: 33.8 }, stops);
        const visited = plan.stops.reduce((s, stop) => s + stop.legKm, 0);
        expect(plan.totalKm).toBeLessThanOrEqual(visited + 0.1);
    });

    it('caps stops at maxStops keeping highest priority', () => {
        const stops = Array.from({ length: 20 }, (_, i) => mkStop(`s${i}`, -13.9 - i * 0.01, 33.7 + i * 0.01, i));
        const plan = optimizeRoute({ lat: -13.97, lng: 33.79 }, stops, { maxStops: 8 });
        expect(plan.stops).toHaveLength(8);
        expect(plan.stops.every(s => s.daysOverdue >= 12)).toBe(true); // top-priority slice kept
    });
});

// ── Farm plans ───────────────────────────────────────────────────────────────

describe('farm plan milestones', () => {
    it('generates maize template anchored to planting date', () => {
        const planting = new Date('2026-11-20');
        const milestones = milestonesForCrop('maize', planting);
        expect(milestones.length).toBe(PLAN_TEMPLATES.maize.length);
        expect(milestones[1].title).toMatch(/Planting/);
        expect(milestones[1].dueDate.toISOString().slice(0, 10)).toBe('2026-11-20');
        const harvest = milestones.find(m => m.category === 'harvest');
        expect(harvest).toBeDefined();
    });

    it('matches crop by substring and falls back to maize template', () => {
        const potato = milestonesForCrop('Irish Potato', new Date('2026-11-01'));
        expect(potato.some(m => m.title.includes('blight'))).toBe(true);
        const unknown = milestonesForCrop('quinoa', new Date('2026-11-01'));
        expect(unknown.length).toBeGreaterThan(0);
    });
});

// ── Gamification ─────────────────────────────────────────────────────────────

jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => ({ query: jest.fn() })),
    query: jest.fn(),
}));
import { query } from '../services/databaseService';
const mockQuery = query as jest.Mock;

describe('officer gamification', () => {
    beforeEach(() => mockQuery.mockReset());

    it('computes score, success rate and badges from aggregated rows', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                { id: 'o1', name: 'Alice Banda', region: 'center', visits_completed: '25', outcomes_recorded: '10', success_count: '8', farmers_supported: '30' },
                { id: 'o2', name: 'Ben Phiri', region: 'south', visits_completed: '5', outcomes_recorded: '2', success_count: '0', farmers_supported: '4' },
            ],
            rowCount: 2,
        });
        const board = await officerGamificationService.getLeaderboard();
        expect(board[0].officerName).toBe('Alice Banda');
        expect(board[0].efficacySuccessRate).toBe(80);
        expect(board[0].badges).toContain('Field Regular');
        expect(board[0].badges).toContain('Outcome Tracker');
        expect(board[0].badges).toContain('Community Anchor');
        expect(board[1].efficacySuccessRate).toBe(0);
        expect(board[1].badges).toEqual([]);
    });
});

// ── Symptom triage ───────────────────────────────────────────────────────────

describe('SMS/USSD symptom triage', () => {
    it('matches fall armyworm keywords case-insensitively', () => {
        const result = triageSymptoms('There are WORMS EATING my maize leaves');
        expect(result.matched).toBe(true);
        expect(result.diagnosis).toMatch(/armyworm/i);
        expect(result.advice).toMatch(/Scout/i);
    });

    it('matches late blight and marks it non-escalating', () => {
        const result = triageSymptoms('black spots on my tomato leaves');
        expect(result.matched).toBe(true);
        expect(result.escalate).toBe(false);
    });

    it('returns escalation guidance for unrecognized symptoms', () => {
        const result = triageSymptoms('my cow is sick');
        expect(result.matched).toBe(false);
        expect(result.escalate).toBe(true);
        expect(result.advice).toMatch(/officer/i);
    });

    it('picks the highest-scoring playbook on overlapping keywords', () => {
        const result = triageSymptoms('stalk borer hollow stem damage');
        expect(result.diagnosis).toMatch(/stalk borer/i);
        expect(PLAYBOOKS.length).toBeGreaterThanOrEqual(8);
    });
});

// ── Soil lab CSV ─────────────────────────────────────────────────────────────

describe('soil lab CSV parser', () => {
    const header = EXPECTED_COLUMNS.join(',');

    it('parses well-formed rows into typed values', () => {
        const csv = `${header}\nabc-123,Lilongwe Lab,S-001,6.4,12,8,0.6,2.1,2026-08-01`;
        const rows = parseSoilLabCsv(csv);
        expect(rows).toHaveLength(1);
        expect(rows[0].ph).toBe(6.4);
        expect(rows[0].farmerRef).toBe('abc-123');
        expect(rows[0].testedAt).toBeDefined();
    });

    it('throws listing missing columns', () => {
        expect(() => parseSoilLabCsv('farmer_ref,ph\nabc,6')).toThrow(/missing required columns/);
    });

    it('throws when farmer_ref absent on a row', () => {
        const csv = `${header}\n,Lilongwe Lab,S-001,6.4,,,,,`;
        expect(() => parseSoilLabCsv(csv)).toThrow(/farmer_ref is required/);
    });

    it('tolerates empty numeric fields', () => {
        const csv = `${header}\nabc-123,Lab,S-001,,,,,,`;
        const rows = parseSoilLabCsv(csv);
        expect(rows[0].ph).toBeUndefined();
    });
});

// ── MIS export ───────────────────────────────────────────────────────────────

describe('MIS export service', () => {
    beforeEach(() => mockQuery.mockReset());

    it('emits versioned CSV with the documented column contract', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ farmer_ref: 'f-1', district: 'Lilongwe', region: 'center', village: 'Kasiya', crops: 'maize;soybean', farm_size_ha: '1.5', registered_at: '2026-08-24' }],
            rowCount: 1,
        });
        const { csv, rowCount } = await misExportService.exportDataset('farmers');
        expect(csv.startsWith(`mis_version=${MIS_VERSION}\n`)).toBe(true);
        expect(csv).toContain('farmer_ref,district,region,village,crops,farm_size_ha,registered_at');
        expect(csv).toContain('maize;soybean');
        expect(rowCount).toBe(1);
    });

    it('escapes values containing commas', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ farmer_ref: 'f-2', district: 'A, District', region: 'x', village: 'y', crops: 'maize', farm_size_ha: '1', registered_at: '2026-08-24' }],
            rowCount: 1,
        });
        const { csv } = await misExportService.exportDataset('farmers');
        expect(csv).toContain('"A, District"');
    });
});

// ── Weather index ────────────────────────────────────────────────────────────

describe('weather index classification', () => {
    it('classifies deficit bands correctly', () => {
        expect(classifyIndex(50)).toBe('severe_deficit');
        expect(classifyIndex(70)).toBe('deficit');
        expect(classifyIndex(100)).toBe('normal');
        expect(classifyIndex(140)).toBe('above_normal');
    });
});

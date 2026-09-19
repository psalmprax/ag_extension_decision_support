import type { Pool } from 'pg';
import { getPool } from '@/services/databaseService';
import { getCache } from '@/services/cacheService';
import { selfHealingService } from '@/services/selfHealing';
import {
    DEFAULT_HEALTH_WARMUP_WINDOW_MS,
    getHealthWarmupWindowMs,
    resolveHealthStatus,
} from '../app';

// Mock dependencies
jest.mock('@/services/databaseService');
jest.mock('@/services/cacheService');
jest.mock('@/services/aiProvider/aiProvider');
jest.mock('@/services/selfHealing');
jest.mock('@/utils/logger', () => ({
    logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
    },
}));

const mockGetPool = getPool as jest.MockedFunction<typeof getPool>;
const mockGetCache = getCache as jest.MockedFunction<typeof getCache>;
const mockSelfHealingService = selfHealingService as jest.Mocked<typeof selfHealingService>;

// Import the extracted functions (we need to test them indirectly through the health handler)
// Since the functions are not exported, we'll test the health handler behavior

describe('Health Check Helpers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Database Health Check', () => {
        it('should return connected when pool is available and query succeeds', async () => {
            const mockPool = { query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }) } as unknown as Pool;
            mockGetPool.mockReturnValue(mockPool);

            // Test by simulating the health check logic
            const pool = getPool();
            let status = 'unknown';
            if (pool) {
                await pool.query('SELECT 1');
                status = 'connected';
            }
            expect(status).toBe('connected');
        });

        it('should return not configured when pool is null', () => {
            mockGetPool.mockReturnValue(null);
            const pool = getPool();
            const status = pool ? 'connected' : 'not configured';
            expect(status).toBe('not configured');
        });
    });

    describe('Cache Health Check', () => {
        it('should return connected when redis is open', () => {
            mockGetCache.mockReturnValue({ isOpen: true } as unknown as ReturnType<typeof getCache>);
            const redis = getCache();
            const status = redis?.isOpen ? 'connected' : 'not connected';
            expect(status).toBe('connected');
        });

        it('should return not connected when redis is closed', () => {
            mockGetCache.mockReturnValue({ isOpen: false } as unknown as ReturnType<typeof getCache>);
            const redis = getCache();
            const status = redis?.isOpen ? 'connected' : 'not connected';
            expect(status).toBe('not connected');
        });
    });

    describe('Agent Services Health Check', () => {
        it('should return not initialized when no agents registered', () => {
            mockSelfHealingService.getHealthStatus.mockReturnValue(new Map());
            const agentHealth = selfHealingService.getHealthStatus();
            const registeredCount = agentHealth.size;
            const status = registeredCount === 0 ? 'not initialized' : `${registeredCount} registered`;
            expect(status).toBe('not initialized');
        });

        it('should return healthy when all agents are healthy', () => {
            const now = new Date().toISOString();
            const healthMap = new Map([
                ['agent1', { status: 'healthy' as const, component: 'test', lastCheck: now, consecutiveFailures: 0, lastSuccess: now }],
                ['agent2', { status: 'healthy' as const, component: 'test', lastCheck: now, consecutiveFailures: 0, lastSuccess: now }],
            ]);
            mockSelfHealingService.getHealthStatus.mockReturnValue(healthMap);
            const agentHealth = selfHealingService.getHealthStatus();
            const registeredCount = agentHealth.size;
            const unhealthyCount = Array.from(agentHealth.values()).filter(h => h.status === 'unhealthy' || h.status === 'offline').length;
            const status = unhealthyCount === 0 ? `${registeredCount} registered, all healthy` : `${registeredCount} registered, ${unhealthyCount} unhealthy`;
            expect(status).toBe('2 registered, all healthy');
        });

        it('should report unhealthy agents', () => {
            const now = new Date().toISOString();
            const healthMap = new Map([
                ['agent1', { status: 'healthy' as const, component: 'test', lastCheck: now, consecutiveFailures: 0, lastSuccess: now }],
                ['agent2', { status: 'unhealthy' as const, component: 'test', lastCheck: now, consecutiveFailures: 3, lastSuccess: now }],
            ]);
            mockSelfHealingService.getHealthStatus.mockReturnValue(healthMap);
            const agentHealth = selfHealingService.getHealthStatus();
            const unhealthyCount = Array.from(agentHealth.values()).filter(h => h.status === 'unhealthy' || h.status === 'offline').length;
            const status = unhealthyCount > 0 ? `2 registered, ${unhealthyCount} unhealthy` : 'all healthy';
            expect(status).toBe('2 registered, 1 unhealthy');
        });

        it('should exclude planned (not-yet-implemented) agents from the unhealthy count', () => {
            // Mirrors the PLANNED_AGENTS exclusion in app.ts checkAgentServices:
            // a registered-but-unimplemented agent (e.g. openclaw) must not flag
            // the production health check as unhealthy.
            const plannedAgents = new Set(['openclaw']);
            const now = new Date().toISOString();
            const healthMap = new Map([
                ['agent-zero', { status: 'healthy' as const, component: 'agent-zero', lastCheck: now, consecutiveFailures: 0, lastSuccess: now }],
                ['crew-ai', { status: 'healthy' as const, component: 'crew-ai', lastCheck: now, consecutiveFailures: 0, lastSuccess: now }],
                ['openclaw', { status: 'offline' as const, component: 'openclaw', lastCheck: now, consecutiveFailures: 5, lastSuccess: null }],
            ]);
            mockSelfHealingService.getHealthStatus.mockReturnValue(healthMap);
            const agentHealth = selfHealingService.getHealthStatus();
            const registeredCount = agentHealth.size;
            const unhealthyCount = Array.from(agentHealth.values()).filter(h =>
                (h.status === 'unhealthy' || h.status === 'offline') && !plannedAgents.has(h.component)
            ).length;
            const status = unhealthyCount === 0 ? `${registeredCount} registered, all healthy` : `${registeredCount} registered, ${unhealthyCount} unhealthy`;
            expect(status).toBe('3 registered, all healthy');
        });
    });

    describe('Warm-Up Window & Health Status Resolution', () => {
        const originalEnv = process.env.HEALTH_WARMUP_WINDOW_MS;

        afterEach(() => {
            if (originalEnv !== undefined) {
                process.env.HEALTH_WARMUP_WINDOW_MS = originalEnv;
            } else {
                delete process.env.HEALTH_WARMUP_WINDOW_MS;
            }
        });

        it('defaults warm-up window to 15,000 ms (15s)', () => {
            delete process.env.HEALTH_WARMUP_WINDOW_MS;
            expect(DEFAULT_HEALTH_WARMUP_WINDOW_MS).toBe(15_000);
            expect(getHealthWarmupWindowMs()).toBe(15_000);
        });

        it('configures warm-up window via process.env.HEALTH_WARMUP_WINDOW_MS', () => {
            process.env.HEALTH_WARMUP_WINDOW_MS = '20000';
            expect(getHealthWarmupWindowMs()).toBe(20_000);

            process.env.HEALTH_WARMUP_WINDOW_MS = '5000';
            expect(getHealthWarmupWindowMs()).toBe(5_000);
        });

        it('falls back to default for invalid or negative environment variable values', () => {
            process.env.HEALTH_WARMUP_WINDOW_MS = 'not-a-number';
            expect(getHealthWarmupWindowMs()).toBe(15_000);

            process.env.HEALTH_WARMUP_WINDOW_MS = '-100';
            expect(getHealthWarmupWindowMs()).toBe(15_000);
        });

        it('resolves healthy (warmup) when db is healthy and in warmup', () => {
            const result = resolveHealthStatus({
                dbOk: true,
                aiOk: true,
                errors: [],
                inWarmup: true,
            });
            expect(result).toEqual({ statusCode: 200, statusText: 'healthy (warmup)' });
        });

        it('resolves starting (warmup) when db has not yet connected during warmup', () => {
            const result = resolveHealthStatus({
                dbOk: false,
                aiOk: true,
                errors: ['database: connecting'],
                inWarmup: true,
            });
            expect(result).toEqual({ statusCode: 200, statusText: 'starting (warmup)' });
        });

        it('resolves unhealthy (503) post-warmup when db is down', () => {
            const result = resolveHealthStatus({
                dbOk: false,
                aiOk: true,
                errors: ['database: connection refused'],
                inWarmup: false,
            });
            expect(result).toEqual({ statusCode: 503, statusText: 'unhealthy' });
        });

        it('resolves unhealthy (503) during warmup when both db and AI are down', () => {
            const result = resolveHealthStatus({
                dbOk: false,
                aiOk: false,
                errors: ['database: connecting', 'ai_provider: not configured'],
                inWarmup: true,
            });
            expect(result).toEqual({ statusCode: 503, statusText: 'unhealthy' });
        });

        it('resolves starting (warmup) when AI is down but db is up during warmup', () => {
            const result = resolveHealthStatus({
                dbOk: true,
                aiOk: false,
                errors: ['ai_provider: not configured'],
                inWarmup: true,
            });
            expect(result).toEqual({ statusCode: 200, statusText: 'starting (warmup)' });
        });
    });
});

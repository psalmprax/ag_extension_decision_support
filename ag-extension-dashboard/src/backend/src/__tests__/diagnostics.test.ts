/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../app';
import jwt from 'jsonwebtoken';
import { config } from '../config';

// ---------------------------------------------------------------
// Mock dependencies used by the diagnostics route
// ---------------------------------------------------------------

// Mock logger (same pattern as other test files)
jest.mock('../utils/logger', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));

// DNS mock — control which domains resolve (preserve rest of the module)
const mockDnsResolve4 = jest.fn();
jest.mock('dns/promises', () => {
    const actual = jest.requireActual('dns/promises');
    return {
        ...actual,
        resolve4: (...args: any[]) => mockDnsResolve4(...args),
    };
});

// Diagnostics helpers mock — control TCP, HTTP, SSL results
// This avoids mocking low-level net/http/https which Express itself depends on
const mockConnectTCP = jest.fn();
const mockCheckHTTP = jest.fn();
const mockCheckSSL = jest.fn();
jest.mock('../services/diagnosticsHelpers', () => ({
    connectTCP: (...args: any[]) => mockConnectTCP(...args),
    checkHTTP: (...args: any[]) => mockCheckHTTP(...args),
    checkSSL: (...args: any[]) => mockCheckSSL(...args),
}));

// ---------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------
let adminToken: string;
let officerToken: string;

function resetMocks(): void {
    mockDnsResolve4.mockReset();
    mockConnectTCP.mockReset();
    mockCheckHTTP.mockReset();
    mockCheckSSL.mockReset();
}

function defaultMockReturnValues(): void {
    // DNS: both domains resolve
    mockDnsResolve4.mockImplementation((name: string) => {
        if (name === 'www.gpexts.com' || name === 'gpexts.com') {
            return Promise.resolve(['145.223.97.248']);
        }
        return Promise.reject(new Error('ENOTFOUND'));
    });

    // TCP: all ports open on default
    mockConnectTCP.mockResolvedValue(true);

    // HTTP: backend and frontend reachable via Traefik
    mockCheckHTTP.mockImplementation((url: string) => {
        if (url.includes('/api/health')) {
            return Promise.resolve({ ok: true, status: 200, body: JSON.stringify({ status: 'healthy' }) });
        }
        return Promise.resolve({ ok: true, status: 200, body: '<html><body>OK</body></html>' });
    });

    // SSL: valid certificate
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + 88);
    mockCheckSSL.mockResolvedValue({
        ok: true,
        cert: {
            validFrom: '2025-01-01T00:00:00Z',
            validTo: validTo.toISOString(),
            issuer: "Let's Encrypt",
            subject: 'www.gpexts.com',
            daysLeft: 88,
        },
    });
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------
describe('Diagnostics API', () => {
    beforeAll(() => {
        adminToken = jwt.sign(
            { userId: 'admin-1', role: 'admin', email: 'admin@test.com' },
            config.jwt.secret || 'test-secret',
            { expiresIn: '1h' }
        );
        officerToken = jwt.sign(
            { userId: 'officer-1', role: 'extension_officer', email: 'officer@test.com' },
            config.jwt.secret || 'test-secret',
            { expiresIn: '1h' }
        );
    });

    beforeEach(() => {
        resetMocks();
        defaultMockReturnValues();
    });

    // ─── Auth tests ──────────────────────────────────────────────

    describe('Authentication', () => {
        it('should return 401 if no token provided', async () => {
            const response = await request(app).get('/api/health/diagnostics');
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('No token provided');
        });

        it('should return 403 if user is not admin', async () => {
            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${officerToken}`);
            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Insufficient permissions');
        });

        it('should return 200 with admin token', async () => {
            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    // ─── DNS tests ───────────────────────────────────────────────

    describe('DNS Checks', () => {
        it('should resolve www.gpexts.com and gpexts.com', async () => {
            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body.dns).toBeDefined();
            expect(response.body.dns['www.gpexts.com'].resolved).toBe(true);
            expect(response.body.dns['www.gpexts.com'].ips).toContain('145.223.97.248');
            expect(response.body.dns['gpexts.com'].resolved).toBe(true);
        });

        it('should handle DNS failure gracefully', async () => {
            mockDnsResolve4.mockRejectedValue(new Error('ENOTFOUND'));

            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body.dns['www.gpexts.com'].resolved).toBe(false);
            expect(response.body.dns['www.gpexts.com'].error).toBe('DNS resolution failed');
        });
    });

    // ─── Port connectivity tests ────────────────────────────────

    describe('Port Connectivity', () => {
        it('should report all configured ports', async () => {
            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body.ports).toBeInstanceOf(Array);
            expect(response.body.ports.length).toBeGreaterThan(0);

            // All ports should be open by default
            const openPorts = response.body.ports.filter((p: any) => p.open);
            expect(openPorts.length).toBe(6);
        });

        it('should detect closed ports', async () => {
            // Close port 443 and 80 — return false for those connections
            mockConnectTCP.mockImplementation((host: string, port: number) => {
                if ((host === 'localhost' && port === 443) || (host === 'localhost' && port === 80)) {
                    return Promise.resolve(false);
                }
                return Promise.resolve(true);
            });

            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            const port443 = response.body.ports.find((p: any) => p.port === 443);
            const port80 = response.body.ports.find((p: any) => p.port === 80);
            const port3001 = response.body.ports.find((p: any) => p.port === 3001);

            expect(port443.open).toBe(false);
            expect(port80.open).toBe(false);
            expect(port3001.open).toBe(true);
        });

        it('should include port name and host in results', async () => {
            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            const port80 = response.body.ports.find((p: any) => p.port === 80);
            expect(port80.name).toBe('HTTP (Traefik)');
            expect(port80.host).toBe('localhost');
        });
    });

    // ─── Traefik routing tests ──────────────────────────────────

    describe('Traefik Routing', () => {
        it('should report backend and frontend reachable via Traefik', async () => {
            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body.traefik).toBeDefined();
            expect(response.body.traefik.backend_via_traefik).toBe('reachable');
            expect(response.body.traefik.frontend_via_traefik).toBe('reachable');
            expect(response.body.traefik.backend_http_status).toBe(200);
        });

        it('should detect unreachable Traefik routes', async () => {
            mockCheckHTTP.mockResolvedValue({ ok: false, status: 0 });

            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body.traefik.backend_via_traefik).toBe('unreachable');
            expect(response.body.traefik.frontend_via_traefik).toBe('unreachable');
        });

        it('should handle unexpected HTTP errors gracefully', async () => {
            mockCheckHTTP.mockRejectedValue(new Error('ECONNREFUSED'));

            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            // The catch block sets { error: ... } without backend_via_traefik
            expect(response.body.traefik.error).toContain('ECONNREFUSED');
        });
    });

    // ─── Container Network tests ────────────────────────────────

    describe('Container Network', () => {
        it('should check container-to-container connectivity', async () => {
            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body.container_network).toBeInstanceOf(Array);
            expect(response.body.container_network.length).toBe(5);

            const db = response.body.container_network.find((c: any) => c.name === 'app-db');
            expect(db.reachable).toBe(true);
        });

        it('should detect unreachable containers', async () => {
            mockConnectTCP.mockImplementation((host: string, port: number) => {
                if (host === 'app-db' && port === 5432) {
                    return Promise.resolve(false);
                }
                return Promise.resolve(true);
            });

            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            const db = response.body.container_network.find((c: any) => c.name === 'app-db');
            expect(db.reachable).toBe(false);
        });
    });

    // ─── SSL Certificate tests ──────────────────────────────────

    describe('SSL Certificate', () => {
        it('should return SSL certificate info when connection succeeds', async () => {
            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body.ssl).toBeDefined();
            expect(response.body.ssl.ok).toBe(true);
            expect(response.body.ssl.cert).toBeDefined();
            expect(response.body.ssl.cert.subject).toBe('www.gpexts.com');
            expect(response.body.ssl.cert.issuer).toBe("Let's Encrypt");
            expect(response.body.ssl.cert.daysLeft).toBeGreaterThan(0);
        });

        it('should handle SSL connection failure gracefully', async () => {
            mockCheckSSL.mockResolvedValue({ ok: false, error: 'ENOTFOUND' });

            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body.ssl.ok).toBe(false);
            expect(response.body.ssl.error).toBeDefined();
        });
    });

    // ─── Deployment detection tests ─────────────────────────────

    describe('Deployment Detection', () => {
        it('should report test environment', async () => {
            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body.deployment.node_env).toBe('test');
            expect(response.body.deployment.acme_email_configured).toBe(false);
        });

        it('should detect HTTPS active when SSL cert is valid', async () => {
            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body.deployment.https_active).toBe(true);
        });

        it('should detect HTTPS inactive when SSL fails', async () => {
            mockCheckSSL.mockResolvedValue({ ok: false, error: 'ENOTFOUND' });

            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body.deployment.https_active).toBe(false);
        });
    });

    // ─── Issues & Recommendations tests ─────────────────────────

    describe('Issues & Recommendations', () => {
        it('should report no issues when all checks pass', async () => {
            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body.issues).toBeInstanceOf(Array);
            expect(response.body.issues.length).toBe(0);
            expect(response.body.summary).toContain('All checks passed');
        });

        it('should report DNS failure as an issue', async () => {
            mockDnsResolve4.mockRejectedValue(new Error('ENOTFOUND'));

            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body.issues.length).toBeGreaterThan(0);
            expect(response.body.issues.some((i: string) => i.includes('DNS'))).toBe(true);
            expect(response.body.recommendations.some((r: string) => r.includes('DNS'))).toBe(true);
        });

        it('should report closed port 80 and 443 as issues', async () => {
            mockConnectTCP.mockImplementation((host: string, port: number) => {
                if (port === 80 || port === 443) return Promise.resolve(false);
                return Promise.resolve(true);
            });

            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body.issues.length).toBeGreaterThanOrEqual(2);
        });

        it('should recommend docker-compose.prod.yml when port 443 is closed', async () => {
            mockConnectTCP.mockImplementation((host: string, port: number) => {
                if (port === 443) return Promise.resolve(false);
                return Promise.resolve(true);
            });

            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            const hasProdRec = response.body.recommendations.some((r: string) =>
                r.includes('docker-compose.prod.yml')
            );
            expect(hasProdRec).toBe(true);
        });

        it('should report unreachable Traefik backend as an issue', async () => {
            mockCheckHTTP.mockResolvedValue({ ok: false, status: 0 });

            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body.issues.some((i: string) => i.includes('Backend'))).toBe(true);
        });
    });

    // ─── Cache tests ────────────────────────────────────────────

    describe('Caching', () => {
        it('should bypass cache in test mode (NODE_ENV=test)', async () => {
            const first = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(first.body.cached).toBe(false);

            const second = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            // Cache is disabled when NODE_ENV=test (CACHE_TTL = -1)
            expect(second.body.cached).toBe(false);
        });
    });

    // ─── Legacy route alias tests ───────────────────────────────

    describe('Route Aliases', () => {
        it('should serve diagnostics at /api/v1/health/diagnostics', async () => {
            const response = await request(app)
                .get('/api/v1/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should serve diagnostics at /api/v1/system/diagnostics', async () => {
            const response = await request(app)
                .get('/api/v1/system/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should serve diagnostics at /api/system/diagnostics', async () => {
            const response = await request(app)
                .get('/api/system/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    // ─── Response structure tests ───────────────────────────────

    describe('Response Structure', () => {
        it('should include all required top-level fields', async () => {
            const response = await request(app)
                .get('/api/health/diagnostics')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('hostname');
            expect(response.body).toHaveProperty('node_env');
            expect(response.body).toHaveProperty('domain', 'www.gpexts.com');
            expect(response.body).toHaveProperty('server_ip', '145.223.97.248');
            expect(response.body).toHaveProperty('dns');
            expect(response.body).toHaveProperty('ports');
            expect(response.body).toHaveProperty('traefik');
            expect(response.body).toHaveProperty('container_network');
            expect(response.body).toHaveProperty('ssl');
            expect(response.body).toHaveProperty('deployment');
            expect(response.body).toHaveProperty('issues');
            expect(response.body).toHaveProperty('recommendations');
            expect(response.body).toHaveProperty('summary');
        });
    });
});

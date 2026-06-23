import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { authorize } from '../middleware/authorize';
import { safeError } from '../utils/safeResponse';
import * as dns from 'dns/promises';
import { connectTCP, checkHTTP, checkSSL } from '../services/diagnosticsHelpers';

const router = Router();

// All diagnostics endpoints require admin authorization
router.use(authorize(['admin']));

// ─── Diagnostics Endpoint ────────────────────────────────────────────────
// GET /api/health/diagnostics
// Runs comprehensive infrastructure checks to diagnose why www.gpexts.com is unreachable.
// Results are cached for 60 seconds to avoid flooding.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedResult: any = null;
let cacheTime = 0;
// Disable caching in test mode so each test gets fresh results
const CACHE_TTL = process.env.NODE_ENV === 'test' ? -1 : 60_000;

function tryParseJSON(str: string): Record<string, unknown> | string {
    try {
        return JSON.parse(str);
    } catch {
        return str.slice(0, 200);
    }
}

async function checkDnsResolution(domain: string): Promise<Record<string, { resolved: boolean; ips: string[]; error?: string }>> {
    const dnsResults: Record<string, { resolved: boolean; ips: string[]; error?: string }> = {};
    const rootDomain = domain.replace(/^www\./, '');
    for (const name of [domain, rootDomain]) {
        try {
            const addresses = await dns.resolve4(name);
            dnsResults[name] = { resolved: true, ips: addresses };
        } catch {
            dnsResults[name] = { resolved: false, ips: [], error: 'DNS resolution failed' };
        }
    }
    return dnsResults;
}

async function checkPortConnectivity(): Promise<Array<{ port: number; name: string; host: string; open: boolean }>> {
    const portsToCheck = [
        { port: 80, name: 'HTTP (Traefik)', host: 'localhost' },
        { port: 443, name: 'HTTPS', host: 'localhost' },
        { port: 3001, name: 'Backend API', host: 'localhost' },
        { port: 5432, name: 'PostgreSQL', host: 'app-db' },
        { port: 6379, name: 'Redis', host: 'redis' },
        { port: process.env.NODE_ENV === 'production' ? 80 : 5173, name: process.env.NODE_ENV === 'production' ? 'Frontend (Nginx)' : 'Frontend (Vite)', host: 'localhost' },
    ];

    const portResults: Array<{ port: number; name: string; host: string; open: boolean }> = [];
    for (const p of portsToCheck) {
        const open = await connectTCP(p.host, p.port);
        portResults.push({ ...p, open });
    }
    return portResults;
}

async function checkTraefikRouting(): Promise<Record<string, unknown>> {
    try {
        const traefikHealth = await checkHTTP('http://localhost:80/api/health');
        const traefikFrontend = await checkHTTP('http://localhost:80/');
        return {
            backend_via_traefik: traefikHealth.ok ? 'reachable' : 'unreachable',
            backend_http_status: traefikHealth.status,
            frontend_via_traefik: traefikFrontend.ok ? 'reachable' : 'unreachable',
            frontend_http_status: traefikFrontend.status,
            backend_health_response: traefikHealth.body ? tryParseJSON(traefikHealth.body) : undefined,
        };
    } catch (err) {
        return { error: `Traefik check failed: ${(err as Error).message}` };
    }
}

async function checkContainerNetworks(): Promise<Array<{ name: string; port: number; reachable: boolean }>> {
    const containersToCheck = [
        { name: 'app-db', port: 5432 },
        { name: 'redis', port: 6379 },
        { name: 'ag-dashboard-backend', port: 3001 },
        { name: 'ag-dashboard-frontend', port: process.env.NODE_ENV === 'production' ? 80 : 5173 },
        { name: 'ag-extension-dashboard-traefik-1', port: 80 },
    ];

    const containerResults: Array<{ name: string; port: number; reachable: boolean }> = [];
    for (const c of containersToCheck) {
        const reachable = await connectTCP(c.name, c.port);
        containerResults.push({ ...c, reachable });
    }
    return containerResults;
}

async function checkSSLCertificate(domain: string): Promise<Record<string, unknown>> {
    const sslResult = await checkSSL(domain);
    if (sslResult.ok) {
        return sslResult as unknown as Record<string, unknown>;
    } else {
        return {
            ok: false,
            error: sslResult.error || 'Connection failed (this may be a container networking limitation)',
            container_network_note: `The SSL check runs inside the Docker container. If the container cannot resolve or reach the public domain, the check reports as failed even when SSL is correctly configured on the host. Verify SSL independently via: openssl s_client -connect ${domain}:443`,
        };
    }
}

function getDeploymentDetection(sslResult: Record<string, unknown>): Record<string, unknown> {
    const isProduction = process.env.NODE_ENV === 'production';
    const hasACMEEmail = !!process.env.ACME_EMAIL;
    return {
        node_env: process.env.NODE_ENV || 'development',
        docker_hostname: process.env.HOSTNAME || '',
        acme_email_configured: hasACMEEmail,
        https_active: sslResult.ok,
        prod_override_detected: sslResult.ok || (isProduction && hasACMEEmail),
        recommendation: '',
    };
}

interface DiagnosticResults {
    dns?: Record<string, { resolved: boolean }>;
    ports?: Array<{ port: number; open: boolean }>;
    traefik?: { backend_via_traefik: string };
    [key: string]: unknown;
}

function getSummaryAndRecommendations(results: DiagnosticResults): Record<string, unknown> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    const checkDomain = process.env.DOMAIN || 'www.gpexts.com';
    if (results.dns?.[checkDomain] && !results.dns[checkDomain].resolved) {
        issues.push(`DNS resolution failed for ${checkDomain}`);
        recommendations.push(`Check DNS A record for ${checkDomain} — should point to ${process.env.SERVER_IP || '145.223.97.248'}`);
    }

    const port80 = results.ports?.find((p: { port: number }) => p.port === 80);
    const port443 = results.ports?.find((p: { port: number }) => p.port === 443);

    if (port80 && !port80.open) {
        issues.push('Port 80 (HTTP) is closed — Traefik may not be running');
        recommendations.push('Ensure Traefik container is up: docker ps | grep traefik');
    }

    if (port443 && !port443.open) {
        issues.push('Port 443 (HTTPS) is closed — docker-compose.prod.yml is likely not deployed');
        recommendations.push([
            'Deploy with production override:',
            '  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build',
            '',
            'Ensure .env has ACME_EMAIL set for Let\'s Encrypt.',
        ].join('\n'));
    }

    if (results.traefik?.backend_via_traefik === 'unreachable') {
        issues.push('Backend is not reachable through Traefik on port 80');
        recommendations.push('Check Traefik labels and Docker provider configuration in docker-compose.yml');
    }

    return {
        issues,
        recommendations,
        summary: issues.length === 0
            ? 'All checks passed. The server appears healthy. Check DNS propagation and firewall settings on the network level.'
            : `Found ${issues.length} issue(s). See recommendations for remediation.`,
    };
}

router.get('/', async (_req: Request, res: Response) => {
    try {
        if (cachedResult && Date.now() - cacheTime < CACHE_TTL) {
            return res.json({ success: true, cached: true, timestamp: new Date().toISOString(), ...cachedResult });
        }

        const domain = process.env.DOMAIN || 'www.gpexts.com';
        
        const results: Record<string, unknown> = {
            timestamp: new Date().toISOString(),
            hostname: process.env.HOSTNAME || '',
            node_env: process.env.NODE_ENV || 'development',
            domain,
            server_ip: process.env.SERVER_IP || '145.223.97.248',
        };

        try {
            results.dns = await checkDnsResolution(domain);
        } catch (err) {
            results.dns = { error: `DNS check failed: ${(err as Error).message}` };
        }

        results.ports = await checkPortConnectivity();
        results.traefik = await checkTraefikRouting();
        results.container_network = await checkContainerNetworks();
        results.ssl = await checkSSLCertificate(domain);
        results.deployment = getDeploymentDetection(results.ssl as Record<string, unknown>);

        const summary = getSummaryAndRecommendations(results);
        results.issues = summary.issues;
        results.recommendations = summary.recommendations;
        results.summary = summary.summary;

        cachedResult = results;
        cacheTime = Date.now();

        const isHealthy = (summary.issues as string[]).length === 0;
        res.status(isHealthy ? 200 : 200).json({ success: true, cached: false, timestamp: results.timestamp, ...results });
    } catch (error) {
        logger.error('Diagnostics endpoint error:', error);
        safeError(res, 500, 'Diagnostics check failed');
    }
});

export default router;

import axios from 'axios';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { logger } from '@/utils/logger';

/** Normalized document returned to the ingestion worker. */
export interface ScrapedDocument {
    id: string;
    title: string;
    summary: string;
    url: string | null;
    keywords: string[];
    platform: string;
    publishedAt: string | null;
    /** Always 'unverified_scrape' — nothing in this path validates content. */
    dataStatus: 'unverified_scrape';
}

/** Shape emitted by the Python CloakBrowserScanner (tools/cloakbrowser/models.py ContentCandidate). */
interface ContentCandidate {
    id?: string;
    platform?: string;
    source_uri?: string;
    title?: string | null;
    description?: string | null;
    tags?: string[];
    published_at?: string | null;
    niche?: string | null;
}

export class StealthScraperService {
    private static AGENT_URL = process.env.AGENT_ZERO_URL || 'http://ag-agent-zero:8000';

    /**
     * Agent Zero verifies HS256 JWTs signed with the shared JWT_SECRET. Prefer an
     * explicit AGENT_ZERO_TOKEN; otherwise mint a short-lived service token so the
     * worker can authenticate without an operator pasting a token into env.
     */
    private static serviceToken(): string | null {
        if (process.env.AGENT_ZERO_TOKEN) return process.env.AGENT_ZERO_TOKEN;
        const secret = config.jwt.secret;
        if (!secret) return null;
        return jwt.sign(
            { userId: 'backend-ingestion-worker', role: 'service', email: 'ingestion@system.local' },
            secret as jwt.Secret,
            { expiresIn: '10m' }
        );
    }

    private static normalize(candidates: unknown, platform: string): ScrapedDocument[] {
        if (!Array.isArray(candidates)) return [];
        const out: ScrapedDocument[] = [];
        for (const raw of candidates as ContentCandidate[]) {
            const title = (raw?.title || '').trim();
            const summary = (raw?.description || '').trim();
            if (!title && !summary) continue;
            out.push({
                id: String(raw.id || raw.source_uri || title),
                title: title || summary.slice(0, 80),
                summary,
                url: raw.source_uri || null,
                keywords: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 12) : [],
                platform: raw.platform || platform,
                publishedAt: raw.published_at || null,
                dataStatus: 'unverified_scrape',
            });
        }
        return out;
    }

    /**
     * Executes a stealth scrape via the Python Agent Zero and returns normalized documents.
     * Throws on transport/auth failures so the caller can distinguish "no results"
     * from "pipeline broken".
     */
    static async scrapeKnowledge(niche: string, platform: string, region: string): Promise<ScrapedDocument[]> {
        const token = this.serviceToken();
        if (!token) {
            throw new Error('Stealth scrape unavailable: neither AGENT_ZERO_TOKEN nor JWT_SECRET is configured');
        }

        logger.info(`Triggering stealth scrape for niche: "${niche}" on platform: "${platform}" in region: "${region}"`);

        const response = await axios.post(
            `${this.AGENT_URL}/api/execute`,
            { task_type: 'stealth_scrape', parameters: { niche, platform, region } },
            {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                timeout: 60000,
            }
        );

        const body = response.data as { success?: boolean; results?: unknown; error?: string; result?: { success?: boolean; results?: unknown; error?: string } };
        // Agent Zero wraps task output under `result` for /api/execute; tolerate both.
        const payload = body?.result && typeof body.result === 'object' ? body.result : body;
        if (!payload?.success) {
            throw new Error(`Agent Zero stealth scrape failed: ${payload?.error || 'unknown error'}`);
        }
        return this.normalize(payload.results, platform);
    }
}

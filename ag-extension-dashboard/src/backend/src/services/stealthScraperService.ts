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

/**
 * Strips HTML tags, web boilerplate, social share widgets, navigation menus,
 * and deduplicates repeated sentences from scraped text before vector ingestion.
 */
export function sanitizeScrapedText(text: string): string {
    if (!text || typeof text !== 'string') return '';

    const cleaned = text
        // Remove HTML comments, scripts, styles, and tags
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        // Decode common HTML entities
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        // Remove social share button lists & metadata noise
        .replace(/\b(Facebook|Twitter|X|LinkedIn|Pinterest|WhatsApp|Instagram|Telegram|Reddit)\b(\s+(Facebook|Twitter|X|LinkedIn|Pinterest|WhatsApp|Instagram|Telegram|Reddit)\b)+/gi, '')
        .replace(/\b(Share on|Follow us on|Pin on|Tweet this|Share this)\b[^\n.]*/gi, '')
        // Remove common menu / breadcrumb junk
        .replace(/\b(Home|About Us|Contact Us|Privacy Policy|Terms of Service|Cookie Policy)\b(\s*[-|/>»]\s*\b[A-Za-z\s]+\b)*/gi, '')
        .replace(/\bWhat are You Looking for\?\s+[A-Za-z\s&]+/gi, '')
        .replace(/\b(Read also|Read more|Related posts?|Leave a Reply|Cancel reply|Save my name|Sign up for our newsletter|Subscribe to):?[^\n.]*/gi, '')
        // Normalize spaces
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n\n')
        .trim();

    // Deduplicate repeated lines and phrases
    const lines = cleaned.split('\n');
    const seenLines = new Set<string>();
    const filteredLines: string[] = [];

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
            filteredLines.push('');
            continue;
        }
        if (line.length < 5 && !/[.!?:]$/.test(line)) continue;

        const normalized = line.toLowerCase();
        if (seenLines.has(normalized)) continue;
        seenLines.add(normalized);

        // Deduplicate phrase repeats within the same line (e.g. "Disciplines In Nigeria Disciplines In Nigeria")
        const deduplicatedLine = line.replace(/(\b[\w\s]{4,30}\b)(?:\s+\1)+/gi, '$1');
        filteredLines.push(deduplicatedLine);
    }

    return filteredLines
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
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
            const rawTitle = (raw?.title || '').trim();
            const rawSummary = (raw?.description || '').trim();
            if (!rawTitle && !rawSummary) continue;

            const title = sanitizeScrapedText(rawTitle);
            const summary = sanitizeScrapedText(rawSummary);
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

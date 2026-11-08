import { createHash } from 'crypto';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { agronomicSafetyGuard } from '@/services/security/agronomicSafetyGuard';
import { withAdvisoryTimeout } from './advisoryRuntime';

type PublicHint = { articleId: string; sha256: string; source: string; hint: string };
type Article = { id: string; title: string; content: string; tags: string[] };

export const ASK_HELP = 'Send ASK followed by your question, crop, location, growth stage and symptoms. Example: ASK maize leaves turning yellow in Kenya. Do not send personal information.';
const NO_SOURCE = 'No approved public knowledge hint matched your question. Contact a local extension officer; no request has been sent to one.';
const UNAVAILABLE = 'Knowledge hints are temporarily unavailable. Please try again or contact a local extension officer.';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseAskCommand(text: string): string | null {
    const match = /^(?:\/ask|ask)(?:\s+([\s\S]*))?$/i.exec(text.trim());
    return match ? (match[1] || '').trim() : null;
}

function configuredHints(): PublicHint[] {
    const raw = process.env.MESSAGING_KB_PUBLIC_HINTS;
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > 100) throw new Error('Invalid public hint list');
    return parsed.map((entry: unknown) => {
        if (!entry || typeof entry !== 'object') throw new Error('Invalid public hint');
        const e = entry as Record<string, unknown>;
        if (typeof e.articleId !== 'string' || !uuid.test(e.articleId) ||
            typeof e.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(e.sha256) ||
            typeof e.source !== 'string' || !e.source.trim() || e.source.length > 60 ||
            typeof e.hint !== 'string' || !e.hint.trim() || e.hint.length > 160 ||
            /[\r\n<>*_[\]]/.test(e.source + e.hint)) {
            throw new Error('Invalid public hint fields');
        }
        return { articleId: e.articleId.toLowerCase(), sha256: e.sha256, source: e.source.trim(), hint: e.hint.trim() };
    });
}

export async function messagingKnowledgeReply(question: string): Promise<string> {
    if (!question.trim()) return ASK_HELP;
    if (question.length > 500) return 'Question too long. Send ASK and a question of 500 characters or fewer.';
    try {
        const hints = configuredHints();
        if (!hints.length) return NO_SOURCE;
        const words = question.toLowerCase().match(/[a-z0-9]{3,}/g)?.slice(0, 12) || [];
        if (!words.length) return ASK_HELP;
        const result = await withAdvisoryTimeout(() => query<Article>(
            `SELECT id, title, content, tags FROM knowledge_articles
             WHERE id = ANY($1::uuid[])
               AND NOT ('unverified_scrape' = ANY(tags))
               AND to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', $2)
             ORDER BY ts_rank_cd(to_tsvector('english', title || ' ' || content), plainto_tsquery('english', $2)) DESC
             LIMIT 20`,
            [hints.map(h => h.articleId), words.join(' ')]
        ), 4000, 'Public messaging knowledge search');
        for (const article of result.rows) {
            const hint = hints.find(h => h.articleId === article.id.toLowerCase());
            if (!hint || article.tags?.includes('unverified_scrape')) continue;
            const digest = createHash('sha256').update(JSON.stringify([article.title, article.content])).digest('hex');
            if (digest !== hint.sha256 || !agronomicSafetyGuard.scanGeneratedAdvice(hint.hint).safe ||
                /\b(?:spray|pesticide|insecticide|fungicide|herbicide|fertili[sz]er|dose|dosage)\b/i.test(hint.hint)) continue;
            return `Hint (${hint.source}): ${hint.hint}\nNot a diagnosis. Confirm with a local extension officer.`;
        }
        return NO_SOURCE;
    } catch (error) {
        logger.error('Public messaging knowledge search failed:', error);
        return UNAVAILABLE;
    }
}

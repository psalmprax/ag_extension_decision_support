import { createHash } from 'crypto';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import type { FinalAnswer, KnowledgeAttachment } from '@/services/knowledge/types';
import type { SearchResult } from '@/services/vectorService';

/**
 * Answers shared between users: when one person's question was answered from real sources,
 * the next person who asks the same question, for the same place and in the same language,
 * gets that answer without another AI call.
 *
 * Only answers that are safe to hand to someone else are kept:
 *   - they cite at least one retrieved source, and every citation points at a real source;
 *   - the safety guard changed nothing and raised no quarantine alert;
 *   - no live data (weather, prices, satellite, soil grids) and no tool output went into them,
 *     and the question is not about prices or weather;
 *   - no photo or file was attached.
 * Answers from knowledge-base articles are kept 30 days; answers that also drew on web search
 * results (searched over the past week) are kept 7. The month is part of the key, so a seasonal
 * answer is never reused in a later month. The knowledge-base articles behind the answer are
 * fingerprinted when they are retrieved; the answer is saved only if they are unchanged when it
 * is written, and before reuse they are compared again: an article since edited, re-tagged for
 * review or deleted means the answer is dropped and a new one is made.
 *
 * The key is a hash: no user id and no question text is stored.
 */

/** Bump to drop every cached answer (per-user and shared) when the answer policy changes. */
export const ADVISORY_CACHE_VERSION = 'advisory-v6';

export const KNOWLEDGE_BASE_DAYS = 30;
export const WEB_SOURCE_DAYS = 7;

const REAL_TIME_CATEGORIES = new Set(['market_prices', 'climate_and_weather']);
const KNOWLEDGE_ARTICLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WEB_RESULT_ID = /^web-/;
const MIN_ANSWER_LENGTH = 200;

export interface SharedAnswerScope {
    question: string;
    country?: string;
    region?: string;
    language?: string;
    locationZone?: string;
    soil?: string;
    water?: string;
    goal?: string;
    provider?: string;
}

/** The same question typed with different capitals, spacing or end punctuation. */
export function normalizeSharedQuestion(question: string): string {
    return question
        .normalize('NFKC')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, '')
        .replace(/[\s?？!！.。…]+$/u, '')
        .trim();
}

function scopeValue(value?: string): string {
    return (value || '').trim().toLowerCase();
}

export function sharedAnswerKey(scope: SharedAnswerScope, now: Date = new Date()): string {
    return createHash('sha256').update(JSON.stringify({
        version: ADVISORY_CACHE_VERSION,
        question: normalizeSharedQuestion(scope.question),
        country: scopeValue(scope.country),
        region: scopeValue(scope.region),
        language: scopeValue(scope.language),
        locationZone: scopeValue(scope.locationZone),
        soil: scopeValue(scope.soil),
        water: scopeValue(scope.water),
        goal: scopeValue(scope.goal),
        provider: scopeValue(scope.provider),
        month: now.toISOString().slice(0, 7),
    })).digest('hex');
}

export interface SharedAnswerCandidate {
    response: FinalAnswer;
    categories: string[];
    attachments?: KnowledgeAttachment[];
    /** Names of tools whose output the answer drew on. */
    toolsUsed?: string[];
}

/** Whether an answer to this question could be shared at all, before it is written. */
export function mayBeShared(categories: string[], attachments?: KnowledgeAttachment[]): boolean {
    return !attachments?.length && !categories.some(category => REAL_TIME_CATEGORIES.has(category));
}

/** How many days this answer may be shared, or null when it must not be. */
export function sharedAnswerDays({ response, categories, attachments, toolsUsed }: SharedAnswerCandidate): number | null {
    if (toolsUsed?.length || !mayBeShared(categories, attachments)) return null;
    if (response.answerMode !== 'generated') return null;
    if (typeof response.answer !== 'string' || response.answer.length < MIN_ANSWER_LENGTH) return null;

    const quality = response.advisoryQuality;
    if (!quality || quality.sourceCount === 0 || quality.citedSourceNumbers.length === 0 || quality.invalidReferences) return null;

    const safety = response.safety;
    if (!safety || !safety.safe || safety.violations.length > 0 || safety.quarantineAlert || safety.hazardLevel !== 'safe') return null;

    const ids = response.contextUsed.map(source => String(source.id));
    if (ids.length === 0) return null;
    // Live data (ids "live-…") and anything not from the knowledge base or web search is never shared.
    if (!ids.every(id => KNOWLEDGE_ARTICLE_ID.test(id) || WEB_RESULT_ID.test(id))) return null;
    return ids.some(id => WEB_RESULT_ID.test(id)) ? WEB_SOURCE_DAYS : KNOWLEDGE_BASE_DAYS;
}

function knowledgeArticleIds(sources: SearchResult[]): string[] {
    return [...new Set(sources.map(source => String(source.id)).filter(id => KNOWLEDGE_ARTICLE_ID.test(id)))];
}

/** The knowledge-base articles an answer is written from, as they were when retrieved. */
export interface SourcesRevision {
    articleIds: string[];
    fingerprint: string;
}

export async function knowledgeSourcesRevision(sources: SearchResult[]): Promise<SourcesRevision | null> {
    const articleIds = knowledgeArticleIds(sources);
    try {
        const result = await query<{ fingerprint: string }>(
            'SELECT knowledge_sources_fingerprint($1::uuid[]) AS fingerprint',
            [articleIds],
        );
        const fingerprint = result.rows[0]?.fingerprint;
        return fingerprint ? { articleIds, fingerprint } : null;
    } catch (error) {
        logger.warn('Could not fingerprint the answer sources; the answer will not be shared:', error);
        return null;
    }
}

/** What is stored: the answer without its spoken audio and without the per-request cache flag. */
function storedAnswer(response: FinalAnswer): Partial<FinalAnswer> {
    const stored: Partial<FinalAnswer> = { ...response };
    delete stored.cached;
    delete stored.audio;
    return stored;
}

function isStoredAnswer(value: unknown): value is Omit<FinalAnswer, 'cached'> {
    if (typeof value !== 'object' || value === null) return false;
    const answer = value as { answer?: unknown; contextUsed?: unknown };
    return typeof answer.answer === 'string' && answer.answer.length >= MIN_ANSWER_LENGTH && Array.isArray(answer.contextUsed);
}

/**
 * Saves the answer only while its sources still match `revision`, taken when they were
 * retrieved: an article edited while the answer was being written would otherwise be stored
 * with the new article's fingerprint and an answer written from the old one.
 */
export async function saveSharedAnswer(key: string, response: FinalAnswer, days: number, revision: SourcesRevision): Promise<void> {
    try {
        const saved = await query(
            `INSERT INTO shared_answer_cache (scope_key, answer, source_ids, sources_fingerprint, expires_at)
             SELECT $1, $2::jsonb, $3::uuid[], knowledge_sources_fingerprint($3::uuid[]), NOW() + make_interval(days => $4::int)
             WHERE knowledge_sources_fingerprint($5::uuid[]) = $6
             ON CONFLICT (scope_key) DO UPDATE SET
                 answer = EXCLUDED.answer,
                 source_ids = EXCLUDED.source_ids,
                 sources_fingerprint = EXCLUDED.sources_fingerprint,
                 hit_count = 0,
                 created_at = NOW(),
                 last_hit_at = NULL,
                 expires_at = EXCLUDED.expires_at`,
            [key, JSON.stringify(storedAnswer(response)), knowledgeArticleIds(response.contextUsed), days, revision.articleIds, revision.fingerprint],
        );
        if ((saved.rowCount ?? 0) === 0) {
            logger.info('Not saving the answer for reuse: a source article changed while it was being written.');
        }
        await query('DELETE FROM shared_answer_cache WHERE expires_at <= NOW()');
    } catch (error) {
        logger.warn('Could not save the answer for reuse:', error);
    }
}

interface SharedAnswerRow {
    answer: unknown;
    sources_unchanged: boolean;
}

export async function findSharedAnswer(key: string): Promise<FinalAnswer | null> {
    try {
        const result = await query<SharedAnswerRow>(
            `SELECT answer, sources_fingerprint = knowledge_sources_fingerprint(source_ids) AS sources_unchanged
             FROM shared_answer_cache
             WHERE scope_key = $1 AND expires_at > NOW()`,
            [key],
        );
        const row = result.rows[0];
        if (!row) return null;
        if (!row.sources_unchanged || !isStoredAnswer(row.answer)) {
            logger.info('Dropping a shared answer: its knowledge-base sources changed since it was saved.');
            await query('DELETE FROM shared_answer_cache WHERE scope_key = $1', [key]);
            return null;
        }
        query('UPDATE shared_answer_cache SET hit_count = hit_count + 1, last_hit_at = NOW() WHERE scope_key = $1', [key])
            .catch(error => logger.warn('Could not count a shared answer reuse:', error));
        return { ...row.answer, cached: true };
    } catch (error) {
        logger.warn('Shared answer lookup failed; making a new answer:', error);
        return null;
    }
}

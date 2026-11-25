import type { PoolClient } from 'pg';
import { query, withTransaction } from '@/services/databaseService';
import { getFarmerForPrincipal, type RequestPrincipal } from '@/services/dataGovernanceService';
import { countryOfUser } from '@/services/country/countryContext';
import { getEmbedding } from '@/services/embeddingCache';
import { findCountry } from '@/shared-api/countries';
import { logger } from '@/utils/logger';

/**
 * Approved advice from the review queue, added to the knowledge base.
 *
 * The agronomist who approved an AI answer (or a manager) can turn it into a knowledge-base
 * document, correcting it on the way. It goes in tagged `pending_review`, so it does not ground
 * any answer until a manager or administrator other than that agronomist approves it on the
 * document review screen. The document records who approved the advice and when, and the
 * sources they give. Anyone can read knowledge-base documents, so the farmer's name, phone
 * numbers and email addresses are refused.
 */

export const REVIEWED_ANSWER_TAG = 'reviewed_answer';
const MANAGER_ROLES = new Set(['admin', 'regional_manager']);

export interface ReviewedAnswerInput {
    title: string;
    content: string;
    crops: string[];
    category: string;
    sources?: string;
    country?: string;
}

export type ReviewedAnswerResult =
    | { ok: true; articleId: string }
    | { ok: false; status: 400 | 403 | 404 | 409; error: string };

const LIMITS = { titleMin: 5, titleMax: 200, contentMin: 80, contentMax: 20000, crops: 10, cropMax: 60, categoryMax: 100, sourcesMax: 2000 };

function text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function cropList(value: unknown): string[] {
    const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
    return [...new Set(items.map(text).filter(Boolean))];
}

export function validateReviewedAnswer(body: unknown): { ok: true; value: ReviewedAnswerInput } | { ok: false; error: string } {
    const input = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    const title = text(input.title);
    const content = text(input.content);
    const crops = cropList(input.crops);
    const category = text(input.category) || 'Reviewed advice';
    const sources = text(input.sources);
    const country = text(input.country);

    if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax) {
        return { ok: false, error: `Give the document a title of ${LIMITS.titleMin} to ${LIMITS.titleMax} characters.` };
    }
    if (content.length < LIMITS.contentMin || content.length > LIMITS.contentMax) {
        return { ok: false, error: `The advice must be ${LIMITS.contentMin} to ${LIMITS.contentMax} characters.` };
    }
    if (crops.length > LIMITS.crops || crops.some(crop => crop.length > LIMITS.cropMax)) {
        return { ok: false, error: `Name at most ${LIMITS.crops} crops.` };
    }
    if (category.length > LIMITS.categoryMax || sources.length > LIMITS.sourcesMax) {
        return { ok: false, error: 'The category or the sources are too long.' };
    }
    return { ok: true, value: { title, content, crops, category, ...(sources ? { sources } : {}), ...(country ? { country } : {}) } };
}

interface FarmerNames {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PHONE_NUMBER = /\+?\d(?:[\s().-]*\d){8,}/;
const EMAIL_ADDRESS = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;

function containsWords(value: string, words: string): boolean {
    const phrase = words.split(/\s+/).map(escapeRegExp).join('\\s+');
    return new RegExp(`(^|[^\\p{L}])${phrase}([^\\p{L}]|$)`, 'iu').test(value);
}

/** Personal details in text meant for everyone: the farmer's name, phone numbers, email addresses. */
export function findPersonalDetails(value: string, farmer: FarmerNames | null): string[] {
    const found: string[] = [];
    const first = text(farmer?.first_name);
    const last = text(farmer?.last_name);
    // A name on its own is matched from three letters (shorter ones are too often ordinary words);
    // the full name is matched at any length, so "Bo Li" is found too. Whole words only.
    const names = [first, last].filter(name => name.length >= 3);
    if (first && last) names.push(`${first} ${last}`);
    if (names.some(name => containsWords(value, name))) {
        found.push("the farmer's name");
    }
    const farmerDigits = text(farmer?.phone).replace(/\D/g, '');
    const textDigits = value.replace(/\D/g, '');
    if (PHONE_NUMBER.test(value) || (farmerDigits.length >= 7 && textDigits.includes(farmerDigits))) found.push('a phone number');
    if (EMAIL_ADDRESS.test(value)) found.push('an email address');
    return found;
}

function joinList(items: string[]): string {
    return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

interface ReviewRow extends FarmerNames {
    id: string;
    status: string;
    farmer_id: string | null;
    reviewed_by: string | null;
    reviewed_at: Date | string | null;
    knowledge_article_id: string | null;
    farmer_country: string | null;
    reviewer_first_name: string | null;
    reviewer_last_name: string | null;
}

async function loadReview(reviewId: string): Promise<ReviewRow | null> {
    const result = await query<ReviewRow>(
        `SELECT r.id, r.status, r.farmer_id, r.reviewed_by, r.reviewed_at, r.knowledge_article_id,
                f.first_name, f.last_name, f.phone, f.country AS farmer_country,
                u.first_name AS reviewer_first_name, u.last_name AS reviewer_last_name
         FROM recommendation_reviews r
         LEFT JOIN farmers f ON f.id = r.farmer_id
         LEFT JOIN users u ON u.id = r.reviewed_by
         WHERE r.id = $1`,
        [reviewId],
    );
    return result.rows[0] ?? null;
}

function reviewDate(value: Date | string | null): string {
    const date = value ? new Date(value) : new Date();
    return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function documentContent(input: ReviewedAnswerInput): string {
    return input.sources ? `${input.content}\n\nSources: ${input.sources}` : input.content;
}

async function documentCountry(input: ReviewedAnswerInput, review: ReviewRow, principal: RequestPrincipal): Promise<string | null> {
    return findCountry(input.country)?.name ?? findCountry(review.farmer_country)?.name ?? (await countryOfUser(principal.userId));
}

async function insertDocument(
    client: PoolClient,
    reviewId: string,
    document: { title: string; content: string; category: string; crops: string[]; regions: string[]; source: string },
): Promise<string | null> {
    const locked = await client.query<{ knowledge_article_id: string | null }>(
        'SELECT knowledge_article_id FROM recommendation_reviews WHERE id = $1 FOR UPDATE',
        [reviewId],
    );
    if (!locked.rows[0] || locked.rows[0].knowledge_article_id) return null;
    const inserted = await client.query<{ id: string }>(
        `INSERT INTO knowledge_articles (title, content, summary, category, tags, crops, regions, source, content_type)
         VALUES ($1, $2, $3, $4, $5::text[], $6::text[], $7::text[], $8, 'text')
         RETURNING id`,
        [
            document.title, document.content, document.content.slice(0, 300), document.category,
            [REVIEWED_ANSWER_TAG, 'pending_review'], document.crops, document.regions, document.source,
        ],
    );
    const articleId = inserted.rows[0]!.id;
    await client.query('UPDATE recommendation_reviews SET knowledge_article_id = $1 WHERE id = $2', [articleId, reviewId]);
    return articleId;
}

/**
 * Search by meaning needs an embedding; when that fails the keyword search still finds it and a
 * later backfill embeds it. Only the embedding is written, so a document approved or rejected in
 * the meantime keeps its tags, and a deleted one is not brought back.
 */
async function embedDocument(articleId: string, content: string): Promise<void> {
    try {
        const embedding = await getEmbedding(content);
        await query('UPDATE knowledge_articles SET embedding = $1::double precision[] WHERE id = $2', [embedding, articleId]);
    } catch (error) {
        logger.warn(`Reviewed advice ${articleId} saved without an embedding; the backfill will add it:`, error);
    }
}

export async function addReviewedAnswerToKnowledge(
    reviewId: string,
    input: ReviewedAnswerInput,
    principal: RequestPrincipal,
): Promise<ReviewedAnswerResult> {
    const review = await loadReview(reviewId);
    if (!review || !review.farmer_id || !(await getFarmerForPrincipal(review.farmer_id, principal))) {
        return { ok: false, status: 404, error: 'Review not found' };
    }
    if (review.status !== 'approved') {
        return { ok: false, status: 409, error: 'Only approved advice can be added to the knowledge base.' };
    }
    if (review.reviewed_by !== principal.userId && !MANAGER_ROLES.has(principal.role)) {
        return { ok: false, status: 403, error: 'Only the person who approved this advice, or a manager, can add it to the knowledge base.' };
    }
    if (review.knowledge_article_id) {
        return { ok: false, status: 409, error: 'This advice is already in the knowledge base.' };
    }
    const personal = findPersonalDetails([input.title, input.content, input.sources ?? '', input.category, ...input.crops].join('\n'), review);
    if (personal.length > 0) {
        return { ok: false, status: 400, error: `Remove ${joinList(personal)} first: everyone who asks a question can read knowledge-base documents.` };
    }

    const reviewer = [review.reviewer_first_name, review.reviewer_last_name].map(text).filter(Boolean).join(' ') || 'an agronomist';
    const country = await documentCountry(input, review, principal);
    const document = {
        title: input.title,
        content: documentContent(input),
        category: input.category,
        crops: input.crops,
        regions: country ? [country] : [],
        source: `Advice approved by ${reviewer}, ${reviewDate(review.reviewed_at)}`.slice(0, 255),
    };

    const articleId = await withTransaction(client => insertDocument(client, reviewId, document));
    if (!articleId) return { ok: false, status: 409, error: 'This advice is already in the knowledge base.' };

    logger.info(`Approved advice ${reviewId} added to the knowledge base as ${articleId} by ${principal.userId}; waiting for document approval`);
    await embedDocument(articleId, document.content);
    return { ok: true, articleId };
}

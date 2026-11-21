/**
 * Every question answered without a vetted guide behind it is noted, without who asked.
 * The report groups them by crop and country and by the words that recur, so the content
 * team knows which guides to license or have written next. Demo sessions are not counted.
 */
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';

export async function recordContentGap(gap: { question: string; crop?: string | null; country?: string | null; language?: string | null; role?: string | null }): Promise<void> {
    try {
        await query(
            `INSERT INTO content_gaps (question, crop, country, language, asked_by_role) VALUES ($1, $2, $3, $4, $5)`,
            [gap.question.trim().slice(0, 500), gap.crop?.toLowerCase().slice(0, 80) ?? null, gap.country ?? null, gap.language?.slice(0, 10) ?? null, gap.role ?? null],
        );
    } catch (error) {
        logger.warn('Could not record a content gap:', error);
    }
}

const STOP = new Set(['the', 'and', 'for', 'with', 'what', 'how', 'why', 'when', 'which', 'my', 'is', 'are', 'can', 'do', 'does', 'should', 'of', 'to', 'in', 'on', 'a', 'an', 'it', 'i', 'me', 'this', 'that', 'there', 'have', 'has', 'be', 'or', 'from', 'at', 'after', 'about', 'na', 'ya', 'kwa', 'wa', 'ni', 'za', 'la', 'le', 'les', 'de', 'des', 'du', 'et', 'que', 'o', 'e', 'do', 'da']);

/** The words that recur across questions (a rough guide to topics, not a classifier). */
export function topWords(questions: string[], limit = 8): Array<{ word: string; count: number }> {
    const counts = new Map<string, number>();
    for (const question of questions) {
        const words = new Set(question.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 3 && !STOP.has(w)));
        words.forEach(word => counts.set(word, (counts.get(word) ?? 0) + 1));
    }
    return Array.from(counts, ([word, count]) => ({ word, count }))
        .filter(item => item.count > 1)
        .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
        .slice(0, limit);
}

export interface GapGroup {
    crop: string | null;
    country: string | null;
    questions: number;
    topWords: Array<{ word: string; count: number }>;
    examples: string[];
}

/** The last `days` days of gaps, largest groups first. */
export async function contentGapReport(days = 90, country?: string | null): Promise<GapGroup[]> {
    const { rows } = await query<{ crop: string | null; country: string | null; question: string }>(
        `SELECT crop, country, question FROM content_gaps
          WHERE created_at > NOW() - make_interval(days => $1) AND ($2::text IS NULL OR country = $2)
          ORDER BY created_at DESC LIMIT 5000`,
        [days, country ?? null],
    );
    const groups = new Map<string, { crop: string | null; country: string | null; questions: string[] }>();
    for (const row of rows) {
        const key = `${row.crop ?? ''}|${row.country ?? ''}`;
        const group = groups.get(key) ?? { crop: row.crop, country: row.country, questions: [] };
        group.questions.push(row.question);
        groups.set(key, group);
    }
    return Array.from(groups.values())
        .map(group => ({
            crop: group.crop, country: group.country, questions: group.questions.length,
            topWords: topWords(group.questions), examples: Array.from(new Set(group.questions)).slice(0, 5),
        }))
        .sort((a, b) => b.questions - a.questions);
}

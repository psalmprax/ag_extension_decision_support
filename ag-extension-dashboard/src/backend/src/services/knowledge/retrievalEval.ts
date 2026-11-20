/**
 * Retrieval evaluation metrics. Pure functions, no I/O.
 *
 * A golden case is a question plus the article ids a correct answer should be
 * grounded in. "Unanswerable" cases have no such article in the corpus: the
 * right outcome there is no evidence at all (the answer is then labelled
 * general guidance), so they measure the relevance gate rather than ranking.
 */

export interface GoldenCase {
    id: string;
    question: string;
    language: string;
    /** Article ids that answer the question; empty for an unanswerable case. */
    expected: string[];
    crops?: string[];
    country?: string;
}

export interface CaseOutcome {
    case: GoldenCase;
    /** Candidate article ids, best first, before the relevance gate. */
    ranked: string[];
    /** Article ids that passed the relevance gate. */
    evidence: string[];
    error?: string;
}

export interface RetrievalMetrics {
    cases: number;
    answerable: number;
    unanswerable: number;
    /** Share of answerable cases with an expected article in the top k candidates. */
    hitAt1: number;
    hitAt3: number;
    hitAt5: number;
    /** Mean reciprocal rank of the first expected article (0 when absent). */
    mrr: number;
    /** Share of answerable cases whose gated evidence contains an expected article. */
    groundedRate: number;
    /** Share of unanswerable cases that were given no evidence. */
    abstentionRate: number;
    /** Share of gated evidence passages (answerable cases) that are expected articles. */
    evidencePrecision: number;
    errors: number;
}

function share(numerator: number, denominator: number): number {
    return denominator === 0 ? 0 : numerator / denominator;
}

function firstHitRank(outcome: CaseOutcome): number | undefined {
    const index = outcome.ranked.findIndex(id => outcome.case.expected.includes(id));
    return index >= 0 ? index + 1 : undefined;
}

export function computeRetrievalMetrics(outcomes: CaseOutcome[]): RetrievalMetrics {
    const answerable = outcomes.filter(outcome => outcome.case.expected.length > 0);
    const unanswerable = outcomes.filter(outcome => outcome.case.expected.length === 0);
    const ranks = answerable.map(firstHitRank);
    const hitAt = (k: number) => share(ranks.filter(rank => rank !== undefined && rank <= k).length, answerable.length);
    const evidence = answerable.flatMap(outcome => outcome.evidence.map(id => outcome.case.expected.includes(id)));
    return {
        cases: outcomes.length,
        answerable: answerable.length,
        unanswerable: unanswerable.length,
        hitAt1: hitAt(1),
        hitAt3: hitAt(3),
        hitAt5: hitAt(5),
        mrr: share(ranks.reduce<number>((sum, rank) => sum + (rank ? 1 / rank : 0), 0), answerable.length),
        groundedRate: share(answerable.filter(outcome => outcome.evidence.some(id => outcome.case.expected.includes(id))).length, answerable.length),
        abstentionRate: share(unanswerable.filter(outcome => outcome.evidence.length === 0).length, unanswerable.length),
        evidencePrecision: share(evidence.filter(Boolean).length, evidence.length),
        errors: outcomes.filter(outcome => outcome.error).length,
    };
}

export function metricsByLanguage(outcomes: CaseOutcome[]): Record<string, RetrievalMetrics> {
    const languages = [...new Set(outcomes.map(outcome => outcome.case.language))].sort();
    return Object.fromEntries(languages.map(language =>
        [language, computeRetrievalMetrics(outcomes.filter(outcome => outcome.case.language === language))]
    ));
}

export type MetricGates = Partial<Record<keyof RetrievalMetrics, number>>;

/** Metrics below their minimum; `errors` is a maximum. */
export function failedGates(metrics: RetrievalMetrics, gates: MetricGates): string[] {
    return Object.entries(gates).flatMap(([name, bound]) => {
        const value = metrics[name as keyof RetrievalMetrics];
        if (bound === undefined) return [];
        const failed = name === 'errors' ? value > bound : value < bound;
        return failed ? [`${name} ${value.toFixed(3)} ${name === 'errors' ? '>' : '<'} ${bound}`] : [];
    });
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/** Rejects malformed golden files early: unknown ids would silently score as misses. */
export function validateGoldenCases(cases: unknown, knownArticleIds: Set<string>): GoldenCase[] {
    if (!Array.isArray(cases)) throw new Error('Golden set must be an array');
    const seen = new Set<string>();
    return cases.map((raw, index) => {
        if (!raw || typeof raw !== 'object') throw new Error(`Case ${index}: not an object`);
        const item = raw as Record<string, unknown>;
        if (typeof item.id !== 'string' || !item.id || seen.has(item.id)) throw new Error(`Case ${index}: missing or duplicate id`);
        seen.add(item.id);
        if (typeof item.question !== 'string' || !item.question.trim()) throw new Error(`Case ${item.id}: missing question`);
        if (typeof item.language !== 'string') throw new Error(`Case ${item.id}: missing language`);
        if (!Array.isArray(item.expected)) throw new Error(`Case ${item.id}: expected must be an array`);
        const expected: string[] = [];
        for (const id of item.expected) {
            if (typeof id !== 'string' || !knownArticleIds.has(id)) throw new Error(`Case ${item.id}: unknown article id ${String(id)}`);
            expected.push(id);
        }
        const { crops, country } = item;
        if (crops !== undefined && !isStringArray(crops)) {
            throw new Error(`Case ${item.id}: crops must be an array of strings`);
        }
        if (country !== undefined && typeof country !== 'string') throw new Error(`Case ${item.id}: country must be a string`);
        return {
            id: item.id, question: item.question, language: item.language, expected,
            ...(isStringArray(crops) ? { crops } : {}), ...(country !== undefined ? { country } : {}),
        };
    });
}

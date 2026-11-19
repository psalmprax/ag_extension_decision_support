/**
 * Retrieval evaluation against the golden set (eval/rag-golden.json).
 *
 *   npm run eval:rag                      # print metrics
 *   npm run eval:rag -- --gate            # exit 1 when a metric is below eval/rag-gates.json
 *   npm run eval:rag -- --out=report.json # also write per-case results
 *
 * Runs the production advisory retrieval (rankAdvisoryEvidence: translation,
 * hybrid search, boosts, reranking, relevance gate) with the configured
 * embedding and LLM providers, over the 30 seed articles. Use a disposable
 * database: the seed articles are upserted and chunked. Other articles in the
 * database would compete with the seeds and lower the scores, so the run
 * reports them.
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { config } from '@/config';
import { closeDatabase, initializeDatabase, query } from '@/services/databaseService';
import { closeCache, initializeCache } from '@/services/cacheService';
import { rankAdvisoryEvidence } from '@/services/knowledge/advisoryRetrieval';
import {
    computeRetrievalMetrics, failedGates, metricsByLanguage, validateGoldenCases,
    type CaseOutcome, type GoldenCase, type MetricGates, type RetrievalMetrics,
} from '@/services/knowledge/retrievalEval';
import { seedKnowledgeArticlesData } from '@/services/knowledge/seedArticles';
import { RAGV2Service } from '@/services/ragV2Service';
import { retrievalSignals } from '@/services/vector/rrfFusion';
import { VectorService } from '@/services/vectorService';
import { logger } from '@/utils/logger';

const EVAL_DIR = path.resolve(__dirname, '../../eval');
const CONCURRENCY = 3;

function argValue(name: string): string | undefined {
    const prefix = `--${name}=`;
    return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length);
}

async function prepareCorpus(): Promise<Set<string>> {
    const ids = seedKnowledgeArticlesData.map(article => article.id);
    await VectorService.seedKnowledge(seedKnowledgeArticlesData);
    const { rows: [counts] } = await query<{ embedded: string; others: string }>(
        `SELECT count(*) FILTER (WHERE id = ANY($1::uuid[]) AND embedding IS NOT NULL) AS embedded,
                count(*) FILTER (WHERE id <> ALL($1::uuid[])) AS others
         FROM knowledge_articles`, [ids]
    );
    if (Number(counts!.embedded) !== ids.length) {
        throw new Error(`Only ${counts!.embedded}/${ids.length} seed articles are embedded: check the embedding provider configuration`);
    }
    if (Number(counts!.others) > 0) {
        logger.warn(`${counts!.others} non-seed articles are in this database and will compete with the golden set`);
    }
    const chunked = await RAGV2Service.chunkAllArticles();
    logger.info(`Corpus ready: ${chunked.total} articles, ${chunked.chunks} chunks`);
    return new Set(ids);
}

async function runCase(golden: GoldenCase): Promise<CaseOutcome & { rerankedBy?: string; translated: boolean }> {
    try {
        const { ranked, relevant, englishQuery } = await rankAdvisoryEvidence(golden.question, {
            language: golden.language, crops: golden.crops, country: golden.country,
        });
        return {
            case: golden,
            ranked: ranked.map(result => result.id),
            evidence: relevant.map(result => result.id),
            rerankedBy: ranked.map(result => retrievalSignals(result).rerankedBy).find(Boolean),
            translated: englishQuery !== undefined,
        };
    } catch (error) {
        return { case: golden, ranked: [], evidence: [], error: (error as Error).message, translated: false };
    }
}

async function runAll(cases: GoldenCase[]) {
    const outcomes: Array<Awaited<ReturnType<typeof runCase>>> = new Array(cases.length);
    let next = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
        while (next < cases.length) {
            const index = next++;
            outcomes[index] = await runCase(cases[index]!);
        }
    }));
    return outcomes;
}

function formatRow(label: string, metrics: RetrievalMetrics): string {
    const pct = (value: number) => `${(value * 100).toFixed(1)}%`.padStart(7);
    return `${label.padEnd(8)} ${String(metrics.answerable).padStart(4)} ${String(metrics.unanswerable).padStart(4)} ` +
        `${pct(metrics.hitAt1)} ${pct(metrics.hitAt3)} ${pct(metrics.hitAt5)} ${metrics.mrr.toFixed(3).padStart(6)} ` +
        `${pct(metrics.groundedRate)} ${pct(metrics.evidencePrecision)} ${pct(metrics.abstentionRate)} ${String(metrics.errors).padStart(4)}`;
}

async function main(): Promise<void> {
    await initializeDatabase();
    await initializeCache().catch(error => logger.warn('Cache unavailable for the evaluation run:', error));
    const knownIds = await prepareCorpus();

    const golden = JSON.parse(readFileSync(path.join(EVAL_DIR, 'rag-golden.json'), 'utf8')) as { cases: unknown };
    const cases = validateGoldenCases(golden.cases, knownIds);
    const outcomes = await runAll(cases);

    const overall = computeRetrievalMetrics(outcomes);
    const byLanguage = metricsByLanguage(outcomes);
    const header = 'subset    ans  una   hit@1   hit@3   hit@5    mrr grounded  ev.prec abstain  err';
    console.log(`\nEmbeddings: ${config.ai.embeddings.provider}/${config.ai.embeddings.model}; ` +
        `reranker: ${[...new Set(outcomes.map(outcome => outcome.rerankedBy ?? 'none'))].join(', ')}; ` +
        `translated: ${outcomes.filter(outcome => outcome.translated).length}/${outcomes.length}; ` +
        `thresholds: vector ${config.retrieval.minVectorSimilarity}, rerank ${config.retrieval.minRerankScore}`);
    console.log(header);
    console.log(formatRow('all', overall));
    for (const [language, metrics] of Object.entries(byLanguage)) console.log(formatRow(language, metrics));

    const misses = outcomes.filter(outcome => outcome.error ||
        (outcome.case.expected.length > 0 && !outcome.evidence.some(id => outcome.case.expected.includes(id))) ||
        (outcome.case.expected.length === 0 && outcome.evidence.length > 0));
    if (misses.length > 0) {
        console.log(`\nCases needing attention (${misses.length}):`);
        for (const miss of misses) {
            const short = (ids: string[]) => ids.map(id => id.slice(-2)).join(',') || '-';
            console.log(`  ${miss.case.id}: expected ${short(miss.case.expected)}, ranked ${short(miss.ranked.slice(0, 5))}, ` +
                `evidence ${short(miss.evidence)}${miss.error ? `, error: ${miss.error}` : ''}  ${JSON.stringify(miss.case.question)}`);
        }
    }

    const out = argValue('out');
    if (out) writeFileSync(out, JSON.stringify({ overall, byLanguage, outcomes }, null, 2));

    if (process.argv.includes('--gate')) {
        const gates = JSON.parse(readFileSync(path.join(EVAL_DIR, 'rag-gates.json'), 'utf8')) as { overall: MetricGates; byLanguage?: Record<string, MetricGates> };
        const failures = [
            ...failedGates(overall, gates.overall).map(failure => `all: ${failure}`),
            // A gated language with no outcomes fails: deleting its questions
            // must not pass the gate silently.
            ...Object.entries(gates.byLanguage ?? {}).flatMap(([language, languageGates]) =>
                byLanguage[language]
                    ? failedGates(byLanguage[language]!, languageGates).map(failure => `${language}: ${failure}`)
                    : [`${language}: no evaluated cases`]),
        ];
        if (failures.length > 0) {
            console.error(`\nRetrieval quality gate failed:\n  ${failures.join('\n  ')}`);
            process.exitCode = 1;
        } else {
            console.log('\nRetrieval quality gate passed.');
        }
    }
}

main()
    .catch(error => {
        logger.error('Retrieval evaluation crashed:', error);
        process.exitCode = 2;
    })
    .finally(async () => {
        await closeCache().catch(() => undefined);
        await closeDatabase().catch(() => undefined);
    });

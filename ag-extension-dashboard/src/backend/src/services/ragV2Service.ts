/**
 * RAG v2 Service — chunk retrieval, candidate fusion, reranking, citations.
 *
 * 1. Chunking: articles split by section and paragraph (knowledge/chunking.ts)
 * 2. Candidates: article vectors, article full text and chunk vectors fused
 *    with RRF, keeping each leg's evidence (vector/rrfFusion.ts)
 * 3. Re-ranking: cross-encoder or LLM relevance scores (knowledge/reranker.ts)
 * 4. Knowledge graph: entity co-occurrence for the knowledge search page, not
 *    verified relationships; advisory answers do not use it
 */

import { query } from '@/services/databaseService';
import { getEmbedding } from '@/services/embeddingCache';
import { logger } from '@/utils/logger';
import { normalizeAgronomicQuery } from '@/utils/agronomicQueryNormalizer';
import type { SearchResult } from '@/services/vectorService';
import { chunkDocument, chunkEmbeddingInput } from '@/services/knowledge/chunking';
import { CROP_PATTERN } from '@/services/knowledge/cropTerms';
import { orderByRerank, scoreCandidates } from '@/services/knowledge/reranker';
import { fuseRankedLegs, retrievalSignals, type RankedLeg, type RetrievalSignals } from '@/services/vector/rrfFusion';
import { cosineDistance, embeddingWidthPredicate, toVectorLiteral } from '@/services/vector/vectorSql';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Chunk {
    id: string;
    articleId: string;
    chunkIndex: number;
    content: string;
    embedding?: number[];
}

export interface Entity {
    id: string;
    name: string;
    type: 'crop' | 'disease' | 'soil' | 'region' | 'practice' | 'nutrient' | 'pest';
    properties: Record<string, unknown>;
}

export interface Relationship {
    sourceEntityId: string;
    targetEntityId: string;
    relationType: string;
    articleId?: string;
    properties: Record<string, unknown>;
}

export interface RankedResult {
    id: string;
    articleId: string;
    content: string;
    metadata: Record<string, unknown>;
    score: number;
    rerankScore?: number;
    citation: string;
}

export interface Citation {
    sourceId: string;
    title: string;
    category: string;
    excerpt: string;
    score: number;
}

// ─── Entity Patterns ─────────────────────────────────────────────────────────

const ENTITY_PATTERNS: Record<string, RegExp[]> = {
    crop: [CROP_PATTERN],
    disease: [
        /\b(northern\s+leaf\s+blight|southern\s+rust|grey\s+leaf\s+spot|gray\s+leaf\s+spot|maize\s+streak|fall\s+armyworm|stem\s+borer|aphid|whitefly|thrips|nematode|root\s+rot|leaf\s+blight|powdery\s+mildew|downy\s+mildew|anthracnose|wilt|mosaic\s+virus|bacterial\s+blight|rust|smut|ergot|blast|brown\s+spot|sheath\s+blight)\b/gi
    ],
    soil: [
        /\b(sandy\s+loam|clay\s+loam|silt\s+loam|sandy\s+soil|clay\s+soil|laterite|ferralsol|acrisol|vertisol|luvisol|cambisol|alluvial|peat|chalky|saline|acidic|alkaline|well.drained|waterlogged|fertile|degraded)\b/gi
    ],
    nutrient: [
        /\b(nitrogen|phosphorus|potassium|calcium|magnesium|sulfur|zinc|iron|manganese|boron|copper|organic\s+matter|compost|manure|fertilizer|NPK|urea|DAP|CAN|superphosphate)\b/gi
    ],
    practice: [
        /\b(crop\s+rotation|intercropping|mulching|cover\s+crop|no.till|conservation\s+tillage|drip\s+irrigation|furrow\s+irrigation|rainfed|terracing|contour\s+farming|agroforestry|precision\s+agriculture|integrated\s+pest\s+management|IPM|composting|green\s+manure|raised\s+bed|zero\s+grazing)\b/gi
    ],
    region: [
        /\b(sub.Saharan|East\s+Africa|West\s+Africa|Southern\s+Africa|Central\s+Africa|South\s+East\s+Asia|South\s+Asia|Latin\s+America|Caribbean|tropical|temperate|arid|semi.arid|humid|highland|lowland|coastal|savanna|rainforest)\b/gi
    ]
};

// ─── RAG V2 Service ──────────────────────────────────────────────────────────

export class RAGV2Service {

    // ── Schema Initialization ────────────────────────────────────────────────

    static async initializeSchema(): Promise<void> {
        logger.info('[RAGv2] Schema initialization handled via Prisma migrations');
    }


    // ── Chunking ─────────────────────────────────────────────────────────────

    static async chunkAndEmbedArticle(articleId: string, content: string, metadata: Record<string, unknown>): Promise<number> {
        const chunks = chunkDocument(content);
        if (chunks.length === 0) return 0;
        const title = typeof metadata.title === 'string' ? metadata.title : undefined;

        await query(
            `DELETE FROM knowledge_chunks
             WHERE article_id = $1 AND source_content_hash = encode(sha256(convert_to($2::text, 'UTF8')), 'hex')
               AND EXISTS (SELECT 1 FROM knowledge_articles WHERE id = $1 AND content = $2)`,
            [articleId, content]
        );

        let embedded = 0;
        for (let i = 0; i < chunks.length; i++) {
            const embedding = await getEmbedding(chunkEmbeddingInput(title, chunks[i]!));
            const inserted = await query(
                `INSERT INTO knowledge_chunks (id, article_id, chunk_index, content, embedding, source_content_hash)
                 SELECT $1, id, $3, $4, $5::double precision[], encode(sha256(convert_to($6::text, 'UTF8')), 'hex')
                 FROM knowledge_articles WHERE id = $2 AND content = $6
                 ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding,
                     source_content_hash = EXCLUDED.source_content_hash`,
                [`${articleId}-chunk-${i}`, articleId, i, chunks[i]!.content, embedding, content]
            );
            if (inserted.rowCount !== 1) throw new Error(`Article ${articleId} changed during chunk indexing`);
            embedded++;
        }

        return embedded;
    }

    static async chunkAllArticles(): Promise<{ total: number; chunks: number }> {
        const { rows } = await query(
            "SELECT id, content, title, category, tags, crops, regions, source, source_url FROM knowledge_articles WHERE embedding IS NOT NULL"
        );

        let totalChunks = 0;
        for (const row of rows) {
            const count = await this.chunkAndEmbedArticle(row.id, row.content, {
                title: row.title, category: row.category
            });
            totalChunks += count;
        }

        logger.info(`[RAGv2] Chunked ${rows.length} articles into ${totalChunks} chunks`);
        return { total: rows.length, chunks: totalChunks };
    }

    // ── Entity Extraction ────────────────────────────────────────────────────

    private static processPatternMatches(text: string, type: string, pattern: RegExp, articleId: string, entities: Map<string, Entity>) {
        const regex = new RegExp(pattern.source, 'gi'); // Use global flag for matchAll
        const matches = [...text.matchAll(regex)];
        
        for (const match of matches) {
            const name = match[1] || match[0];
            const normalizedName = name.toLowerCase().trim();
            const entityId = `${type}:${normalizedName}`;

            if (!entities.has(entityId)) {
                entities.set(entityId, {
                    id: entityId,
                    name: normalizedName,
                    type: type as Entity['type'],
                    properties: { firstSeenIn: articleId }
                });
            }
        }
    }

    static extractEntities(text: string, articleId: string): Map<string, Entity> {
        const entities = new Map<string, Entity>();

        for (const [type, patterns] of Object.entries(ENTITY_PATTERNS)) {
            for (const pattern of patterns) {
                this.processPatternMatches(text, type, pattern, articleId, entities);
            }
        }

        return entities;
    }

    static async storeEntities(entities: Map<string, Entity>): Promise<void> {
        for (const entity of entities.values()) {
            await query(
                `INSERT INTO knowledge_entities (id, name, entity_type, properties)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, properties = knowledge_entities.properties || EXCLUDED.properties`,
                [entity.id, entity.name, entity.type, JSON.stringify(entity.properties)]
            );
        }
    }

    // ── Relationship Extraction ──────────────────────────────────────────────

    private static processRelationshipPair(a: Entity, b: Entity, articleId: string, rels: Relationship[]) {
        if (a.type !== b.type) {
            rels.push({
                sourceEntityId: a.id,
                targetEntityId: b.id,
                relationType: 'co_occurs_with',
                articleId,
                properties: { coOccurrence: true }
            });
            rels.push({
                sourceEntityId: b.id,
                targetEntityId: a.id,
                relationType: 'co_occurs_with',
                articleId,
                properties: { coOccurrence: true }
            });
        }
    }

    static extractRelationships(entities: Map<string, Entity>, articleId: string): Relationship[] {
        const rels: Relationship[] = [];
        const entityList = Array.from(entities.values());

        for (let i = 0; i < entityList.length; i++) {
            for (let j = i + 1; j < entityList.length; j++) {
                this.processRelationshipPair(entityList[i], entityList[j], articleId, rels);
            }
        }

        return rels;
    }

    static async storeRelationships(relationships: Relationship[], sourceContent: string): Promise<void> {
        for (const rel of relationships) {
            const inserted = await query(
                `INSERT INTO knowledge_relationships (source_id, target_id, relation_type, article_id, properties, source_content_hash)
                 SELECT $1, $2, $3, id, $5, encode(sha256(convert_to($6::text, 'UTF8')), 'hex')
                 FROM knowledge_articles WHERE id = $4 AND content = $6
                 ON CONFLICT (source_id, target_id, relation_type, article_id) DO UPDATE SET
                     properties = EXCLUDED.properties, source_content_hash = EXCLUDED.source_content_hash`,
                [rel.sourceEntityId, rel.targetEntityId, rel.relationType, rel.articleId, JSON.stringify(rel.properties), sourceContent]
            );
            if (inserted.rowCount !== 1) throw new Error(`Article ${rel.articleId} changed during graph indexing`);
        }
    }

    // ── Graph Traversal ──────────────────────────────────────────────────────

    private static toEntity(row: Record<string, unknown>): Entity {
        return {
            id: String(row.id),
            name: String(row.name),
            type: String(row.entity_type) as Entity['type'],
            properties: (row.properties as Record<string, unknown>) || {},
        };
    }

    private static async fetchEntityAndRelated(normalizedName: string, entityId?: string): Promise<{ entityRow: Record<string, unknown>; relatedRows: Record<string, unknown>[] } | null> {
        let eId = entityId;
        let entityRow: Record<string, unknown> | null = null;

        if (!eId) {
            const { rows: entities } = await query(
                "SELECT id, name, entity_type, properties FROM knowledge_entities WHERE name = $1 LIMIT 1",
                [normalizedName]
            );
            if (entities.length === 0) return null;
            entityRow = entities[0] as Record<string, unknown>;
            eId = entityRow.id as string;
        }

        const { rows: related } = await query(
            `SELECT e.id, e.name, e.entity_type, e.properties, r.relation_type
             FROM knowledge_relationships r
             JOIN knowledge_entities e ON (e.id = r.target_id)
             JOIN knowledge_articles a ON a.id = r.article_id
             WHERE r.source_id = $1 AND r.relation_type = 'co_occurs_with'
               AND r.source_content_hash = a.content_hash
             LIMIT 10`,
            [eId]
        );

        return { entityRow: entityRow as Record<string, unknown>, relatedRows: related };
    }

    static async getRelatedEntities(entityName: string, maxDepth: number = 2): Promise<Entity[]> {
        const visited = new Set<string>();
        const results: Entity[] = [];

        const traverse = async (name: string, depth: number) => {
            if (depth > maxDepth || visited.size > 20) return;
            const normalizedName = name.toLowerCase().trim();

            const data = await this.fetchEntityAndRelated(normalizedName);
            if (!data) return;

            const { entityRow, relatedRows } = data;
            const entityId = String(entityRow.id);

            if (visited.has(entityId)) return;
            visited.add(entityId);
            results.push(this.toEntity(entityRow));

            for (const rel of relatedRows) {
                const relId = String(rel.id);
                if (!visited.has(relId)) {
                    const entity = this.toEntity(rel);
                    entity.properties.viaRelation = String(rel.relation_type);
                    results.push(entity);
                    visited.add(relId);
                }
            }
        };

        await traverse(entityName, 0);
        return results;
    }

    // ── Chunk-Level Search ───────────────────────────────────────────────────

    static async searchChunks(queryText: string, limit: number = 10, filters: { category?: string; crop?: string } = {}): Promise<RankedResult[]> {
        try {
            return await this.searchChunksByEmbedding(await getEmbedding(queryText), limit, filters);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('[RAGv2] Chunk search failed:', errorMessage);
            return [];
        }
    }

    /** Nearest current chunks (derived from the article's present content). Throws on database errors. */
    static async searchChunksByEmbedding(embedding: number[], limit: number, filters: { category?: string; crop?: string } = {}): Promise<RankedResult[]> {
        // Over-fetch from the index, then drop chunks of stale or filtered-out
        // articles: the HNSW scan returns nearest rows before the join filters.
        // 40 is pgvector's default hnsw.ef_search, the most one index scan returns.
        const { rows } = await query(
            `SELECT nearest.id, nearest.article_id, nearest.content, nearest.chunk_index, nearest.score,
                    a.title, a.category, a.source, a.source_url, a.crops, a.tags, a.regions, a.updated_at
             FROM (
                SELECT c.id, c.article_id, c.content, c.chunk_index, c.source_content_hash,
                       1 - (${cosineDistance('c.embedding', 1)}) AS score
                FROM knowledge_chunks c
                WHERE ${embeddingWidthPredicate('c.embedding')}
                ORDER BY ${cosineDistance('c.embedding', 1)}
                LIMIT LEAST($2::int * 4, 40)
             ) nearest
             JOIN knowledge_articles a ON a.id = nearest.article_id
             WHERE nearest.source_content_hash = a.content_hash
               AND ($3::text IS NULL OR a.category = $3)
               AND ($4::text IS NULL OR $4 = ANY(a.crops))
             ORDER BY nearest.score DESC
             LIMIT $2::int`,
            [toVectorLiteral(embedding), limit, filters.category ?? null, filters.crop ?? null]
        );

        return rows.map((row: Record<string, unknown>) => {
            const score = Number.parseFloat(String(row.score));
            return {
                id: String(row.id),
                articleId: String(row.article_id),
                content: String(row.content),
                metadata: {
                    title: row.title,
                    category: row.category,
                    source: row.source,
                    sourceUrl: row.source_url,
                    crops: row.crops,
                    tags: row.tags,
                    regions: row.regions,
                    updatedAt: row.updated_at,
                    chunkIndex: row.chunk_index,
                    retrieval: { vectorSimilarity: score } satisfies RetrievalSignals,
                },
                score,
                citation: `${row.title} (${row.category})`
            };
        });
    }

    // ── Re-ranking ───────────────────────────────────────────────────────────

    /**
     * Reorder results by reranker relevance (0-1). Results the reranker did not
     * score keep their order after the scored ones; if reranking fails
     * entirely, the incoming order is kept.
     */
    static async rerank(queryText: string, results: RankedResult[], topK: number = 5): Promise<RankedResult[]> {
        if (results.length <= 1) return results;
        try {
            const outcome = await scoreCandidates(queryText, results.map(result => ({
                title: typeof result.metadata.title === 'string' ? result.metadata.title : undefined,
                content: result.content,
            })));
            return orderByRerank(results, outcome.scores).slice(0, topK).map(({ item, score }) => score === undefined ? item : {
                ...item,
                rerankScore: score,
                metadata: {
                    ...item.metadata,
                    retrieval: { ...retrievalSignals(item), rerankScore: score, rerankedBy: outcome.by } satisfies RetrievalSignals,
                },
            });
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.warn(`[RAGv2] Re-ranking failed, using original order: ${errorMessage}`);
            return results.slice(0, topK);
        }
    }

    // ── Full RAG v2 Pipeline ─────────────────────────────────────────────────

    /**
     * Candidate passages for a question: article vectors, article full text and
     * chunk vectors (plus an English-translation vector leg when supplied),
     * fused with RRF. One embedding per phrasing; a failing leg is logged and
     * skipped, and only the failure of every leg throws.
     */
    static async retrieveCandidates(
        queryText: string,
        options: { limit?: number; filters?: { category?: string; crop?: string }; useChunks?: boolean; englishQuery?: string } = {}
    ): Promise<RankedResult[]> {
        const { limit = 15, filters = {}, useChunks = true, englishQuery } = options;
        const { VectorService } = await import('./vectorService');
        const depth = Math.max(limit, 10);
        const embeddingFor = (text: string) => getEmbedding(normalizeAgronomicQuery(text));

        const embedding = embeddingFor(queryText);
        const legs: Array<Promise<RankedLeg>> = [
            embedding.then(vector => VectorService.searchByEmbedding(vector, depth, filters, 0))
                .then(results => ({ leg: 'vector', results })),
            VectorService.keywordSearch(englishQuery || queryText, depth, filters)
                .then(results => ({ leg: 'keyword', results })),
        ];
        if (useChunks) {
            legs.push(embedding.then(vector => this.searchChunksByEmbedding(vector, depth, filters))
                // Half weight: the chunk leg shares the article leg's embedding, so
                // the two are correlated evidence, not independent votes.
                .then(chunks => ({ leg: 'chunk', results: chunks.map(chunkAsArticleHit), weight: 0.5 })));
        }
        if (englishQuery && englishQuery !== queryText) {
            legs.push(embeddingFor(englishQuery)
                .then(vector => VectorService.searchByEmbedding(vector, depth, filters, 0))
                .then(results => ({ leg: 'translated_vector', results })));
        }

        const settled = await Promise.allSettled(legs);
        const succeeded = settled.flatMap(outcome => outcome.status === 'fulfilled' ? [outcome.value] : []);
        settled.forEach(outcome => {
            if (outcome.status === 'rejected') logger.warn('[RAGv2] Retrieval leg failed:', outcome.reason);
        });
        if (succeeded.length === 0) throw new Error('Every retrieval leg failed');

        return fuseRankedLegs(succeeded, limit, { preferContentFrom: 'chunk' }).map(hit => ({
            id: hit.id,
            articleId: hit.id,
            content: hit.content,
            metadata: hit.metadata,
            score: hit.score,
            citation: `${hit.metadata.title} (${hit.metadata.category})`,
        }));
    }

    private static async buildGraphContext(queryText: string): Promise<string> {
        try {
            const queryEntities = this.extractEntities(queryText, '');
            const relatedContexts: string[] = [];

            for (const entity of queryEntities.values()) {
                const related = await this.getRelatedEntities(entity.name, 1);
                if (related.length > 0) {
                    const relations = related
                        .filter(r => r.id !== entity.id)
                        .map(r => {
                            const viaRelation = r.properties?.viaRelation;
                            const relationStr = viaRelation ? ', ' + viaRelation : '';
                            return `${r.name} (${r.type}${relationStr})`;
                        })
                        .slice(0, 5);
                    if (relations.length > 0) {
                        relatedContexts.push(`Related to "${entity.name}": ${relations.join(', ')}`);
                    }
                }
            }

            if (relatedContexts.length > 0) {
                return `Entity co-occurrences in articles (not verified relationships or recommendations):\n${relatedContexts.join('\n')}`;
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.warn(`[RAGv2] Graph enrichment failed: ${errorMessage}`);
        }
        return '';
    }

    static async enhancedSearch(
        queryText: string,
        options: {
            limit?: number;
            useChunks?: boolean;
            useGraph?: boolean;
            useReranking?: boolean;
            filters?: { category?: string; crop?: string };
        } = {}
    ): Promise<{ results: RankedResult[]; graphContext: string; citations: Citation[] }> {
        const { limit = 5, useChunks = true, useGraph = true, useReranking = true, filters = {} } = options;

        let results = await this.retrieveCandidates(queryText, { limit: limit * 3, useChunks, filters });

        let graphContext = '';
        if (useGraph) {
            graphContext = await this.buildGraphContext(queryText);
        }

        if (useReranking && results.length > 1) {
            results = await this.rerank(queryText, results, limit);
        } else {
            results = results.slice(0, limit);
        }

        const citations: Citation[] = results.map(r => ({
            sourceId: r.articleId,
            title: String(r.metadata.title || 'Unknown'),
            category: String(r.metadata.category || 'General'),
            excerpt: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
            score: r.rerankScore ?? r.score
        }));

        return { results, graphContext, citations };
    }

    // ── Build Knowledge Graph from All Articles ──────────────────────────────

    static async buildKnowledgeGraph(): Promise<{ entities: number; relationships: number }> {
        const { rows } = await query("SELECT id, content FROM knowledge_articles");

        let totalEntities = 0;
        let totalRels = 0;

        for (const row of rows) {
            const entities = this.extractEntities(row.content, row.id);
            await this.storeEntities(entities);
            totalEntities += entities.size;

            const relationships = this.extractRelationships(entities, row.id);
            await this.storeRelationships(relationships, row.content);
            totalRels += relationships.length;
        }

        logger.info(`[RAGv2] Knowledge graph built: ${totalEntities} entities, ${totalRels} relationships`);
        return { entities: totalEntities, relationships: totalRels };
    }

    // ── Full Bootstrap ───────────────────────────────────────────────────────

    static async bootstrap(): Promise<void> {
        logger.info('[RAGv2] Starting full bootstrap...');
        await this.initializeSchema();
        // Vector and full-text indexes are owned by migration 20261121090000_rag_retrieval_indexes.
        const chunkResult = await this.chunkAllArticles();

        const graphResult = await this.buildKnowledgeGraph();
        logger.info(`[RAGv2] Bootstrap complete: ${chunkResult.chunks} chunks, ${graphResult.entities} entities, ${graphResult.relationships} relationships`);
    }
}

/** A chunk hit keyed by its article, so fusion merges it with that article's other hits. */
function chunkAsArticleHit(chunk: RankedResult): SearchResult {
    return { id: chunk.articleId, content: chunk.content, metadata: chunk.metadata, score: chunk.score };
}

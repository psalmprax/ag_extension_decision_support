/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * RAG v2 Service — Chunking + Knowledge Graph + Re-ranking + Citations
 *
 * Upgrades the basic vector search into a production-grade RAG pipeline:
 * 1. Chunking: Long articles split into overlapping chunks for precise retrieval
 * 2. Knowledge Graph: Entity extraction + relationship traversal for multi-hop reasoning
 * 3. Re-ranking: LLM-based relevance scoring after initial retrieval
 * 4. Citations: Source attribution in every answer
 */

import { query } from '@/services/databaseService';
import { getEmbedding } from '@/services/embeddingCache';
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { logger } from '@/utils/logger';

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
    properties: Record<string, any>;
}

export interface Relationship {
    sourceEntityId: string;
    targetEntityId: string;
    relationType: string; // e.g., 'treats', 'affects', 'grows_in', 'requires'
    properties: Record<string, any>;
}

export interface RankedResult {
    id: string;
    articleId: string;
    content: string;
    metadata: Record<string, any>;
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
    crop: [
        /\b(maize|corn|rice|cassava|yam|plantain|banana|cocoa|coffee|cotton|groundnut|peanut|sorghum|millet|bean|cowpea|soybean|sugarcane|oil\s*palm|sweet\s*potato|potato|tomato|onion|wheat|barley|oat|rye|chickpea|lentil|pigeon\s*pea|mango|avocado|citrus|pineapple|papaya|cashew|sesame|sunflower|canola|rapeseed)\b/gi
    ],
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

// ─── Chunking ────────────────────────────────────────────────────────────────

function chunkText(text: string, chunkSize: number = 800, overlap: number = 150): string[] {
    if (!text || text.trim().length === 0) return [];
    if (text.length <= chunkSize) return [text.trim()];

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
        let end = Math.min(start + chunkSize, text.length);
        // Break at word boundary
        if (end < text.length) {
            const lastSpace = text.substring(start, end).lastIndexOf(' ');
            if (lastSpace > chunkSize * 0.7) end = start + lastSpace;
        }
        const chunk = text.substring(start, end).trim();
        if (chunk.length > 50) chunks.push(chunk);
        start = end - overlap;
        if (start >= text.length) break;
    }

    return chunks;
}

// ─── RAG V2 Service ──────────────────────────────────────────────────────────

export class RAGV2Service {

    // ── Schema Initialization ────────────────────────────────────────────────

    static async initializeSchema(): Promise<void> {
        try {
            await query(`
                CREATE TABLE IF NOT EXISTS knowledge_chunks (
                    id TEXT PRIMARY KEY,
                    article_id TEXT NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
                    chunk_index INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    embedding vector(768),
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_chunks_article ON knowledge_chunks(article_id);
                -- IVFFlat index created after data is loaded (requires non-empty table)

                CREATE TABLE IF NOT EXISTS knowledge_entities (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    properties JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_entities_type ON knowledge_entities(entity_type);
                CREATE INDEX IF NOT EXISTS idx_entities_name ON knowledge_entities USING gin(to_tsvector('english', name));

                CREATE TABLE IF NOT EXISTS knowledge_relationships (
                    id SERIAL PRIMARY KEY,
                    source_id TEXT NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
                    target_id TEXT NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
                    relation_type TEXT NOT NULL,
                    article_id TEXT REFERENCES knowledge_articles(id) ON DELETE CASCADE,
                    properties JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(source_id, target_id, relation_type, article_id)
                );
                CREATE INDEX IF NOT EXISTS idx_rel_source ON knowledge_relationships(source_id);
                CREATE INDEX IF NOT EXISTS idx_rel_target ON knowledge_relationships(target_id);
                CREATE INDEX IF NOT EXISTS idx_rel_type ON knowledge_relationships(relation_type);
            `);
            logger.info('[RAGv2] Schema initialized');
        } catch (error: any) {
            logger.error('[RAGv2] Schema init error:', error.message);
        }
    }

    // ── Chunking ─────────────────────────────────────────────────────────────

    static async chunkAndEmbedArticle(articleId: string, content: string, metadata: Record<string, any>): Promise<number> {
        const chunks = chunkText(content, 800, 150);
        if (chunks.length === 0) return 0;

        // Delete existing chunks for this article
        await query('DELETE FROM knowledge_chunks WHERE article_id = $1', [articleId]);

        let embedded = 0;
        for (let i = 0; i < chunks.length; i++) {
            try {
                const embedding = await getEmbedding(chunks[i]);
                const vector = `[${embedding.join(',')}]`;
                await query(
                    `INSERT INTO knowledge_chunks (id, article_id, chunk_index, content, embedding)
                     VALUES ($1, $2, $3, $4, $5::vector)
                     ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
                    [`${articleId}-chunk-${i}`, articleId, i, chunks[i], vector]
                );
                embedded++;
            } catch (err: any) {
                logger.warn(`[RAGv2] Failed to embed chunk ${i} of article ${articleId}: ${err.message}`);
            }
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

    static extractEntities(text: string, articleId: string): Map<string, Entity> {
        const entities = new Map<string, Entity>();

        for (const [type, patterns] of Object.entries(ENTITY_PATTERNS)) {
            for (const pattern of patterns) {
                const regex = new RegExp(pattern.source, pattern.flags);
                let match;
                while ((match = regex.exec(text)) !== null) {
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

    static extractRelationships(entities: Map<string, Entity>, articleId: string): Relationship[] {
        const rels: Relationship[] = [];
        const entityList = Array.from(entities.values());

        // Co-occurrence based relationships within the same article
        for (let i = 0; i < entityList.length; i++) {
            for (let j = i + 1; j < entityList.length; j++) {
                const a = entityList[i];
                const b = entityList[j];

                // Infer relationship type from entity types
                const relType = this.inferRelationType(a.type, b.type);
                if (relType) {
                    rels.push({
                        sourceEntityId: a.id,
                        targetEntityId: b.id,
                        relationType: relType,
                        articleId,
                        properties: { coOccurrence: true }
                    });
                    // Also add reverse
                    const reverseRel = this.inferRelationType(b.type, a.type);
                    if (reverseRel) {
                        rels.push({
                            sourceEntityId: b.id,
                            targetEntityId: a.id,
                            relationType: reverseRel,
                            articleId,
                            properties: { coOccurrence: true }
                        });
                    }
                }
            }
        }

        return rels;
    }

    private static inferRelationType(sourceType: string, targetType: string): string | null {
        const key = `${sourceType}->${targetType}`;
        const map: Record<string, string> = {
            'crop->disease': 'affected_by',
            'disease->crop': 'affects',
            'crop->soil': 'grows_in',
            'soil->crop': 'suitable_for',
            'crop->nutrient': 'requires',
            'nutrient->crop': 'needed_by',
            'crop->practice': 'managed_by',
            'practice->crop': 'applies_to',
            'crop->region': 'grown_in',
            'region->crop': 'grows',
            'disease->practice': 'treated_by',
            'practice->disease': 'treats',
            'disease->nutrient': 'related_to',
            'nutrient->disease': 'related_to',
        };
        return map[key] || null;
    }

    static async storeRelationships(relationships: Relationship[]): Promise<void> {
        for (const rel of relationships) {
            try {
                await query(
                    `INSERT INTO knowledge_relationships (source_id, target_id, relation_type, article_id, properties)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT DO NOTHING`,
                    [rel.sourceEntityId, rel.targetEntityId, rel.relationType, rel.articleId, JSON.stringify(rel.properties)]
                );
            } catch (err: any) {
                // Ignore duplicate key errors
                if (!err.message?.includes('duplicate key')) {
                    logger.warn(`[RAGv2] Failed to store relationship: ${err.message}`);
                }
            }
        }
    }

    // ── Graph Traversal ──────────────────────────────────────────────────────

    static async getRelatedEntities(entityName: string, maxDepth: number = 2): Promise<Entity[]> {
        const visited = new Set<string>();
        const results: Entity[] = [];

        const traverse = async (name: string, depth: number) => {
            if (depth > maxDepth || visited.size > 20) return;
            const normalizedName = name.toLowerCase().trim();

            // Find entity by name
            const { rows: entities } = await query(
                "SELECT id, name, entity_type, properties FROM knowledge_entities WHERE name ILIKE $1 LIMIT 1",
                [`%${normalizedName}%`]
            );
            if (entities.length === 0) return;

            const entityId = entities[0].id;
            if (visited.has(entityId)) return;
            visited.add(entityId);
            results.push(entities[0]);

            // Find related entities
            const { rows: related } = await query(
                `SELECT e.id, e.name, e.entity_type, e.properties, r.relation_type
                 FROM knowledge_relationships r
                 JOIN knowledge_entities e ON (e.id = r.target_id)
                 WHERE r.source_id = $1
                 LIMIT 10`,
                [entityId]
            );

            for (const rel of related) {
                if (!visited.has(rel.id)) {
                    results.push({ ...rel, properties: { ...rel.properties, viaRelation: rel.relation_type } });
                    visited.add(rel.id);
                }
            }
        };

        await traverse(entityName, 0);
        return results;
    }

    // ── Chunk-Level Search ───────────────────────────────────────────────────

    static async searchChunks(queryText: string, limit: number = 10): Promise<RankedResult[]> {
        try {
            const embedding = await getEmbedding(queryText);
            const vector = `[${embedding.join(',')}]`;

            const { rows } = await query(
                `SELECT c.id, c.article_id, c.content, c.chunk_index,
                        a.title, a.category, a.source, a.source_url, a.crops,
                        (1 - (c.embedding <=> $1::vector)) as score
                 FROM knowledge_chunks c
                 JOIN knowledge_articles a ON a.id::text = c.article_id
                 WHERE c.embedding IS NOT NULL
                 ORDER BY c.embedding <=> $1::vector
                 LIMIT $2`,
                [vector, limit]
            );

            return rows.map((row: any) => ({
                id: row.id,
                articleId: row.article_id,
                content: row.content,
                metadata: {
                    title: row.title,
                    category: row.category,
                    source: row.source,
                    sourceUrl: row.source_url,
                    crops: row.crops,
                    chunkIndex: row.chunk_index
                },
                score: Number.parseFloat(row.score),
                citation: `${row.title} (${row.category})`
            }));
        } catch (error: any) {
            logger.error('[RAGv2] Chunk search failed:', error.message);
            return [];
        }
    }

    // ── Re-ranking ───────────────────────────────────────────────────────────

    static async rerank(queryText: string, results: RankedResult[], topK: number = 5): Promise<RankedResult[]> {
        if (results.length <= 1) return results;

        // Take top 15 from initial retrieval for re-ranking
        const candidates = results.slice(0, 15);
        const passages = candidates.map((r, i) => `[${i}] ${r.content.substring(0, 300)}`).join('\n\n');

        try {
            const prompt = `You are a relevance scorer. Given the query and passages below, score each passage's relevance from 0-10.
Return ONLY a JSON array of objects: [{"idx": 0, "score": 8}, {"idx": 1, "score": 3}, ...]

Query: "${queryText}"

Passages:
${passages}

JSON scores:`;

            const result = await AIRouter.routeRequest('generate', {
                prompt,
                options: { temperature: 0, maxTokens: 500 }
            });

            const text = typeof result === 'string' ? result : result?.text || '';
            const jsonMatch = text.match(/\[[\s\S]*?\]/);
            if (jsonMatch) {
                const scores = JSON.parse(jsonMatch[0]);
                for (const item of scores) {
                    if (candidates[item.idx]) {
                        candidates[item.idx].rerankScore = item.score / 10;
                    }
                }
                // Sort by rerank score, fall back to original score
                candidates.sort((a, b) => (b.rerankScore ?? b.score) - (a.rerankScore ?? a.score));
            }
        } catch (err: any) {
            logger.warn(`[RAGv2] Re-ranking failed, using original order: ${err.message}`);
        }

        return candidates.slice(0, topK);
    }

    // ── Full RAG v2 Pipeline ─────────────────────────────────────────────────

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

        // 1. Initial retrieval — chunk-level or article-level
        let results: RankedResult[];
        if (useChunks) {
            results = await this.searchChunks(queryText, limit * 3);
        } else {
            // Fall back to article-level search (existing VectorService)
            const { VectorService } = await import('./vectorService');
            const articleResults = await VectorService.hybridSearch(queryText, limit * 3, filters);
            results = articleResults.map(r => ({
                id: r.id,
                articleId: r.id,
                content: r.content,
                metadata: r.metadata,
                score: r.score,
                citation: `${r.metadata.title} (${r.metadata.category})`
            }));
        }

        // 2. Knowledge graph context enrichment
        let graphContext = '';
        if (useGraph) {
            try {
                // Extract entities from the query
                const queryEntities = this.extractEntities(queryText, '');
                const relatedContexts: string[] = [];

                for (const entity of queryEntities.values()) {
                    const related = await this.getRelatedEntities(entity.name, 1);
                    if (related.length > 0) {
                        const relations = related
                            .filter(r => r.id !== entity.id)
                            .map(r => `${r.name} (${r.entity_type}${r.properties?.viaRelation ? ', ' + r.properties.viaRelation : ''})`)
                            .slice(0, 5);
                        if (relations.length > 0) {
                            relatedContexts.push(`Related to "${entity.name}": ${relations.join(', ')}`);
                        }
                    }
                }

                if (relatedContexts.length > 0) {
                    graphContext = `Knowledge Graph Context:\n${relatedContexts.join('\n')}`;
                }
            } catch (err: any) {
                logger.warn(`[RAGv2] Graph enrichment failed: ${err.message}`);
            }
        }

        // 3. Re-ranking
        if (useReranking && results.length > 1) {
            results = await this.rerank(queryText, results, limit);
        } else {
            results = results.slice(0, limit);
        }

        // 4. Build citations
        const citations: Citation[] = results.map(r => ({
            sourceId: r.articleId,
            title: r.metadata.title || 'Unknown',
            category: r.metadata.category || 'General',
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
            await this.storeRelationships(relationships);
            totalRels += relationships.length;
        }

        logger.info(`[RAGv2] Knowledge graph built: ${totalEntities} entities, ${totalRels} relationships`);
        return { entities: totalEntities, relationships: totalRels };
    }

    // ── Full Bootstrap ───────────────────────────────────────────────────────

    static async bootstrap(): Promise<void> {
        logger.info('[RAGv2] Starting full bootstrap...');
        await this.initializeSchema();
        const chunkResult = await this.chunkAllArticles();

        // Create IVFFlat index after data is loaded (requires non-empty table)
        if (chunkResult.chunks > 0) {
            try {
                await query(`CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10)`);
            } catch (err: any) {
                // Index may already exist
            }
        }

        const graphResult = await this.buildKnowledgeGraph();
        logger.info(`[RAGv2] Bootstrap complete: ${chunkResult.chunks} chunks, ${graphResult.entities} entities, ${graphResult.relationships} relationships`);
    }
}

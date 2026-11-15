/**
 * Width of the pgvector embedding columns (knowledge_articles, knowledge_chunks,
 * search_cache). Leaf module with no imports so providers can depend on it
 * without a cycle through the AI router.
 */
export const EMBEDDING_DIMENSIONS = Number.parseInt(process.env.EMBEDDING_DIMENSIONS || '768', 10);
